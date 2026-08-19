export type Suit = "diamonds" | "hearts" | "spades" | "clubs";

export interface CardProps {
    suit: Suit;
    num: number;
    health: number;
    attack: number;
}

export type PlayerSlot = "player1" | "player2";

export interface SelectPlayerPayload {
    slot: PlayerSlot;
}

export interface SlotClaimedPayload {
    slot: PlayerSlot;
}

export interface PlayerTakenPayload {
    slot: PlayerSlot;
}

export interface GameStartPayload {
    hand: CardProps[];
    castleDeck: CardProps[];
    opponentHandSize: number;
    yourSlot: PlayerSlot;
    currentTurn: PlayerSlot;
}

export interface TurnChangedPayload {
    turn: PlayerSlot;
}

export interface SelectCardPayload {
    cardIndices: number[];
}

export interface CardPlayedPayload {
    slot: PlayerSlot;
    cards: CardProps[];
}

export interface OpponentLeftPayload {
    message: string;
}

export interface HandUpdatedPayload {
    hand: CardProps[];
}

export interface OpponentHandUpdatedPayload {
    opponentHandSize: number;
}

export interface GameLostPayload {
    ok: false;
    gameStatus: "lost";
    reason: string;
}

export interface GameWonPayload {
    ok: true;
    gameStatus: "won";
}

export interface OpponentDisconnectedPayload {
    message: string;
}

export interface OpponentReconnectedPayload {
    message: string;
}

export interface GameEndedPayload {
    message: string;
}

export interface PileCountsPayload {
    castleDeckCount: number;
    discardDeckCount: number;
    tavernDeckCount: number;
}

export type ActionResult =
    | { ok: true; slot?: PlayerSlot; cards?: CardProps[] }
    | { ok: false; reason: string };
