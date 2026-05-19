import { useRef, useEffect } from 'react'
import { useStore } from '../store/useStore'

export function FindOverlay() {
  const findText = useStore((s) => s.findText)
  const setFindText = useStore((s) => s.setFindText)
  const findResult = useStore((s) => s.findResult)
  const findOptions = useStore((s) => s.findOptions)
  const setFindOptions = useStore((s) => s.setFindOptions)
  const setShowFind = useStore((s) => s.setShowFind)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFind = (text: string, options?: { forward?: boolean; findNext?: boolean }) => {
    if (!text) {
      window.electron.stopFind('clearSelection')
      return
    }
    window.electron.findInPage(text, options)
  }

  useEffect(() => {
    inputRef.current?.focus()
    if (findText) {
      handleFind(findText)
    }
  }, [])

  const handleInputChange = (val: string) => {
    setFindText(val)
    setFindOptions({ forward: true })
    if (val) {
      window.electron.findInPage(val)
    } else {
      window.electron.stopFind('clearSelection')
    }
  }

  const handleNext = () => {
    setFindOptions({ forward: true })
    handleFind(findText, { forward: true, findNext: true })
  }

  const handlePrev = () => {
    setFindOptions({ forward: false })
    handleFind(findText, { forward: false, findNext: true })
  }

  const handleClose = () => {
    window.electron.stopFind('clearSelection')
    setShowFind(false)
    setFindText('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.shiftKey ? handlePrev() : handleNext()
    }
    if (e.key === 'Escape') {
      handleClose()
    }
  }

  return (
    <div className="find-overlay">
      <input
        ref={inputRef}
        value={findText}
        onChange={(e) => handleInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Find in page..."
      />
      <span className={`find-count${findText && findResult.matches === 0 ? ' no-results' : ''}`}>
        {findText
          ? findResult.matches > 0
            ? `${findResult.activeMatchOrdinal}/${findResult.matches}`
            : 'No results'
          : ''}
      </span>
      <button className="find-nav-btn" onClick={handlePrev} title="Previous">
        &#8593;
      </button>
      <button className="find-nav-btn" onClick={handleNext} title="Next">
        &#8595;
      </button>
      <button className="find-close-btn" onClick={handleClose} title="Close">
        &times;
      </button>
    </div>
  )
}
