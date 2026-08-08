import type { PlayerSlot } from "../playerNames";
import { PLAYER_NAMES } from "../playerNames";

interface PlayerSelectProps {
    onSelect: (slot: PlayerSlot) => void;
    takenSlot: PlayerSlot | null;
}

function PlayerSelect({ onSelect, takenSlot }: PlayerSelectProps) {
    return (
        <>
        <h2>Who are you?</h2>
        <button type="button" onClick={() => onSelect("player1")}>{PLAYER_NAMES.player1}</button>
        <button type="button" onClick={() => onSelect("player2")}>{PLAYER_NAMES.player2}</button>
        {takenSlot && <p>{PLAYER_NAMES[takenSlot]} is already taken — pick the other one.</p>}
        </>
    )
}

export default PlayerSelect;
