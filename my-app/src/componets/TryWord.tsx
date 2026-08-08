import { useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'
import './TryWord.css'

export const WORD_LENGTH = 5
export type LetterStatus = 'correct' | 'present' | 'absent' | 'blank'

interface TryWordProps {
  onSubmit?: (word: string) => void,
  status?: LetterStatus[],
  isLocked?: boolean
}

function TryWord({ onSubmit, status, isLocked }: TryWordProps) {
  const [letters, setLetters] = useState<string[]>(Array(WORD_LENGTH).fill(''))
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])

  const handleChange = (index: number, e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^a-zA-Z]/g, '').slice(-1)

    setLetters((prev) => {
      const next = [...prev]
      next[index] = value.toUpperCase()
      return next
    })

    if (value && index < WORD_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !letters[index] && index > 0) {
      inputsRef.current[index - 1]?.focus()
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputsRef.current[index - 1]?.focus()
    } else if (e.key === 'ArrowRight' && index < WORD_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus()
    } else if (e.key === 'Enter') {
      handleEnter()
    }
  }

  const handleEnter = () => {
    const word = letters.join('')
    if (word.length !== WORD_LENGTH) return
    onSubmit?.(word)
  }

  return (
    <div className="try-word">
      <div className="try-word-boxes">
        {letters.map((letter, index) => (
          <input
            key={index}
            ref={(el) => {
              inputsRef.current[index] = el
            }}
            className={`try-word-box try-word-box--${status?.[index] ?? 'blank'}`}
            type="text"
            inputMode="text"
            maxLength={1}
            value={letter}
            onChange={(e) => handleChange(index, e)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            disabled={isLocked}
          />
        ))}
      </div>
      <button
        className={`try-word-enter${isLocked ? ' try-word-enter--hidden' : ''}`}
        type="button"
        onClick={handleEnter}
        disabled={letters.some((l) => !l) || isLocked}
      >
        Enter
      </button>
    </div>
  )
}

export default TryWord
