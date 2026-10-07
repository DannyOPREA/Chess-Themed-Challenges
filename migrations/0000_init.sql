CREATE TABLE `accusations` (
	`accuser_id` integer NOT NULL,
	`accused_id` integer NOT NULL,
	`challenge` integer NOT NULL,
	PRIMARY KEY(`accuser_id`, `accused_id`),
	FOREIGN KEY (`accuser_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`accused_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "accusations_not_self" CHECK(accuser_id <> accused_id),
	CONSTRAINT "accusations_challenge_valid" CHECK(challenge between 1 and 20)
);
--> statement-breakpoint
CREATE INDEX `accusations_accused_idx` ON `accusations` (`accused_id`);--> statement-breakpoint
CREATE TABLE `game` (
	`id` integer PRIMARY KEY NOT NULL,
	`phase` text DEFAULT 'lobby' NOT NULL,
	CONSTRAINT "game_single_row" CHECK(id = 1),
	CONSTRAINT "game_phase_valid" CHECK(phase in ('lobby', 'game_on', 'accusations_closed', 'reveal'))
);
--> statement-breakpoint
CREATE TABLE `players` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`pin_hash` text NOT NULL,
	`pin_salt` text NOT NULL,
	`challenge` integer,
	`decoy` integer,
	`completed` integer DEFAULT false NOT NULL,
	`joined_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "players_challenge_valid" CHECK(challenge between 1 and 20),
	CONSTRAINT "players_decoy_valid" CHECK(decoy between 1 and 20),
	CONSTRAINT "players_assigned_together" CHECK((challenge is null) = (decoy is null)),
	CONSTRAINT "players_completed_when_assigned" CHECK(completed = 0 or challenge is not null)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `players_name_key_unique` ON `players` (`name_key`);