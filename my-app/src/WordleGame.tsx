import TryWord, { WORD_LENGTH } from "./componets/TryWord";
import type { LetterStatus } from "./componets/TryWord";
import { useState } from "react";

const WORD = "DIARY";
const MAX_ATTEMPTS = 5;

type GameStatus = 'playing' | 'won' | 'lost' | 'tryAgain';

function Game() {
    const [statuses, setStatuses] = useState<LetterStatus[][]>(
        [Array(WORD_LENGTH).fill('blank')]
    );
    const [lockedRows, setLockedRows] = useState<boolean[]>(
        Array(MAX_ATTEMPTS).fill(false)
    );
    const [gameStatus, setGameStatus] = useState<GameStatus>('playing');
    const [triedWords, setTriedWords] = useState<string[]>([]);
    const [rowResetTokens, setRowResetTokens] = useState<number[]>(
        Array(MAX_ATTEMPTS).fill(0)
    );
    const [triedLetters, setTriedLetters] = useState<Set<string>>(new Set());

    const getLetterStatuses = (word: string): LetterStatus[] => {
        const result: LetterStatus[] = Array(WORD_LENGTH).fill('absent');
        const pool = WORD.split('');

        for (let i = 0; i < WORD_LENGTH; i++) {
            if (word[i] === WORD[i]) {
                result[i] = 'correct';
                pool[i] = '';
            }
        }

        for (let i = 0; i < WORD_LENGTH; i++) {
            if (result[i] === 'correct') continue;
            const poolIdx = pool.indexOf(word[i]);
            if (poolIdx !== -1) {
                result[i] = 'present';
                pool[poolIdx] = '';
            }
        }

        return result;
    }

    const checkSubmission = (word: string, tryIdx: number) => {
        if (gameStatus !== 'playing' && gameStatus !== 'tryAgain') return;

        if (triedWords.includes(word)) {
            setGameStatus('tryAgain');
            setRowResetTokens((prev) => prev.map((token, idx) => idx === tryIdx ? token + 1 : token));
            return;
        }
        // if (word.split('').some((letter) => triedLetters.has(letter))) {
        //     setGameStatus('tryAgain');
        //     setRowResetTokens((prev) => prev.map((token, idx) => idx === tryIdx ? token + 1 : token));
        //     return;
        // }

        const result = getLetterStatuses(word);

        setStatuses((prev) => prev.map((status, idx) => idx === tryIdx ? result : status));
        setLockedRows((prev) => prev.map((locked, idx) => idx === tryIdx ? true : locked));

        if (word === WORD) {
            setGameStatus('won');
            return;
        }

        if (tryIdx + 1 >= MAX_ATTEMPTS) {
            setGameStatus('lost');
            return;
        }
        
        setTriedWords((prev) => [...prev, word]);
        setTriedLetters((prev) => {
            const next = new Set(prev);
            word.split('').forEach((letter) => next.add(letter));
            return next;
        });

        setStatuses((prev) => [...prev, Array(WORD_LENGTH).fill('blank')]);
    }

    return (
        <>
        {
            statuses.map((attempt: LetterStatus[], idx: number) => (
                <TryWord
                    key={`${idx}-${rowResetTokens[idx]}`}
                    onSubmit={(word) => checkSubmission(word, idx)}
                    status={attempt}
                    isLocked={lockedRows[idx]}
                />
            ))
        }
        {gameStatus === 'won' && <p>You got it! The word was {WORD}.</p>}
        {gameStatus === 'lost' && <p>Out of tries. The word was {WORD}.</p>}
        {gameStatus === 'tryAgain' && <p>Already guessed try again</p>}
        <h1>tried words</h1>
        {triedWords.map((word, idx) => {
            return (
                <h3 key={`${word}-${idx}`}>{word}</h3>
            )
        })}

        <h1>tried letters</h1>
        <h4>
            {[...triedLetters].join(', ')}
        </h4>
        </>
    )
}

export default Game;
