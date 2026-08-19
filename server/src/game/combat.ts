import type { CardProps } from "../types.js";
import { resetFaceCardStats } from "../deckSetup.js";
import { clearPlayedCards, getCastleDeck, getDiscardDeck, getPlayedCards, getTavernDeck, getTopCastleCard, isStarted } from "./session.js";

function hasClubPower(cards: CardProps[]): boolean {
    return getTopCastleCard().suit !== "clubs" &&
           cards.some((card: CardProps) => card.suit === "clubs");
}

export function attack(cards: CardProps[]): void {
    const clubPower = hasClubPower(cards) ? 2 : 1;
    const topCastleCard: CardProps = getTopCastleCard();
    const totalAttack = cards.reduce((sum, card) => sum + card.attack, 0);
    topCastleCard.health -= (totalAttack * clubPower);
}

export function applySpadePowerReduction(cards: CardProps[]): void {
    if (getCastleDeck().length === 0) return;
    const topCastleCard = getTopCastleCard();
    if (topCastleCard.suit === "spades") return;

    const reduction = cards
        .filter((card) => card.suit === "spades")
        .reduce((sum, card) => sum + card.attack, 0);

    topCastleCard.attack = Math.max(0, topCastleCard.attack - reduction);
}

export function isTopCastleCardDefeated(): boolean {
    return getCastleDeck().length > 0 && getTopCastleCard().health <= 0;
}

export function resolveDefeatedCastleCard(): CardProps | null {
    if (!isTopCastleCardDefeated()) return null;
    if (!isStarted()) return null;

    const castleDeck = getCastleDeck();
    const defeatedCard = castleDeck.pop();
    if (defeatedCard === undefined) return null;
    if (defeatedCard.health === 0) {
        resetFaceCardStats(defeatedCard);
        getTavernDeck().push(defeatedCard);
    } else {
        getDiscardDeck().push(...getPlayedCards("player1"), ...getPlayedCards("player2"), defeatedCard);
    }

    clearPlayedCards();

    return castleDeck.length > 0 ? getTopCastleCard() : null;
}
