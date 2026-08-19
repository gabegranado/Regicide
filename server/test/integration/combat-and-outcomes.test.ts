import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import type { Socket as ClientSocket } from "socket.io-client";
import { bootTestServer, connectClient, waitForEvent, emitWithAck, type TestServerHandle } from "../helpers/testServer.js";
import { resetGame, getCastleDeck, getHandFor } from "../../src/game/session.js";
import { makeCard } from "../helpers/fixtures.js";

let server: TestServerHandle;
let clients: ClientSocket[];

beforeEach(async () => {
    resetGame();
    server = await bootTestServer();
    clients = [];
});

afterEach(async () => {
    for (const client of clients) client.close();
    await server.close();
});

async function connect(): Promise<ClientSocket> {
    const client = await connectClient(server.url);
    clients.push(client);
    return client;
}

// Boots two real clients through a genuine socket-driven deal (server.ts's actual logic, not
// mocked), then hands back both sockets. Because the test process and the server share the
// same in-process game.ts module, callers can follow this with direct live-reference
// mutations (getCastleDeck(), getHandFor(), ...) to engineer a specific scenario before
// resuming action through the sockets -- the documented technique for these tests.
async function connectAndDeal(): Promise<{ a: ClientSocket; b: ClientSocket }> {
    const a = await connect();
    const b = await connect();
    const gameStartAPromise = waitForEvent(a, "game-start");
    const gameStartBPromise = waitForEvent(b, "game-start");
    a.emit("select-player", { slot: "player1" });
    b.emit("select-player", { slot: "player2" });
    await Promise.all([gameStartAPromise, gameStartBPromise]);
    return { a, b };
}

describe("combat and outcomes", () => {
    it("happy path: attack -> defense-required -> defend -> turn-changed", async () => {
        const { a } = await connectAndDeal();

        const castle = getCastleDeck();
        castle.length = 0;
        castle.push(makeCard("hearts", 8, { attack: 8, health: 100 }));

        const player1Hand = getHandFor("player1");
        player1Hand.length = 0;
        player1Hand.push(makeCard("spades", 3), makeCard("hearts", 5));

        const defenseRequiredPromise = waitForEvent<{ amount: number }>(a, "defense-required");
        const attackAck = await emitWithAck<{ ok: true } | { ok: false; reason: string }>(a, "select-played-card", { cardIndices: [0] });
        assert.equal(attackAck.ok, true);

        // The spade card should have reduced the castle's attack 8 -> 5 before defense-required
        // is computed.
        const defenseRequired = await defenseRequiredPromise;
        assert.equal(defenseRequired.amount, 5);

        const turnChangedPromise = waitForEvent<{ turn: string }>(a, "turn-changed");
        const defendAck = await emitWithAck<{ ok: true } | { ok: false; reason: string }>(a, "defending", { cardIndices: [0] });
        assert.equal(defendAck.ok, true);

        const turnChanged = await turnChangedPromise;
        assert.equal(turnChanged.turn, "player2");
    });

    it("wins the game when the last castle card is defeated", async () => {
        const { a, b } = await connectAndDeal();

        const castle = getCastleDeck();
        castle.length = 0;
        castle.push(makeCard("hearts", 5, { attack: 0, health: 5 })); // the only card left

        const player1Hand = getHandFor("player1");
        player1Hand.length = 0;
        player1Hand.push(makeCard("hearts", 5)); // exact-kill: 5 damage vs 5 health

        const gameWonAPromise = waitForEvent<{ ok: true; gameStatus: string }>(a, "game-won");
        const gameWonBPromise = waitForEvent<{ ok: true; gameStatus: string }>(b, "game-won");

        await emitWithAck(a, "select-played-card", { cardIndices: [0] });

        const [wonA, wonB] = await Promise.all([gameWonAPromise, gameWonBPromise]);
        assert.deepEqual(wonA, { ok: true, gameStatus: "won" });
        assert.deepEqual(wonB, { ok: true, gameStatus: "won" });
    });

    it("loses the game when the incoming turn's player has no cards left", async () => {
        const { a, b } = await connectAndDeal();

        const castle = getCastleDeck();
        castle.length = 0;
        castle.push(makeCard("hearts", 3, { attack: 3, health: 100 })); // survives the hit

        const player1Hand = getHandFor("player1");
        player1Hand.length = 0;
        player1Hand.push(makeCard("hearts", 3), makeCard("spades", 5));

        getHandFor("player2").length = 0; // empty -- player2 is about to become the current turn

        await emitWithAck(a, "select-played-card", { cardIndices: [0] }); // attack, defense-required for 3
        const gameLostAPromise = waitForEvent<{ ok: false; gameStatus: string; reason: string }>(a, "game-lost");
        const gameLostBPromise = waitForEvent<{ ok: false; gameStatus: string; reason: string }>(b, "game-lost");

        await emitWithAck(a, "defending", { cardIndices: [0] }); // defend with the remaining spades-5

        const [lostA, lostB] = await Promise.all([gameLostAPromise, gameLostBPromise]);
        assert.equal(lostA.reason, "player2 has no cards left to attack with.");
        assert.deepEqual(lostA, lostB);
    });

    it("loses the game immediately when the attacker can't afford the resulting defense", async () => {
        const { a, b } = await connectAndDeal();

        const castle = getCastleDeck();
        castle.length = 0;
        castle.push(makeCard("hearts", 10, { attack: 50, health: 100 })); // huge required defense

        const player1Hand = getHandFor("player1");
        player1Hand.length = 0;
        player1Hand.push(makeCard("hearts", 3), makeCard("spades", 2)); // remaining total (2) << 50

        const gameLostAPromise = waitForEvent<{ ok: false; gameStatus: string; reason: string }>(a, "game-lost");
        const gameLostBPromise = waitForEvent<{ ok: false; gameStatus: string; reason: string }>(b, "game-lost");

        await emitWithAck(a, "select-played-card", { cardIndices: [0] });

        const [lostA, lostB] = await Promise.all([gameLostAPromise, gameLostBPromise]);
        assert.equal(lostA.reason, "player1 doesn't have enough cards left to cover 50 damage — the castle can't be defended against.");
        assert.deepEqual(lostA, lostB);
    });

    it("regression: accepts an ace + 9 combo (sums to exactly 10) through the real socket contract", async () => {
        const { a } = await connectAndDeal();

        const castle = getCastleDeck();
        castle.length = 0;
        castle.push(makeCard("hearts", 10, { attack: 5, health: 100 }));

        const player1Hand = getHandFor("player1");
        player1Hand.length = 0;
        player1Hand.push(makeCard("spades", 1), makeCard("spades", 9));

        const ack = await emitWithAck<{ ok: true } | { ok: false; reason: string }>(a, "select-played-card", { cardIndices: [0, 1] });
        assert.equal(ack.ok, true);
    });
});
