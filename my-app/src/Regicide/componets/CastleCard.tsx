import Card from "./Card";
import type { CardProps } from "./Card";

interface CastleCardProps {
    card: CardProps | null;
    remaining: number;
}

function CastleCard({ card, remaining }: CastleCardProps) {
    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <h3>Castle Deck</h3>
            {card && <Card suit={card.suit} num={card.num} health={card.health} attack={card.attack} width="clamp(56px, 16vw, 120px)" />}
            {card && <p>{card.health} HP / {card.attack} ATK</p>}
            <p>{remaining} card{remaining === 1 ? "" : "s"} left</p>
        </div>
    )
}

export default CastleCard;
