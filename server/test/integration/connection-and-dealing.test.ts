import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import type { Socket as ClientSocket } from "socket.io-client";
import { bootTestServer, connectClient, waitForEvent, type TestServerHandle } from "../helpers/testServer.js";
import { resetGame } from "../../src/game/session.js";

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

describe("connecting and dealing", () => {
    it("deals two distinct 7-card hands with no hand-leaking once both players select", async () => {
        const a = await connect();
        const b = await connect();

        const gameStartAPromise = waitForEvent<{ hand: unknown[]; yourSlot: string; currentTurn: string; castleDeck: unknown[] }>(a, "game-start");
        const gameStartBPromise = waitForEvent<{ hand: unknown[]; yourSlot: string; currentTurn: string }>(b, "game-start");

        a.emit("select-player", { slot: "player1" });
        b.emit("select-player", { slot: "player2" });

        const [gameStartA, gameStartB] = await Promise.all([gameStartAPromise, gameStartBPromise]);

        assert.equal(gameStartA.hand.length, 7);
        assert.equal(gameStartB.hand.length, 7);
        assert.equal(gameStartA.yourSlot, "player1");
        assert.equal(gameStartB.yourSlot, "player2");
        assert.equal(gameStartA.currentTurn, "player1");
        assert.equal(gameStartB.currentTurn, "player1");
        assert.notDeepEqual(gameStartA.hand, gameStartB.hand);
        assert.equal(gameStartA.castleDeck.length, 12);
    });

    it("broadcasts correct pile counts once the deal completes", async () => {
        const a = await connect();
        const b = await connect();

        const pileCountsPromise = waitForEvent<{ castleDeckCount: number; discardDeckCount: number; tavernDeckCount: number }>(a, "pile-counts-updated");
        a.emit("select-player", { slot: "player1" });
        b.emit("select-player", { slot: "player2" });

        const counts = await pileCountsPromise;
        assert.deepEqual(counts, { castleDeckCount: 12, discardDeckCount: 0, tavernDeckCount: 26 });
    });

    it("rejects a third client claiming an already-taken slot", async () => {
        const a = await connect();
        const b = await connect();
        const c = await connect();

        const gameStartPromise = waitForEvent(a, "game-start");
        a.emit("select-player", { slot: "player1" });
        b.emit("select-player", { slot: "player2" });
        await gameStartPromise;

        const playerTakenPromise = waitForEvent<{ slot: string }>(c, "player-taken");
        c.emit("select-player", { slot: "player1" });
        const payload = await playerTakenPromise;
        assert.equal(payload.slot, "player1");
    });
});
