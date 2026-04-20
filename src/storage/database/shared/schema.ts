import { pgTable, serial, timestamp, unique, text, foreignKey, integer, jsonb, index } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"


export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updated_at: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const players = pgTable("players", {
	id: serial().primaryKey().notNull(),
	username: text().notNull(),
	password: text().notNull(),
	created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	unique("players_username_key").on(table.username),
]);

export const playerProgress = pgTable("player_progress", {
	id: serial().primaryKey().notNull(),
	player_id: integer("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
	destination_slug: text("destination_slug").notNull(),
	visited_place_ids: text("visited_place_ids").array().default([]),
	updated_at: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	unique("player_progress_player_id_destination_slug_key").on(table.player_id, table.destination_slug),
	index("player_progress_player_id_idx").on(table.player_id),
]);

export const cacheInfo = pgTable("cache_info", {
	destination_slug: text("destination_slug").primaryKey().notNull(),
	destination_name: text("destination_name").notNull(),
	info: jsonb().notNull(),
	created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const cacheAttractions = pgTable("cache_attractions", {
	destination_slug: text("destination_slug").primaryKey().notNull(),
	attractions: jsonb().notNull(),
	created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const cacheCheckins = pgTable("cache_checkins", {
	destination_slug: text("destination_slug").primaryKey().notNull(),
	checkins: jsonb().notNull(),
	created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});
