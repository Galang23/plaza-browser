import React from 'react'
import ReactDOM from 'react-dom/client'
import { InternalPageStub } from '../shared/InternalPageStub'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <InternalPageStub
      title="Settings"
      route="about:settings"
      message="Settings page scaffold. Sections will land in v1.4.0: General, Privacy, Workspace defaults, Performance, Permissions, About."
    />
  </React.StrictMode>
)
