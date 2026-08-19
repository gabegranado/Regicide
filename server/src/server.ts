import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import type { ActionResult, CardPlayedPayload, GameEndedPayload, GameLostPayload, GameStartPayload, GameWonPayload, HandUpdatedPayload, OpponentDisconnectedPayload, OpponentHandUpdatedPayload, OpponentLeftPayload, OpponentReconnectedPayload, PileCountsPayload, PlayerSlot, PlayerTakenPayload, SelectCardPayload, SelectPlayerPayload, SlotClaimedPayload, TurnChangedPayload } from "./types.js";
import {
    advanceTurn,
    claimSlot,
    dealIfReady,
    resetGame,
    markSlotDisconnected,
    isStarted,
    getPendingDefense,
    setPendingDefense,
    getCastleDeck,
    getCurrentTurn,
    getHandFor,
    getOpponentHandSize,
    getSlotForSocket,
    getSocketIdForSlot,
    getPlayedCards,
    getTopCastleCard,
    getDiscardDeck,
    getTavernDeck,
} from "./game/session.js";
import { playCards, discardCards, canPlayCardsForAttack, canAffordDefense } from "./game/actions.js";
import { attack, applySpadePowerReduction, isTopCastleCardDefeated, resolveDefeatedCastleCard } from "./game/combat.js";
import { applyDiamondDrawPower, hasDiamondsInPlayedCards, applyHeartPower, numHeartsInPlay } from "./game/powers.js";

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const VALID_SLOTS: PlayerSlot[] = ["player1", "player2"];

