import type { CardProps } from "./Card";
import type { Dispatch, SetStateAction } from "react";
import Card from "./Card";

interface CardStackProps {
    playersHand: CardProps[];
    selectedCards?: CardProps[];
    setSelectedCards?: Dispatch<SetStateAction<CardProps[]>>;
    interactive?: boolean;
}

function CardStack({ playersHand, selectedCards = [], setSelectedCards, interactive = true }: CardStackProps) {
    const center = (playersHand.length - 1) / 2;
    // A non-interactive hand (not your turn) still fans out, just with a tighter curve --
    // it's not up for selection, so it doesn't need to spread wide enough to click each card.
    const angleStep = interactive ? 20 : 3; // degrees of rotation per card away from center
    // Both in vw (not px) so the fan's curve and lift shrink right along with the card width
    // on a narrow phone screen instead of staying a fixed size and looking oversized/clipped.
    const curveStepVw = interactive ? 0.9 : 0.25; // vw pushed down per card away from center
    const liftAmountVw = 5; // vw a card rises when selected

    // Card width and overlap are both in vw, and overlap is derived from how many cards
    // there are, so the whole fanned hand always adds up to maxTotalVw of the screen --
    // it scales with any screen size and never needs to scroll, no matter the hand size.
    const cardWidthVw = 10;
    const maxTotalVw = 70;
    const totalWithoutOverlap = playersHand.length * cardWidthVw;
    const overlapVw = playersHand.length > 1
        ? (maxTotalVw - totalWithoutOverlap) / (playersHand.length - 1) - 6
        : 0;

    const toggleCard = (card: CardProps) => {
        if (!interactive || !setSelectedCards) return;
        setSelectedCards((prev) =>
            prev.includes(card)
                ? prev.filter((c) => c !== card)
                : [...prev, card]
        );
    };

    return (
        <div style={{ display: "flex", flexDirection: "row", justifyContent: "center", alignItems: "flex-end" }}>
        {
            playersHand.map((card, idx) => {
                const offset = idx - center;
                const rotation = offset * angleStep;
                const lift = Math.abs(offset) * curveStepVw;
                const isSelected = interactive && selectedCards.includes(card);
                const translateY = isSelected ? lift - liftAmountVw : lift;

                return (
                    <div
                        key={idx}
                        onClick={() => toggleCard(card)}
                        style={{
                            transform: `rotate(${rotation}deg) translateY(${translateY}vw)`,
                            transformOrigin: "bottom center",
                            marginLeft: idx === 0 ? 0 : `${overlapVw}vw`,
                            boxShadow: "0 4px 10px rgba(0, 0, 0, 0.4)",
                            zIndex: isSelected ? playersHand.length + idx : idx,
                            transition: "transform 0.2s ease",
                            cursor: interactive ? "pointer" : "default",
                        }}
                    >
                        <Card suit={card.suit} num={card.num} health={card.health} attack={card.attack} width={`${cardWidthVw}vw`}/>
                    </div>
                )
            })
        }
        </div>
    )
}

export default CardStack;
