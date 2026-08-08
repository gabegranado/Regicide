import BackOfCard from "../assets/CardsImg/PNG-cards-1.3/BackOfCard.png";

interface CardPileProps {
    label: string;
    count: number;
}

function CardPile({ label, count }: CardPileProps) {
    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <h3>{label}</h3>
            <img src={BackOfCard} alt={label} style={{ width: "120px", height: "auto" }} />
            <p>{count} card{count === 1 ? "" : "s"} left</p>
        </div>
    )
}

export default CardPile;
