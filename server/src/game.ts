import type { ActionResult, CardProps, PlayerSlot } from "./types.js";
import { createGameDeal, PLAYER_DECK_SIZE, getAttackValue, shuffleArray } from "./deckSetup.js";

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

export function playCards(socketId: string, cardIndices: number[]): { slot: PlayerSlot; cards: CardProps[] } | null {
    const slot = getSlotForSocket(socketId);
    if (slot === null || slot !== state.currentTurn) return null;
    if (cardIndices.length === 0) return null;

    const handKey = slot === "player1" ? "player1Hand" : "player2Hand";
    const hand = state[handKey];

    const uniqueIndices = [...new Set(cardIndices)];
    if (uniqueIndices.some((idx) => idx < 0 || idx >= hand.length)) return null;

    const descendingIndices = uniqueIndices.sort((a, b) => b - a);
    const cards: CardProps[] = [];
    for (const idx of descendingIndices) {
        cards.unshift(hand.splice(idx, 1)[0]);
    }

    if (slot === "player1") state.player1PlayedCards.push(...cards);
    else state.player2PlayedCards.push(...cards);

    return { slot, cards };
}

export function discardCards(socketId: string, cardIndices: number[]): ActionResult {
    const slot = getSlotForSocket(socketId);
    if (slot === null || slot !== state.currentTurn) {
        return { ok: false, reason: "It's not your turn." };
    }
    if (state.discardDeck === null) {
        return { ok: false, reason: "The game hasn't started yet." };
    }
    if (cardIndices.length === 0) {
        return { ok: false, reason: "Select at least one card to discard." };
    }

    // `hand` only ever contains cards still in the player's hand — anything already played
    // for an attack was already spliced out of this same array in playCards, so there's no
    // way for cardIndices to resolve to a card currently in play.
    const handKey = slot === "player1" ? "player1Hand" : "player2Hand";
    const hand = state[handKey];

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

    state.discardDeck.push(...cards);

    return { ok: true, slot, cards };
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

export function getHandFor(slot: PlayerSlot): CardProps[] {
    return slot === "player1" ? state.player1Hand : state.player2Hand;
}

export function getOpponentHandSize(slot: PlayerSlot): number {
    return slot === "player1" ? state.player2Hand.length : state.player1Hand.length;
}

export function getCastleDeck(): CardProps[] {
    return state.castleDeck;
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

export function getTopCastleCard():CardProps {
    return state.castleDeck[state.castleDeck.length-1];
}

export function attack(cards: CardProps[]): void {
    const clubPower = hasClubPower(cards) ? 2 : 1;
    const topCastleCard: CardProps = getTopCastleCard();
    const totalAttack = cards.reduce((sum, card) => sum + card.attack, 0);
    topCastleCard.health -= (totalAttack * clubPower);
}

export function canPlayCardsForAttack(socketId: string, cardIndices: number[]): ActionResult {
    const slot = getSlotForSocket(socketId);
    if (slot === null || slot !== state.currentTurn) {
        return { ok: false, reason: "It's not your turn." };
    }
    if (state.discardDeck === null) {
        return { ok: false, reason: "The game hasn't started yet." };
    }
    if (cardIndices.length === 0) {
        return { ok: false, reason: "Select at least one card." };
    }

    const handKey = slot === "player1" ? "player1Hand" : "player2Hand";
    const hand = state[handKey];

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

function hasClubPower(cards: CardProps[]):boolean {
    return getTopCastleCard().suit !== "clubs" &&
           cards.some((card: CardProps) => card.suit === "clubs");
}

export function applySpadePowerReduction(cards: CardProps[]): void {
    if (state.castleDeck.length === 0) return;
    const topCastleCard = getTopCastleCard();
    if (topCastleCard.suit === "spades") return;

    const reduction = cards
        .filter((card) => card.suit === "spades")
        .reduce((sum, card) => sum + card.attack, 0);

    topCastleCard.attack = Math.max(0, topCastleCard.attack - reduction);
}

export function isTopCastleCardDefeated(): boolean {
    return state.castleDeck.length > 0 && getTopCastleCard().health <= 0;
}

// Recycled jack/queen/king cards need to shed their castle-combat stats (a much higher
// attack, and possibly a health left at 0 or negative from the killing blow) before they're
// playable as a regular hand card again — a face card can reach the tavern deck two ways
// (an exact kill sends it there directly, or an overkill sends it to discard first and heart
// power can later reclaim it from there), so both paths need this same reset applied.
function resetFaceCardStats(card: CardProps): void {
    if (card.num <= 10) return;
    const resetValue = getAttackValue(card.num);
    card.health = resetValue;
    card.attack = resetValue;
}

export function resolveDefeatedCastleCard(): CardProps | null {
    if (!isTopCastleCardDefeated()) return null;
    if (state.discardDeck === null) return null;

    const defeatedCard = state.castleDeck.pop();
    if (defeatedCard === undefined) return null;
    if (defeatedCard.health === 0) {
        resetFaceCardStats(defeatedCard);
        state.tavernDeck?.push(defeatedCard);
    } else {
        state.discardDeck.push(...state.player1PlayedCards, ...state.player2PlayedCards, defeatedCard);
    }


    state.player1PlayedCards = [];
    state.player2PlayedCards = [];

    return state.castleDeck.length > 0 ? getTopCastleCard() : null;
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
    if (!state.tavernDeck) return 0;

    const [firstToDraw, secondToDraw] =
        slot === "player1"
            ? [state.player1Hand, state.player2Hand]
            : [state.player2Hand, state.player1Hand];

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

        const card = state.tavernDeck.pop();
        if (!card) break;

        target.push(card);
        drawn++;
    }

    return drawn;
}

export function hasDiamondsInPlayedCards(cards: CardProps[]): boolean {
    return cards.some((card) => card.suit === "diamonds");
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
    if (state.discardDeck === null || state.tavernDeck === null) return;

    const numCardsToDraw = numHeartsInPlay(cards);
    if (numCardsToDraw === 0) return;

    // .slice() (not .splice()) on the same shuffled array twice, so neither call mutates out
    // from under the other — splitting it this way instead of chained splices avoids losing
    // cards to a double-applied offset.
    const shuffled = shuffleArray(state.discardDeck);
    const reclaimed = shuffled.slice(0, numCardsToDraw);
    const remaining = shuffled.slice(numCardsToDraw);

    // A reclaimed face card may have been sitting in discard with stale castle-combat stats
    // (overkilled rather than exact-killed, so resolveDefeatedCastleCard never reset it) --
    // reset it now, the same as the exact-kill path does, before it re-enters circulation.
    reclaimed.forEach(resetFaceCardStats);

    state.tavernDeck = [...state.tavernDeck, ...reclaimed];
    state.discardDeck = remaining;
}

// The whole hand's total is the most a player could ever discard, so if even that falls
// short of the required amount, no selection could ever be enough — the game is lost.
export function canAffordDefense(slot: PlayerSlot): boolean {
    const requiredAmount = getTopCastleCard().attack;
    const totalHandValue = getHandFor(slot).reduce((sum, card) => sum + card.num, 0);
    return totalHandValue >= requiredAmount;
}

