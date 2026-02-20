CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`invitation_id` text,
	`type` text,
	`r2_key` text,
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`invitation_id` text,
	`amount` integer,
	`currency` text DEFAULT 'USD',
	`status` text,
	`created_at` integer
);
