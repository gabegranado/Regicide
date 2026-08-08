import type { CardProps, Suit } from "./types.js";

export const PLAYER_DECK_SIZE = 7;
const SUITS: Suit[] = ["diamonds", "hearts", "spades", "clubs"];

const CASTLE_ATTACK_VALUES: Record<number, number> = {
    13: 20, // king
    12: 15, // queen
    11: 10, // jack
};

const CASTLE_DEFENSE_VALUES: Record<number, number> = {
    13: 40, // king
    12: 30, // queen
    11: 20, // jack
};


export function getAttackValue(num: number): number {
    return CASTLE_ATTACK_VALUES[num] ?? num;
}

function getDefenseValue(num: number): number {
    return CASTLE_DEFENSE_VALUES[num] ?? num;
}

export function shuffleArray<T>(arr: T[]): T[] {
    const array = [...arr];
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

export function createNumberDeck(): CardProps[] {
    const deck: CardProps[] = [];

    for (const suit of SUITS) {
        for (let num = 1; num <= 10; num++) {
            deck.push({ suit, num, health: getDefenseValue(num), attack: getAttackValue(num) });
        }
    }

    return deck;
}

export function arrangeCastleDeck(num: number): CardProps[] {
    const shuffledSuits = shuffleArray(SUITS);
    const deck: CardProps[] = [];
    shuffledSuits.forEach((suit: Suit) => deck.push({
        suit: suit,
        num: num,
        health: getDefenseValue(num),
        attack: getAttackValue(num)
    }));

    return deck;
}

export function setupCastle(): CardProps[] {
    const shuffledSuitsKings = arrangeCastleDeck(13);
    const shuffledSuitsQueen = arrangeCastleDeck(12);
    const shuffledSuitsJacks = arrangeCastleDeck(11);

    return [
        ...shuffledSuitsKings,
        ...shuffledSuitsQueen,
        ...shuffledSuitsJacks];
}

export function dealPlayerHands(pileDeck: CardProps[]): { 
    player1Hand: CardProps[]; 
    player2Hand: CardProps[];
    tavernDeck: CardProps[] } {
    const pile = [...pileDeck];
    const player1Hand = pile.splice(0, PLAYER_DECK_SIZE);
    const player2Hand = pile.splice(0, PLAYER_DECK_SIZE);
    // `pile` has already had both hands spliced out of it, so whatever's left over IS the
    // tavern deck -- no further offset needed (slicing again here was double-subtracting).
    const tavernDeck = pile;

    return { player1Hand, player2Hand, tavernDeck};
}

export function createGameDeal(): {
    castleDeck: CardProps[];
    player1Hand: CardProps[]; 
    player2Hand: CardProps[];
    tavernDeck: CardProps[];
    discardDeck: CardProps[]} {
    const pileDeck = shuffleArray(createNumberDeck());
    const castleDeck = setupCastle();
    const { player1Hand, player2Hand, tavernDeck } = dealPlayerHands(pileDeck);
    const discardDeck:CardProps[] = [];

    return { castleDeck, player1Hand, player2Hand, tavernDeck, discardDeck};
}
