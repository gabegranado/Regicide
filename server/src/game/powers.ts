import type { CardProps, PlayerSlot } from "../types.js";
import { PLAYER_DECK_SIZE, resetFaceCardStats, shuffleArray } from "../deckSetup.js";
import { getDiscardDeck, getHandFor, getTavernDeck, isStarted } from "./session.js";

export function hasDiamondsInPlayedCards(cards: CardProps[]): boolean {
    return cards.some((card) => card.suit === "diamonds");
}

// Only ever looks at the cards from *this* play (not the accumulated playedCards pile) —
// same reasoning as applySpadePowerReduction: a diamond already drawn for on an earlier
// round must never trigger another draw just because it's still sitting in the pile.
export function applyDiamondDrawPower(slot: PlayerSlot, cards: CardProps[]): number {
    const totalCardsToDraw = cards.reduce((acc, card) => {
        if (card.suit === "diamonds") acc += card.attack;
        return acc;
    }, 0);
    return drawCards(slot, totalCardsToDraw);
}

function drawCards(slot: PlayerSlot, totalCardsToDraw: number): number {
    if (!isStarted()) return 0;

    const [firstToDraw, secondToDraw] =
        slot === "player1"
            ? [getHandFor("player1"), getHandFor("player2")]
            : [getHandFor("player2"), getHandFor("player1")];

    const tavernDeck = getTavernDeck();

    let drawn = 0;
    for (let i = 0; i < totalCardsToDraw; i++) {
        const preferFirst = i % 2 === 0;
        const firstHasRoom = firstToDraw.length < PLAYER_DECK_SIZE;
        const secondHasRoom = secondToDraw.length < PLAYER_DECK_SIZE;

        let target: CardProps[] | null = null;
        if (preferFirst && firstHasRoom) target = firstToDraw;
        else if (!preferFirst && secondHasRoom) target = secondToDraw;
        else if (firstHasRoom) target = firstToDraw;
        else if (secondHasRoom) target = secondToDraw;

        if (target === null) break; // both hands already at the 7-card cap

        const card = tavernDeck.pop();
        if (!card) break;

        target.push(card);
        drawn++;
    }

    return drawn;
}

// Only ever looks at the cards from *this* play (not hand/playedCards state) — same reasoning
// as applySpadePowerReduction/applyDiamondDrawPower: this must reflect hearts just played,
// not hearts still sitting unplayed in hand (which is what it was reading before).
export function numHeartsInPlay(cards: CardProps[]): number {
    return cards.reduce((acc, card) => {
        if (card.suit === "hearts") acc += card.attack;
        return acc;
    }, 0);
}

export function applyHeartPower(cards: CardProps[]): void {
    if (!isStarted()) return;

    const numCardsToDraw = numHeartsInPlay(cards);
    if (numCardsToDraw === 0) return;

    const discard = getDiscardDeck();
    const tavern = getTavernDeck();

    // .slice() (not .splice()) on the same shuffled array twice, so neither call mutates out
    // from under the other — splitting it this way instead of chained splices avoids losing
    // cards to a double-applied offset.
    const shuffled = shuffleArray(discard);
    const reclaimed = shuffled.slice(0, numCardsToDraw);
    const remaining = shuffled.slice(numCardsToDraw);

    // A reclaimed face card may have been sitting in discard with stale castle-combat stats
    // (overkilled rather than exact-killed, so resolveDefeatedCastleCard never reset it) --
    // reset it now, the same as the exact-kill path does, before it re-enters circulation.
    reclaimed.forEach(resetFaceCardStats);

    discard.length = 0;
    discard.push(...remaining);
    tavern.push(...reclaimed);
}
