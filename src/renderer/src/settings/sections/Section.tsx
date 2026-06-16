import React from 'react'
import {
  sectionCardStyle,
  sectionTitleStyle,
  placeholderNoteStyle
} from '../../shared/internalPageStyles'

type SectionProps = {
  id: string
  title: string
  citation?: string
  children?: React.ReactNode
}

export function Section({ id, title, citation, children }: SectionProps): React.ReactElement {
  return (
    <section id={id} style={sectionCardStyle}>
      <h2 style={sectionTitleStyle}>{title}</h2>
      {children ?? <p style={placeholderNoteStyle}>{citation ?? 'Coming in a future v1.4.x release.'}</p>}
    </section>
  )
}
