import Duck from '../Regicide/assets/Duck.jpeg';

interface CardTestProps {
    width?: string;
}

function CardTest({ width = "120px" }: CardTestProps) {
    return (
        <>
            <img src={Duck} style={{ width, height: "auto", display: "block" }}></img>
        </>
    )
}

export default CardTest;