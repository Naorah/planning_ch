import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable(
	'users',
	{
		id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
		login: text('login').notNull().unique(),
		passwordHash: text('password_hash').notNull(),
		displayName: text('display_name').notNull(),
		roles: text('roles').notNull().default('[]'),
		service: text('service'),
		email: text('email'),
		admin: integer('admin', { mode: 'boolean' }).notNull().default(false),
		blocked: integer('blocked', { mode: 'boolean' }).notNull().default(false),
		activeFrom: text('active_from').notNull(),
		activeUntil: text('active_until')
	},
	(table) => [uniqueIndex('users_email_unique').on(table.email)]
);

export const sessions = sqliteTable('sessions', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	expiresAt: integer('expires_at').notNull()
});

export const presencePeriods = sqliteTable(
	'presence_periods',
	{
		id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		startsOn: text('starts_on').notNull(),
		endsOn: text('ends_on').notNull()
	},
	(table) => [index('presence_user_idx').on(table.userId)]
);

export const preferences = sqliteTable(
	'preferences',
	{
		id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		effectiveFrom: text('effective_from').notNull(),
		slots: text('slots').notNull(),
		createdAt: text('created_at').notNull()
	},
	(table) => [index('preferences_user_idx').on(table.userId)]
);

export const planningEntries = sqliteTable(
	'planning_entries',
	{
		id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		date: text('date').notNull(),
		period: text('period', { enum: ['matin', 'apres_midi'] }).notNull(),
		icon: text('icon'),
		note: text('note'),
		service: text('service')
	},
	(table) => [
		uniqueIndex('planning_user_date_period').on(table.userId, table.date, table.period),
		index('planning_date_idx').on(table.date)
	]
);

export const passwordResets = sqliteTable(
	'password_resets',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		expiresAt: integer('expires_at').notNull()
	},
	(table) => [index('password_resets_user_idx').on(table.userId)]
);
