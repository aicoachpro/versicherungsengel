CREATE TABLE IF NOT EXISTS `provision_imports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`filename` text NOT NULL,
	`import_date` text NOT NULL,
	`total_rows` integer NOT NULL DEFAULT 0,
	`total_betrag` real NOT NULL DEFAULT 0,
	`matched_rows` integer NOT NULL DEFAULT 0,
	`unmatched_rows` integer NOT NULL DEFAULT 0,
	`created_at` text NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS `provisions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`import_id` integer NOT NULL,
	`buchungs_datum` text NOT NULL,
	`vers_nehmer` text NOT NULL,
	`bsz` text,
	`vers_nummer` text,
	`datev_konto` text,
	`konto_name` text,
	`buchungstext` text,
	`erfolgs_datum` text,
	`vtnr` text,
	`prov_basis` real NOT NULL DEFAULT 0,
	`prov_satz` real NOT NULL DEFAULT 0,
	`betrag` real NOT NULL DEFAULT 0,
	`lead_id` integer,
	`match_confidence` real,
	`created_at` text NOT NULL DEFAULT (datetime('now'))
);
