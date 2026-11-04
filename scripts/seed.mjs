import { createClient } from '@libsql/client';
import { randomBytes, randomUUID, scryptSync } from 'node:crypto';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

const client = createClient({ url: url.startsWith('file:') ? url : `file:${url}` });

function hashPassword(password) {
	const salt = randomBytes(16).toString('base64url');
	const hash = scryptSync(password, salt, 32).toString('base64url');
	return `${salt}:${hash}`;
}

function isoDate(date) {
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${date.getFullYear()}-${month}-${day}`;
}

function eachDay(year, monthIndex) {
	const count = new Date(year, monthIndex + 1, 0).getDate();
	return Array.from({ length: count }, (_, index) => new Date(year, monthIndex, index + 1));
}

const existing = await client.execute("SELECT id FROM users WHERE login = 'swiss'");
if (existing.rows.length > 0) {
	await client.execute("UPDATE users SET admin = 1 WHERE login = 'swiss'");
	console.log('Le compte swiss existe déjà. Aucun nouveau jeton. Admin confirmé.');
	client.close();
	process.exit(0);
}

const now = new Date();
const activeFrom = isoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1));
const interneUntil = isoDate(new Date(now.getFullYear(), now.getMonth(), 15));
const token = randomBytes(18).toString('base64url');

const roster = [
	{
		login: 'swiss',
		displayName: 'Admin',
		roles: '["medecin_certif"]',
		activeUntil: null,
		password: token
	},
	{
		login: 'medecin-1',
		displayName: 'Médecin 1',
		roles: '["medecin_certif"]',
		activeUntil: null,
		password: randomBytes(18).toString('base64url')
	},
	{
		login: 'medecin-2',
		displayName: 'Médecin 2',
		roles: '["medecin"]',
		activeUntil: null,
		password: randomBytes(18).toString('base64url')
	},
	{
		login: 'interne-1',
		displayName: 'Interne 1',
		roles: '["interne"]',
		activeUntil: interneUntil,
		password: randomBytes(18).toString('base64url')
	}
].map((person) => ({ ...person, id: randomUUID() }));

const byLogin = new Map(roster.map((person) => [person.login, person]));
const doctors = ['swiss', 'medecin-1', 'medecin-2'];
const shifts = [];
const seen = new Set();

function isActive(person, date) {
	if (date < activeFrom) return false;
	if (person.activeUntil && date > person.activeUntil) return false;
	return true;
}

function assign(login, date, period) {
	let person = byLogin.get(login);
	if (!person || !isActive(person, date)) {
		person = doctors.map((name) => byLogin.get(name)).find((item) => item && isActive(item, date));
	}
	if (!person) return;
	const key = `${person.id}|${date}|${period}`;
	if (seen.has(key)) return;
	seen.add(key);
	shifts.push({ id: randomUUID(), userId: person.id, date, period });
}

for (const delta of [-1, 0, 1]) {
	const cursor = new Date(now.getFullYear(), now.getMonth() + delta, 1);
	for (const date of eachDay(cursor.getFullYear(), cursor.getMonth())) {
		const day = date.getDate();
		const iso = isoDate(date);
		if (day !== 7 && day !== 21) assign(doctors[day % 3], iso, 'matin');
		if (day !== 11) assign(day <= 15 ? 'interne-1' : doctors[(day + 1) % 3], iso, 'apres_midi');
	}
}

const tx = await client.transaction('write');
try {
	for (const person of roster) {
		await tx.execute({
			sql: `INSERT INTO users (id, login, password_hash, display_name, roles, email, admin, active_from, active_until)
			      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			args: [
				person.id,
				person.login,
				hashPassword(person.password),
				person.displayName,
				person.roles,
				null,
				person.login === 'swiss' ? 1 : 0,
				activeFrom,
				person.activeUntil
			]
		});
	}
	for (const shift of shifts) {
		await tx.execute({
			sql: `INSERT INTO planning_entries (id, user_id, date, period) VALUES (?, ?, ?, ?)`,
			args: [shift.id, shift.userId, shift.date, shift.period]
		});
	}
	await tx.commit();
} catch (error) {
	await tx.rollback();
	throw error;
}

client.close();
console.log('Compte admin créé');
console.log(`login: swiss`);
console.log(`token: ${token}`);
