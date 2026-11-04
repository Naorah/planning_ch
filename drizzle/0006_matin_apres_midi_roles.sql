ALTER TABLE `users` ADD `roles` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
UPDATE `users` SET `roles` = '["interne"]' WHERE lower(trim(`role`)) = 'interne';
--> statement-breakpoint
UPDATE `users` SET `roles` = '["medecin"]' WHERE lower(trim(`role`)) IN ('medecin', 'médecin');
--> statement-breakpoint
UPDATE `users` SET `roles` = '["medecin_certif"]' WHERE lower(trim(`role`)) LIKE '%certif%';
--> statement-breakpoint
UPDATE `users` SET `roles` = '[]' WHERE lower(trim(`role`)) = 'admin';
--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `role`;
--> statement-breakpoint
UPDATE `planning_entries` SET `period` = 'matin' WHERE `period` = 'jour';
--> statement-breakpoint
UPDATE `planning_entries` SET `period` = 'apres_midi' WHERE `period` = 'nuit';
--> statement-breakpoint
UPDATE `preferences` SET `slots` = REPLACE(REPLACE(`slots`, '-jour', '-matin'), '-nuit', '-apres_midi');
