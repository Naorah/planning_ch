declare global {
	namespace App {
		interface Locals {
			user: {
				id: string;
				login: string;
				displayName: string;
				roles: import('#lib/planning.ts').RoleCode[];
				admin: boolean;
			} | null;
		}
	}
}

export {};
