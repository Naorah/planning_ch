#!/usr/bin/env bash
# Récupère la branche courante, installe / migre / reconstruit seulement si nécessaire,
# contrôle le build, puis redémarre l'instance PM2.
#
# Ordre : pull → deps → migrations DB → build → checkup → swap → PM2.
# Les migrations tournent avant le redémarrage pour que le nouveau code
# trouve déjà le schéma à jour ; en cas d’échec, l’ancienne instance reste en ligne.
set -euo pipefail

cd "$(cd "$(dirname "$0")" && pwd)"

APP_NAME="planning-ch"
REMOTE="${DEPLOY_REMOTE:-origin}"
STATE_FILE=".deploy-state"

log() {
	printf '%s\n' "$*"
}

die() {
	printf '%s\n' "$*" >&2
	exit 1
}

load_env_file() {
	local file="$1" line key value
	[[ -f "$file" ]] || return 0

	while IFS= read -r line || [[ -n "$line" ]]; do
		line="${line%$'\r'}"
		[[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
		line="${line#export }"
		key="${line%%=*}"
		value="${line#*=}"
		[[ "$line" == *"="* ]] || continue
		key="${key#"${key%%[![:space:]]*}"}"
		key="${key%"${key##*[![:space:]]}"}"
		value="${value#"${value%%[![:space:]]*}"}"
		value="${value%"${value##*[![:space:]]}"}"
		if [[ ${#value} -ge 2 && ( "$value" == \"*\" || "$value" == \'*\' ) ]]; then
			value="${value:1:${#value}-2}"
		fi
		[[ -n "$key" ]] || continue
		if [[ -z "${!key+x}" ]]; then
			export "$key=$value"
		fi
	done < "$file"
}

file_changed() {
	local pattern="$1"
	[[ -n "${changed:-}" ]] && printf '%s\n' "$changed" | grep -qE "$pattern"
}

pick_port() {
	node -e "const net=require('net'); const s=net.createServer(); s.listen(0,'127.0.0.1',()=>{process.stdout.write(String(s.address().port)); s.close();});"
}

http_status() {
	node --input-type=module -e '
		const url = process.argv[1];
		const ctrl = new AbortController();
		const timer = setTimeout(() => ctrl.abort(), 2000);
		try {
			const res = await fetch(url, { redirect: "manual", signal: ctrl.signal });
			process.stdout.write(String(res.status));
		} catch {
			process.stdout.write("000");
		} finally {
			clearTimeout(timer);
		}
	' -- "$1"
}

smoke_server() {
	local dir="$1"
	local port pid log_file status i

	[[ -s "${dir}/index.js" ]] || die "Build incomplet : ${dir}/index.js est absent."
	node --check "${dir}/index.js"

	port="$(pick_port)"
	log_file="$(mktemp)"
	log "Démarrage de contrôle sur 127.0.0.1:${port}."

	HOST=127.0.0.1 PORT="$port" node "${dir}/index.js" >"$log_file" 2>&1 &
	pid=$!
	status="000"

	for i in $(seq 1 50); do
		if ! kill -0 "$pid" 2>/dev/null; then
			break
		fi
		status="$(http_status "http://127.0.0.1:${port}/")"
		if [[ "$status" =~ ^[1-5][0-9][0-9]$ ]]; then
			break
		fi
		sleep 0.2
	done

	kill "$pid" 2>/dev/null || true
	wait "$pid" 2>/dev/null || true

	if [[ ! "$status" =~ ^[1-5][0-9][0-9]$ ]]; then
		printf '%s\n' "Journal du contrôle :" >&2
		cat "$log_file" >&2 || true
		rm -f "$log_file"
		die "Le build ne répond pas."
	fi

	rm -f "$log_file"
	log "Contrôle HTTP ${status}."
}

checkup_build() {
	local dir="$1"
	log "Contrôle du code."
	npm run check
	log "Contrôle du build (${dir})."
	smoke_server "$dir"
}

swap_build() {
	rm -rf build.prev
	if [[ -d build ]]; then
		mv build build.prev
	fi
	if ! mv build.next build; then
		if [[ -d build.prev ]]; then
			mv build.prev build
		fi
		die "Remplacement du build impossible."
	fi
	rm -rf build.prev
}

pm2_online() {
	local pid
	pid="$(pm2 pid "$APP_NAME" 2>/dev/null || true)"
	[[ -n "$pid" && "$pid" != "0" ]]
}

pm2_known() {
	pm2 jlist 2>/dev/null | node -e '
		let raw = "";
		process.stdin.on("data", (chunk) => { raw += chunk; });
		process.stdin.on("end", () => {
			const start = raw.indexOf("[");
			const end = raw.lastIndexOf("]");
			if (start === -1 || end === -1) process.exit(1);
			try {
				const list = JSON.parse(raw.slice(start, end + 1));
				process.exit(list.some((app) => app.name === process.argv[1]) ? 0 : 1);
			} catch {
				process.exit(1);
			}
		});
	' "$APP_NAME"
}

write_state() {
	printf 'commit=%s\nenv=%s\nmigrated=%s\n' "$head" "$env_hash" "$migrated_hash" > "$STATE_FILE"
}

drizzle_fingerprint() {
	node -e '
		const fs = require("node:fs");
		const path = require("node:path");
		const crypto = require("node:crypto");
		const root = "drizzle";
		if (!fs.existsSync(root)) process.exit(0);
		const files = [];
		const walk = (dir) => {
			for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
				const full = path.join(dir, entry.name);
				if (entry.isDirectory()) walk(full);
				else files.push(full);
			}
		};
		walk(root);
		files.sort();
		const hash = crypto.createHash("sha256");
		for (const file of files) {
			hash.update(file);
			hash.update("\0");
			hash.update(fs.readFileSync(file));
			hash.update("\0");
		}
		process.stdout.write(hash.digest("hex"));
	'
}

run_migrations() {
	[[ -n "${DATABASE_URL:-}" ]] || die "DATABASE_URL manquant dans .env : migrations impossibles."
	[[ -d drizzle ]] || die "Dossier drizzle/ introuvable."
	log "Migrations Drizzle (npm run db:migrate)."
	npm run db:migrate
	migrated_hash="$(drizzle_fingerprint)"
	log "Migrations à jour."
}

trap 'rm -rf build.next' EXIT

command -v git >/dev/null 2>&1 || die "git est introuvable."
command -v npm >/dev/null 2>&1 || die "npm est introuvable."
command -v node >/dev/null 2>&1 || die "node est introuvable."
command -v pm2 >/dev/null 2>&1 || die "pm2 est introuvable."
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "Ce dossier n'est pas un dépôt git."

if [[ -n "$(git status --porcelain)" ]]; then
	die "Modifications locales présentes. Déploiement interrompu."
fi

branch="$(git rev-parse --abbrev-ref HEAD)"
[[ "$branch" != "HEAD" ]] || die "HEAD est détaché. Placez-vous sur une branche."

log "Récupération de ${REMOTE}/${branch}."
git fetch "$REMOTE" "$branch"
git pull --ff-only "$REMOTE" "$branch"

head="$(git rev-parse HEAD)"
state_commit=""
state_env=""
state_migrated=""
if [[ -f "$STATE_FILE" ]]; then
	state_commit="$(sed -n 's/^commit=//p' "$STATE_FILE")"
	state_env="$(sed -n 's/^env=//p' "$STATE_FILE")"
	state_migrated="$(sed -n 's/^migrated=//p' "$STATE_FILE")"
fi

env_hash="$(node -e "const fs=require('node:fs'); const crypto=require('node:crypto'); if(!fs.existsSync('.env')) process.exit(0); process.stdout.write(crypto.createHash('sha256').update(fs.readFileSync('.env')).digest('hex'));")"
migrated_hash="$(drizzle_fingerprint)"

needs_install=0
needs_build=0
needs_migrate=0
needs_restart=0
changed=""

if [[ -z "$state_commit" ]]; then
	needs_build=1
	needs_migrate=1
elif [[ "$state_commit" != "$head" ]]; then
	if git cat-file -e "${state_commit}^{commit}" 2>/dev/null; then
		changed="$(git diff --name-only "$state_commit" "$head")"
	else
		log "Commit déployé introuvable. Installation, migrations et build complets."
		needs_install=1
		needs_build=1
		needs_migrate=1
	fi
fi

if [[ ! -d node_modules ]]; then
	needs_install=1
fi

if [[ ! -s build/index.js ]]; then
	needs_build=1
fi

if file_changed '^(package\.json|package-lock\.json)$'; then
	needs_install=1
	needs_build=1
fi

if file_changed '^(src/|static/|vite\.config\.ts$|tsconfig\.json$)'; then
	needs_build=1
fi

if file_changed '^(drizzle/|drizzle\.config\.ts$|src/lib/server/db/)'; then
	needs_migrate=1
fi

if file_changed '^src/lib/server/db/'; then
	needs_build=1
fi

if [[ -n "$migrated_hash" && "$state_migrated" != "$migrated_hash" ]]; then
	needs_migrate=1
fi

if file_changed '^ecosystem\.config\.cjs$'; then
	needs_restart=1
fi

if [[ -n "$state_commit" && "$state_env" != "$env_hash" ]]; then
	needs_restart=1
fi

load_env_file ".env"

if [[ "$needs_install" -eq 1 ]]; then
	if [[ -f package-lock.json ]]; then
		log "Dépendances modifiées. npm ci."
		npm ci
	else
		log "Dépendances modifiées. npm install."
		npm install
	fi
else
	log "Dépendances inchangées."
fi

# Migrations avant build/swap/restart : le schéma est prêt pour le nouveau code.
if [[ "$needs_migrate" -eq 1 ]]; then
	run_migrations
	needs_restart=1
else
	log "Migrations inchangées."
fi

if [[ "$needs_build" -eq 1 ]]; then
	log "Build de production."
	rm -rf build.next
	BUILD_OUT=build.next npm run build
	needs_restart=1
else
	log "Build inchangé."
fi

if ! pm2_online; then
	needs_restart=1
fi

if [[ "$needs_restart" -eq 0 ]]; then
	if [[ "$state_commit" != "$head" || "$state_migrated" != "$migrated_hash" ]]; then
		write_state
	fi
	log "Aucun redémarrage nécessaire."
	exit 0
fi

if [[ "$needs_build" -eq 1 ]]; then
	checkup_build "build.next"
	log "Remplacement du build en service."
	swap_build
else
	checkup_build "build"
fi

log "Redémarrage de ${APP_NAME}."
if pm2_known; then
	pm2 restart ecosystem.config.cjs --update-env
else
	pm2 start ecosystem.config.cjs
fi

pid="0"
for _ in $(seq 1 25); do
	pid="$(pm2 pid "$APP_NAME" 2>/dev/null || true)"
	if [[ -n "$pid" && "$pid" != "0" ]]; then
		break
	fi
	sleep 0.2
done

if [[ -z "$pid" || "$pid" == "0" ]]; then
	pm2 logs "$APP_NAME" --lines 40 --nostream || true
	die "PM2 n'a pas démarré ${APP_NAME}."
fi

pm2 save
write_state
log "Déploiement terminé (${head:0:7})."
