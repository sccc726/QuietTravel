import { relations } from "drizzle-orm/relations";
import { players, playerProgress, trips, visitJournals, playerDestinations } from "./schema";

export const playerProgressRelations = relations(playerProgress, ({one}) => ({
	player: one(players, {
		fields: [playerProgress.playerId],
		references: [players.id]
	}),
}));

export const tripsRelations = relations(trips, ({one}) => ({
	player: one(players, {
		fields: [trips.playerId],
		references: [players.id]
	}),
}));

export const visitJournalsRelations = relations(visitJournals, ({one}) => ({
	player: one(players, {
		fields: [visitJournals.playerId],
		references: [players.id]
	}),
	trip: one(trips, {
		fields: [visitJournals.tripId],
		references: [trips.id]
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
	trips: many(trips),
	visitJournals: many(visitJournals),
	playerDestinations: many(playerDestinations),
}));
