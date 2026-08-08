import type { CardProps } from "./Card";
import type { Dispatch, SetStateAction } from "react";
import CardStack from "./CardStack";

interface DefendingProps {
    playersHand: CardProps[];
    defendingCards: CardProps[];
    setDefendingCards: Dispatch<SetStateAction<CardProps[]>>;
    onDefend: () => void;
    requiredAmount: number;
}

function Defending({ playersHand, defendingCards, setDefendingCards, onDefend, requiredAmount }: DefendingProps) {
    const selectedTotal = defendingCards.reduce((sum, card) => sum + card.num, 0);

    return (
        <>
        <p>Discard cards totaling at least {requiredAmount} ({selectedTotal} selected)</p>
        <button
            type="button"
            onClick={onDefend}
            disabled={defendingCards.length === 0}
            style={{
                padding: "clamp(10px, 3vw, 14px) clamp(24px, 8vw, 48px)",
                fontSize: "clamp(0.9rem, 3vw, 1.1rem)",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#fff",
                border: "none",
                borderRadius: "10px",
                background: defendingCards.length === 0
                    ? "linear-gradient(180deg, #8a8a8a, #6b6b6b)"
                    : "linear-gradient(180deg, #4a90d9, #2c5f8a)",
                boxShadow: defendingCards.length === 0
                    ? "none"
                    : "0 4px 12px rgba(44, 95, 138, 0.5)",
                cursor: defendingCards.length === 0 ? "not-allowed" : "pointer",
                opacity: defendingCards.length === 0 ? 0.6 : 1,
                transition: "transform 0.1s ease, box-shadow 0.1s ease",
            }}
        >
            Submit
        </button>
        <h1>Defending</h1>
        <CardStack
            playersHand={playersHand}
            selectedCards={defendingCards}
            setSelectedCards={setDefendingCards}
        />
        </>
    )
}

export default Defending;
