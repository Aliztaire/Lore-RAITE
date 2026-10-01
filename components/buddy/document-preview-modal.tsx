'use client'

import { useEffect, useRef } from 'react'
import { X, Download } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import type { Project } from '@/lib/types'
import { Button } from '@/components/ui/button'

interface DocumentPreviewModalProps {
  project: Project
  onClose: () => void
  onExport?: () => void
}

export function DocumentPreviewModal({ project, onClose, onExport }: DocumentPreviewModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const allSections = [
    project.outline.introduction,
    ...project.outline.body,
    project.outline.conclusion,
  ]

  const wordCount = allSections.reduce((acc, s) => acc + (s.content?.split(/\s+/).filter(Boolean).length || 0), 0)

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Preview of ${project.title}`}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-muted animate-in fade-in-0 duration-150"
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
    >
      {/* Toolbar */}
      <div className="fixed top-0 left-0 right-0 z-10 h-14 flex items-center justify-between px-6 border-b border-border bg-card">
        <div className="flex items-baseline gap-3 min-w-0">
          <span className="eyebrow shrink-0">Preview</span>
          <span className="font-serif text-sm font-semibold truncate">{project.title}</span>
          <span className="text-xs text-subtle-foreground tabular-nums shrink-0">{wordCount.toLocaleString()} words</span>
        </div>
        <div className="flex items-center gap-2">
          {onExport && (
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download /> Export .docx
            </Button>
          )}
          <Button variant="ghost" size="icon-sm" className="text-muted-foreground" onClick={onClose} aria-label="Close preview">
            <X />
          </Button>
        </div>
      </div>

      {/* Page */}
      <div className="mt-24 mb-16 w-full max-w-[816px] mx-auto px-4">
        <div
          className="border border-[#ddd6c9]"
          style={{
            background: '#fff',
            padding: '96px 96px 120px',
            minHeight: '1056px',
            fontFamily: '"Times New Roman", Times, serif',
          }}
        >
          {/* Title block */}
          <div className="text-center mb-10">
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', lineHeight: 1.3, marginBottom: '12px', color: '#111' }}>
              {project.title}
            </h1>
            {project.topic && (
              <p style={{ fontSize: '13px', fontStyle: 'italic', color: '#555', lineHeight: 1.6 }}>
                {project.topic}
              </p>
            )}
            <div style={{ marginTop: '32px', borderBottom: '1.5px solid #ddd' }} />
          </div>

          {/* Sections */}
          {allSections.map((section, idx) => (
            <div key={section.id} style={{ marginBottom: '40px' }}>
              {/* Section heading */}
              <h2 style={{
                fontSize: '14px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: '#222',
                marginBottom: '14px',
                marginTop: idx === 0 ? 0 : '36px',
                paddingBottom: '4px',
                borderBottom: '1px solid #e5e5e5',
              }}>
                {section.title}
              </h2>

              {/* Content — rendered as markdown */}
              {section.content ? (
                <div className="doc-content" style={{ fontSize: '12px', lineHeight: '1.9', color: '#222', textAlign: 'justify' }}>
                  <ReactMarkdown
                    components={{
                      h1: ({ children }) => <h3 style={{ fontSize: '13px', fontWeight: 'bold', marginTop: '18px', marginBottom: '6px' }}>{children}</h3>,
                      h2: ({ children }) => <h4 style={{ fontSize: '12.5px', fontWeight: 'bold', marginTop: '14px', marginBottom: '6px' }}>{children}</h4>,
                      h3: ({ children }) => <h5 style={{ fontSize: '12px', fontWeight: 'bold', marginTop: '12px', marginBottom: '4px' }}>{children}</h5>,
                      p: ({ children }) => <p style={{ marginBottom: '12px', textIndent: '2em' }}>{children}</p>,
                      strong: ({ children }) => <strong style={{ fontWeight: 'bold' }}>{children}</strong>,
                      em: ({ children }) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
                      ul: ({ children }) => <ul style={{ listStyleType: 'disc', paddingLeft: '2em', marginBottom: '12px' }}>{children}</ul>,
                      ol: ({ children }) => <ol style={{ listStyleType: 'decimal', paddingLeft: '2em', marginBottom: '12px' }}>{children}</ol>,
                      li: ({ children }) => <li style={{ marginBottom: '4px' }}>{children}</li>,
                      table: ({ children }) => (
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px', fontSize: '11px' }}>{children}</table>
                      ),
                      th: ({ children }) => (
                        <th style={{ border: '1px solid #ccc', padding: '6px 10px', background: '#f5f5f5', fontWeight: 'bold', textAlign: 'left' }}>{children}</th>
                      ),
                      td: ({ children }) => (
                        <td style={{ border: '1px solid #ccc', padding: '6px 10px' }}>{children}</td>
                      ),
                      blockquote: ({ children }) => (
                        <blockquote style={{ borderLeft: '3px solid #ccc', paddingLeft: '16px', marginLeft: '2em', marginBottom: '12px', fontStyle: 'italic', color: '#555' }}>{children}</blockquote>
                      ),
                      code: ({ children }) => (
                        <code style={{ fontFamily: 'monospace', fontSize: '11px', background: '#f4f4f4', padding: '1px 4px', borderRadius: '2px' }}>{children}</code>
                      ),
                    }}
                  >
                    {section.content}
                  </ReactMarkdown>
                </div>
              ) : (
                <p style={{ fontSize: '12px', fontStyle: 'italic', color: '#aaa', lineHeight: 1.9 }}>
                  [No content yet]
                </p>
              )}

            </div>
          ))}

          {/* Consolidated References at the end */}
          {(() => {
            const allRefs = allSections.flatMap(s => s.references)
            const seen = new Set<string>()
            const unique = allRefs.filter(r => {
              const key = r.doi || r.title
              if (seen.has(key)) return false
              seen.add(key)
              return true
            })
            if (unique.length === 0) return null
            return (
              <div style={{ marginTop: '48px', paddingTop: '24px', borderTop: '2px solid #222' }}>
                <h2 style={{
                  fontSize: '14px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: '#222',
                  marginBottom: '18px',
                }}>
                  References
                </h2>
                {unique.map(ref => (
                  <p key={ref.id} style={{ fontSize: '11px', lineHeight: 1.8, color: '#333', paddingLeft: '2em', textIndent: '-2em', marginBottom: '8px' }}>
                    {ref.citation || `${ref.authors.join(', ')} (${ref.year}). ${ref.title}.`}
                  </p>
                ))}
              </div>
            )
          })()}

          {/* Footer rule */}
          <div style={{ borderTop: '1px solid #e0e0e0', marginTop: '40px', paddingTop: '14px', textAlign: 'center' }}>
            <p style={{ fontSize: '10px', color: '#bbb', letterSpacing: '0.04em' }}>
              Generated by Buddy &mdash; AI Research Assistant
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
