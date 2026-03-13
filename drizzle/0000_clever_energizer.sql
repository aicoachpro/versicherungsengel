CREATE TABLE `api_keys` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_key_unique` ON `api_keys` (`key`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`firma` text NOT NULL,
	`branche` text,
	`unternehmensgroesse` text,
	`umsatzklasse` text,
	`kundenstatus` text DEFAULT 'Lead' NOT NULL,
	`haupt_ansprechpartner` text,
	`email` text,
	`telefon` text,
	`website` text,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	`updated_at` text DEFAULT '(datetime(''now''))' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `insurances` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bezeichnung` text NOT NULL,
	`customer_id` integer,
	`sparte` text,
	`versicherer` text,
	`beitrag` real,
	`zahlweise` text,
	`ablauf` text,
	`umfang` text,
	`notizen` text,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	`updated_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`customer_id` integer,
	`phase` text DEFAULT 'Termin eingegangen' NOT NULL,
	`termin` text,
	`ansprechpartner` text,
	`email` text,
	`telefon` text,
	`website` text,
	`branche` text,
	`unternehmensgroesse` text,
	`umsatzklasse` text,
	`termin_kosten` real DEFAULT 320,
	`umsatz` real,
	`conversion` integer,
	`naechster_schritt` text,
	`notizen` text,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	`updated_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);