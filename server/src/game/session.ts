import type { CardProps, PlayerSlot } from "../types.js";
import { createGameDeal } from "../deckSetup.js";

interface GameState {
    player1SocketId: string | null;
    player2SocketId: string | null;
    castleDeck: CardProps[];
    player1Hand: CardProps[];
    player2Hand: CardProps[];
    started: boolean;
    currentTurn: PlayerSlot | null;
    player1PlayedCards: CardProps[];
    player2PlayedCards: CardProps[];
    tavernDeck: CardProps[] | null;
    discardDeck: CardProps[] | null;
    pendingDefense: number | null;
}

const state: GameState = {
    player1SocketId: null,
    player2SocketId: null,
    castleDeck: [],
    player1Hand: [],
    player2Hand: [],
    started: false,
    currentTurn: null,
    player1PlayedCards: [],
    player2PlayedCards: [],
    tavernDeck: null,
    discardDeck: null,
    pendingDefense: null
};

export function claimSlot(socketId: string, slot: PlayerSlot): boolean {
    const key = slot === "player1" ? "player1SocketId" : "player2SocketId";

    if (state[key] !== null && state[key] !== socketId) return false;

    state[key] = socketId;
    return true;
}

export function dealIfReady(): boolean {
    if (state.started) return false;
    if (state.player1SocketId === null || state.player2SocketId === null) return false;

    const deal = createGameDeal();
    state.castleDeck = deal.castleDeck;
    state.player1Hand = deal.player1Hand;
    state.player2Hand = deal.player2Hand;
    state.tavernDeck = deal.tavernDeck;
    state.discardDeck = deal.discardDeck;
    state.started = true;
    state.currentTurn = "player1";
    return true;
}

export function getCurrentTurn(): PlayerSlot | null {
    return state.currentTurn;
}

export function advanceTurn(): PlayerSlot | null {
    if (state.currentTurn === null) return null;
    state.currentTurn = state.currentTurn === "player1" ? "player2" : "player1";
    return state.currentTurn;
}

export function getDiscardDeck(): CardProps[] {
    return state.discardDeck ?? [];
}

export function getTavernDeck(): CardProps[] {
    return state.tavernDeck ?? [];
}

export function getPlayedCards(slot: PlayerSlot): CardProps[] {
    return slot === "player1" ? state.player1PlayedCards : state.player2PlayedCards;
}

// Wholesale reassignment (not in-place mutation) is deliberate here: server.ts captures
// getPlayedCards(slot) into an emit payload immediately before this can run, and Socket.IO's
// packet encoding isn't guaranteed synchronous -- truncating the live array in place would risk
// mutating an array object already captured for that emit. Reassigning to a fresh [] leaves any
// already-captured reference's contents untouched regardless of encoding timing.
export function clearPlayedCards(): void {
    state.player1PlayedCards = [];
    state.player2PlayedCards = [];
}

export function getHandFor(slot: PlayerSlot): CardProps[] {
    return slot === "player1" ? state.player1Hand : state.player2Hand;
}

export function getOpponentHandSize(slot: PlayerSlot): number {
    return slot === "player1" ? state.player2Hand.length : state.player1Hand.length;
}

export function getCastleDeck(): CardProps[] {
    return state.castleDeck;
}

export function getTopCastleCard(): CardProps {
    return state.castleDeck[state.castleDeck.length - 1];
}

export function getSlotForSocket(socketId: string): PlayerSlot | null {
    if (state.player1SocketId === socketId) return "player1";
    if (state.player2SocketId === socketId) return "player2";
    return null;
}

export function getSocketIdForSlot(slot: PlayerSlot): string | null {
    return slot === "player1" ? state.player1SocketId : state.player2SocketId;
}

export function isStarted(): boolean {
    return state.started;
}

// Explicit reset used by the "end game" action and by lobby-phase disconnects (nothing worth
// preserving yet) — wipes everything back to a clean, unclaimed slate.
export function resetGame(): void {
    state.player1SocketId = null;
    state.player2SocketId = null;
    state.castleDeck = [];
    state.player1Hand = [];
    state.player2Hand = [];
    state.started = false;
    state.currentTurn = null;
    state.player1PlayedCards = [];
    state.player2PlayedCards = [];
    state.tavernDeck = null;
    state.discardDeck = null;
    state.pendingDefense = null;
}

// Called on disconnect mid-game (tab close/refresh) — only releases this socket's ownership of
// its slot so the same browser can reclaim it later via claimSlot(). Every other piece of game
// state (hands, castle deck, whose turn it is) is left untouched so the game can resume exactly
// where it left off once that player reconnects.
export function markSlotDisconnected(socketId: string): PlayerSlot | null {
    if (state.player1SocketId === socketId) {
        state.player1SocketId = null;
        return "player1";
    }
    if (state.player2SocketId === socketId) {
        state.player2SocketId = null;
        return "player2";
    }
    return null;
}

export function getPendingDefense(): number | null {
    return state.pendingDefense;
}

export function setPendingDefense(amount: number | null): void {
    state.pendingDefense = amount;
}
