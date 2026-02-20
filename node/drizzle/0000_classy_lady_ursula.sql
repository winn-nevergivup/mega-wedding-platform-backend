CREATE TABLE `budget_planner` (
	`id` text PRIMARY KEY NOT NULL,
	`invitation_id` text,
	`category` text,
	`estimated_amount` integer,
	`actual_amount` integer,
	`status` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`invitation_id`) REFERENCES `invitations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `guests` (
	`id` text PRIMARY KEY NOT NULL,
	`invitation_id` text,
	`name` text,
	`group` text,
	`category` text,
	`phone` text,
	`rsvp_status` text,
	`total_bring_people` integer DEFAULT 0,
	`rsvp_at` integer,
	`meal_preference` text,
	`dietary_note` text,
	`is_sent` integer DEFAULT false,
	`message` text,
	`message_at` integer,
	`invitation_code` text,
	`checkin_status` integer DEFAULT false,
	`checkin_at` integer,
	`public_hash` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`invitation_id`) REFERENCES `invitations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`slug` text,
	`status` text,
	`theme_id` text,
	`content_json` text,
	`page_views` integer DEFAULT 0,
	`shared_link_count` integer DEFAULT 0,
	`expires_at` integer,
	`public_hash` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`theme_id`) REFERENCES `themes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `login_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`method` text,
	`ip_address` text,
	`user_agent` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`type` text,
	`title` text,
	`message` text,
	`link` text,
	`unread` integer DEFAULT true,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `partners` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`logo` text,
	`website` text,
	`is_active` integer DEFAULT true,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE TABLE `ratings` (
	`id` text PRIMARY KEY NOT NULL,
	`guest_id` text,
	`invitation_id` text,
	`score` integer,
	`comment` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`guest_id`) REFERENCES `guests`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invitation_id`) REFERENCES `invitations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `revenue_summary` (
	`id` text PRIMARY KEY NOT NULL,
	`invitation_id` text,
	`user_id` text,
	`total_amount` integer,
	`currency` text,
	`status` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`invitation_id`) REFERENCES `invitations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text,
	`value` text,
	`description` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE TABLE `system_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`action` text,
	`user_id` text,
	`ip_address` text,
	`user_agent` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `templates_message` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`title` text,
	`content` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `themes` (
	`id` text PRIMARY KEY NOT NULL,
	`theme_code` text,
	`name` text,
	`description` text,
	`preview_image` text,
	`is_active` integer DEFAULT true,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE TABLE `user_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`product_code` text,
	`package_code` text,
	`status` text,
	`started_at` integer,
	`expired_at` integer,
	`auto_renew` integer DEFAULT false,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text,
	`phone` text,
	`role` text,
	`status` text,
	`last_signed_in_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE TABLE `wedding_checklist` (
	`id` text PRIMARY KEY NOT NULL,
	`invitation_id` text,
	`name` text,
	`category` text,
	`due_date` integer,
	`description` text,
	`is_completed` integer DEFAULT false,
	`completed_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`invitation_id`) REFERENCES `invitations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `wishlist_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`wishlist_id` text,
	`guest_id` text,
	`guest_name` text,
	`status` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`wishlist_id`) REFERENCES `wishlist_gifts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`guest_id`) REFERENCES `guests`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `wishlist_gifts` (
	`id` text PRIMARY KEY NOT NULL,
	`invitation_id` text,
	`title` text,
	`description` text,
	`type` text,
	`external_link` text,
	`target_amount` integer,
	`currency` text,
	`max_claim` integer,
	`is_active` integer DEFAULT true,
	`sort_order` integer DEFAULT 0,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`invitation_id`) REFERENCES `invitations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `guests_public_hash_unique` ON `guests` (`public_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `invitations_slug_unique` ON `invitations` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `invitations_public_hash_unique` ON `invitations` (`public_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `settings_key_unique` ON `settings` (`key`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);