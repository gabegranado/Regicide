import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
    claimSlot,
    dealIfReady,
    getCurrentTurn,
    advanceTurn,
    getSlotForSocket,
    getSocketIdForSlot,
    isStarted,
    resetGame,
    markSlotDisconnected,
    getPendingDefense,
    setPendingDefense,
    getHandFor,
    getCastleDeck,
    getDiscardDeck,
    getTavernDeck,
    getPlayedCards,
    getOpponentHandSize,
} from "../../../src/game/session.js";

// Only resetGame() belongs here -- markSlotDisconnected() is a feature under test below, not
// an isolation primitive (it deliberately leaves hands/deck/turn untouched by design).
beforeEach(() => {
    resetGame();
});

describe("claimSlot", () => {
    it("succeeds on first claim", () => {
        assert.equal(claimSlot("s1", "player1"), true);
    });

    it("is idempotent for the same socket re-claiming its own slot", () => {
        claimSlot("s1", "player1");
        assert.equal(claimSlot("s1", "player1"), true);
    });

    it("fails when a different socket claims an already-owned slot", () => {
        claimSlot("s1", "player1");
        assert.equal(claimSlot("s2", "player1"), false);
    });

    it("still allows the other slot to be claimed", () => {
        claimSlot("s1", "player1");
        assert.equal(claimSlot("s2", "player2"), true);
    });
});

describe("dealIfReady", () => {
    it("returns false with only one slot filled", () => {
        claimSlot("s1", "player1");
        assert.equal(dealIfReady(), false);
    });

    it("returns false if the game already started", () => {
        claimSlot("s1", "player1");
        claimSlot("s2", "player2");
        dealIfReady();
        assert.equal(dealIfReady(), false);
    });

    it("deals once both slots are filled and sets player1 to go first", () => {
        claimSlot("s1", "player1");
        claimSlot("s2", "player2");
        assert.equal(dealIfReady(), true);

        assert.equal(getCastleDeck().length, 12);
        assert.equal(getHandFor("player1").length, 7);
        assert.equal(getHandFor("player2").length, 7);
        assert.equal(getTavernDeck().length, 26);
        assert.deepEqual(getDiscardDeck(), []);
        assert.equal(getCurrentTurn(), "player1");
    });
});

describe("getCurrentTurn / advanceTurn", () => {
    it("is null before the game starts", () => {
        assert.equal(getCurrentTurn(), null);
        assert.equal(advanceTurn(), null);
    });

    it("toggles player1 <-> player2 after the game starts", () => {
        claimSlot("s1", "player1");
        claimSlot("s2", "player2");
        dealIfReady();

        assert.equal(getCurrentTurn(), "player1");
        assert.equal(advanceTurn(), "player2");
        assert.equal(getCurrentTurn(), "player2");
        assert.equal(advanceTurn(), "player1");
    });
});

describe("getSlotForSocket / getSocketIdForSlot", () => {
    it("resolves in both directions once claimed", () => {
        claimSlot("s1", "player1");
        claimSlot("s2", "player2");

        assert.equal(getSlotForSocket("s1"), "player1");
        assert.equal(getSlotForSocket("s2"), "player2");
        assert.equal(getSocketIdForSlot("player1"), "s1");
        assert.equal(getSocketIdForSlot("player2"), "s2");
    });

    it("returns null for an unknown socket", () => {
        assert.equal(getSlotForSocket("unknown"), null);
    });
});

describe("isStarted", () => {
    it("is false before dealing, true after, false again after resetGame", () => {
        assert.equal(isStarted(), false);

        claimSlot("s1", "player1");
        claimSlot("s2", "player2");
        dealIfReady();
        assert.equal(isStarted(), true);

        resetGame();
        assert.equal(isStarted(), false);
    });
});

describe("resetGame", () => {
    it("clears every field back to a clean slate from an arbitrary prior state", () => {
        claimSlot("s1", "player1");
        claimSlot("s2", "player2");
        dealIfReady();
        setPendingDefense(15);

        resetGame();

        assert.equal(getSlotForSocket("s1"), null);
        assert.equal(getSlotForSocket("s2"), null);
        assert.equal(getCastleDeck().length, 0);
        assert.equal(getHandFor("player1").length, 0);
        assert.equal(getHandFor("player2").length, 0);
        assert.equal(isStarted(), false);
        assert.equal(getCurrentTurn(), null);
        assert.deepEqual(getPlayedCards("player1"), []);
        assert.deepEqual(getPlayedCards("player2"), []);
        assert.deepEqual(getTavernDeck(), []);
        assert.deepEqual(getDiscardDeck(), []);
        assert.equal(getPendingDefense(), null);
    });
});

describe("markSlotDisconnected", () => {
    it("nulls only the matching socket's slot, leaving hand/castle/turn untouched", () => {
        claimSlot("s1", "player1");
        claimSlot("s2", "player2");
        dealIfReady();

        const player1HandBefore = [...getHandFor("player1")];
        const castleDeckBefore = [...getCastleDeck()];
        const turnBefore = getCurrentTurn();

        const slot = markSlotDisconnected("s1");

        assert.equal(slot, "player1");
        assert.equal(getSlotForSocket("s1"), null);
        assert.equal(getSocketIdForSlot("player2"), "s2"); // other player unaffected
        assert.deepEqual(getHandFor("player1"), player1HandBefore);
        assert.deepEqual(getCastleDeck(), castleDeckBefore);
        assert.equal(getCurrentTurn(), turnBefore);
    });

    it("lets a new socket id reclaim the freed slot", () => {
        claimSlot("s1", "player1");
        claimSlot("s2", "player2");
        dealIfReady();

        markSlotDisconnected("s1");
        assert.equal(claimSlot("s1-reconnected", "player1"), true);
        assert.equal(getSlotForSocket("s1-reconnected"), "player1");
    });

    it("returns null for a socket that doesn't hold a slot", () => {
        assert.equal(markSlotDisconnected("unknown"), null);
    });
});

describe("getPendingDefense / setPendingDefense", () => {
    it("defaults to null and round-trips a value", () => {
        assert.equal(getPendingDefense(), null);
        setPendingDefense(20);
        assert.equal(getPendingDefense(), 20);
    });

    it("is cleared by resetGame", () => {
        setPendingDefense(20);
        resetGame();
        assert.equal(getPendingDefense(), null);
    });
});

describe("getOpponentHandSize", () => {
    it("returns the OTHER player's hand size (player1 -> player2's, and vice versa)", () => {
        claimSlot("s1", "player1");
        claimSlot("s2", "player2");
        dealIfReady();

        assert.equal(getOpponentHandSize("player1"), getHandFor("player2").length);
        assert.equal(getOpponentHandSize("player2"), getHandFor("player1").length);
        assert.equal(getOpponentHandSize("player1"), 7);
        assert.equal(getOpponentHandSize("player2"), 7);
    });
});

describe("plain getters before a deal", () => {
    it("return safe empty defaults", () => {
        assert.deepEqual(getHandFor("player1"), []);
        assert.deepEqual(getCastleDeck(), []);
        assert.deepEqual(getDiscardDeck(), []); // discardDeck is null pre-deal -> ?? []
        assert.deepEqual(getTavernDeck(), []); // tavernDeck is null pre-deal -> ?? []
        assert.deepEqual(getPlayedCards("player1"), []);
        assert.deepEqual(getPlayedCards("player2"), []);
    });
});
