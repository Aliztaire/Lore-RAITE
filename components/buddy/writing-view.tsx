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
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Heading2,
  Heading3,
  Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ReactMarkdown from "react-markdown";
import { useBuddyStore } from "@/lib/store";
import type { ChatMessage, Reference } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useEditor, EditorContent, NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Image as TiptapImage } from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import { mergeAttributes } from "@tiptap/core";
import type { NodeViewProps } from "@tiptap/react";

// ─── Resizable Image Node ─────────────────────────────────────────────────────

function ResizableImageComponent({ node, updateAttributes, selected }: NodeViewProps) {
  const { src, alt, width } = node.attrs;
  const handleRef = useRef<HTMLDivElement>(null);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = (handleRef.current?.parentElement?.clientWidth) || 300;

    const onMove = (ev: MouseEvent) => {
      const newWidth = Math.max(80, startWidth + (ev.clientX - startX));
      updateAttributes({ width: newWidth });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <NodeViewWrapper className="relative inline-block my-3" style={{ width: width ? `${width}px` : undefined }}>
      <img
        src={src}
        alt={alt || ''}
        style={{ width: '100%', borderRadius: 8, display: 'block', outline: selected ? '2px solid #a0ad6d' : undefined }}
      />
      <div
        ref={handleRef}
        onMouseDown={startResize}
        style={{
          position: 'absolute', bottom: 4, right: 4,
          width: 14, height: 14,
          background: '#a0ad6d',
          borderRadius: 2,
          cursor: 'nwse-resize',
          opacity: selected ? 1 : 0,
          transition: 'opacity 0.15s',
        }}
      />
    </NodeViewWrapper>
  );
}

