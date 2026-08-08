import { useState } from "react";
import CardTest from "./CardTest";

function CardTestStack () {
    const arr = [1, 2, 3, 4, 5, 6];
    const center = (arr.length - 1) / 2;
    const angleStep = 10; // degrees of rotation per card away from center
    const curveStep = 10; // px pushed down per card away from center
    const liftAmount = 60; // px a card rises when selected

    // Card width and overlap are both in vw, and overlap is derived from how many cards
    // there are, so the whole fanned stack always adds up to maxTotalVw of the screen --
    // it scales with any screen size and never needs to scroll, no matter how many cards.
    const cardWidthVw = 18;
    const maxTotalVw = 80;
    const totalWithoutOverlap = arr.length * cardWidthVw;
    const overlapVw = arr.length > 1 ? (maxTotalVw - totalWithoutOverlap) / (arr.length - 1) -4: 0;

    const [selected, setSelected] = useState<Set<number>>(new Set());

    const toggleCard = (idx: number) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx);
            else next.add(idx);
            return next;
        });
    };

    return (
        <>
        <h1>test</h1>
        <div style={{ display: "flex", flexDirection: "row", justifyContent: "center", alignItems: "flex-end", minHeight: "90vh" }}>
        {
            arr.map((card, idx) => {
                const offset = idx - center;
                const rotation = offset * angleStep;
                const lift = Math.abs(offset) * curveStep;
                const isSelected = selected.has(idx);
                const translateY = isSelected ? lift - liftAmount : lift;
                return (
                    <div
                        key={card}
                        onClick={() => toggleCard(idx)}
                        style={{
                            transform: `rotate(${rotation}deg) translateY(${translateY}px)`,
                            transformOrigin: "bottom center",
                            marginLeft: idx === 0 ? 0 : `${overlapVw}vw`,
                            boxShadow: "0 4px 10px rgba(0, 0, 0, 0.4)",
                            zIndex: isSelected ? arr.length + idx : idx,
                            transition: "transform 0.2s ease",
                            cursor: "pointer",
                        }}
                    >
                        <CardTest width={`${cardWidthVw}vw`}/>
                    </div>
                )
            })
        }
        </div>
        </>
    )
}

export default CardTestStack;