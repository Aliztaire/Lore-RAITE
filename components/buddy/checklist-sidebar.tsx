'use client'

import { Check, ChevronRight, BookOpen, FileText } from 'lucide-react'
import { useBuddyStore } from '@/lib/store'
import type { OutlineSection } from '@/lib/types'
import { cn } from '@/lib/utils'

export function ChecklistSidebar() {
  const { getCurrentProject, selectedSectionId, selectSection, toggleSectionComplete, setViewMode } = useBuddyStore()
  const project = getCurrentProject()

  if (!project) return null

  const allSections = [
    project.outline.introduction,
    ...project.outline.body,
    project.outline.conclusion
  ]

  const completedCount = allSections.filter(s => s.completed).length
  const progress = (completedCount / allSections.length) * 100

  const handleSectionClick = (section: OutlineSection) => {
    selectSection(section.id)
    setViewMode('writing')
  }

  const SectionItem = ({ section, depth = 0 }: { section: OutlineSection; depth?: number }) => {
    const isSelected = selectedSectionId === section.id
    
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => handleSectionClick(section)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleSectionClick(section)
          }
        }}
        className={cn(
          'w-full text-left px-3 py-2 rounded-lg transition-colors cursor-pointer',
          'flex items-start gap-3 group',
          isSelected ? 'bg-primary/10 text-foreground' : 'hover:bg-secondary text-foreground/80',
          depth > 0 && 'ml-4'
        )}
      >
        <button
          onClick={(e) => {
            e.stopPropagation()
            toggleSectionComplete(section.id)
          }}
          className={cn(
            'mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 transition-colors',
            'flex items-center justify-center',
            section.completed 
              ? 'bg-primary border-primary text-primary-foreground' 
              : 'border-muted-foreground/40 hover:border-primary'
          )}
        >
          {section.completed && <Check className="h-3 w-3" />}
        </button>
        
        <div className="flex-1 min-w-0">
          <div className={cn(
            'text-sm font-medium truncate',
            section.completed && 'line-through text-muted-foreground'
          )}>
            {section.title}
          </div>
          <div className="text-xs text-muted-foreground truncate mt-0.5">
            {section.description}
          </div>
        </div>

        <ChevronRight className={cn(
          'h-4 w-4 text-muted-foreground transition-transform mt-0.5 flex-shrink-0',
          'opacity-0 group-hover:opacity-100',
          isSelected && 'opacity-100'
        )} />
      </div>
    )
  }

  return (
    <aside className="w-72 border-r border-border bg-card/30 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="h-5 w-5 text-primary" />
          <h2 className="font-serif font-semibold">Paper Outline</h2>
        </div>
        
        {/* Progress Bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{completedCount} / {allSections.length}</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Sections List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {/* Introduction */}
        <div className="mb-2">
          <div className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Opening
          </div>
          <SectionItem section={project.outline.introduction} />
        </div>

        {/* Body Sections */}
        <div className="mb-2">
          <div className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Body
          </div>
          {project.outline.body.map((section) => (
            <SectionItem key={section.id} section={section} />
          ))}
        </div>

        {/* Conclusion */}
        <div>
          <div className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Closing
          </div>
          <SectionItem section={project.outline.conclusion} />
        </div>
      </div>

      {/* Footer Stats */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <FileText className="h-4 w-4" />
          <span>
            {allSections.reduce((acc, s) => acc + (s.content?.split(/\s+/).filter(Boolean).length || 0), 0)} words written
          </span>
        </div>
      </div>
    </aside>
  )
}
