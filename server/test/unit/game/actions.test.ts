import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { playCards, discardCards, canPlayCardsForAttack, canAffordDefense } from "../../../src/game/actions.js";
import { getHandFor, getPlayedCards, getDiscardDeck, getCastleDeck } from "../../../src/game/session.js";
import { startTestGame, PLAYER1_SOCKET, PLAYER2_SOCKET } from "../../helpers/gameHarness.js";
import { makeCard } from "../../helpers/fixtures.js";

// playCards/discardCards/canPlayCardsForAttack all early-return unless a game is actually
// started (claimed + dealt), so every test here needs startTestGame(), not just resetGame().
beforeEach(() => {
    startTestGame(); // currentTurn is always "player1" right after a fresh deal
});

describe("playCards", () => {
    it("rejects a play from the socket that isn't the current turn", () => {
        assert.equal(playCards(PLAYER2_SOCKET, [0]), null);
    });

    it("rejects an unknown socket", () => {
        assert.equal(playCards("unknown", [0]), null);
    });

    it("rejects empty indices", () => {
        assert.equal(playCards(PLAYER1_SOCKET, []), null);
    });

    it("rejects an out-of-range index", () => {
        const hand = getHandFor("player1");
        assert.equal(playCards(PLAYER1_SOCKET, [hand.length]), null);
    });

    it("removes played cards from hand and accumulates them across multiple calls", () => {
        const hand = getHandFor("player1");
        hand.length = 0;
        hand.push(makeCard("hearts", 2), makeCard("clubs", 3), makeCard("spades", 4));

        const first = playCards(PLAYER1_SOCKET, [0]);
        assert.deepEqual(first, { slot: "player1", cards: [makeCard("hearts", 2)] });
        assert.equal(hand.length, 2);
        assert.deepEqual(getPlayedCards("player1"), [makeCard("hearts", 2)]);

        // Second call must ADD to the pile, not replace it -- index.ts relies on this to show
        // every card attacking this enemy so far, not just the latest action's cards.
        const second = playCards(PLAYER1_SOCKET, [0]);
        assert.deepEqual(second, { slot: "player1", cards: [makeCard("clubs", 3)] });
        assert.deepEqual(getPlayedCards("player1"), [makeCard("hearts", 2), makeCard("clubs", 3)]);
    });
});

describe("discardCards", () => {
    it("rejects a discard from the socket that isn't the current turn", () => {
        const result = discardCards(PLAYER2_SOCKET, [0]);
        assert.equal(result.ok, false);
        assert.equal(!result.ok && result.reason, "It's not your turn.");
    });

    it("rejects empty indices", () => {
        const result = discardCards(PLAYER1_SOCKET, []);
        assert.equal(result.ok, false);
        assert.equal(!result.ok && result.reason, "Select at least one card to discard.");
    });

    it("rejects an out-of-range index", () => {
        const hand = getHandFor("player1");
        const result = discardCards(PLAYER1_SOCKET, [hand.length]);
        assert.equal(result.ok, false);
        assert.equal(!result.ok && result.reason, "Invalid card selection.");
    });

    it("rejects a selection that totals below the required defense amount", () => {
        getCastleDeck()[getCastleDeck().length - 1].attack = 15;
        const hand = getHandFor("player1");
        hand.length = 0;
        hand.push(makeCard("hearts", 5));

        const result = discardCards(PLAYER1_SOCKET, [0]);
        assert.equal(result.ok, false);
        assert.equal(!result.ok && result.reason, "Discarded cards total 5, but you need at least 15 to defend against this attack.");
    });

    it("succeeds, removing cards from hand and pushing them to discard", () => {
        getCastleDeck()[getCastleDeck().length - 1].attack = 8;
        const hand = getHandFor("player1");
        hand.length = 0;
        hand.push(makeCard("hearts", 5), makeCard("spades", 3), makeCard("clubs", 9));

        const result = discardCards(PLAYER1_SOCKET, [0, 1]);
        assert.equal(result.ok, true);
        assert.ok(result.ok && result.cards.length === 2);
        assert.equal(hand.length, 1);
        assert.deepEqual(getDiscardDeck(), [makeCard("hearts", 5), makeCard("spades", 3)]);
    });
});

