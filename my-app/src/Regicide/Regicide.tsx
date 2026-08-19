import { useEffect } from "react";
import Card from "./componets/Card";
import type { CardProps } from "./componets/Card";
import CastleCard from "./componets/CastleCard";
import CardPile from "./componets/CardPile";
import PlayerSelect from "./componets/PlayerSelect";
import { PLAYER_NAMES, otherSlot } from "./playerNames";
import Attacking from "./componets/Attacking";
import Defending from "./componets/Defending";
import CardStack from "./componets/CardStack";
import { useRegicideGame } from "./useRegicideGame";

function Regicide() {
    const {
        hand,
        opponentHandSize,
        mySlot,
        currentTurn,
        status,
        opponentDisconnected,
        takenSlot,
        playedCards,
        attackingCards,
        setAttackingCards,
        topCastleCard,
        isDefending,
        castleAttackValue,
        defendingCards,
        setDefendingCards,
        errors,
        pileCounts,
        selectPlayer,
        handleAttack,
        handleDefend,
        handleEndGame,
    } = useRegicideGame();

    const isMyTurn = currentTurn !== null && currentTurn === mySlot;

    // Applied to <body> (not a wrapping div) because #root is a fixed-width, centered column --
    // a div inside it can only ever color that column, not the full viewport either side of it.
    useEffect(() => {
        if (status !== "playing") {
            document.body.style.backgroundColor = "";
            return;
        }
        document.body.style.backgroundColor = isDefending ? "#3b0d0d" : isMyTurn ? "#0d3b1e" : "#000000";
        return () => {
            document.body.style.backgroundColor = "";
        };
    }, [status, isDefending, isMyTurn]);

    const endGameButton = (
        <button
            type="button"
            onClick={handleEndGame}
            style={{
                position: "fixed",
                top: "clamp(8px, 2vw, 16px)",
                right: "clamp(8px, 2vw, 16px)",
                padding: "clamp(6px, 1.5vw, 8px) clamp(12px, 3vw, 18px)",
                fontSize: "clamp(0.7rem, 2vw, 0.8rem)",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                background: "linear-gradient(180deg, #5a5a5a, #2a2a2a)",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.4)",
                cursor: "pointer",
                zIndex: 1000,
            }}
        >
            End Game
        </button>
    );

    if (status === "selecting") {
        return <PlayerSelect onSelect={selectPlayer} takenSlot={takenSlot} />;
    }

    if (status === "reconnecting") {
        return <p>Reconnecting...</p>;
    }

    const myName = mySlot ? PLAYER_NAMES[mySlot] : "";

    // Fixed top-left, out of normal document flow, so it doesn't push the rest of the page's
    // content down the way the centered <h1> it replaces used to.
    const playerNameLabel = (
        <div
            style={{
                position: "fixed",
                top: "clamp(8px, 2vw, 16px)",
                left: "clamp(8px, 2vw, 16px)",
                padding: "clamp(6px, 1.5vw, 8px) clamp(12px, 3vw, 18px)",
                fontSize: "clamp(0.9rem, 2.5vw, 1.2rem)",
                fontWeight: 700,
                color: "#fff",
                borderRadius: "8px",
                background: "linear-gradient(180deg, #5a5a5a, #2a2a2a)",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.4)",
                zIndex: 1000,
            }}
        >
            {myName}
        </div>
    );

    if (status === "lost") {
        return (
            <>
                {endGameButton}
                <h1>Game Over</h1>
                <h2>{errors.lost}</h2>
            </>
        )
    }

    if (status === "won") {
        return (
            <>
                {endGameButton}
                <h1>Winner</h1>
            </>
        )
    }

    if (status === "waiting") {
        return (
            <>
            {endGameButton}
            {playerNameLabel}
            <p>Waiting for the other player to join...</p>
            </>
        );
    }

    if (status === "opponent-left") {
        return (
            <>
            {endGameButton}
            {playerNameLabel}
            <p>The other player left the game.</p>
            </>
        );
    }

    function handleGameStage() {
        if (isDefending) {
           return (
             <>
             {errors.defend && <p>{errors.defend}</p>}
             <Defending
                    playersHand={hand}
                    defendingCards={defendingCards}
                    setDefendingCards={setDefendingCards}
                    onDefend={handleDefend}
                    requiredAmount={castleAttackValue}
            />
            </>);
        }
        else if (isMyTurn){
            return  (
                <>
                {errors.attack && <p>{errors.attack}</p>}
                <Attacking
                    playersHand={hand}
                    attackingCards={attackingCards}
                    setAttackingCards={setAttackingCards}
                    onAttack={handleAttack}
                />
                </>
            );
         }

        return <CardStack playersHand={hand} interactive={false} />;
    }

    const opponentSlot = mySlot ? otherSlot(mySlot) : null;
    const opponentName = opponentSlot ? PLAYER_NAMES[opponentSlot] : "";
    const myPlayedCards = mySlot ? playedCards[mySlot] : [];
    const opponentPlayedCards = opponentSlot ? playedCards[opponentSlot] : [];

    return (
        <>
        {endGameButton}
        {playerNameLabel}
        {opponentDisconnected && <p>{opponentName} disconnected — waiting for them to reconnect...</p>}
        <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "flex-start", gap: "clamp(12px, 4vw, 32px)" }}>
            <CardPile label="Discard Pile" count={pileCounts.discardDeckCount} />
            <CastleCard card={topCastleCard} remaining={pileCounts.castleDeckCount} />
            <CardPile label="Tavern Pile" count={pileCounts.tavernDeckCount} />
        </div>
        <h3>Battle</h3>
        {errors.attack && <h4>{errors.attack}</h4>}
        <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: "24px" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "4px" }}>
                <p>{myName}{myPlayedCards.length === 0 ? ": no cards played yet" : ""}</p>
                <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: "8px" }}>
                {
                    myPlayedCards.map((card: CardProps, idx: number) => (
                        <Card key={idx} suit={card.suit} num={card.num} health={card.health} attack={card.attack} width="clamp(48px, 12vw, 120px)"/>
                    ))
                }
                </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "4px" }}>
                <p>{opponentName}{opponentPlayedCards.length === 0 ? ": no cards played yet" : ""}</p>
                <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: "8px" }}>
                {
                    opponentPlayedCards.map((card: CardProps, idx: number) => (
                        <Card key={idx} suit={card.suit} num={card.num} health={card.health} attack={card.attack} width="clamp(48px, 12vw, 120px)"/>
                    ))
                }
                </div>
            </div>
        </div>

        <h3>{myName}'s hand</h3>
        {
            handleGameStage()
        }

        <h3>{opponentName}'s hand</h3>
        <p>{opponentHandSize} card{opponentHandSize === 1 ? "" : "s"}</p>

        </>
    )
}

export default Regicide;
