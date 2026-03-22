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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  } = useBuddyStore();

  const project = getCurrentProject();
  const [chatInput, setChatInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [showReferenceForm, setShowReferenceForm] = useState(false);
  const [expandedRefId, setExpandedRefId] = useState<string | null>(null);
  const [citationStyle, setCitationStyle] = useState<"APA" | "MLA" | "Chicago">("APA");
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

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
      <aside className="w-72 border-r border-border bg-card/30 flex flex-col shrink-0 h-full min-h-0">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-medium text-sm flex items-center gap-2">
              <BookMarked className="h-4 w-4 text-primary" />
              References
            </h3>
            <div className="flex items-center gap-2">
              <Select value={citationStyle} onValueChange={(v: any) => setCitationStyle(v)}>
                <SelectTrigger className="h-6 text-xs w-[85px] border-none bg-background/50 focus:ring-1 focus:ring-primary shadow-sm hover:bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="APA" className="text-xs">APA 7</SelectItem>
                  <SelectItem value="MLA" className="text-xs">MLA 9</SelectItem>
                  <SelectItem value="Chicago" className="text-xs">Chicago</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setShowReferenceForm(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {currentSection.references.length}{" "}
            {currentSection.references.length === 1 ? "source" : "sources"}
            {" · "}auto-saved
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-2">
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
                className="rounded-lg bg-secondary/50 border border-border text-xs transition-colors overflow-hidden"
              >
                {/* Collapsed header */}
                <div
                  className="p-2 flex items-start gap-2 cursor-pointer hover:bg-secondary/70 transition-colors"
                  onClick={() =>
                    setExpandedRefId(expandedRefId === ref.id ? null : ref.id)
                  }
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold leading-snug line-clamp-2">
                      {ref.title}
                    </p>
                    <p className="text-muted-foreground mt-0.5 truncate">
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
        </div>

        {/* Manual add-reference form */}
        {showReferenceForm && (
          <div className="p-3 border-t border-border bg-card shrink-0">
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
      <div className="flex-1 flex flex-col min-w-0 h-full min-h-0">
        {/* Section header */}
        <div className="h-14 border-b border-border bg-card/50 flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode("dashboard")}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <div className="h-4 w-px bg-border" />
            <div>
              <h2 className="font-medium">{currentSection.title}</h2>
              <p className="text-xs text-muted-foreground">
                {currentSection.description}
              </p>
            </div>
          </div>
          <span className="text-xs text-muted-foreground">
            {currentSection.content?.split(/\s+/).filter(Boolean).length || 0}{" "}
            words
          </span>
        </div>

        {/* Text editor */}
        <div className="flex-1 p-6 overflow-y-auto">
          <Textarea
            ref={editorRef}
            value={currentSection.content || ""}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder={`Start writing your ${currentSection.title.toLowerCase()} here…\n\nTip: Ask the AI assistant to search for literature — references will be extracted and saved automatically.`}
            className="w-full h-full min-h-[400px] resize-none bg-transparent border-0 focus-visible:ring-0 text-base leading-relaxed font-serif"
          />
        </div>

        {/* ── AI Chat Panel ─────────────────────────────────────────────────── */}
        <div className="h-72 border-t border-border bg-card/30 flex flex-col shrink-0">
          {/* Chat header */}
          <div className="p-3 border-b border-border flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">AI Assistant</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAudit}
              disabled={isLoading}
              className="gap-2 text-xs"
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
                  className={cn(
                    "max-w-[80%] p-3 rounded-lg text-sm",
                    msg.role === "user"
                      ? "ml-auto bg-primary text-primary-foreground"
                      : "bg-secondary",
                  )}
                >
                  {(msg.parts as any[])?.map((part: any, i: number) => {
                    if (part.type === "text") {
                      return (
                        <p key={i} className="whitespace-pre-wrap leading-relaxed">
                          {part.text}
                        </p>
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
          <div className="p-3 border-t border-border shrink-0">
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
                className="flex-1"
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
