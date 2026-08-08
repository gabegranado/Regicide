import { io } from "socket.io-client";

function connect(label) {
    const socket = io("http://localhost:3099", { forceNew: true });
    const state = { hand: [], isDefending: false, playedCards: { player1: [], player2: [] } };
    socket.on("game-start", (p) => { state.hand = p.hand; });
    socket.on("hand-updated", (p) => { state.hand = p.hand; console.log(`[${label}] hand-updated -> ${p.hand.length} cards`); });
    socket.on("defense-required", () => { state.isDefending = true; });
    socket.on("turn-changed", () => { state.isDefending = false; });
    socket.on("card-played", (p) => { state.playedCards[p.slot] = p.cards; });
    socket.onAny((event) => console.log(`[${label}] event: ${event}`));
    return { label, socket, state };
}

function waitFor(client, eventName) {
    return new Promise((resolve) => client.socket.once(eventName, (payload) => resolve(payload)));
}

function emitWithAck(client, event, payload) {
    return new Promise((resolve) => client.socket.emit(event, payload, resolve));
}

let polly, gabe, pollyGameStart, diamondIdx;

for (let attempt = 0; attempt < 20; attempt++) {
    polly = connect(`Polly-${attempt}`);
    gabe = connect(`Gabe-${attempt}`);
    await new Promise((r) => setTimeout(r, 200));

    const pollyStart = waitFor(polly, "game-start");
    const gabeStart = waitFor(gabe, "game-start");
    polly.socket.emit("select-player", { slot: "player1" });
    gabe.socket.emit("select-player", { slot: "player2" });
    [pollyGameStart] = await Promise.all([pollyStart, gabeStart]);

    diamondIdx = pollyGameStart.hand.findIndex((c) => c.suit === "diamonds");
    if (diamondIdx >= 0) break;
    polly.socket.disconnect();
    gabe.socket.disconnect();
}

console.log(`\nPolly's hand before: ${JSON.stringify(polly.state.hand)}`);
console.log(`Playing diamond at index ${diamondIdx}: ${JSON.stringify(pollyGameStart.hand[diamondIdx])}\n`);

await emitWithAck(polly, "select-played-card", { cardIndices: [diamondIdx] });
await new Promise((r) => setTimeout(r, 400));

console.log(`\nPolly's tracked hand state after full event sequence: ${JSON.stringify(polly.state.hand)}`);
console.log(`Polly's hand length: ${polly.state.hand.length} (should be 7 if a diamond refilled it)`);
console.log(`Polly isDefending: ${polly.state.isDefending}`);

// Now defend (need enough cards to cover the required defense amount)
const requiredAmount = 20; // will be adjusted below based on actual event
polly.socket.once("defense-required", () => {});

// Just try defending with as many cards as needed, recomputing from current tracked hand
let total = 0;
const indices = [];
for (let i = 0; i < polly.state.hand.length && total < 50; i++) {
    indices.push(i);
    total += polly.state.hand[i].num;
    if (total >= 20) break;
}
console.log(`\nDefending with indices ${JSON.stringify(indices)} (total ${total})`);
const defendAck = await emitWithAck(polly, "defending", { cardIndices: indices });
console.log(`Defend ack: ${JSON.stringify(defendAck)}`);
await new Promise((r) => setTimeout(r, 300));

console.log(`\nFinal Polly hand state: ${JSON.stringify(polly.state.hand)}`);
console.log(`Final Polly isDefending: ${polly.state.isDefending}`);

polly.socket.disconnect();
gabe.socket.disconnect();
process.exit(0);
