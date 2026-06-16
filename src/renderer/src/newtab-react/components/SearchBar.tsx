import { useEffect, useRef } from 'react'

interface Props {
  query: string
  onQueryChange: (q: string) => void
  onSearch: (q: string) => void
}

export default function SearchBar({ query, onQueryChange, onSearch }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement === document.body) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = query.trim()
    if (trimmed) onSearch(trimmed)
  }

  return (
    <div className="newtab-search">
      <form onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search the web..."
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          autoFocus
          spellCheck="false"
        />
        {query && (
          <button
            type="button"
            className="search-clear-btn"
            onClick={() => onQueryChange('')}
            aria-label="Clear search"
          >
            &times;
          </button>
        )}
      </form>
    </div>
  )
}
