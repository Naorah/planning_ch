const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;

function readEnvFile(file) {
	if (!fs.existsSync(file)) return {};

	const env = {};
	const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);

	for (const raw of lines) {
		const line = raw.trim();
		if (!line || line.startsWith('#')) continue;

		const body = line.startsWith('export ') ? line.slice(7).trim() : line;
		const eq = body.indexOf('=');
		if (eq === -1) continue;

		const key = body.slice(0, eq).trim();
		let value = body.slice(eq + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		if (key) env[key] = value;
	}

	return env;
}

const fileEnv = readEnvFile(path.join(root, '.env'));

const env = {
	NODE_ENV: 'production',
	HOST: '127.0.0.1',
	PORT: '3000',
	PROTOCOL_HEADER: 'x-forwarded-proto',
	HOST_HEADER: 'x-forwarded-host',
	ADDRESS_HEADER: 'x-real-ip',
	...fileEnv
};

if (process.env.DATABASE_URL) env.DATABASE_URL = process.env.DATABASE_URL;
env.NODE_ENV = 'production';
env.HOST = '127.0.0.1';
env.PORT = '3344';
env.PROTOCOL_HEADER = 'x-forwarded-proto';
env.HOST_HEADER = 'x-forwarded-host';
env.ADDRESS_HEADER = 'x-real-ip';

module.exports = {
	apps: [
		{
			name: 'planning-ch',
			cwd: root,
			script: 'build/index.js',
			interpreter: 'node',
			// Une seule instance : la base SQLite ne supporte pas plusieurs écrivains.
			instances: 1,
			exec_mode: 'fork',
			autorestart: true,
			watch: false,
			max_memory_restart: '512M',
			kill_timeout: 5000,
			env
		}
	]
};
