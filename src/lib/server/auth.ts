import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { parseRoles, type RoleCode } from '#lib/planning.ts';
import { db } from './db/index.ts';
import { passwordResets, sessions, users } from './db/schema.ts';

const SESSION_MS = 1000 * 60 * 60 * 24 * 7;
const RESET_MS = 1000 * 60 * 15;

export type PublicUser = {
	id: string;
	login: string;
	displayName: string;
	roles: RoleCode[];
	admin: boolean;
};

function hashPassword(password: string) {
	const salt = randomBytes(16).toString('base64url');
	const hash = scryptSync(password, salt, 32).toString('base64url');
	return `${salt}:${hash}`;
}

function loginFromName(name: string) {
	const base = name
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 40);
	return base || 'collaborateur';
}

export async function createCollaborator(displayName: string, activeFrom: string) {
	const name = displayName.trim().replace(/\s+/g, ' ');
	if (!name || name.length > 80) return { error: 'Indiquez un nom.' };

	const base = loginFromName(name);
	let login = base;
	for (let suffix = 2; suffix < 100; suffix += 1) {
		const [existing] = await db
			.select({ id: users.id })
			.from(users)
			.where(eq(users.login, login))
			.limit(1);
		if (!existing) break;
		login = `${base}-${suffix}`.slice(0, 48);
	}

	await db.insert(users).values({
		login,
		passwordHash: hashPassword(randomBytes(18).toString('base64url')),
		displayName: name,
		roles: JSON.stringify(['medecin']),
		email: null,
		admin: false,
		blocked: false,
		activeFrom
	});
	return { error: '' };
}

function verifyPassword(password: string, stored: string) {
	const [salt, hash] = stored.split(':');
	if (!salt || !hash) return false;
	const actual = scryptSync(password, salt, 32);
	const expected = Buffer.from(hash, 'base64url');
	if (actual.length !== expected.length) return false;
	return timingSafeEqual(actual, expected);
}

const dummyHash = hashPassword('planning-ch-dummy');

export async function authenticate(login: string, password: string): Promise<PublicUser | null> {
	const name = login.trim();
	if (!name || name.length > 200 || password.length > 200) return null;

	const [user] = await db.select().from(users).where(eq(users.login, name)).limit(1);
	const valid = verifyPassword(password, user?.passwordHash ?? dummyHash);
	if (!user || !valid || user.blocked) return null;

	return {
		id: user.id,
		login: user.login,
		displayName: user.displayName,
		roles: parseRoles(user.roles),
		admin: !!user.admin
	};
}

export async function createSession(userId: string) {
	const id = randomBytes(32).toString('base64url');
	await db.insert(sessions).values({ id, userId, expiresAt: Date.now() + SESSION_MS });
	return { id, maxAge: SESSION_MS / 1000 };
}

export async function deleteSession(id: string) {
	await db.delete(sessions).where(eq(sessions.id, id));
}

export async function getUserBySession(id: string): Promise<PublicUser | null> {
	const [row] = await db
		.select({
			expiresAt: sessions.expiresAt,
			id: users.id,
			login: users.login,
			displayName: users.displayName,
			roles: users.roles,
			admin: users.admin,
			blocked: users.blocked
		})
		.from(sessions)
		.innerJoin(users, eq(sessions.userId, users.id))
		.where(eq(sessions.id, id))
		.limit(1);

	if (!row) return null;
	if (row.expiresAt <= Date.now() || row.blocked) {
		await deleteSession(id);
		return null;
	}

	return {
		id: row.id,
		login: row.login,
		displayName: row.displayName,
		roles: parseRoles(row.roles),
		admin: !!row.admin
	};
}

export async function createPasswordReset(userId: string) {
	await db.delete(passwordResets).where(eq(passwordResets.userId, userId));
	const id = randomBytes(32).toString('base64url');
	await db.insert(passwordResets).values({
		id,
		userId,
		expiresAt: Date.now() + RESET_MS
	});
	return id;
}

export async function getPasswordReset(token: string) {
	if (!token || token.length > 200) return null;
	const [row] = await db
		.select({
			id: passwordResets.id,
			userId: passwordResets.userId,
			expiresAt: passwordResets.expiresAt,
			displayName: users.displayName,
			login: users.login,
			blocked: users.blocked
		})
		.from(passwordResets)
		.innerJoin(users, eq(passwordResets.userId, users.id))
		.where(eq(passwordResets.id, token))
		.limit(1);
	if (!row) return null;
	if (row.expiresAt <= Date.now() || row.blocked) {
		await db.delete(passwordResets).where(eq(passwordResets.id, row.id));
		return null;
	}
	return row;
}

export async function consumePasswordReset(token: string, password: string) {
	const reset = await getPasswordReset(token);
	if (!reset) return { error: 'Lien invalide ou expiré.' };
	if (password.length < 8 || password.length > 200) {
		return { error: 'Mot de passe entre 8 et 200 caractères.' };
	}

	await db
		.update(users)
		.set({ passwordHash: hashPassword(password) })
		.where(eq(users.id, reset.userId));
	await db.delete(passwordResets).where(eq(passwordResets.userId, reset.userId));
	await db.delete(sessions).where(eq(sessions.userId, reset.userId));
	return { error: '' };
}
