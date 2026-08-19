import type { ActionResult, CardProps, PlayerSlot } from "../types.js";
import { getCurrentTurn, getDiscardDeck, getHandFor, getPlayedCards, getSlotForSocket, getTopCastleCard, isStarted } from "./session.js";

export function playCards(socketId: string, cardIndices: number[]): { slot: PlayerSlot; cards: CardProps[] } | null {
    const slot = getSlotForSocket(socketId);
    if (slot === null || slot !== getCurrentTurn()) return null;
    if (cardIndices.length === 0) return null;

    const hand = getHandFor(slot);

    const uniqueIndices = [...new Set(cardIndices)];
    if (uniqueIndices.some((idx) => idx < 0 || idx >= hand.length)) return null;

    const descendingIndices = uniqueIndices.sort((a, b) => b - a);
    const cards: CardProps[] = [];
    for (const idx of descendingIndices) {
        cards.unshift(hand.splice(idx, 1)[0]);
    }

    getPlayedCards(slot).push(...cards);

    return { slot, cards };
}

export function discardCards(socketId: string, cardIndices: number[]): ActionResult {
    const slot = getSlotForSocket(socketId);
    if (slot === null || slot !== getCurrentTurn()) {
        return { ok: false, reason: "It's not your turn." };
    }
    if (!isStarted()) {
        return { ok: false, reason: "The game hasn't started yet." };
    }
    if (cardIndices.length === 0) {
        return { ok: false, reason: "Select at least one card to discard." };
    }

    // `hand` only ever contains cards still in the player's hand — anything already played
    // for an attack was already spliced out of this same array in playCards, so there's no
    // way for cardIndices to resolve to a card currently in play.
    const hand = getHandFor(slot);

    const uniqueIndices = [...new Set(cardIndices)];
    if (uniqueIndices.some((idx) => idx < 0 || idx >= hand.length)) {
        return { ok: false, reason: "Invalid card selection." };
    }

    const requiredAmount = getTopCastleCard().attack;
    const selectedTotal = uniqueIndices.reduce((sum, idx) => sum + hand[idx].num, 0);
    if (selectedTotal < requiredAmount) {
        return { ok: false, reason: `Discarded cards total ${selectedTotal}, but you need at least ${requiredAmount} to defend against this attack.` };
    }

    const descendingIndices = uniqueIndices.sort((a, b) => b - a);
    const cards: CardProps[] = [];
    for (const idx of descendingIndices) {
        cards.unshift(hand.splice(idx, 1)[0]);
    }

    getDiscardDeck().push(...cards);

    return { ok: true, slot, cards };
}

export function canPlayCardsForAttack(socketId: string, cardIndices: number[]): ActionResult {
    const slot = getSlotForSocket(socketId);
    if (slot === null || slot !== getCurrentTurn()) {
        return { ok: false, reason: "It's not your turn." };
    }
    if (!isStarted()) {
        return { ok: false, reason: "The game hasn't started yet." };
    }
    if (cardIndices.length === 0) {
        return { ok: false, reason: "Select at least one card." };
    }

    const hand = getHandFor(slot);

    const uniqueIndices = [...new Set(cardIndices)];
    if (uniqueIndices.some((idx) => idx < 0 || idx >= hand.length)) {
        return { ok: false, reason: "Invalid card selection." };
    }

    const selectedCards = uniqueIndices.map((idx) => hand[idx]);

    // Recycled jack/queen/king cards (num 11-13) can end up in a hand via the tavern deck.
    // They aren't number cards, so the same-rank/sum-to-10 combo rule below doesn't apply to
    // them at all — they can only ever be played solo.
    if (selectedCards.some((card) => card.num > 10)) {
        if (selectedCards.length > 1) {
            return { ok: false, reason: "Jacks, queens, and kings can only be played on their own, not combined with other cards." };
        }
        return { ok: true };
    }

    let totalCount = 0;
    let uniqueCard: CardProps | null = null;

    for (const card of selectedCards) {
        if (card.num !== 1) {
            if (!uniqueCard) uniqueCard = card;
            else if (uniqueCard.num !== card.num) {
                return { ok: false, reason: `Cards must all be the same rank (aces are wild) — ${uniqueCard.num} and ${card.num} don't match.` };
            }
        }
        totalCount += card.num;
        if (totalCount > 10) {
            return { ok: false, reason: "Selected cards add up to more than 10." };
        }
    }
    return { ok: true };
    // can use cards in pairs, triples or quads as long as they add up to ten or less
}

// The whole hand's total is the most a player could ever discard, so if even that falls
// short of the required amount, no selection could ever be enough — the game is lost.
export function canAffordDefense(slot: PlayerSlot): boolean {
    const requiredAmount = getTopCastleCard().attack;
    const totalHandValue = getHandFor(slot).reduce((sum, card) => sum + card.num, 0);
    return totalHandValue >= requiredAmount;
}
