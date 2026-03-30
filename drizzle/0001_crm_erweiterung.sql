-- VOE-30: CRM-Erweiterung — Aktivitäten, Archiv, Dokumente
-- archivedAt-Feld für Lead-Archivierung
ALTER TABLE `leads` ADD `archived_at` text;
--> statement-breakpoint
-- Aktivitäten-Log
CREATE TABLE `activities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lead_id` integer NOT NULL,
	`datum` text NOT NULL,
	`kontaktart` text NOT NULL,
	`notiz` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
-- Dokumente
CREATE TABLE `documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lead_id` integer NOT NULL,
	`name` text NOT NULL,
	`dateipfad` text NOT NULL,
	`typ` text DEFAULT 'Sonstiges' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action
);
