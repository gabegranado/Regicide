import type { CardProps } from "./Card";
import type { Dispatch, SetStateAction } from "react";
import Card from "./Card";

interface CardSelectProps {
    playersHand: CardProps[];
    selectedCards: CardProps[];
    setSelectedCards: Dispatch<SetStateAction<CardProps[]>>;
}

function CardSelect({ playersHand, selectedCards, setSelectedCards }: CardSelectProps) {
    const toggleCard = (card: CardProps) => {
        setSelectedCards((prev) =>
            prev.includes(card)
                ? prev.filter((c) => c !== card)
                : [...prev, card]
        );
    };

    return (
        <>
        {playersHand.map((card: CardProps, idx: number) => {
            const isSelected = selectedCards.includes(card);
            return (
                <div key={idx}>
                    <Card suit={card.suit} num={card.num} health={card.health} attack={card.attack}/>
                    <button type="button" onClick={() => toggleCard(card)}>
                        {isSelected ? "Deselect" : "Select"}
                    </button>
                </div>
            )
        })}
        </>
    )
}

export default CardSelect;
