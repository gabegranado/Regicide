import type { CardProps, Suit } from "../../src/types.js";

export function makeCard(suit: Suit, num: number, overrides: Partial<CardProps> = {}): CardProps {
    return { suit, num, health: num, attack: num, ...overrides };
}
