import type { Suit } from "./componets/Card";

const RANK_NAMES: Record<number, string> = {
    1: "ace",
    11: "jack",
    12: "queen",
    13: "king",
};

const images = import.meta.glob("./assets/CardsImg/PNG-cards-1.3/*.png", {
    eager: true,
    import: "default",
}) as Record<string, string>;

const imagesByFilename = new Map<string, string>();
for (const [path, url] of Object.entries(images)) {
    const filename = path.split("/").pop();
    if (filename) imagesByFilename.set(filename, url);
}

export function getCardImage(suit: Suit, num: number): string {
    const rank = RANK_NAMES[num] ?? String(num);
    const filename = `${rank}_of_${suit}.png`;
    const url = imagesByFilename.get(filename);
    if (!url) throw new Error(`Missing card image for ${filename}`);
    return url;
}
