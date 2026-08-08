export type PlayerSlot = "player1" | "player2";

export const PLAYER_NAMES: Record<PlayerSlot, string> = {
    player1: "Player1",
    player2: "Player2",
};

export function otherSlot(slot: PlayerSlot): PlayerSlot {
    return slot === "player1" ? "player2" : "player1";
}
