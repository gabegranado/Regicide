import type { CardProps } from "./Card";
import type { Dispatch, SetStateAction } from "react";
import CardStack from "./CardStack";

interface AttackingProps {
    playersHand: CardProps[];
    attackingCards: CardProps[];
    setAttackingCards: Dispatch<SetStateAction<CardProps[]>>;
    onAttack: () => void;
}

function Attacking({ playersHand, attackingCards, setAttackingCards, onAttack }: AttackingProps) {
    return (
        <>
        <button
            type="button"
            onClick={onAttack}
            disabled={attackingCards.length === 0}
            style={{
                padding: "14px 48px",
                fontSize: "1.1rem",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#fff",
                border: "none",
                borderRadius: "10px",
                background: attackingCards.length === 0
                    ? "linear-gradient(180deg, #8a8a8a, #6b6b6b)"
                    : "linear-gradient(180deg, #ff6b4a, #c0392b)",
                boxShadow: attackingCards.length === 0
                    ? "none"
                    : "0 4px 12px rgba(192, 57, 43, 0.5)",
                cursor: attackingCards.length === 0 ? "not-allowed" : "pointer",
                opacity: attackingCards.length === 0 ? 0.6 : 1,
                transition: "transform 0.1s ease, box-shadow 0.1s ease",
            }}
        >
            Attack
        </button>
        <h1>Attacking</h1>
        <CardStack
            playersHand={playersHand}
            selectedCards={attackingCards}
            setSelectedCards={setAttackingCards}
        />
        </>
    )
}

export default Attacking;
