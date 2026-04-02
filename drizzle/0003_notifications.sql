CREATE TABLE IF NOT EXISTS `notifications` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `type` text NOT NULL,
  `title` text NOT NULL,
  `message` text NOT NULL,
  `entity_id` integer,
  `read_at` text,
  `created_at` text DEFAULT (datetime('now')) NOT NULL
);
