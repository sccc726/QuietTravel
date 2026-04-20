import { relations } from "drizzle-orm/relations";
import { players, playerProgress } from "./schema";

export const playerProgressRelations = relations(playerProgress, ({one}) => ({
	player: one(players, {
		fields: [playerProgress.playerId],
		references: [players.id]
	}),
}));

export const playersRelations = relations(players, ({many}) => ({
	playerProgresses: many(playerProgress),
}));