CREATE TABLE IF NOT EXISTS `lead_providers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`lead_type` text NOT NULL DEFAULT '',
	`min_per_month` integer NOT NULL DEFAULT 10,
	`cost_per_lead` real NOT NULL DEFAULT 320,
	`billing_model` text NOT NULL DEFAULT 'prepaid',
	`carry_over` integer NOT NULL DEFAULT 1,
	`start_month` text NOT NULL DEFAULT '',
	`active` integer NOT NULL DEFAULT 1,
	`created_at` text NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE `leads` ADD COLUMN `provider_id` integer;
