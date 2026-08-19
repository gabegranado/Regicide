import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { hasDiamondsInPlayedCards, applyDiamondDrawPower, numHeartsInPlay, applyHeartPower } from "../../../src/game/powers.js";
import { getHandFor, getTavernDeck, getDiscardDeck, resetGame } from "../../../src/game/session.js";
import { startTestGame } from "../../helpers/gameHarness.js";
import { makeCard } from "../../helpers/fixtures.js";

beforeEach(() => {
    startTestGame();
});

describe("hasDiamondsInPlayedCards", () => {
    it("is true when a diamond card is present", () => {
        assert.equal(hasDiamondsInPlayedCards([makeCard("clubs", 2), makeCard("diamonds", 5)]), true);
    });

    it("is false when no diamond card is present", () => {
        assert.equal(hasDiamondsInPlayedCards([makeCard("clubs", 2), makeCard("hearts", 5)]), false);
    });
});

describe("applyDiamondDrawPower", () => {
    it("draws a total equal to the summed attack of ONLY the diamond cards passed in", () => {
        const player1Hand = getHandFor("player1");
        const player2Hand = getHandFor("player2");
        player1Hand.length = 0;
        player2Hand.length = 0;
        const tavern = getTavernDeck();
        tavern.length = 0;
        tavern.push(makeCard("clubs", 1), makeCard("clubs", 2));

        // Only the diamond's attack (2) should count -- the hearts card must be ignored.
        const drawn = applyDiamondDrawPower("player1", [makeCard("diamonds", 2), makeCard("hearts", 9)]);
        assert.equal(drawn, 2);
    });

    it("alternates draws, preferring the acting slot first", () => {
        const player1Hand = getHandFor("player1");
        const player2Hand = getHandFor("player2");
        player1Hand.length = 0;
        player2Hand.length = 0;
        const tavern = getTavernDeck();
        tavern.length = 0;
        const c1 = makeCard("clubs", 1);
        const c2 = makeCard("clubs", 2);
        const c3 = makeCard("clubs", 3);
        const c4 = makeCard("clubs", 4);
        tavern.push(c1, c2, c3, c4); // popped from the end: c4, c3, c2, c1

        const drawn = applyDiamondDrawPower("player1", [makeCard("diamonds", 4)]);

        assert.equal(drawn, 4);
        assert.deepEqual(player1Hand, [c4, c2]); // player1 (acting) gets draws 1 and 3
        assert.deepEqual(player2Hand, [c3, c1]); // player2 gets draws 2 and 4
        assert.equal(tavern.length, 0);
    });

    it("falls back to the other hand once the preferred hand hits the 7-card cap", () => {
        const player1Hand = getHandFor("player1");
        const player2Hand = getHandFor("player2");
        player1Hand.length = 0;
        player1Hand.push(...Array.from({ length: 7 }, (_, i) => makeCard("spades", (i % 10) + 1))); // full
        player2Hand.length = 0;
        const tavern = getTavernDeck();
        tavern.length = 0;
        tavern.push(makeCard("clubs", 1), makeCard("clubs", 2), makeCard("clubs", 3));

        const drawn = applyDiamondDrawPower("player1", [makeCard("diamonds", 3)]);

        assert.equal(drawn, 3);
        assert.equal(player1Hand.length, 7); // untouched, stayed full
        assert.equal(player2Hand.length, 3); // every draw fell through to player2
    });

    it("stops early and returns a short count once the tavern deck is exhausted", () => {
        const player1Hand = getHandFor("player1");
        const player2Hand = getHandFor("player2");
        player1Hand.length = 0;
        player2Hand.length = 0;
        const tavern = getTavernDeck();
        tavern.length = 0;
        tavern.push(makeCard("clubs", 1)); // only 1 card available

        const drawn = applyDiamondDrawPower("player1", [makeCard("diamonds", 5)]);
        assert.equal(drawn, 1);
        assert.equal(tavern.length, 0);
    });
});

describe("numHeartsInPlay", () => {
    it("sums the attack of heart-suited cards only", () => {
        const total = numHeartsInPlay([makeCard("hearts", 3), makeCard("clubs", 9), makeCard("hearts", 2)]);
        assert.equal(total, 5);
    });

    it("is 0 when no hearts are present", () => {
        assert.equal(numHeartsInPlay([makeCard("clubs", 9)]), 0);
    });
});

describe("applyHeartPower", () => {
    it("is a no-op when no hearts were played", () => {
        getDiscardDeck().push(makeCard("spades", 4));
        const discardBefore = [...getDiscardDeck()];
        const tavernBefore = [...getTavernDeck()];

        applyHeartPower([makeCard("clubs", 3)]);

        assert.deepEqual(getDiscardDeck(), discardBefore);
        assert.deepEqual(getTavernDeck(), tavernBefore);
    });

    it("is a no-op when the game hasn't started (discard/tavern are null)", () => {
        resetGame();
        assert.doesNotThrow(() => applyHeartPower([makeCard("hearts", 3)]));
    });

    it("reclaims exactly numHeartsInPlay(cards) cards from discard into tavern, resetting stale face-card stats but leaving plain cards untouched", () => {
        const staleQueen = makeCard("hearts", 12, { attack: 3, health: -5 }); // stale from an earlier overkill
        const plainCard = makeCard("spades", 6);
        getDiscardDeck().length = 0;
        getDiscardDeck().push(staleQueen, plainCard);

        const tavernSizeBefore = getTavernDeck().length;

        // Requesting exactly as many as are in discard makes the reclaim deterministic
        // regardless of the internal shuffle -- both cards get reclaimed either way.
        applyHeartPower([makeCard("hearts", 2)]);

        assert.equal(getDiscardDeck().length, 0);
        assert.equal(getTavernDeck().length, tavernSizeBefore + 2);

        const reclaimedQueen = getTavernDeck().find((c) => c.suit === "hearts" && c.num === 12);
        assert.ok(reclaimedQueen, "the queen should have been reclaimed into the tavern deck");
        assert.equal(reclaimedQueen!.attack, 15); // regression: reset instead of left at the stale 3
        assert.equal(reclaimedQueen!.health, 15);

        const reclaimedPlain = getTavernDeck().find((c) => c.suit === "spades" && c.num === 6);
        assert.ok(reclaimedPlain);
        assert.equal(reclaimedPlain!.attack, 6); // untouched -- not a face card
        assert.equal(reclaimedPlain!.health, 6);
    });
});
