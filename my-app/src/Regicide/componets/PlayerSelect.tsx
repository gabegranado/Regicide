import type { CSSProperties } from "react";
import type { PlayerSlot } from "../playerNames";
import { PLAYER_NAMES } from "../playerNames";

interface PlayerSelectProps {
    onSelect: (slot: PlayerSlot) => void;
    takenSlot: PlayerSlot | null;
}

const buttonStyle: CSSProperties = {
    padding: "clamp(10px, 3vw, 14px) clamp(24px, 8vw, 40px)",
    margin: "8px",
    fontSize: "clamp(0.9rem, 3vw, 1.1rem)",
    fontWeight: 700,
    minHeight: "44px",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    background: "linear-gradient(180deg, #6b6b6b, #3a3a3a)",
    cursor: "pointer",
};

function PlayerSelect({ onSelect, takenSlot }: PlayerSelectProps) {
    return (
        <>
        <h2>Who are you?</h2>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center" }}>
            <button type="button" onClick={() => onSelect("player1")} style={buttonStyle}>{PLAYER_NAMES.player1}</button>
            <button type="button" onClick={() => onSelect("player2")} style={buttonStyle}>{PLAYER_NAMES.player2}</button>
        </div>
        {takenSlot && <p>{PLAYER_NAMES[takenSlot]} is already taken — pick the other one.</p>}
        </>
    )
}

export default PlayerSelect;
