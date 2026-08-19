import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    getAttackValue,
    shuffleArray,
    createNumberDeck,
    arrangeCastleDeck,
    setupCastle,
    dealPlayerHands,
    createGameDeal,
    PLAYER_DECK_SIZE,
} from "../../src/deckSetup.js";
import type { CardProps } from "../../src/types.js";

describe("getAttackValue", () => {
    it("maps castle ranks to their fixed attack values", () => {
        assert.equal(getAttackValue(11), 10); // jack
        assert.equal(getAttackValue(12), 15); // queen
        assert.equal(getAttackValue(13), 20); // king
    });

    it("passes numbers 1-10 through unchanged", () => {
        for (let num = 1; num <= 10; num++) {
            assert.equal(getAttackValue(num), num);
        }
    });
});

describe("shuffleArray", () => {
    it("returns a permutation containing exactly the same elements", () => {
        const input = [1, 2, 3, 4, 5, 6, 7, 8];
        const result = shuffleArray(input);
        assert.deepEqual([...result].sort((a, b) => a - b), input);
    });

    it("does not mutate the input array", () => {
        const input = [1, 2, 3, 4, 5];
        const original = [...input];
        shuffleArray(input);
        assert.deepEqual(input, original);
    });

    it("produces a deterministic order when Math.random is mocked", (t) => {
        t.mock.method(Math, "random", () => 0);
        // Fisher-Yates with random() always 0 -> j is always 0, so it's a fixed
        // sequence of swaps against index 0: [1,2,3,4] -> [4,2,3,1] -> [3,2,4,1] -> [2,3,4,1]
        const result = shuffleArray([1, 2, 3, 4]);
        assert.deepEqual(result, [2, 3, 4, 1]);
    });
});

describe("createNumberDeck", () => {
    it("creates 40 cards: 4 suits x values 1-10", () => {
        const deck = createNumberDeck();
        assert.equal(deck.length, 40);

        const suits = new Set(deck.map((c) => c.suit));
        assert.deepEqual([...suits].sort(), ["clubs", "diamonds", "hearts", "spades"]);
    });

    it("gives every card health and attack equal to its own num", () => {
        for (const card of createNumberDeck()) {
            assert.equal(card.health, card.num);
            assert.equal(card.attack, card.num);
        }
    });
});

describe("arrangeCastleDeck", () => {
    it("returns 4 cards, one per suit, all sharing the given num", () => {
        const deck = arrangeCastleDeck(13);
        assert.equal(deck.length, 4);
        assert.ok(deck.every((c) => c.num === 13));

        const suits = new Set(deck.map((c) => c.suit));
        assert.deepEqual([...suits].sort(), ["clubs", "diamonds", "hearts", "spades"]);
    });

    it("uses the castle rank's attack/health values, not the raw num", () => {
        const kings = arrangeCastleDeck(13);
        assert.ok(kings.every((c) => c.attack === 20 && c.health === 40));

        const queens = arrangeCastleDeck(12);
        assert.ok(queens.every((c) => c.attack === 15 && c.health === 30));

        const jacks = arrangeCastleDeck(11);
        assert.ok(jacks.every((c) => c.attack === 10 && c.health === 20));
    });
});

describe("setupCastle", () => {
    it("returns 12 cards ordered kings, then queens, then jacks", () => {
        const castle = setupCastle();
        assert.equal(castle.length, 12);
        assert.deepEqual(castle.slice(0, 4).map((c) => c.num), [13, 13, 13, 13]);
        assert.deepEqual(castle.slice(4, 8).map((c) => c.num), [12, 12, 12, 12]);
        assert.deepEqual(castle.slice(8, 12).map((c) => c.num), [11, 11, 11, 11]);
    });
});

describe("dealPlayerHands", () => {
    it("splits 7/7 and puts the remainder in the tavern deck with no duplication or loss", () => {
        const pile = createNumberDeck(); // 40 cards
        const { player1Hand, player2Hand, tavernDeck } = dealPlayerHands(pile);

        assert.equal(player1Hand.length, PLAYER_DECK_SIZE);
        assert.equal(player2Hand.length, PLAYER_DECK_SIZE);
        assert.equal(tavernDeck.length, 40 - PLAYER_DECK_SIZE * 2);

        // Regression guard: an earlier bug double-subtracted the deal offset when computing
        // the tavern deck, silently losing cards.
        const allCards = [...player1Hand, ...player2Hand, ...tavernDeck];
        assert.equal(allCards.length, 40);
        assert.equal(new Set(allCards).size, 40); // every card is the same object exactly once
    });

    it("does not mutate the caller's original pile array", () => {
        const pile = createNumberDeck();
        const originalLength = pile.length;
        dealPlayerHands(pile);
        assert.equal(pile.length, originalLength);
    });
});

describe("createGameDeal", () => {
    it("produces a full, non-overlapping deal", () => {
        const deal = createGameDeal();

        assert.equal(deal.castleDeck.length, 12);
        assert.equal(deal.player1Hand.length, PLAYER_DECK_SIZE);
        assert.equal(deal.player2Hand.length, PLAYER_DECK_SIZE);
        assert.equal(deal.tavernDeck.length, 40 - PLAYER_DECK_SIZE * 2);
        assert.deepEqual(deal.discardDeck, []);

        const numberCards: CardProps[] = [...deal.player1Hand, ...deal.player2Hand, ...deal.tavernDeck];
        assert.equal(numberCards.length, 40);
        assert.equal(new Set(numberCards).size, 40);

        // Castle cards are a disjoint pool: none of their (suit, num) pairs should collide with
        // the 1-10 number-card pool (they're 11-13 exclusively).
        assert.ok(deal.castleDeck.every((c) => c.num >= 11));
        assert.ok(numberCards.every((c) => c.num <= 10));
    });
});
