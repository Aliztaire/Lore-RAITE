'use client'

import { useEffect, useRef } from 'react'
import {
  CheckCircle2, Network, PenTool,
  Sparkles, ArrowRight,
  BookOpen, FileText, Quote, Calendar, Mic, Library, TestTube2
} from 'lucide-react'
import { useBuddyStore } from '@/lib/store'
import confetti from 'canvas-confetti'

export function DashboardOverview() {
  const { getCurrentProject, setViewMode, selectSection, setVoiceNotePanelOpen, isVoiceNotePanelOpen } = useBuddyStore()
  const project = getCurrentProject()
  const celebratedRef = useRef(false)

  const allSections = project ? [
    project.outline.introduction,
    ...project.outline.body,
    project.outline.conclusion
  ] : []

  const completedSections = allSections.filter(s => s.completed).length
  const isFullyComplete = allSections.length > 0 && completedSections === allSections.length

  useEffect(() => {
    if (isFullyComplete && !celebratedRef.current) {
      celebratedRef.current = true
      const end = Date.now() + 3000
      const colors = ['#9bb067', '#fb804a', '#ffce5d', '#381d18', '#fef5dd']
      const frame = () => {
        confetti({ particleCount: 6, angle: 60, spread: 55, origin: { x: 0 }, colors })
        confetti({ particleCount: 6, angle: 120, spread: 55, origin: { x: 1 }, colors })
        if (Date.now() < end) requestAnimationFrame(frame)
      }
      frame()
    }
    if (!isFullyComplete) celebratedRef.current = false
  }, [isFullyComplete])

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Select or create a project to get started</p>
      </div>
    )
  }
  const totalWords = allSections.reduce((acc, s) =>
    acc + (s.content?.split(/\s+/).filter(Boolean).length || 0), 0
  )
  const totalReferences = allSections.reduce((acc, s) => acc + s.references.length, 0)
  const nextIncompleteSection = allSections.find(s => !s.completed)

  const handleContinueWriting = () => {
    if (nextIncompleteSection) {
      selectSection(nextIncompleteSection.id)
      setViewMode('writing')
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-y-auto" style={{ background: '#fdfbfd' }}>
      {/* Top hero banner */}
      <div
        className="px-8 pt-8 pb-10"
        style={{
          background: '#fef5dd',
        }}
      >
        <div className="max-w-5xl mx-auto">
          <p className="text-sm font-medium mb-1 tracking-wide uppercase" style={{ color: 'rgba(56,29,24,0.6)' }}>Your Project</p>
          <h1 className="font-serif text-3xl font-bold mb-4 text-balance leading-snug" style={{ color: '#381d18' }}>
            {project.title}
          </h1>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-3">
            {/* Continue Writing */}
            <div className="relative group">
              <button
                onClick={handleContinueWriting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
                style={{ backgroundColor: '#381d18', color: '#ffffff' }}
              >
                <PenTool className="h-4 w-4" />
                Continue Writing
                <ArrowRight className="h-4 w-4" />
              </button>
              <div className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 w-52 rounded-xl bg-white/95 text-gray-700 text-xs px-3 py-2 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-20 text-center leading-relaxed">
                Pick up where you left off and keep writing your paper with AI assistance.
              </div>
            </div>

            {/* View Canvas */}
            <div className="relative group">
              <button
                onClick={() => setViewMode('canvas')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm hover:opacity-80 transition-all border"
                style={{ backgroundColor: 'rgba(56,29,24,0.12)', color: '#381d18', borderColor: 'rgba(56,29,24,0.25)' }}
              >
                <Network className="h-4 w-4" />
                View Canvas
              </button>
              <div className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 w-52 rounded-xl bg-white/95 text-gray-700 text-xs px-3 py-2 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-20 text-center leading-relaxed">
                Visualize how your ideas and sections connect on an interactive concept map.
              </div>
            </div>

            {/* Voice Notes */}
            <div className="relative group">
              <button
                onClick={() => setVoiceNotePanelOpen(!isVoiceNotePanelOpen)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm hover:opacity-80 transition-all border"
                style={{ backgroundColor: 'rgba(56,29,24,0.12)', color: '#381d18', borderColor: 'rgba(56,29,24,0.25)' }}
              >
                <Mic className="h-4 w-4" />
                Voice Notes
              </button>
              <div className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 w-52 rounded-xl bg-white/95 text-gray-700 text-xs px-3 py-2 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-20 text-center leading-relaxed">
                Record quick voice memos for ideas you don&apos;t want to lose while researching.
              </div>
            </div>

            {/* Stats Analyzer */}
            <div className="relative group">
              <button
                onClick={() => setViewMode('analyzer')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm hover:opacity-80 transition-all border"
                style={{ backgroundColor: 'rgba(56,29,24,0.12)', color: '#381d18', borderColor: 'rgba(56,29,24,0.25)' }}
              >
                <TestTube2 className="h-4 w-4" />
                Stats Analyzer
              </button>
              <div className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 w-52 rounded-xl bg-white/95 text-gray-700 text-xs px-3 py-2 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-20 text-center leading-relaxed">
                Analyze and interpret statistical data relevant to your research topic.
              </div>
            </div>

            {/* Wrap Up Research */}
            <div className="relative group">
              <button
                onClick={() => setViewMode('literature')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm hover:opacity-80 transition-all border"
                style={{ backgroundColor: 'rgba(56,29,24,0.12)', color: '#381d18', borderColor: 'rgba(56,29,24,0.25)' }}
              >
                <Library className="h-4 w-4" />
                Wrap Up Research
              </button>
              <div className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 w-52 rounded-xl bg-white/95 text-gray-700 text-xs px-3 py-2 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-20 text-center leading-relaxed">
                Scan your paper for literature gaps and get suggestions to strengthen your RRL.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats bar + Research Structure */}
      <div className="flex-1 flex flex-col w-full px-8 pb-6 min-h-0">

        {/* Stats bar */}
        <div className="-mt-5 mb-6">
          <div className="rounded-2xl bg-white shadow-sm border border-white/80 flex items-stretch divide-x divide-gray-100 overflow-hidden">

            {/* Progress */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 py-2.5 gap-1">
              <div className="flex items-center gap-2 mb-0.5">
                <BookOpen className="h-3.5 w-3.5" style={{ color: '#fb804a' }} />
                <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Progress</span>
              </div>
              <p className="text-2xl font-bold leading-none" style={{ color: '#fb804a' }}>
                {completedSections}<span className="text-base font-medium text-gray-300">/{allSections.length}</span>
              </p>
              <p className="text-[10px] text-gray-400 mt-1">sections done</p>
            </div>

            {/* Word Count */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 py-2.5 gap-1">
              <div className="flex items-center gap-2 mb-0.5">
                <FileText className="h-3.5 w-3.5" style={{ color: '#381d18' }} />
                <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Words</span>
              </div>
              <p className="text-2xl font-bold leading-none" style={{ color: '#381d18' }}>
                {totalWords.toLocaleString()}
              </p>
              <p className="text-[10px] text-gray-400 mt-1">words written</p>
            </div>

            {/* References */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 py-2.5 gap-1">
              <div className="flex items-center gap-2 mb-0.5">
                <Quote className="h-3.5 w-3.5" style={{ color: '#ffce5d' }} />
                <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Sources</span>
              </div>
              <p className="text-2xl font-bold leading-none" style={{ color: '#ffce5d' }}>
                {totalReferences}
              </p>
              <p className="text-[10px] text-gray-400 mt-1">sources found</p>
            </div>

            {/* Last Updated */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 py-2.5 gap-1">
              <div className="flex items-center gap-2 mb-0.5">
                <Calendar className="h-3.5 w-3.5" style={{ color: '#fb804a' }} />
                <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Updated</span>
              </div>
              <p className="text-2xl font-bold leading-none" style={{ color: '#fb804a' }}>
                {new Date(project.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
              </p>
              <p className="text-[10px] text-gray-400 mt-1">
                {new Date(project.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>

          </div>
        </div>

        {/* Research Structure */}
        <div className="flex flex-col pt-6 w-full">
          <div className="mb-4">
            <h2 className="font-semibold text-[30px] text-gray-800">Research Structure</h2>
            <p className="text-s text-gray-400 mt-0.5">Your paper&apos;s research structure</p>
          </div>
          <div className="flex items-stretch">
            {/* CSS Teddy Bear */}
            <div className="w-1/2 flex items-center justify-center py-2 overflow-visible">
              {(() => {
                const fillPercent = allSections.length > 0 ? completedSections / allSections.length : 0
                const grayClip = `inset(0 0 ${fillPercent * 100}% 0)`
                const colorClip = `inset(${(1 - fillPercent) * 100}% 0 0 0)`
                return (
                  <div style={{ position: 'relative', width: '240px', height: '320px', overflow: 'visible' }}>
                    <div className="bear-scene" style={{ position: 'absolute', top: 0, left: 0, filter: 'grayscale(1) brightness(0.85)', clipPath: grayClip, transition: 'clip-path 0.6s ease' }}>
                      <div className="teddy-bear" />
                    </div>
                    <div className="bear-scene" style={{ position: 'absolute', top: 0, left: 0, clipPath: colorClip, transition: 'clip-path 0.6s ease' }}>
                      <div className="teddy-bear" />
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* Section labels */}
            <div className="w-1/2 flex flex-col gap-2 overflow-y-auto max-h-90 pr-1">
              {allSections.map((section) => {
                const wordCount = section.content?.split(/\s+/).filter(Boolean).length || 0
                return (
                  <button
                    key={section.id}
                    onClick={() => { selectSection(section.id); setViewMode('writing') }}
                    className="w-full text-left px-4 py-3 rounded-xl hover:bg-orange-50 transition-colors flex items-center gap-3 group"
                  >
                    <CheckCircle2
                      className={`h-4 w-4 shrink-0 transition-colors ${section.completed ? '' : 'text-gray-200 group-hover:text-gray-300'}`}
                      style={section.completed ? { color: '#fb804a' } : {}}
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${section.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                        {section.title}
                      </p>
                    </div>
                    <span className="text-xs text-gray-300 tabular-nums mr-2">{wordCount}w</span>
                    <span className="hidden group-hover:flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap" style={{ color: '#fb804a', background: '#fff3e0' }}>
                      <Sparkles className="h-3.5 w-3.5" />
                      Buddy can help
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
