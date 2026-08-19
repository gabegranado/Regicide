import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import type { Socket as ClientSocket } from "socket.io-client";
import { bootTestServer, connectClient, waitForEvent, type TestServerHandle } from "../helpers/testServer.js";
import { resetGame, getHandFor } from "../../src/game/session.js";

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

describe("persistence and end-game", () => {
    it("preserves game state through a mid-game disconnect and resumes identically on reconnect", async () => {
        const { a, b } = await connectAndDeal();
        const originalHandA = [...getHandFor("player1")];

        const disconnectedPromise = waitForEvent<{ message: string }>(b, "opponent-disconnected");
        a.close();
        const disconnected = await disconnectedPromise;
        assert.match(disconnected.message, /player1/);

        const aPrime = await connect();
        const reconnectedPromise = waitForEvent<{ message: string }>(b, "opponent-reconnected");
        const gameStartPromise = waitForEvent<{ hand: unknown[]; yourSlot: string }>(aPrime, "game-start");
        aPrime.emit("select-player", { slot: "player1" });

        const resumedGameStart = await gameStartPromise;
        assert.deepEqual(resumedGameStart.hand, originalHandA);
        assert.equal(resumedGameStart.yourSlot, "player1");

        const reconnected = await reconnectedPromise;
        assert.match(reconnected.message, /player1/);
    });

    it("resets both sockets on end-game and allows a fresh game to start afterward", async () => {
        const { a, b } = await connectAndDeal();

        const endedAPromise = waitForEvent(a, "game-ended");
        const endedBPromise = waitForEvent(b, "game-ended");
        a.emit("end-game");
        await Promise.all([endedAPromise, endedBPromise]);

        const c = await connect();
        const d = await connect();
        const gameStartCPromise = waitForEvent<{ hand: unknown[] }>(c, "game-start");
        const gameStartDPromise = waitForEvent(d, "game-start");
        c.emit("select-player", { slot: "player1" });
        d.emit("select-player", { slot: "player2" });

        const [gameStartC] = await Promise.all([gameStartCPromise, gameStartDPromise]);
        assert.equal(gameStartC.hand.length, 7);
    });

    it("takes the pre-start reset+opponent-left branch (not the mid-game reconnect branch) when a player leaves before the game starts", async () => {
        const a = await connect();
        const b = await connect(); // connected but hasn't selected a slot -- game can't be started yet

        const slotClaimedPromise = waitForEvent(a, "slot-claimed");
        a.emit("select-player", { slot: "player1" });
        await slotClaimedPromise;

        const opponentLeftPromise = waitForEvent<{ message: string }>(b, "opponent-left");
        a.close();
        const opponentLeft = await opponentLeftPromise;
        assert.equal(opponentLeft.message, "The other player left the game.");
    });
});
