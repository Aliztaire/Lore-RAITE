"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  Send,
  Mic,
  MicOff,
  AlertTriangle,
  BookMarked,
  Plus,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  X,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import ReactMarkdown from "react-markdown";
import { useBuddyStore } from "@/lib/store";
import type { ChatMessage, Reference } from "@/lib/types";
import { cn } from "@/lib/utils";

// ─── APA 7 Formatting Helpers ─────────────────────────────────────────────────

function toAPA7Author(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return fullName;
  if (parts.length === 1) return parts[0];

  const lastName = parts[parts.length - 1];
  const initials = parts
    .slice(0, -1)
    .map((p) => p[0].toUpperCase() + ".")
    .join(" ");
  return `${lastName}, ${initials}`;
}

function buildAuthorString(authors: string[]): string {
  const formatted = authors.map(toAPA7Author);
  if (formatted.length === 0) return "Unknown Author";
  if (formatted.length === 1) return formatted[0];
  if (formatted.length === 2) return `${formatted[0]}, & ${formatted[1]}`;
  if (formatted.length <= 20)
    return (
      formatted.slice(0, -1).join(", ") +
      ", & " +
      formatted[formatted.length - 1]
    );
  return (
    formatted.slice(0, 19).join(", ") +
    ", . . . " +
    formatted[formatted.length - 1]
  );
}

interface ArticleData {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  journal: string | null;
  volume: string | null;
  issue: string | null;
  first_page: string | null;
  last_page: string | null;
  doi: string | null;
  abstract: string;
  cited_by: number;
}

function buildAPA7Citation(article: ArticleData): string {
  const authorStr = buildAuthorString(article.authors);
  const year = article.year ? `(${article.year})` : "(n.d.)";

  let citation = `${authorStr} ${year}. ${article.title || "Untitled"}.`;

  if (article.journal) {
    citation += ` ${article.journal}`;
    if (article.volume) {
      citation += `, ${article.volume}`;
      if (article.issue) citation += `(${article.issue})`;
    }
    if (article.first_page) {
      const pages = article.last_page
        ? `${article.first_page}–${article.last_page}`
        : article.first_page;
      citation += `, ${pages}`;
    }
    citation += ".";
  }

  if (article.doi) {
    const doiUrl = article.doi.startsWith("http")
      ? article.doi
      : `https://doi.org/${article.doi}`;
    citation += ` ${doiUrl}`;
  }

  return citation;
}

function articleToReference(article: ArticleData): Reference {
  return {
    id: article.id || Math.random().toString(36).substring(2, 15),
    title: article.title || "Untitled",
    authors: Array.isArray(article.authors) ? article.authors : [],
    year: article.year?.toString() ?? "n.d.",
    type: "article",
    citation: buildAPA7Citation(article),
    doi: article.doi ?? undefined,
    journal: article.journal ?? undefined,
    volume: article.volume ?? undefined,
    issue: article.issue ?? undefined,
    pages:
      article.first_page && article.last_page
        ? `${article.first_page}–${article.last_page}`
        : (article.first_page ?? undefined),
    notes: article.abstract || "",
  };
}

