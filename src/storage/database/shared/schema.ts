import { pgTable, serial, timestamp, unique, pgPolicy, text, index, foreignKey, integer, jsonb } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const players = pgTable("players", {
	id: serial().primaryKey().notNull(),
	username: text().notNull(),
	password: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	unique("players_username_key").on(table.username),
	pgPolicy("players_允许公开写入", { as: "permissive", for: "insert", to: ["public"], withCheck: sql`true`  }),
	pgPolicy("players_允许公开删除", { as: "permissive", for: "delete", to: ["public"] }),
	pgPolicy("players_允许公开更新", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("players_允许公开读取", { as: "permissive", for: "select", to: ["public"] }),
]);

export const playerProgress = pgTable("player_progress", {
	id: serial().primaryKey().notNull(),
	playerId: integer("player_id").notNull(),
	destinationSlug: text("destination_slug").notNull(),
	visitedPlaceIds: text("visited_place_ids").array().default([""]),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	totalPlaces: integer("total_places").default(0),
	touringState: jsonb("touring_state"),
}, (table) => [
	index("player_progress_player_id_idx").using("btree", table.playerId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.playerId],
			foreignColumns: [players.id],
			name: "player_progress_player_id_players_id_fk"
		}).onDelete("cascade"),
	unique("player_progress_player_id_destination_slug_key").on(table.playerId, table.destinationSlug),
	pgPolicy("player_progress_允许公开写入", { as: "permissive", for: "insert", to: ["public"], withCheck: sql`true`  }),
	pgPolicy("player_progress_允许公开删除", { as: "permissive", for: "delete", to: ["public"] }),
	pgPolicy("player_progress_允许公开更新", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("player_progress_允许公开读取", { as: "permissive", for: "select", to: ["public"] }),
]);

export const cacheAttractions = pgTable("cache_attractions", {
	destinationSlug: text("destination_slug").primaryKey().notNull(),
	attractions: jsonb().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	pgPolicy("cache_attractions_允许公开写入", { as: "permissive", for: "insert", to: ["public"], withCheck: sql`true`  }),
	pgPolicy("cache_attractions_允许公开删除", { as: "permissive", for: "delete", to: ["public"] }),
	pgPolicy("cache_attractions_允许公开更新", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("cache_attractions_允许公开读取", { as: "permissive", for: "select", to: ["public"] }),
]);

export const cacheCheckins = pgTable("cache_checkins", {
	destinationSlug: text("destination_slug").primaryKey().notNull(),
	checkins: jsonb().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	pgPolicy("cache_checkins_允许公开写入", { as: "permissive", for: "insert", to: ["public"], withCheck: sql`true`  }),
	pgPolicy("cache_checkins_允许公开删除", { as: "permissive", for: "delete", to: ["public"] }),
	pgPolicy("cache_checkins_允许公开更新", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("cache_checkins_允许公开读取", { as: "permissive", for: "select", to: ["public"] }),
]);

export const cacheInfo = pgTable("cache_info", {
	destinationSlug: text("destination_slug").primaryKey().notNull(),
	destinationName: text("destination_name").notNull(),
	info: jsonb().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	pgPolicy("cache_info_允许公开写入", { as: "permissive", for: "insert", to: ["public"], withCheck: sql`true`  }),
	pgPolicy("cache_info_允许公开删除", { as: "permissive", for: "delete", to: ["public"] }),
	pgPolicy("cache_info_允许公开更新", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("cache_info_允许公开读取", { as: "permissive", for: "select", to: ["public"] }),
]);
