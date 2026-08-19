import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { attack, applySpadePowerReduction, isTopCastleCardDefeated, resolveDefeatedCastleCard } from "../../../src/game/combat.js";
import { getTopCastleCard, getCastleDeck, getPlayedCards, getDiscardDeck, getTavernDeck, resetGame } from "../../../src/game/session.js";
import { startTestGame } from "../../helpers/gameHarness.js";
import { makeCard } from "../../helpers/fixtures.js";

beforeEach(() => {
    startTestGame();
});

describe("attack", () => {
    it("reduces the top castle card's health by the summed attack of the played cards", () => {
        const top = getCastleDeck()[getCastleDeck().length - 1];
        top.suit = "hearts";
        top.health = 50;

        attack([makeCard("spades", 4), makeCard("diamonds", 3)]);
        assert.equal(top.health, 43);
    });

    it("doubles total damage when a club card attacks a non-club top card", () => {
        const top = getCastleDeck()[getCastleDeck().length - 1];
        top.suit = "hearts";
        top.health = 50;

        attack([makeCard("clubs", 5)]);
        assert.equal(top.health, 40); // 5 * 2 = 10 damage
    });

    it("does NOT double when a club card attacks a club-suited top card (self-immunity)", () => {
        const top = getCastleDeck()[getCastleDeck().length - 1];
        top.suit = "clubs";
        top.health = 50;

        attack([makeCard("clubs", 5)]);
        assert.equal(top.health, 45); // plain 5 damage, not doubled
    });
});

describe("applySpadePowerReduction", () => {
    it("reduces the top castle card's attack by the summed attack of spade cards played", () => {
        const top = getCastleDeck()[getCastleDeck().length - 1];
        top.suit = "hearts";
        top.attack = 10;

        applySpadePowerReduction([makeCard("spades", 4), makeCard("spades", 3)]);
        assert.equal(top.attack, 3);
    });

    it("floors the reduction at 0 instead of going negative", () => {
        const top = getCastleDeck()[getCastleDeck().length - 1];
        top.suit = "hearts";
        top.attack = 5;

        applySpadePowerReduction([makeCard("spades", 20)]);
        assert.equal(top.attack, 0);
    });

    it("is a no-op when the castle deck is empty", () => {
        resetGame();
        assert.doesNotThrow(() => applySpadePowerReduction([makeCard("spades", 5)]));
    });

    it("is a no-op when the top castle card is itself spades", () => {
        const top = getCastleDeck()[getCastleDeck().length - 1];
        top.suit = "spades";
        top.attack = 10;

        applySpadePowerReduction([makeCard("spades", 5)]);
        assert.equal(top.attack, 10);
    });
});

describe("isTopCastleCardDefeated", () => {
    it("is false when the castle deck is empty", () => {
        resetGame();
        assert.equal(isTopCastleCardDefeated(), false);
    });

    it("is false when health is above 0", () => {
        getCastleDeck()[getCastleDeck().length - 1].health = 1;
        assert.equal(isTopCastleCardDefeated(), false);
    });

    it("is true when health is 0 or below", () => {
        getCastleDeck()[getCastleDeck().length - 1].health = 0;
        assert.equal(isTopCastleCardDefeated(), true);

        getCastleDeck()[getCastleDeck().length - 1].health = -5;
        assert.equal(isTopCastleCardDefeated(), true);
    });
});

describe("resolveDefeatedCastleCard", () => {
    it("returns null and changes nothing when the top card isn't actually defeated", () => {
        const castleDeck = getCastleDeck();
        castleDeck[castleDeck.length - 1].health = 5;
        const lengthBefore = castleDeck.length;

        assert.equal(resolveDefeatedCastleCard(), null);
        assert.equal(castleDeck.length, lengthBefore);
    });

    it("exact-kill path: resets a defeated face card's stats and sends it to the tavern deck, clearing played piles", () => {
        const castleDeck = getCastleDeck();
        const filler = makeCard("spades", 5);
        const staleQueen = makeCard("hearts", 12, { attack: 3, health: 0 }); // exact-killed, stale stats
        castleDeck.length = 0;
        castleDeck.push(filler, staleQueen);

        getPlayedCards("player1").push(makeCard("clubs", 2));
        getPlayedCards("player2").push(makeCard("diamonds", 3));

        const result = resolveDefeatedCastleCard();

        assert.deepEqual(result, filler); // new top card revealed
        assert.equal(castleDeck.length, 1);
        assert.deepEqual(getPlayedCards("player1"), []);
        assert.deepEqual(getPlayedCards("player2"), []);

        const reclaimed = getTavernDeck().find((c) => c.suit === "hearts" && c.num === 12);
        assert.ok(reclaimed, "the defeated queen should be in the tavern deck");
        // resetFaceCardStats() should have restored the queen's stats to 15/15, not left the
        // stale 3/0 it died with.
        assert.equal(reclaimed!.attack, 15);
        assert.equal(reclaimed!.health, 15);
    });

    it("returns null (the win signal) when defeating the very last castle card", () => {
        const castleDeck = getCastleDeck();
        castleDeck.length = 0;
        castleDeck.push(makeCard("hearts", 12, { attack: 3, health: 0 }));

        const result = resolveDefeatedCastleCard();

        assert.equal(result, null);
        assert.equal(castleDeck.length, 0);
    });

    it("overkill path: sends the card and both played piles to discard, WITHOUT resetting stats", () => {
        const castleDeck = getCastleDeck();
        const filler = makeCard("spades", 5);
        const overkilledQueen = makeCard("hearts", 12, { attack: 3, health: -10 }); // overkilled
        castleDeck.length = 0;
        castleDeck.push(filler, overkilledQueen);

        const p1Card = makeCard("clubs", 2);
        const p2Card = makeCard("diamonds", 3);
        getPlayedCards("player1").push(p1Card);
        getPlayedCards("player2").push(p2Card);

        const result = resolveDefeatedCastleCard();

        assert.deepEqual(result, filler);
        assert.deepEqual(getPlayedCards("player1"), []);
        assert.deepEqual(getPlayedCards("player2"), []);
        assert.deepEqual(getDiscardDeck(), [p1Card, p2Card, overkilledQueen]);

        // Deliberately NOT reset here -- only reset on exact-kill, or later on heart-power
        // reclaim from discard.
        assert.equal(overkilledQueen.attack, 3);
        assert.equal(overkilledQueen.health, -10);
        assert.equal(getTavernDeck().some((c) => c.suit === "hearts" && c.num === 12), false);
    });
});

describe("getTopCastleCard", () => {
    it("returns the last element of the castle deck", () => {
        const castleDeck = getCastleDeck();
        const top = makeCard("clubs", 7);
        castleDeck.push(top);
        assert.deepEqual(getTopCastleCard(), top);
    });
});
