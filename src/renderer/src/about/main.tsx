import React from 'react'
import ReactDOM from 'react-dom/client'
import { InternalPageStub } from '../shared/InternalPageStub'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <InternalPageStub
      title="About Plaza Browser"
      route="about:about"
      message="About page scaffold. App version, build date, dependency versions, license, and docs links will land in v1.4.0."
    />
  </React.StrictMode>
)
