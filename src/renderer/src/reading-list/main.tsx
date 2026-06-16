import React from 'react'
import ReactDOM from 'react-dom/client'
import { InternalPageStub } from '../shared/InternalPageStub'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <InternalPageStub
      title="Reading List"
      route="about:reading-list"
      message="Reading list scaffold. Saved articles, mark-as-read, and the Save-to-Reading-List context menu action will land in v1.4.0."
    />
  </React.StrictMode>
)
