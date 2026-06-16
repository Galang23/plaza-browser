import React, { useState, useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'
import { TabInfo } from '../types'
import './TabSearchModal.css'

export const TabSearchModal: React.FC = () => {
  const showTabSearch = useStore((state) => state.showTabSearch)
  const setShowTabSearch = useStore((state) => state.setShowTabSearch)
  const tabs = useStore((state) => state.tabs)
  
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  
  useEffect(() => {
    if (showTabSearch) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [showTabSearch])
  
  if (!showTabSearch) return null

  // Basic fuzzy search logic
  const lowerQuery = query.toLowerCase()
  const filteredTabs = tabs.filter(t => 
    t.title.toLowerCase().includes(lowerQuery) || t.url.toLowerCase().includes(lowerQuery)
  ).slice(0, 10)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowTabSearch(false)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, filteredTabs.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      const selectedTab = filteredTabs[selectedIndex]
      if (selectedTab) {
        window.electron.switchTab(selectedTab.id)
        setShowTabSearch(false)
      }
    }
  }

  return (
    <div className="tab-search-overlay" onClick={() => setShowTabSearch(false)}>
      <div className="tab-search-modal" onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="text"
          className="tab-search-input"
          placeholder="Search tabs by title or URL..."
          value={query}
          onChange={e => {
            setQuery(e.target.value)
            setSelectedIndex(0)
          }}
          onKeyDown={handleKeyDown}
        />
        <div className="tab-search-results">
          {filteredTabs.map((tab, idx) => (
            <div
              key={tab.id}
              className={`tab-search-item ${idx === selectedIndex ? 'selected' : ''}`}
              onClick={() => {
                window.electron.switchTab(tab.id)
                setShowTabSearch(false)
              }}
              onMouseEnter={() => setSelectedIndex(idx)}
            >
              {tab.favicon ? (
                <img className="favicon" src={tab.favicon} alt="" />
              ) : (
                <span className="favicon-fallback">📄</span>
              )}
              <div className="tab-info">
                <span className="tab-title">{tab.title || 'New Tab'}</span>
                <span className="tab-url">{tab.url}</span>
              </div>
            </div>
          ))}
          {filteredTabs.length === 0 && (
            <div className="tab-search-empty">No matching tabs found.</div>
          )}
        </div>
      </div>
    </div>
  )
}
