const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;

const attempts = new Map<string, { count: number; resetAt: number }>();

function bucket(key: string) {
	const now = Date.now();
	if (attempts.size > 1000) {
		for (const [stored, value] of attempts) {
			if (value.resetAt <= now) attempts.delete(stored);
		}
	}
	const current = attempts.get(key);
	if (!current || current.resetAt <= now) {
		const fresh = { count: 0, resetAt: now + WINDOW_MS };
		attempts.set(key, fresh);
		return fresh;
	}
	return current;
}

export function clientAddress(getClientAddress: () => string) {
	try {
		return getClientAddress() || 'inconnue';
	} catch {
		return 'inconnue';
	}
}

export function loginBlocked(key: string) {
	const current = attempts.get(key);
	if (!current || current.resetAt <= Date.now()) return false;
	return current.count >= MAX_FAILURES;
}

export function recordLoginFailure(key: string) {
	bucket(key).count += 1;
}

export function clearLoginFailures(key: string) {
	attempts.delete(key);
}