function formatCitation(ref: Reference, style: "APA" | "MLA" | "Chicago"): string {
  const { title, authors, year, journal, volume, issue, pages, doi } = ref;

  if (!authors || authors.length === 0 || !title) return ref.citation;

  if (style === "APA") {
    return ref.citation;
  }

  if (style === "MLA") {
    let authorStr = "";
    if (authors.length === 1) {
      const parts = authors[0].trim().split(/\s+/);
      authorStr = parts.length > 1 ? `${parts.pop()}, ${parts.join(" ")}` : authors[0];
    } else if (authors.length === 2) {
      const parts1 = authors[0].trim().split(/\s+/);
      const a1 = parts1.length > 1 ? `${parts1.pop()}, ${parts1.join(" ")}` : authors[0];
      authorStr = `${a1}, and ${authors[1]}`;
    } else if (authors.length > 2) {
      const parts1 = authors[0].trim().split(/\s+/);
      const a1 = parts1.length > 1 ? `${parts1.pop()}, ${parts1.join(" ")}` : authors[0];
      authorStr = `${a1}, et al`;
    }

    let cit = `${authorStr}. "${title}."`;
    if (journal) cit += ` ${journal},`;
    if (volume) cit += ` vol. ${volume},`;
    if (issue) cit += ` no. ${issue},`;
    if (year && year !== "n.d.") cit += ` ${year},`;
    if (pages) cit += ` pp. ${pages}.`;
    if (doi) {
      const doiUrl = doi.startsWith("http") ? doi : `https://doi.org/${doi}`;
      cit += ` ${doiUrl}.`;
    }
    return cit.replace(/,\./g, '.');
  }

  if (style === "Chicago") {
    let authorStr = "";
    if (authors.length === 1) {
      const parts = authors[0].trim().split(/\s+/);
      authorStr = parts.length > 1 ? `${parts.pop()}, ${parts.join(" ")}` : authors[0];
    } else if (authors.length > 1 && authors.length <= 10) {
      const parts1 = authors[0].trim().split(/\s+/);
      const a1 = parts1.length > 1 ? `${parts1.pop()}, ${parts1.join(" ")}` : authors[0];
      const others = authors.slice(1).join(", ");
      authorStr = `${a1}, ${others}`;
    } else if (authors.length > 10) {
      const parts1 = authors[0].trim().split(/\s+/);
      const a1 = parts1.length > 1 ? `${parts1.pop()}, ${parts1.join(" ")}` : authors[0];
      authorStr = `${a1} et al`;
    }

    const yr = year && year !== "n.d." ? year : "n.d.";
    let cit = `${authorStr}. ${yr}. "${title}."`;
    if (journal) {
      cit += ` ${journal} ${volume || ""}`;
      if (issue) cit += `(${issue})`;
      if (pages) cit += `: ${pages}.`;
      else cit += ".";
    }
    if (doi) {
      const doiUrl = doi.startsWith("http") ? doi : `https://doi.org/${doi}`;
      cit += ` ${doiUrl}.`;
    }
    return cit;
  }

  return ref.citation;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function WritingView() {
  const {
    getCurrentProject,
    selectedSectionId,
    updateSection,
    sectionChats,
    addSectionMessage,
    setViewMode,
    addToBibliography,
    removeFromBibliography,
  } = useBuddyStore();

  const project = getCurrentProject();
  const [chatInput, setChatInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [showReferenceForm, setShowReferenceForm] = useState(false);
  const [expandedRefId, setExpandedRefId] = useState<string | null>(null);
  const [refsOpen, setRefsOpen] = useState(true);
  const [citationStyle, setCitationStyle] = useState<"APA" | "MLA" | "Chicago">("APA");
  const [chatHeight, setChatHeight] = useState(288);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isResizingChat = useRef(false);

  const startChatResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingChat.current = true;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    const onMouseMove = (ev: MouseEvent) => {
      if (!isResizingChat.current) return;
      const container = (e.target as HTMLElement).closest('.writing-col') as HTMLElement;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const newHeight = rect.bottom - ev.clientY;
      setChatHeight(Math.min(Math.max(newHeight, 160), 520));
    };
    const onMouseUp = () => {
      isResizingChat.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, []);

  const processedToolCallIds = useRef(new Set<string>());

  // ── Section helpers ──────────────────────────────────────────────────────────

  const getCurrentSection = useCallback(() => {
    if (!project || !selectedSectionId) return null;
    if (project.outline.introduction.id === selectedSectionId)
      return project.outline.introduction;
    if (project.outline.conclusion.id === selectedSectionId)
      return project.outline.conclusion;
    return project.outline.body.find((s) => s.id === selectedSectionId) ?? null;
  }, [project, selectedSectionId]);

  const currentSection = getCurrentSection();

  // ── useChat ──────────────────────────────────────────────────────────────────

  const { messages, setMessages, sendMessage, status } = useChat({
    id: selectedSectionId || "default",
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ messages }) => ({
        body: {
          messages,
          context: {
            projectTitle: project?.title,
            currentSection: currentSection?.title,
            sectionContent: currentSection?.content,
          },
        },
      }),
    }),
    onFinish: ({ message }) => {
      if (!selectedSectionId) return;
      const text =
        (message.parts as any[])
          ?.filter((p) => p.type === "text")
          .map((p) => p.text)
          .join("") ||
        (message as any).content ||
        "";
      if (text) {
        addSectionMessage(selectedSectionId, {
          id: message.id,
          role: message.role as "user" | "assistant",
          content: text,
          timestamp: new Date().toISOString(),
          sectionId: selectedSectionId,
        });
      }
    },
  });

  const isLoading = status === "streaming" || status === "submitted";

  // ── Restore chat history when section changes ────────────────────────────────

  const lastLoadedSectionRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      selectedSectionId &&
      selectedSectionId !== lastLoadedSectionRef.current
    ) {
      const existing = sectionChats[selectedSectionId] || [];
      setMessages(
        existing.map((m) => ({
          id: m.id,
          role: m.role as any,
          content: m.content,
          parts: [{ type: "text" as const, text: m.content }],
        })),
      );
      lastLoadedSectionRef.current = selectedSectionId;
    } else if (!selectedSectionId && lastLoadedSectionRef.current !== null) {
      setMessages([]);
      lastLoadedSectionRef.current = null;
    }
  }, [selectedSectionId, sectionChats, setMessages]);

  useEffect(() => {
    processedToolCallIds.current = new Set();
  }, [selectedSectionId]);

  // ── Auto-scroll chat ─────────────────────────────────────────────────────────

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Extract references from AI SDK tool results ───────────────────────────────

  useEffect(() => {
    if (!selectedSectionId) return;

    const newRefs: Reference[] = [];

    for (const msg of messages) {
      if (msg.role !== "assistant" || !msg.parts) continue;

      for (const part of msg.parts as any[]) {
        if (
          part.type !== "tool-search_scholarly_articles" ||
          part.state !== "output-available" ||
          !Array.isArray(part.output)
        )
          continue;

        if (processedToolCallIds.current.has(part.toolCallId)) continue;
        processedToolCallIds.current.add(part.toolCallId);

        for (const article of part.output) {
          if (!article || typeof article !== "object" || !article.title)
            continue;
          newRefs.push(articleToReference(article as ArticleData));
        }
      }
    }

    if (newRefs.length === 0) return;

    const state = useBuddyStore.getState();
    const freshProject = state.projects.find(
      (p) => p.id === state.currentProjectId,
    );
    if (!freshProject) return;

    let freshSection = null;
    if (freshProject.outline.introduction.id === selectedSectionId)
      freshSection = freshProject.outline.introduction;
    else if (freshProject.outline.conclusion.id === selectedSectionId)
      freshSection = freshProject.outline.conclusion;
    else
      freshSection =
        freshProject.outline.body.find((s) => s.id === selectedSectionId) ??
        null;

    if (!freshSection) return;

    const existingTitles = new Set(freshSection.references.map((r) => r.title));
    const existingDois = new Set(
      freshSection.references.map((r) => r.doi).filter(Boolean),
    );
    const unique = newRefs.filter(
      (r) =>
        !existingTitles.has(r.title) && (!r.doi || !existingDois.has(r.doi)),
    );

    if (unique.length === 0) return;

    updateSection(selectedSectionId, {
      references: [...freshSection.references, ...unique],
    });
  }, [messages, selectedSectionId, updateSection]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleContentChange = (content: string) => {
    if (selectedSectionId) updateSection(selectedSectionId, { content });
  };

  const handleEditorPaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData.items)
    const imageItem = items.find(item => item.type.startsWith('image/'))
    if (!imageItem) return
    e.preventDefault()
    const file = imageItem.getAsFile()
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      const textarea = editorRef.current
      if (!textarea) return
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const current = currentSection?.content || ''
      const inserted = `\n![image](${dataUrl})\n`
      const newContent = current.slice(0, start) + inserted + current.slice(end)
      handleContentChange(newContent)
      // restore cursor after the inserted markdown
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + inserted.length
      })
    }
    reader.readAsDataURL(file)
  }, [currentSection, editorRef]);

  const handleSendMessage = () => {
    if (!chatInput.trim() || !selectedSectionId || isLoading) return;
    const input = chatInput;
    addSectionMessage(selectedSectionId, {
      id: Math.random().toString(36).substring(2, 15),
      role: "user",
      content: input,
      timestamp: new Date().toISOString(),
      sectionId: selectedSectionId,
    });
    setChatInput("");
    sendMessage({ text: input });
  };

  const handleAudit = () => {
    if (!selectedSectionId || !currentSection || isLoading) return;
    sendMessage({
      text: "Please audit my current section. Give me specific strengths, suggestions for improvement, and any missing evidence or counterarguments.",
    });
  };

  const addReference = (ref: Partial<Reference>) => {
    if (!selectedSectionId || !currentSection) return;
    const newRef: Reference = {
      id: Math.random().toString(36).substring(2, 15),
      title: ref.title || "",
      authors: ref.authors || [],
      year: ref.year || "",
      type: ref.type || "article",
      citation: ref.citation || "",
      notes: ref.notes || "",
    };
    updateSection(selectedSectionId, {
      references: [...currentSection.references, newRef],
    });
    setShowReferenceForm(false);
  };

  // ── Empty state ───────────────────────────────────────────────────────────────

  if (!project || !currentSection) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">
            Select a section to start writing
          </p>
          <Button variant="outline" onClick={() => setViewMode("dashboard")}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex overflow-hidden h-full min-h-0">
      {/* ── References Sidebar ─────────────────────────────────────────────── */}
      <aside
        className="border-r border-border flex flex-col shrink-0 h-full min-h-0 transition-all duration-200"
        style={{ width: refsOpen ? '18rem' : '2.5rem' }}
      >
        {refsOpen ? (
        <div className="p-4 border-b border-white/20 shrink-0" style={{ backgroundColor: '#381d18' }}>
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-medium text-sm flex items-center gap-2 text-white">
              <BookMarked className="h-4 w-4 text-white" />
              References
            </h3>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-white hover:bg-white/20"
                onClick={() => setShowReferenceForm(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-white hover:bg-white/20"
                onClick={() => setRefsOpen(false)}
                title="Collapse references"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-white/70">
            {currentSection.references.length}{" "}
            {currentSection.references.length === 1 ? "source" : "sources"}
            {" · "}auto-saved
          </p>
        </div>
        ) : (
          <button
            onClick={() => setRefsOpen(true)}
            className="flex-1 flex items-center justify-center hover:bg-white/10 transition-colors"
            style={{ backgroundColor: '#381d18' }}
            title="Open References"
          >
            <ChevronRight className="h-4 w-4 text-white" />
          </button>
        )}

        {/* Body — white, only when open */}
        {refsOpen && <div className="flex-1 overflow-y-auto p-2 space-y-2" style={{ backgroundColor: '#ffffff' }}>
          {currentSection.references.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-8 px-3 space-y-2">
              <FileText className="h-8 w-8 mx-auto opacity-30" />
              <p className="font-medium">No references yet</p>
              <p className="opacity-70 leading-relaxed">
                Ask the AI to search for literature and references will appear
                here automatically in APA 7 format.
              </p>
            </div>
          ) : (
            currentSection.references.map((ref) => (
              <div
                key={ref.id}
                className="rounded-lg bg-white border border-border text-xs transition-colors overflow-hidden"
              >
                {/* Use button */}
                {(() => {
                  const inBib = (project?.bibliography || []).includes(ref.id)
                  return (
                    <button
                      onClick={() => inBib ? removeFromBibliography(ref.id) : addToBibliography(ref.id)}
                      className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] font-semibold transition-colors"
                      style={inBib
                        ? { backgroundColor: '#a0ad6d', color: '#fff' }
                        : { backgroundColor: '#ffffff', color: '#a0ad6d' }
                      }
                    >
                      <span>{inBib ? '✓ Added to Bibliography' : '+ Use in Paper'}</span>
                    </button>
                  )
                })()}
                {/* Collapsed header */}
                <div
                  className="p-2 flex items-start gap-2 cursor-pointer transition-colors"
                  style={{ backgroundColor: '#fef5dd' }}
                  onClick={() =>
                    setExpandedRefId(expandedRefId === ref.id ? null : ref.id)
                  }
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold leading-snug line-clamp-2" style={{ color: '#381d18' }}>
                      {ref.title}
                    </p>
                    <p className="mt-0.5 truncate text-muted-foreground">
                      {ref.authors.length > 0
                        ? `${toAPA7Author(ref.authors[0])}${
                            ref.authors.length > 1 ? " et al." : ""
                          }`
                        : "Unknown Author"}{" "}
                      ({ref.year})
                    </p>
                  </div>
                  {expandedRefId === ref.id ? (
                    <ChevronUp className="h-3 w-3 shrink-0 mt-0.5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-3 w-3 shrink-0 mt-0.5 text-muted-foreground" />
                  )}
                </div>

                {/* Expanded detail panel */}
                {expandedRefId === ref.id && (
                  <div className="px-2 pb-3 space-y-3 border-t border-border/50 pt-2">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                        {citationStyle === 'APA' ? 'APA 7' : citationStyle === 'MLA' ? 'MLA 9' : 'Chicago'} Citation
                      </p>
                      <p className="leading-relaxed text-foreground/90 select-text">
                        {formatCitation(ref, citationStyle)}
                      </p>
                    </div>

                    {ref.notes && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                          Abstract
                        </p>
                        <p className="italic text-muted-foreground leading-relaxed line-clamp-6">
                          {ref.notes}
                        </p>
                      </div>
                    )}

                    {ref.doi && (
                      <a
                        href={
                          ref.doi.startsWith("http")
                            ? ref.doi
                            : `https://doi.org/${ref.doi}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-3 w-3" />
                        View Source
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>}

        {/* Manual add-reference form */}
        {refsOpen && showReferenceForm && (
          <div className="p-3 border-t border-border shrink-0" style={{ backgroundColor: '#fef5dd' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium">Add Reference</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => setShowReferenceForm(false)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const fd = new FormData(form);
                addReference({
                  title: fd.get("title") as string,
                  authors: (fd.get("authors") as string)
                    .split(",")
                    .map((a) => a.trim()),
                  year: fd.get("year") as string,
                  type: "article",
                });
                form.reset();
              }}
              className="space-y-2"
            >
              <Input name="title" placeholder="Title" className="h-8 text-xs" required />
              <Input name="authors" placeholder="Authors (comma separated)" className="h-8 text-xs" required />
              <Input name="year" placeholder="Year" className="h-8 text-xs" required />
              <Button type="submit" size="sm" className="w-full h-7 text-xs">
                Add
              </Button>
            </form>
          </div>
        )}
      </aside>

      {/* ── Main Editor ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 h-full min-h-0 writing-col">
        {/* Section header */}
        <div className="h-14 border-b border-border flex items-center justify-between px-4 shrink-0" style={{ backgroundColor: '#381d18' }}>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/20 hover:text-white"
              onClick={() => setViewMode("dashboard")}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <div className="h-4 w-px bg-white/30" />
            <div>
              <h2 className="font-medium text-white">{currentSection.title}</h2>
              <p className="text-xs text-white/70">
                {currentSection.description}
              </p>
            </div>
          </div>
          <span className="text-xs text-white/70">
            {currentSection.content?.split(/\s+/).filter(Boolean).length || 0}{" "}
            words
          </span>
        </div>

        {/* Text editor */}
        <div className="flex-1 p-6 overflow-y-auto" style={{ backgroundColor: '#ffffff' }}>
          <Textarea
            ref={editorRef}
            value={currentSection.content || ""}
            onChange={(e) => handleContentChange(e.target.value)}
            onPaste={handleEditorPaste}
            placeholder={`Start writing your ${currentSection.title.toLowerCase()} here…\n\nTip: Ask the AI assistant to search for literature — references will be extracted and saved automatically.`}
            className="w-full h-full min-h-[400px] resize-none bg-transparent border-0 focus-visible:ring-0 text-base leading-relaxed font-serif"
          />
        </div>

        {/* ── AI Chat Panel ─────────────────────────────────────────────────── */}
        <div className="border-t border-border flex flex-col shrink-0" style={{ backgroundColor: '#fef5dd', height: chatHeight }}>
          {/* Resize handle */}
          <div
            onMouseDown={startChatResize}
            className="h-1.5 w-full cursor-row-resize hover:bg-[#381d18]/20 transition-colors shrink-0 flex items-center justify-center group"
          >
            <div className="w-8 h-0.5 rounded-full bg-gray-300 group-hover:bg-[#381d18]/40 transition-colors" />
          </div>
          {/* Chat header */}
          <div className="p-3 border-b border-border flex items-center justify-between shrink-0" style={{ backgroundColor: '#381d18' }}>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-white" />
              <span className="text-sm font-medium text-white">AI Assistant</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAudit}
              disabled={isLoading}
              className="gap-2 text-xs text-white border-white/40 hover:bg-white/20 hover:text-white bg-transparent"
            >
              <AlertTriangle className="h-3 w-3" />
              What&apos;s Missing?
            </Button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                Ask questions about your writing, or ask me to{" "}
                <button
                  className="text-primary underline underline-offset-2"
                  onClick={() =>
                    sendMessage({
                      text: `Find recent scholarly articles relevant to my section on "${currentSection.title}"`,
                    })
                  }
                >
                  find references
                </button>{" "}
                for this section.
              </p>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn("max-w-[80%] p-3 rounded-lg text-sm")}
                  style={msg.role === "user"
                    ? { backgroundColor: '#ffffff', color: '#381d18', marginLeft: 'auto', border: '1px solid #e5e7eb' }
                    : { backgroundColor: '#fff3e0', color: '#381d18' }
                  }
                >
                  {(msg.parts as any[])?.map((part: any, i: number) => {
                    if (part.type === "text") {
                      return (
                        <div key={i} className="prose prose-sm max-w-none leading-relaxed [&_strong]:font-bold [&_em]:italic [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:mb-1.5 [&_p:last-child]:mb-0">
                          <ReactMarkdown>{part.text}</ReactMarkdown>
                        </div>
                      );
                    }
                    if (part.type === "tool-search_scholarly_articles") {
                      const count = Array.isArray(part.output)
                        ? part.output.length
                        : 0;
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-2 text-xs opacity-70 my-1"
                        >
                          <BookMarked className="h-3 w-3 shrink-0" />
                          {part.state === "output-available"
                            ? `Retrieved ${count} reference${count !== 1 ? "s" : ""} from OpenAlex — added to References panel`
                            : "Searching OpenAlex…"}
                        </div>
                      );
                    }
                    return null;
                  }) ?? (
                    <p className="whitespace-pre-wrap leading-relaxed">
                      {(msg as any).content}
                    </p>
                  )}
                </div>
              ))
            )}

            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="flex gap-1">
                  {[0, 150, 300].map((delay) => (
                    <span
                      key={delay}
                      className="w-2 h-2 rounded-full bg-primary animate-bounce"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  ))}
                </div>
                <span>Thinking…</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat input */}
          <div className="p-3 border-t border-border shrink-0" style={{ backgroundColor: '#fef5dd' }}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <Button
                type="button"
                variant={isRecording ? "destructive" : "outline"}
                size="icon"
                className="shrink-0"
                onClick={() => setIsRecording(!isRecording)}
              >
                {isRecording ? (
                  <MicOff className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask a question or request a literature search…"
                className="flex-1 bg-white"
                disabled={isLoading}
              />
              <Button
                type="submit"
                size="icon"
                disabled={!chatInput.trim() || isLoading}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
