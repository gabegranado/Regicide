import { useEffect, useState } from "react";
import type { CardProps } from "./componets/Card";
import type { PlayerSlot } from "./playerNames";
import { socket } from "./socket";

export type GameStatus = "selecting" | "reconnecting" | "waiting" | "playing" | "opponent-left" | "lost" | "won";

const RECONNECT_KEY = "regicide-slot";

interface GameStartPayload {
    hand: CardProps[];
    castleDeck: CardProps[];
    opponentHandSize: number;
    yourSlot: PlayerSlot;
    currentTurn: PlayerSlot;
}

interface SlotClaimedPayload {
    slot: PlayerSlot;
}

interface PlayerTakenPayload {
    slot: PlayerSlot;
}

interface TurnChangedPayload {
    turn: PlayerSlot;
}

interface CardPlayedPayload {
    slot: PlayerSlot;
    cards: CardProps[];
}

interface TopCastleCardStatus {
    card: CardProps
}

interface HandUpdatedPayload {
    hand: CardProps[];
}

interface OpponentHandUpdatedPayload {
    opponentHandSize: number;
}

interface DefenseRequiredPayload {
    amount: number;
}

interface GameStatusPayload {
    ok: boolean;
    gameStatus: GameStatus;
    reason: string;
}

interface PileCountsPayload {
    castleDeckCount: number;
    discardDeckCount: number;
    tavernDeckCount: number;
}

type ActionResult =
    | { ok: true; slot?: PlayerSlot; cards?: CardProps[] }
    | { ok: false; reason: string };

