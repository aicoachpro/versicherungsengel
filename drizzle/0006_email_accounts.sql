CREATE TABLE IF NOT EXISTS `email_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`imap_host` text NOT NULL,
	`imap_port` integer NOT NULL DEFAULT 993,
	`use_ssl` integer NOT NULL DEFAULT 1,
	`username` text NOT NULL,
	`password` text NOT NULL,
	`folder` text NOT NULL DEFAULT 'INBOX',
	`active` integer NOT NULL DEFAULT 1,
	`last_polled_at` text,
	`created_at` text NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS `inbound_emails` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`message_id` text NOT NULL,
	`from_address` text NOT NULL,
	`from_name` text,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`html_body` text,
	`received_at` text NOT NULL,
	`processed_at` text,
	`lead_id` integer,
	`status` text NOT NULL DEFAULT 'pending',
	`error_message` text,
	`created_at` text NOT NULL DEFAULT (datetime('now'))
);
