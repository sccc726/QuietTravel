import { relations } from "drizzle-orm/relations";
import { players, playerProgress, visitJournals, playerDestinations } from "./schema";

export const playerProgressRelations = relations(playerProgress, ({one}) => ({
	player: one(players, {
		fields: [playerProgress.playerId],
		references: [players.id]
	}),
}));

export const visitJournalsRelations = relations(visitJournals, ({one}) => ({
	player: one(players, {
		fields: [visitJournals.playerId],
		references: [players.id]
	}),
}));

export const playerDestinationsRelations = relations(playerDestinations, ({one}) => ({
	player: one(players, {
		fields: [playerDestinations.playerId],
		references: [players.id]
	}),
}));

export const playersRelations = relations(players, ({many}) => ({
	playerProgresses: many(playerProgress),
	visitJournals: many(visitJournals),
	playerDestinations: many(playerDestinations),
}));