describe("canPlayCardsForAttack", () => {
    it("rejects a selection from the socket that isn't the current turn", () => {
        const result = canPlayCardsForAttack(PLAYER2_SOCKET, [0]);
        assert.equal(result.ok, false);
    });

    it("rejects empty indices", () => {
        const result = canPlayCardsForAttack(PLAYER1_SOCKET, []);
        assert.equal(result.ok, false);
    });

    it("rejects an out-of-range index", () => {
        const hand = getHandFor("player1");
        const result = canPlayCardsForAttack(PLAYER1_SOCKET, [hand.length]);
        assert.equal(result.ok, false);
    });

    it("rejects a face card combined with any other card", () => {
        const hand = getHandFor("player1");
        hand.length = 0;
        hand.push(makeCard("hearts", 12, { attack: 15, health: 30 }), makeCard("clubs", 2));

        const result = canPlayCardsForAttack(PLAYER1_SOCKET, [0, 1]);
        assert.equal(result.ok, false);
        assert.equal(!result.ok && result.reason, "Jacks, queens, and kings can only be played on their own, not combined with other cards.");
    });

    it("accepts a face card played alone", () => {
        const hand = getHandFor("player1");
        hand.length = 0;
        hand.push(makeCard("hearts", 12, { attack: 15, health: 30 }));

        assert.equal(canPlayCardsForAttack(PLAYER1_SOCKET, [0]).ok, true);
    });

    it("regression: accepts an ace + 9 (sums to exactly 10)", () => {
        const hand = getHandFor("player1");
        hand.length = 0;
        hand.push(makeCard("hearts", 1), makeCard("spades", 9));

        assert.equal(canPlayCardsForAttack(PLAYER1_SOCKET, [0, 1]).ok, true);
    });

    it("accepts multiple aces plus a matching rank", () => {
        const hand = getHandFor("player1");
        hand.length = 0;
        hand.push(makeCard("hearts", 1), makeCard("spades", 1), makeCard("clubs", 4), makeCard("diamonds", 4));

        assert.equal(canPlayCardsForAttack(PLAYER1_SOCKET, [0, 1, 2, 3]).ok, true);
    });

    it("rejects mismatched non-ace ranks", () => {
        const hand = getHandFor("player1");
        hand.length = 0;
        hand.push(makeCard("hearts", 3), makeCard("spades", 4));

        const result = canPlayCardsForAttack(PLAYER1_SOCKET, [0, 1]);
        assert.equal(result.ok, false);
        assert.equal(!result.ok && result.reason, "Cards must all be the same rank (aces are wild) — 3 and 4 don't match.");
    });

    it("rejects a genuinely-over-10 total", () => {
        const hand = getHandFor("player1");
        hand.length = 0;
        hand.push(makeCard("hearts", 6), makeCard("spades", 6));

        const result = canPlayCardsForAttack(PLAYER1_SOCKET, [0, 1]);
        assert.equal(result.ok, false);
        assert.equal(!result.ok && result.reason, "Selected cards add up to more than 10.");
    });
});

describe("canAffordDefense", () => {
    it("is true when the hand total exactly equals the required amount", () => {
        getCastleDeck()[getCastleDeck().length - 1].attack = 10;
        const hand = getHandFor("player1");
        hand.length = 0;
        hand.push(makeCard("hearts", 4), makeCard("spades", 6));

        assert.equal(canAffordDefense("player1"), true);
    });

    it("is true when the hand total exceeds the required amount", () => {
        getCastleDeck()[getCastleDeck().length - 1].attack = 5;
        const hand = getHandFor("player1");
        hand.length = 0;
        hand.push(makeCard("hearts", 10));

        assert.equal(canAffordDefense("player1"), true);
    });

    it("is false when the hand total falls short", () => {
        getCastleDeck()[getCastleDeck().length - 1].attack = 20;
        const hand = getHandFor("player1");
        hand.length = 0;
        hand.push(makeCard("hearts", 3));

        assert.equal(canAffordDefense("player1"), false);
    });
});
