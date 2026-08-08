import { getCardImage } from "../cardImages";

export type Suit = "diamonds" | "hearts" | "spades" | "clubs";

export interface CardProps {
    suit: Suit,
    num: number,
    health: number,
    attack: number
}

function Card({ suit, num, width = "120px" }: CardProps & { width?: string }) {
    return (
        <img
            src={getCardImage(suit, num)}
            alt={`${suit} ${num}`}
            style={{ width, height: "auto", display: "block" }}
        />
    )
}

export default Card;