export function useRegicideGame() {
    const [hand, setHand] = useState<CardProps[]>([]);
    const [opponentHandSize, setOpponentHandSize] = useState(0);
    const [mySlot, setMySlot] = useState<PlayerSlot | null>(null);
    const [currentTurn, setCurrentTurn] = useState<PlayerSlot | null>(null);
    const [status, setStatus] = useState<GameStatus>(() =>
        localStorage.getItem(RECONNECT_KEY) ? "reconnecting" : "selecting"
    );
    const [opponentDisconnected, setOpponentDisconnected] = useState(false);
    const [takenSlot, setTakenSlot] = useState<PlayerSlot | null>(null);
    const [playedCards, setPlayedCards] = useState<Record<PlayerSlot, CardProps[]>>({
        player1: [],
        player2: [],
    });
    const [attackingCards, setAttackingCards] = useState<CardProps[]>([]);
    const [topCastleCard, setTopCastleCard] = useState<CardProps | null>(null);
    const [isDefending, setIsDefending] = useState<boolean>(false);
    const [castleAttackValue, setCastleAttackValue] = useState<number>(0);
    const [defendingCards, setDefendingCards] = useState<CardProps[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [pileCounts, setPileCounts] = useState<PileCountsPayload>({
        castleDeckCount: 0,
        discardDeckCount: 0,
        tavernDeckCount: 0,
    });

    useEffect(() => {
        const handleGameStart = (payload: GameStartPayload) => {
            setHand(payload.hand);
            setOpponentHandSize(payload.opponentHandSize);
            setMySlot(payload.yourSlot);
            setCurrentTurn(payload.currentTurn);
            setOpponentDisconnected(false);
            localStorage.setItem(RECONNECT_KEY, payload.yourSlot);
            setStatus("playing");
        };
        const handleSlotClaimed = (payload: SlotClaimedPayload) => {
            setTakenSlot(null);
            setMySlot(payload.slot);
            localStorage.setItem(RECONNECT_KEY, payload.slot);
            setStatus("waiting");
        };
        const handlePlayerTaken = (payload: PlayerTakenPayload) => {
            setTakenSlot(payload.slot);
            // Only relevant if *we* were the one attempting to reclaim this slot on reconnect —
            // someone else legitimately holds it, so our saved slot is stale. Drop it and fall
            // back to manual selection instead of retrying forever.
            if (localStorage.getItem(RECONNECT_KEY) === payload.slot) {
                localStorage.removeItem(RECONNECT_KEY);
                setStatus("selecting");
            }
        };
        const handleTurnChanged = (payload: TurnChangedPayload) => {
            setCurrentTurn(payload.turn);
            setIsDefending(false);
        };
        const handleCardPlayed = (payload: CardPlayedPayload) => {
            setPlayedCards((prev) => ({ ...prev, [payload.slot]: payload.cards }));
        };
        const handleOpponentLeft = () => setStatus("opponent-left");
        const handleTopCastleCardStatus = (payload: TopCastleCardStatus) => {
            console.log("PAYLOAD TEST ", payload);
            setTopCastleCard(payload.card);
        }
        const handleIsDefending = (payload: DefenseRequiredPayload) => {
            setIsDefending(true);
            setCastleAttackValue(payload.amount);
        }
        const handleHandUpdated = (payload: HandUpdatedPayload) => {
            setHand(payload.hand);
        }
        const handleGameLost = (payload: GameStatusPayload) => {
            setStatus("lost");
            setErrors((prev) => ({...prev, lost: payload.reason}));
        }
        const handleGameWon = () => {
            setStatus("won");
        }
        const handlePileCountsUpdated = (payload: PileCountsPayload) => {
            setPileCounts(payload);
        }
        const handleOpponentsHand = (payload: OpponentHandUpdatedPayload) => {
            setOpponentHandSize(payload.opponentHandSize);
        }
        const handleOpponentDisconnected = () => setOpponentDisconnected(true);
        const handleOpponentReconnected = () => setOpponentDisconnected(false);
        const handleGameEnded = () => {
            localStorage.removeItem(RECONNECT_KEY);
            setHand([]);
            setOpponentHandSize(0);
            setMySlot(null);
            setCurrentTurn(null);
            setTakenSlot(null);
            setPlayedCards({ player1: [], player2: [] });
            setAttackingCards([]);
            setTopCastleCard(null);
            setIsDefending(false);
            setCastleAttackValue(0);
            setDefendingCards([]);
            setErrors({});
            setPileCounts({ castleDeckCount: 0, discardDeckCount: 0, tavernDeckCount: 0 });
            setOpponentDisconnected(false);
            setStatus("selecting");
        }

        socket.on("game-start", handleGameStart);
        socket.on("slot-claimed", handleSlotClaimed);
        socket.on("player-taken", handlePlayerTaken);
        socket.on("turn-changed", handleTurnChanged);
        socket.on("card-played", handleCardPlayed);
        socket.on("opponent-left", handleOpponentLeft);
        socket.on("top-castle-card-status", handleTopCastleCardStatus);
        socket.on("defense-required", handleIsDefending);
        socket.on("hand-updated", handleHandUpdated);
        socket.on("game-lost", handleGameLost);
        socket.on("game-won", handleGameWon);
        socket.on("pile-counts-updated", handlePileCountsUpdated);
        socket.on("opponent-disconnected", handleOpponentDisconnected);
        socket.on("opponent-reconnected", handleOpponentReconnected);
        socket.on("game-ended", handleGameEnded);
        socket.on("opponent-hand-updated", handleOpponentsHand);

        const savedSlot = localStorage.getItem(RECONNECT_KEY) as PlayerSlot | null;
        if (savedSlot) {
            socket.emit("select-player", { slot: savedSlot });
        }

        return () => {
            socket.off("game-start", handleGameStart);
            socket.off("slot-claimed", handleSlotClaimed);
            socket.off("player-taken", handlePlayerTaken);
            socket.off("turn-changed", handleTurnChanged);
            socket.off("card-played", handleCardPlayed);
            socket.off("opponent-left", handleOpponentLeft);
            socket.off("top-castle-card-status", handleTopCastleCardStatus);
            socket.off("defense-required", handleIsDefending);
            socket.off("hand-updated", handleHandUpdated);
            socket.off("game-lost", handleGameLost);
            socket.off("game-won", handleGameWon);
            socket.off("pile-counts-updated", handlePileCountsUpdated);
            socket.off("opponent-disconnected", handleOpponentDisconnected);
            socket.off("opponent-reconnected", handleOpponentReconnected);
            socket.off("game-ended", handleGameEnded);
            socket.off("opponent-hand-updated", handleOpponentsHand);
        };
    }, []);

    const selectPlayer = (slot: PlayerSlot) => {
        socket.emit("select-player", { slot });
    };

    const handleAttack = () => {
        const cardIndices = attackingCards.map((card) => hand.indexOf(card));

        socket.emit("select-played-card", { cardIndices }, (response: ActionResult) => {
            if (!response.ok) {
                setErrors((prev) => ({ ...prev, attack: response.reason }));
                setAttackingCards([]);
                return;
            }

            setErrors((prev) => {
                const { attack, ...rest } = prev;
                return rest;
            });
            setHand((prev) => prev.filter((card) => !attackingCards.includes(card)));
            setAttackingCards([]);
        });
    };

    const handleDefend = () => {
        const cardIndices = defendingCards.map((card) => hand.indexOf(card));

        socket.emit("defending", { cardIndices }, (response: ActionResult) => {
            if (!response.ok) {
                setErrors((prev) => ({ ...prev, defend: response.reason }));
                setDefendingCards([]);
                return;
            }

            setErrors((prev) => {
                const { defend, ...rest } = prev;
                return rest;
            });
            setHand((prev) => prev.filter((card) => !defendingCards.includes(card)));
            setDefendingCards([]);
        });
    };

    const handleEndGame = () => {
        if (!window.confirm("End the game for both players?")) return;
        socket.emit("end-game");
    };

    return {
        hand,
        opponentHandSize,
        mySlot,
        currentTurn,
        status,
        opponentDisconnected,
        takenSlot,
        playedCards,
        attackingCards,
        setAttackingCards,
        topCastleCard,
        isDefending,
        castleAttackValue,
        defendingCards,
        setDefendingCards,
        errors,
        pileCounts,
        selectPlayer,
        handleAttack,
        handleDefend,
        handleEndGame,
    };
}
