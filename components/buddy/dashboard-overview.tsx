'use client'

import {
  CheckCircle2, TrendingUp,
  Sparkles, ArrowRight,
  BookOpen, FileText, Quote, Calendar, Send, Mic, Library, TestTube2
} from 'lucide-react'
import { useBuddyStore } from '@/lib/store'

export function DashboardOverview() {
  const { getCurrentProject, setViewMode, selectSection, setVoiceNotePanelOpen, isVoiceNotePanelOpen } = useBuddyStore()
  const project = getCurrentProject()

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Select or create a project to get started</p>
      </div>
    )
  }

  const allSections = [
    project.outline.introduction,
    ...project.outline.body,
    project.outline.conclusion
  ]

  const completedSections = allSections.filter(s => s.completed).length
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
    <div className="flex-1 overflow-y-auto relative" style={{ background: '#f4f8f5' }}>
      {/* Top hero banner */}
      <div
        className="px-8 pt-8 pb-10"
        style={{
          background: 'linear-gradient(135deg, #2d8653 0%, #3dab68 60%, #5dc48a 100%)',
        }}
      >
        <div className="max-w-5xl mx-auto">
          <p className="text-green-100 text-sm font-medium mb-1 tracking-wide uppercase">Your Project</p>
          <h1 className="font-serif text-3xl font-bold text-white mb-1 text-balance leading-snug">
            {project.title}
          </h1>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleContinueWriting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-[#2d8653] font-semibold text-sm shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
            >
              <Sparkles className="h-4 w-4" />
              Continue Writing
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('canvas')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/20 text-white border border-white/30 font-semibold text-sm hover:bg-white/30 transition-all"
            >
              <TrendingUp className="h-4 w-4" />
              View Canvas
            </button>
            <button
              onClick={() => setVoiceNotePanelOpen(!isVoiceNotePanelOpen)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/20 text-white border border-white/30 font-semibold text-sm hover:bg-white/30 transition-all"
            >
              <Mic className="h-4 w-4" />
              Voice Notes
            </button>
            <button
              onClick={() => setViewMode('analyzer')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/20 text-white border border-white/30 font-semibold text-sm hover:bg-white/30 transition-all"
            >
              <TestTube2 className="h-4 w-4" />
              Stats Analyzer
            </button>
            <button
              onClick={() => setViewMode('literature')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 text-white border border-white/40 font-semibold text-sm hover:bg-white/20 transition-all"
              title="Done with your research? Check for literature gaps."
            >
              <Library className="h-4 w-4" />
              Wrap Up Research
            </button>
          </div>
        </div>
      </div>

      {/* Stats bar — single unified pill */}
      <div className="max-w-5xl mx-auto px-8 -mt-5">
        <div className="rounded-2xl bg-white shadow-sm border border-white/80 flex items-stretch divide-x divide-gray-100 overflow-hidden">

          {/* Progress */}
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-4 gap-1">
            <div className="flex items-center gap-2 mb-0.5">
              <BookOpen className="h-3.5 w-3.5" style={{ color: '#3dab68' }} />
              <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Progress</span>
            </div>
            <p className="text-2xl font-bold leading-none" style={{ color: '#3dab68' }}>
              {completedSections}<span className="text-base font-medium text-gray-300">/{allSections.length}</span>
            </p>
            <p className="text-[10px] text-gray-400 mt-1">sections done</p>
          </div>

          {/* Word Count */}
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-4 gap-1">
            <div className="flex items-center gap-2 mb-0.5">
              <FileText className="h-3.5 w-3.5" style={{ color: '#d4547a' }} />
              <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Words</span>
            </div>
            <p className="text-2xl font-bold leading-none" style={{ color: '#d4547a' }}>
              {totalWords.toLocaleString()}
            </p>
            <p className="text-[10px] text-gray-400 mt-1">words written</p>
          </div>

          {/* References */}
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-4 gap-1">
            <div className="flex items-center gap-2 mb-0.5">
              <Quote className="h-3.5 w-3.5" style={{ color: '#3dab68' }} />
              <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">References</span>
            </div>
            <p className="text-2xl font-bold leading-none" style={{ color: '#3dab68' }}>
              {totalReferences}
            </p>
            <p className="text-[10px] text-gray-400 mt-1">citations</p>
          </div>

          {/* Last Updated */}
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-4 gap-1">
            <div className="flex items-center gap-2 mb-0.5">
              <Calendar className="h-3.5 w-3.5" style={{ color: '#d4547a' }} />
              <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Updated</span>
            </div>
            <p className="text-2xl font-bold leading-none" style={{ color: '#d4547a' }}>
              {new Date(project.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
            </p>
            <p className="text-[10px] text-gray-400 mt-1">
              {new Date(project.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

        </div>
      </div>

      {/* Main content */}
      <div className="max-w-5xl mx-auto px-8 py-6 space-y-5">

        {/* Research Structure Hourglass */}
        <div className="grid grid-cols-1 gap-5">
          <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 pt-5 pb-3 border-b border-gray-50">
              <h2 className="font-semibold text-[15px] text-gray-800">Research Structure</h2>
              <p className="text-xs text-gray-400 mt-0.5">Your paper&apos;s progression through the research hourglass</p>
            </div>
            <div className="flex gap-6 items-start p-6">
              {/* Hourglass SVG */}
              <div className="shrink-0">
                {(() => {
                  const N = allSections.length
                  const SH = 60
                  const W = 200
                  const minW = 4
                  const mid = N / 2
                  const svgH = N * SH
                  const displayW = 140
                  const displayH = Math.round(svgH * (displayW / W))

                  const bw = Array.from({ length: N + 1 }, (_, i) => {
                    if (i <= mid) return Math.round(W - (W - minW) * (i / mid))
                    return Math.round(minW + (W - minW) * ((i - mid) / (N - mid)))
                  })

                  const getColor = (i: number) => {
                    const t = N <= 1 ? 1 : Math.abs(i - (N - 1) / 2) / ((N - 1) / 2)
                    const r = Math.round(212 + (61 - 212) * t)
                    const g = Math.round(84 + (171 - 84) * t)
                    const b = Math.round(122 + (104 - 122) * t)
                    return `rgb(${r},${g},${b})`
                  }

                  return (
                    <svg viewBox={`0 0 ${W} ${svgH}`} width={displayW} height={displayH}>
                      {allSections.map((section, i) => {
                        const lt = (W - bw[i]) / 2
                        const rt = (W + bw[i]) / 2
                        const lb = (W - bw[i + 1]) / 2
                        const rb = (W + bw[i + 1]) / 2
                        const yt = i * SH
                        const yb = (i + 1) * SH
                        const cy = yt + SH / 2
                        const fill = section.completed ? getColor(i) : '#e8e8e8'
                        return (
                          <g
                            key={section.id}
                            className="cursor-pointer"
                            onClick={() => { selectSection(section.id); setViewMode('writing') }}
                          >
                            <polygon
                              points={`${lt},${yt} ${rt},${yt} ${rb},${yb} ${lb},${yb}`}
                              fill={fill}
                              opacity={0.9}
                            />
                            <circle cx={100} cy={cy} r={13} fill="white" stroke={fill} strokeWidth={2} />
                            <text
                              x={100} y={cy + 4.5}
                              textAnchor="middle"
                              fontSize="11"
                              fontWeight="700"
                              fill={section.completed ? getColor(i) : '#bbb'}
                            >
                              {i + 1}
                            </text>
                          </g>
                        )
                      })}
                    </svg>
                  )
                })()}
              </div>

              {/* Section labels */}
              <div className="flex-1 space-y-1 min-w-0">
                {allSections.map((section) => {
                  const wordCount = section.content?.split(/\s+/).filter(Boolean).length || 0
                  return (
                    <button
                      key={section.id}
                      onClick={() => { selectSection(section.id); setViewMode('writing') }}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors flex items-start gap-3 group"
                    >
                      <CheckCircle2
                        className={`h-4 w-4 mt-0.5 shrink-0 transition-colors ${section.completed ? 'text-[#3dab68]' : 'text-gray-200 group-hover:text-gray-300'}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${section.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                          {section.title}
                        </p>
                      </div>
                      <span className="text-xs text-gray-300 shrink-0 tabular-nums">{wordCount}w</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* AI input */}
        <div
          className="flex items-center gap-3 rounded-2xl px-4 py-3 shadow-sm border border-gray-100"
          style={{ background: 'white' }}
        >
          <Sparkles className="h-4 w-4 shrink-0" style={{ color: '#3dab68' }} />
          <input
            type="text"
            placeholder="Ask Buddy anything about your research…"
            className="flex-1 text-sm text-gray-700 placeholder:text-gray-400 bg-transparent border-none outline-none"
          />
          <button
            className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0 transition-all hover:opacity-90"
            style={{ background: '#3dab68' }}
          >
            <Send className="h-3.5 w-3.5 text-white" />
          </button>
        </div>

        <div className="h-6" />
      </div>
    </div>
  )
}
