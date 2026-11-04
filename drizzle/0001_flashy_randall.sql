CREATE TABLE `preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`effective_from` text NOT NULL,
	`slots` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
