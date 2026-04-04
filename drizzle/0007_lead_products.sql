CREATE TABLE IF NOT EXISTS `lead_products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`active` integer NOT NULL DEFAULT 1,
	`sort_order` integer NOT NULL DEFAULT 0,
	`created_at` text NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS `provider_products` (
	`provider_id` integer NOT NULL,
	`product_id` integer NOT NULL
);

ALTER TABLE `leads` ADD COLUMN `assigned_to` integer;
ALTER TABLE `leads` ADD COLUMN `product_id` integer;

-- Seed 20 products
INSERT OR IGNORE INTO lead_products (name, sort_order) VALUES
('Beratung', 1),
('Betriebshaftpflicht', 2),
('Finanzierung', 3),
('Firmenrechtsschutzversicherung', 4),
('Firmenversicherung', 5),
('Flottenversicherung', 6),
('Haftpflichtversicherung', 7),
('Hausratversicherung', 8),
('Hundeversicherung', 9),
('KFZ-Versicherung', 10),
('Krankenzusatzversicherung', 11),
('Pferdeversicherung', 12),
('Rechtsschutzversicherung', 13),
('Sterbegeldversicherung', 14),
('Unfallversicherung', 15),
('Vermögensschadenhaftpflicht', 16),
('Wohngebäudeversicherung', 17),
('Zahnzusatzversicherung', 18),
('Private Krankenversicherung', 19),
('Private Pflegeversicherung', 20),
('Firmeninhaltsversicherung', 21),
('Cyberschutzversicherung', 22);
