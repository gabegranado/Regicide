import { claimSlot, dealIfReady, resetGame } from "../../src/game/session.js";

export const PLAYER1_SOCKET = "test-s1";
export const PLAYER2_SOCKET = "test-s2";

// Most of game.ts's functions early-return on `state.discardDeck === null` or a turn
// mismatch, so most test files need a genuinely *started* game (not just a reset one) as
// their starting point. resetGame() alone isn't enough for those.
export function startTestGame(): { player1Socket: string; player2Socket: string } {
    resetGame();
    claimSlot(PLAYER1_SOCKET, "player1");
    claimSlot(PLAYER2_SOCKET, "player2");
    dealIfReady();
    return { player1Socket: PLAYER1_SOCKET, player2Socket: PLAYER2_SOCKET };
}