const ResizableImage = TiptapImage.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: el => el.getAttribute('width') ? Number(el.getAttribute('width')) : null,
        renderHTML: attrs => attrs.width ? { width: attrs.width } : {},
      },
    };
  },
  parseHTML() {
    return [{ tag: 'img[src]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes)];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageComponent);
  },
}).configure({ inline: false, allowBase64: true });

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

  // ── Selection tooltip for reference matching ─────────────────────────────────
  const [selectionTooltip, setSelectionTooltip] = useState<{
    text: string; x: number; y: number;
  } | null>(null);
  const [refMatchState, setRefMatchState] = useState<{
    loading: boolean;
    ref: Reference | null;
    inserted: boolean;
    noMatch: boolean;
  }>({ loading: false, ref: null, inserted: false, noMatch: false });
  const editorWrapRef = useRef<HTMLDivElement>(null);
  // Stores selected text in a ref so findMatchingReference can read it even if
  // selectionTooltip state has already been cleared by the time the click fires.
  const selectedTextRef = useRef('');
  const selectionEndRef = useRef(0); // stores 'to' pos so insert works after selection collapses
  // Set to true while loading or result is shown; blocks onSelectionUpdate from
  // clearing the tooltip. Reset explicitly when done.
  const isMatchingRef = useRef(false);

  // ── TipTap rich-text editor ──────────────────────────────────────────────────
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      ResizableImage,
      Markdown.configure({ html: true, transformPastedText: true }),
      Placeholder.configure({
        placeholder: 'Start writing your section here…\n\nTip: Ask the AI assistant to search for literature — references will be extracted and saved automatically.',
      }),
    ],
    editorProps: {
      attributes: {
        class: 'outline-none min-h-full p-6 font-serif text-base leading-relaxed prose prose-stone max-w-none ' +
          '[&_strong]:font-bold [&_em]:italic ' +
          '[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-2 ' +
          '[&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-5 [&_h2]:mb-2 ' +
          '[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-1 ' +
          '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 ' +
          '[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 ' +
          '[&_blockquote]:border-l-4 [&_blockquote]:border-[#a0ad6d] [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-gray-500 ' +
          '[&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-3 ' +
          '[&_hr]:my-4 [&_hr]:border-gray-200',
      },
      handleDOMEvents: {
        keydown: (_view, e) => {
          if (e.ctrlKey || e.metaKey) e.stopPropagation();
          return false;
        },
        paste: (_view, e) => {
          const items = Array.from(e.clipboardData?.items || []);
          const imageItem = items.find(i => i.type.startsWith('image/'));
          if (!imageItem) return false;
          e.preventDefault();
          const file = imageItem.getAsFile();
          if (!file) return false;
          const reader = new FileReader();
          reader.onload = (ev) => {
            const src = ev.target?.result as string;
            if (src) editor?.chain().focus().setImage({ src }).run();
          };
          reader.readAsDataURL(file);
          return true;
        },
      },
    },
    onUpdate: ({ editor }) => {
      if (!selectedSectionId) return;
      const md = editor.storage.markdown.getMarkdown();
      updateSection(selectedSectionId, { content: md });
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      if (from === to) {
        // Delay clearing so any pending click handlers on the tooltip fire first.
        // If isMatchingRef becomes true within 150 ms (user clicked Find Best Match),
        // the timeout no-ops and the tooltip stays.
        setTimeout(() => {
          if (!isMatchingRef.current) {
            setSelectionTooltip(null);
            setRefMatchState({ loading: false, ref: null, inserted: false, noMatch: false });
          }
        }, 150);
        return;
      }
      // Don't replace tooltip with a new selection while a match is in progress
      if (isMatchingRef.current) return;
      const text = editor.state.doc.textBetween(from, to, ' ').trim();
      if (text.length < 10) {
        setSelectionTooltip(null);
        return;
      }
      const coords = editor.view.coordsAtPos(to);
      const wrapRect = editorWrapRef.current?.getBoundingClientRect();
      if (!wrapRect) return;
      selectedTextRef.current = text;
      selectionEndRef.current = to;
      setRefMatchState({ loading: false, ref: null, inserted: false, noMatch: false });
      setSelectionTooltip({
        text,
        x: coords.left - wrapRect.left,
        y: coords.top - wrapRect.top - 48,
      });
    },
  });

  // Sync editor when section changes
  useEffect(() => {
    if (!editor) return;
    const md = currentSection?.content || '';
    // Only reset if the content actually differs to avoid cursor jumping
    const current = editor.storage.markdown.getMarkdown();
    if (current !== md) {
      editor.commands.setContent(md);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSectionId, editor]);

  const [chatInput, setChatInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [showReferenceForm, setShowReferenceForm] = useState(false);
  const [expandedRefId, setExpandedRefId] = useState<string | null>(null);
  const [refsOpen, setRefsOpen] = useState(true);
  const [citationStyle, setCitationStyle] = useState<"APA" | "MLA" | "Chicago">("APA");
  const [pendingStyle, setPendingStyle] = useState<"APA" | "MLA" | "Chicago">("APA");
  const [refFilter, setRefFilter] = useState<'all' | string>('all');
  const [chatHeight, setChatHeight] = useState(288);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isResizingChat = useRef(false);

  const findMatchingReference = useCallback(async () => {
    const text = selectedTextRef.current;
    if (!text || !project) return;
    const allRefs = [
      ...(project.outline.introduction.references || []),
      ...project.outline.body.flatMap(s => s.references || []),
      ...(project.outline.conclusion.references || []),
    ];
    if (allRefs.length === 0) {
      setRefMatchState({ loading: false, ref: null, inserted: false, noMatch: false });
      return;
    }
    // Lock: prevent onSelectionUpdate from clearing tooltip during fetch
    isMatchingRef.current = true;
    setRefMatchState({ loading: true, ref: null, inserted: false, noMatch: false });
    try {
      const res = await fetch('/api/find-reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedText: text, references: allRefs }),
      });
      const { referenceId } = await res.json();
      const matched = allRefs.find(r => r.id === referenceId) || null;
      if (!matched) isMatchingRef.current = false;
      setRefMatchState({ loading: false, ref: matched, inserted: false, noMatch: !matched });
    } catch {
      isMatchingRef.current = false;
      setRefMatchState({ loading: false, ref: null, inserted: false, noMatch: false });
    }
  }, [project]); // no longer depends on selectionTooltip — uses ref instead

  const insertCitationAtSelection = useCallback(() => {
    if (!editor || !refMatchState.ref) return;
    const ref = refMatchState.ref;
    const citation = formatCitation(ref, citationStyle);
    // Insert a short inline citation after the selection
    const authorPart = ref.authors?.[0]
      ? ref.authors[0].trim().split(/\s+/).at(-1)
      : 'Unknown';
    const year = ref.year ?? 'n.d.';
    const inline = ` (${authorPart}, ${year})`;
    // Use stored position — selection may have collapsed after tooltip appeared
    const insertAt = selectionEndRef.current || editor.state.selection.to;
    editor.chain().focus().insertContentAt(insertAt, inline).run();
    setRefMatchState(s => ({ ...s, inserted: true }));
    setTimeout(() => {
      isMatchingRef.current = false;
      setSelectionTooltip(null);
    }, 800);
  }, [editor, refMatchState.ref, citationStyle]);

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

  // Toolbar actions wired to TipTap commands
  const fmt = {
    bold:        () => editor?.chain().focus().toggleBold().run(),
    italic:      () => editor?.chain().focus().toggleItalic().run(),
    strike:      () => editor?.chain().focus().toggleStrike().run(),
    h2:          () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
    h3:          () => editor?.chain().focus().toggleHeading({ level: 3 }).run(),
    bullet:      () => editor?.chain().focus().toggleBulletList().run(),
    ordered:     () => editor?.chain().focus().toggleOrderedList().run(),
    blockquote:  () => editor?.chain().focus().toggleBlockquote().run(),
    divider:     () => editor?.chain().focus().setHorizontalRule().run(),
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

  const allSections = project
    ? [project.outline.introduction, ...project.outline.body, project.outline.conclusion]
    : [];

  const allRefsMap = new Map<string, Reference>();
  for (const sec of allSections) {
    for (const ref of sec.references) {
      const key = ref.doi || ref.title;
      if (!allRefsMap.has(key)) allRefsMap.set(key, ref);
    }
  }
  const displayedRefs = refFilter === 'all'
    ? Array.from(allRefsMap.values())
    : (allSections.find(s => s.id === refFilter)?.references ?? []);

  return (
    <div className="flex-1 flex overflow-hidden h-full min-h-0">
      {/* ── References Sidebar ─────────────────────────────────────────────── */}
      <aside
        className="border-r border-border flex flex-col shrink-0 h-full min-h-0 transition-all duration-200"
        style={{ width: refsOpen ? '18rem' : '2.5rem' }}
      >
        {refsOpen ? (() => {
          return (
          <div className="flex flex-col shrink-0" style={{ backgroundColor: '#381d18' }}>
            {/* Top bar */}
            <div className="px-4 pt-4 pb-2">
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
              <p className="text-xs text-white/60">
                {displayedRefs.length} {displayedRefs.length === 1 ? 'source' : 'sources'}
                {refFilter === 'all' ? ' · all sections' : ' · this section'}
              </p>
            </div>

            {/* Filter tabs */}
            <div className="px-3 pb-3 flex flex-wrap gap-1">
              <button
                onClick={() => setRefFilter('all')}
                className="px-2.5 py-1 rounded-full text-[10px] font-semibold transition-colors"
                style={refFilter === 'all'
                  ? { backgroundColor: '#a0ad6d', color: '#fff' }
                  : { backgroundColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }
                }
              >
                All
              </button>
              {allSections.map(sec => (
                <button
                  key={sec.id}
                  onClick={() => setRefFilter(sec.id)}
                  className="px-2.5 py-1 rounded-full text-[10px] font-semibold transition-colors truncate max-w-32"
                  style={refFilter === sec.id
                    ? { backgroundColor: '#fb804a', color: '#fff' }
                    : { backgroundColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }
                  }
                  title={sec.title}
                >
                  {sec.title}
                </button>
              ))}
            </div>
          </div>
          );
        })() : (
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
          {displayedRefs.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-8 px-3 space-y-2">
              <FileText className="h-8 w-8 mx-auto opacity-30" />
              <p className="font-medium">No references yet</p>
              <p className="opacity-70 leading-relaxed">
                Ask the AI to search for literature and references will appear
                here automatically in APA 7 format.
              </p>
            </div>
          ) : (
            displayedRefs.map((ref) => (
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
            {currentSection.content?.split(/\s+/).filter(Boolean).length || 0}{" "}words
          </span>
        </div>

        {/* Formatting toolbar */}
        <div className="shrink-0 border-b border-border flex items-center gap-0.5 px-3 py-1.5 flex-wrap" style={{ backgroundColor: '#fafaf8' }}>
          {([
            { icon: <Bold className="h-3.5 w-3.5" />, title: 'Bold', action: fmt.bold, active: editor?.isActive('bold') },
            { icon: <Italic className="h-3.5 w-3.5" />, title: 'Italic', action: fmt.italic, active: editor?.isActive('italic') },
            { icon: <Strikethrough className="h-3.5 w-3.5" />, title: 'Strikethrough', action: fmt.strike, active: editor?.isActive('strike') },
          ] as const).map(({ icon, title, action, active }) => (
            <button key={title} title={title} onClick={action}
              className="p-1.5 rounded transition-colors"
              style={{ backgroundColor: active ? '#ede9e3' : 'transparent', color: active ? '#381d18' : '#6b7280' }}>
              {icon}
            </button>
          ))}
          <div className="w-px h-4 bg-gray-200 mx-1" />
          {([
            { icon: <Heading2 className="h-3.5 w-3.5" />, title: 'Heading 2', action: fmt.h2, active: editor?.isActive('heading', { level: 2 }) },
            { icon: <Heading3 className="h-3.5 w-3.5" />, title: 'Heading 3', action: fmt.h3, active: editor?.isActive('heading', { level: 3 }) },
          ] as const).map(({ icon, title, action, active }) => (
            <button key={title} title={title} onClick={action}
              className="p-1.5 rounded transition-colors"
              style={{ backgroundColor: active ? '#ede9e3' : 'transparent', color: active ? '#381d18' : '#6b7280' }}>
              {icon}
            </button>
          ))}
          <div className="w-px h-4 bg-gray-200 mx-1" />
          {([
            { icon: <List className="h-3.5 w-3.5" />, title: 'Bullet list', action: fmt.bullet, active: editor?.isActive('bulletList') },
            { icon: <ListOrdered className="h-3.5 w-3.5" />, title: 'Numbered list', action: fmt.ordered, active: editor?.isActive('orderedList') },
            { icon: <Quote className="h-3.5 w-3.5" />, title: 'Blockquote', action: fmt.blockquote, active: editor?.isActive('blockquote') },
            { icon: <Minus className="h-3.5 w-3.5" />, title: 'Divider', action: fmt.divider, active: false },
          ] as const).map(({ icon, title, action, active }) => (
            <button key={title} title={title} onClick={action}
              className="p-1.5 rounded transition-colors"
              style={{ backgroundColor: active ? '#ede9e3' : 'transparent', color: active ? '#381d18' : '#6b7280' }}>
              {icon}
            </button>
          ))}
        </div>

        {/* Rich-text editor */}
        <div
          ref={editorWrapRef}
          className="flex-1 overflow-y-auto tiptap-editor relative"
          style={{ backgroundColor: '#ffffff' }}
        >
          <EditorContent editor={editor} className="h-full" />

          {/* ── Selection reference tooltip ── */}
          {selectionTooltip && (
            <div
              className="absolute z-50 shadow-xl rounded-xl border border-border overflow-hidden"
              style={{
                left: Math.max(8, Math.min(selectionTooltip.x, (editorWrapRef.current?.clientWidth ?? 600) - 280)),
                top: Math.max(8, selectionTooltip.y),
                width: 272,
                backgroundColor: '#1c1008',
              }}
              onMouseDown={e => { e.preventDefault(); e.stopPropagation(); }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
                <span className="text-[11px] font-semibold text-white/80 tracking-wide uppercase">Find Reference</span>
                <button
                  onClick={() => { isMatchingRef.current = false; setSelectionTooltip(null); setRefMatchState({ loading: false, ref: null, inserted: false, noMatch: false }); }}
                  className="text-white/50 hover:text-white transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Selected text preview */}
              <div className="px-3 py-2 border-b border-white/10">
                <p className="text-[10px] text-white/50 mb-0.5">Selected text</p>
                <p className="text-xs text-white/80 italic line-clamp-2">"{selectionTooltip.text}"</p>
              </div>

              {/* Action area */}
              <div className="px-3 py-2.5 space-y-2">
                {!refMatchState.ref && !refMatchState.loading && !refMatchState.noMatch && (
                  <button
                    onClick={findMatchingReference}
                    className="w-full py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                    style={{ backgroundColor: '#a0ad6d', color: '#fff' }}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Find Best Match
                  </button>
                )}

                {refMatchState.noMatch && !refMatchState.loading && (
                  <div className="space-y-1.5">
                    <p className="text-center text-[11px] text-white/50">No matching reference found.</p>
                    <button
                      onClick={() => { setRefMatchState(s => ({ ...s, noMatch: false })); findMatchingReference(); }}
                      className="w-full py-1.5 rounded-lg text-[11px] font-medium transition-all"
                      style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}
                    >
                      Try again
                    </button>
                  </div>
                )}

                {refMatchState.loading && (
                  <div className="flex items-center gap-2 py-1.5 justify-center">
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#a0ad6d] border-t-transparent" />
                    <span className="text-[11px] text-white/60">Searching references…</span>
                  </div>
                )}

                {refMatchState.ref && !refMatchState.inserted && (
                  <>
                    <div className="rounded-lg p-2 space-y-0.5" style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}>
                      <p className="text-[10px] text-[#a0ad6d] font-semibold uppercase tracking-wide">Best match</p>
                      <p className="text-[11px] text-white leading-snug line-clamp-3">{refMatchState.ref.title}</p>
                      <p className="text-[10px] text-white/50">
                        {refMatchState.ref.authors?.[0] && `${refMatchState.ref.authors[0].trim().split(/\s+/).at(-1)} `}
                        {refMatchState.ref.year && `(${refMatchState.ref.year})`}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={findMatchingReference}
                        className="flex-1 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                        style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}
                      >
                        Try again
                      </button>
                      <button
                        onClick={insertCitationAtSelection}
                        className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                        style={{ backgroundColor: '#a0ad6d', color: '#fff' }}
                      >
                        Insert Citation
                      </button>
                    </div>
                  </>
                )}

                {refMatchState.inserted && (
                  <p className="text-center text-[11px] text-[#a0ad6d] font-semibold py-1">✓ Citation inserted!</p>
                )}

                {!refMatchState.loading && !refMatchState.ref && !refMatchState.inserted && (() => {
                  const total = [
                    project?.outline.introduction.references?.length ?? 0,
                    ...(project?.outline.body.map(s => s.references?.length ?? 0) ?? []),
                    project?.outline.conclusion.references?.length ?? 0,
                  ].reduce((a, b) => a + b, 0);
                  return total === 0 ? (
                    <p className="text-[10px] text-yellow-400/70 text-center">
                      No references found in this project yet. Ask the AI chat to search for literature first.
                    </p>
                  ) : (
                    <p className="text-[10px] text-white/40 text-center">
                      AI will match from {total} reference{total !== 1 ? 's' : ''} in this project
                    </p>
                  );
                })()}
              </div>
            </div>
          )}
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
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
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
                    "px-4 py-3 rounded-xl text-sm",
                    msg.role === "user" ? "max-w-[80%] ml-auto" : "w-full"
                  )}
                  style={msg.role === "user"
                    ? { backgroundColor: '#ffffff', color: '#381d18', border: '1px solid #e5e7eb' }
                    : { backgroundColor: '#fff8ee', color: '#381d18', border: '1px solid #ede9e3' }
                  }
                >
                  {(msg.parts as any[])?.map((part: any, i: number) => {
                    if (part.type === "text") {
                      return (
                        <div
                          key={i}
                          className="prose prose-sm max-w-none leading-relaxed
                            [&_strong]:font-semibold [&_strong]:text-[#381d18]
                            [&_em]:italic
                            [&_h1]:text-sm [&_h1]:font-bold [&_h1]:mt-3 [&_h1]:mb-1 [&_h1]:text-[#381d18]
                            [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-1 [&_h2]:text-[#381d18]
                            [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:text-[#381d18]
                            [&_p]:mb-2 [&_p:last-child]:mb-0
                            [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ul]:space-y-1.5
                            [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_ol]:space-y-1.5
                            [&_li]:leading-snug [&_li]:text-[#381d18]
                            [&_li>strong]:block [&_li>strong]:mb-0.5
                            [&_a]:text-blue-600 [&_a]:underline
                            [&_hr]:my-3 [&_hr]:border-[#ede9e3]
                            [&_blockquote]:border-l-2 [&_blockquote]:border-[#a0ad6d] [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-[#b0976a]"
                        >
                          <ReactMarkdown>{part.text}</ReactMarkdown>
                        </div>
                      );
                    }
                    if (part.type === "tool-search_scholarly_articles") {
                      const count = Array.isArray(part.output) ? part.output.length : 0;
                      return (
                        <div key={i} className="flex items-center gap-2 text-xs my-1.5 px-2 py-1.5 rounded-md" style={{ backgroundColor: '#f0f3e0', color: '#a0ad6d' }}>
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