export function startServer(port: number): Promise<{ httpServer: HttpServer; io: Server }> {
    return new Promise((resolve) => {
        const app = express();
        app.use(cors({ origin: CLIENT_ORIGIN }));
        app.get("/health", (_req, res) => {
            res.json({ status: "ok" });
        });

        const httpServer = createServer(app);
        const io = new Server(httpServer, {
            cors: { origin: CLIENT_ORIGIN },
        });

        function emitPileCounts(): void {
            const payload: PileCountsPayload = {
                castleDeckCount: getCastleDeck().length,
                discardDeckCount: getDiscardDeck().length,
                tavernDeckCount: getTavernDeck().length,
            };
            io.emit("pile-counts-updated", payload);
        }

        // Sent targeted per-socket (not broadcast) because each player needs a different number
        // — their opponent's hand size, not their own. Called after anything that changes a
        // hand's size (playing, discarding, or drawing), so it never goes stale mid-game.
        function emitHandSizes(): void {
            for (const s of VALID_SLOTS) {
                const socketId = getSocketIdForSlot(s);
                if (socketId === null) continue;

                const payload: OpponentHandUpdatedPayload = { opponentHandSize: getOpponentHandSize(s) };
                io.to(socketId).emit("opponent-hand-updated", payload);
            }
        }
        
        function advanceTurnAndNotify(): void {
            const newTurn = advanceTurn();
            if (newTurn === null) return;

            if (getHandFor(newTurn).length === 0) {
                const gameLostPayload: GameLostPayload = {
                    ok: false,
                    gameStatus: "lost",
                    reason: `${newTurn} has no cards left to attack with.`,
                };
                io.emit("game-lost", gameLostPayload);
                return;
            }

            const turnPayload: TurnChangedPayload = { turn: newTurn };
            io.emit("turn-changed", turnPayload);
        }

        io.on("connection", (socket) => {
            socket.on("select-player", ({ slot }: SelectPlayerPayload) => {
                if (!VALID_SLOTS.includes(slot)) return;

                if (!claimSlot(socket.id, slot)) {
                    const payload: PlayerTakenPayload = { slot };
                    socket.emit("player-taken", payload);
                    return;
                }

                socket.data.slot = slot;
                const claimedPayload: SlotClaimedPayload = { slot };
                socket.emit("slot-claimed", claimedPayload);

                if (dealIfReady()) {
                    const currentTurn = getCurrentTurn();
                    if (currentTurn === null) return;

                    io.emit("top-castle-card-status", { card: getTopCastleCard() });

                    for (const s of VALID_SLOTS) {
                        const socketId = getSocketIdForSlot(s);
                        if (socketId === null) continue;

                        const payload: GameStartPayload = {
                            hand: getHandFor(s),
                            castleDeck: getCastleDeck(),
                            opponentHandSize: getOpponentHandSize(s),
                            yourSlot: s,
                            currentTurn,
                        };
                        io.to(socketId).emit("game-start", payload);
                    }

                    emitPileCounts();
                } else if (isStarted()) {
                    // Reclaiming a slot in an already-running game — a refresh/reconnect, not a fresh
                    // deal. Resend this socket everything it needs to resume exactly where it left off.
                    const currentTurn = getCurrentTurn();
                    if (currentTurn === null) return;

                    const gameStartPayload: GameStartPayload = {
                        hand: getHandFor(slot),
                        castleDeck: getCastleDeck(),
                        opponentHandSize: getOpponentHandSize(slot),
                        yourSlot: slot,
                        currentTurn,
                    };
                    socket.emit("game-start", gameStartPayload);
                    socket.emit("top-castle-card-status", { card: getTopCastleCard() });

                    const player1PlayedPayload: CardPlayedPayload = { slot: "player1", cards: getPlayedCards("player1") };
                    const player2PlayedPayload: CardPlayedPayload = { slot: "player2", cards: getPlayedCards("player2") };
                    socket.emit("card-played", player1PlayedPayload);
                    socket.emit("card-played", player2PlayedPayload);

                    const pileCountsPayload: PileCountsPayload = {
                        castleDeckCount: getCastleDeck().length,
                        discardDeckCount: getDiscardDeck().length,
                        tavernDeckCount: getTavernDeck().length,
                    };
                    socket.emit("pile-counts-updated", pileCountsPayload);

                    const pendingDefense = getPendingDefense();
                    if (pendingDefense !== null && slot === currentTurn) {
                        socket.emit("defense-required", { amount: pendingDefense });
                    }

                    const reconnectedPayload: OpponentReconnectedPayload = { message: `${slot} reconnected.` };
                    socket.broadcast.emit("opponent-reconnected", reconnectedPayload);
                }
            });

            socket.on("select-played-card", ({ cardIndices }: SelectCardPayload, callback?: (response: ActionResult) => void) => {
                const validation = canPlayCardsForAttack(socket.id, cardIndices);
                if (!validation.ok) {
                    callback?.(validation);
                    return;
                }

                const result = playCards(socket.id, cardIndices);
                if (result === null) {
                    callback?.({ ok: false, reason: "Could not play those cards." });
                    return;
                }

                callback?.({ ok: true, slot: result.slot, cards: result.cards });
                emitHandSizes();

                // attack()/applySpadePowerReduction() only ever see the newly played cards (result.cards),
                // so a card already applied on an earlier round never gets re-counted. The broadcast, on the
                // other hand, sends the full accumulated pile so the client can show every card attacking
                // this enemy so far, not just the cards from this one action.
                const cardPlayedPayload: CardPlayedPayload = { slot: result.slot, cards: getPlayedCards(result.slot) };
                io.emit("card-played", cardPlayedPayload);
                if (hasDiamondsInPlayedCards(result.cards)) {
                    const drawn = applyDiamondDrawPower(result.slot, result.cards);
                    if (drawn > 0) {
                        for (const s of VALID_SLOTS) {
                            const socketId = getSocketIdForSlot(s);
                            if (socketId === null) continue;

                            const handUpdatedPayload: HandUpdatedPayload = { hand: getHandFor(s) };
                            io.to(socketId).emit("hand-updated", handUpdatedPayload);
                        }
                        emitPileCounts();
                        emitHandSizes();
                    }
                }
                if (numHeartsInPlay(result.cards) > 0) {
                    applyHeartPower(result.cards);
                    emitPileCounts();
                }

                attack(result.cards);
                applySpadePowerReduction(result.cards);

                if (isTopCastleCardDefeated()) {
                    const newTopCard = resolveDefeatedCastleCard();

                    io.emit("card-played", { slot: "player1", cards: [] });
                    io.emit("card-played", { slot: "player2", cards: [] });

                    emitPileCounts();

                    // resolveDefeatedCastleCard() only returns null here (after already confirming a
                    // card really was defeated) when the castle deck has just run out of cards —
                    // there's no next enemy to reveal, so the last card falling means the game is won.
                    if (newTopCard === null) {
                        const gameWonPayload: GameWonPayload = { ok: true, gameStatus: "won" };
                        io.emit("game-won", gameWonPayload);
                        return;
                    }

                    io.emit("top-castle-card-status", { card: newTopCard });
                    advanceTurnAndNotify();
                    return;
                }

                io.emit("top-castle-card-status", { card: getTopCastleCard() });
                if (getTopCastleCard().attack === 0) {
                    advanceTurnAndNotify();
                    return;
                }

                if (!canAffordDefense(result.slot)) {
                    const gameLostPayload: GameLostPayload = {
                        ok: false,
                        gameStatus: "lost",
                        reason: `${result.slot} doesn't have enough cards left to cover ${getTopCastleCard().attack} damage — the castle can't be defended against.`,
                    };
                    io.emit("game-lost", gameLostPayload);
                    return;
                }

                setPendingDefense(getTopCastleCard().attack);
                socket.emit("defense-required", { amount: getTopCastleCard().attack });
            });

            socket.on("defending", ({ cardIndices}: SelectCardPayload, callback?: (response: ActionResult) => void) => {
                const result = discardCards(socket.id, cardIndices);
                callback?.(result);
                if (!result.ok) return;

                setPendingDefense(null);
                emitPileCounts();
                emitHandSizes();
                advanceTurnAndNotify();
            });

            socket.on("end-game", () => {
                if (getSlotForSocket(socket.id) === null) return;

                resetGame();
                const payload: GameEndedPayload = { message: "The game was ended." };
                io.emit("game-ended", payload);
            });

            socket.on("disconnect", () => {
                const leavingSlot = getSlotForSocket(socket.id);
                if (leavingSlot === null) return;

                if (isStarted()) {
                    markSlotDisconnected(socket.id);
                    const payload: OpponentDisconnectedPayload = { message: `${leavingSlot} disconnected. Waiting for them to reconnect...` };
                    socket.broadcast.emit("opponent-disconnected", payload);
                } else {
                    resetGame();
                    const payload: OpponentLeftPayload = { message: "The other player left the game." };
                    socket.broadcast.emit("opponent-left", payload);
                }
            });
        });

        httpServer.listen(port, () => resolve({ httpServer, io }));
    });
}
