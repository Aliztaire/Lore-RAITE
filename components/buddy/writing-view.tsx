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
  X,
  ExternalLink,
  ChevronDown,
  Check,
  Loader2,
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Heading2,
  Heading3,
  Minus,
  Volume2,
  VolumeX,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatMarkdown } from "./chat-message";
import { AnimatePresence, motion } from "motion/react";
import { useBuddyStore } from "@/lib/store";
import type { ChatMessage, Reference } from "@/lib/types";
import { cn } from "@/lib/utils";
import { stripMarkup } from "@/lib/strip-markup";
import { useTextToSpeech } from "@/hooks/use-text-to-speech";
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
        style={{ width: '100%', borderRadius: 6, display: 'block', outline: selected ? '2px solid var(--primary)' : undefined }}
      />
      <div
        ref={handleRef}
        onMouseDown={startResize}
        style={{
          position: 'absolute', bottom: 4, right: 4,
          width: 14, height: 14,
          background: 'var(--primary)',
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

// ─── Section outlines: what a student can write in each section ─────────────────

interface GuidePoint { title: string; hint: string }

const SECTION_GUIDES: { match: RegExp; points: GuidePoint[] }[] = [
  { match: /introduc/i, points: [
    { title: 'Background and context', hint: 'Set the scene: what is already known about the topic and why it matters.' },
    { title: 'Problem statement', hint: 'Name the specific issue or gap your study responds to.' },
    { title: 'Purpose and research questions', hint: 'State what the study sets out to find, as research questions or hypotheses.' },
    { title: 'Significance', hint: 'Who benefits from the answer, and how: theory, practice, or policy.' },
    { title: 'Scope and key terms', hint: 'Set the boundaries of the study and define the terms readers need.' },
  ] },
  { match: /literature|related|review/i, points: [
    { title: 'Theoretical framework', hint: 'The theory or model that frames your variables and expectations.' },
    { title: 'Key themes in prior research', hint: 'Organise by theme rather than paper by paper; synthesise, don’t list.' },
    { title: 'Agreements and debates', hint: 'Where studies converge, where they conflict, and why.' },
    { title: 'Methods used so far', hint: 'Common designs, samples, and measures, and their limitations.' },
    { title: 'The gap', hint: 'What remains unanswered, leading directly to your research question.' },
  ] },
  { match: /method/i, points: [
    { title: 'Research design', hint: 'Experimental, correlational, qualitative, or mixed, and why it fits your question.' },
    { title: 'Participants and sampling', hint: 'Who took part, how they were recruited, and how many.' },
    { title: 'Instruments and measures', hint: 'Scales or tools used, with evidence of validity and reliability.' },
    { title: 'Procedure', hint: 'Step by step, what participants experienced, in enough detail to replicate.' },
    { title: 'Data analysis', hint: 'The tests or coding approach you used, matched to each research question.' },
    { title: 'Ethical considerations', hint: 'Consent, confidentiality, and approval from the ethics board.' },
  ] },
  { match: /result|finding/i, points: [
    { title: 'Sample description', hint: 'Final sample size, demographics, and response or completion rates.' },
    { title: 'Descriptive statistics', hint: 'Means, standard deviations, and frequencies for the main variables.' },
    { title: 'Findings by research question', hint: 'Report each test with its statistic, p-value, and effect size.' },
    { title: 'Tables and figures', hint: 'Summarise key results visually and refer to each one in the text.' },
    { title: 'Report, don’t interpret', hint: 'Save explanations of what the results mean for the Discussion.' },
  ] },
  { match: /discuss/i, points: [
    { title: 'Summary of key findings', hint: 'Briefly answer each research question in plain language.' },
    { title: 'Interpretation', hint: 'Explain the results and compare them with the literature you reviewed.' },
    { title: 'Implications', hint: 'What the findings mean for theory, practice, or policy.' },
    { title: 'Limitations', hint: 'Honest constraints of the design, sample, or measures, and their effect.' },
    { title: 'Future research', hint: 'Specific next studies your findings point toward.' },
  ] },
  { match: /conclu|recommend|summary/i, points: [
    { title: 'Restate the purpose', hint: 'Remind the reader what the study set out to do.' },
    { title: 'Main answer', hint: 'The central conclusion your evidence supports.' },
    { title: 'Recommendations', hint: 'Concrete actions for practitioners, institutions, or researchers.' },
    { title: 'Closing statement', hint: 'End on why this work matters, without introducing new evidence.' },
  ] },
]

function guideFor(section: { title: string; description?: string }): GuidePoint[] {
  const found = SECTION_GUIDES.find(g => g.match.test(section.title))
  if (found) return found.points
  return [
    { title: 'Main point', hint: section.description?.trim() || 'State the one idea this section exists to communicate.' },
    { title: 'Evidence', hint: 'Support it with data, examples, or citations from your references.' },
    { title: 'Analysis', hint: 'Explain what the evidence shows and how it advances your argument.' },
    { title: 'Transition', hint: 'Link this section to the next one.' },
  ]
}

// ─── Assistant prompts (shown as short labels on comments) ─────────────────────

const AUDIT_PROMPT =
  "Please audit my current section. Give me specific strengths, suggestions for improvement, and any missing evidence or counterarguments.";
const FIND_REFS_PREFIX = "Find recent scholarly articles relevant to my section on";

function promptLabel(text: string) {
  if (text === AUDIT_PROMPT) return "Review this section";
  if (text.startsWith(FIND_REFS_PREFIX)) return "Find references for this section";
  return text;
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
        placeholder: 'Start writing this section…\n\nTip: ask the assistant below to search for literature. References it finds are saved automatically.',
      }),
    ],
    editorProps: {
      attributes: {
        // Typography lives in globals.css (.tiptap-editor .ProseMirror)
        class: 'outline-none',
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
      const md = (editor.storage as any).markdown.getMarkdown();
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
    const current = (editor.storage as any).markdown.getMarkdown();
    if (current !== md) {
      editor.commands.setContent(md);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSectionId, editor]);

  const [chatInput, setChatInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [showReferenceForm, setShowReferenceForm] = useState(false);
  const [expandedRefId, setExpandedRefId] = useState<string | null>(null);
  const [refsOpen, setRefsOpen] = useState(false); // collapsed by default so the manuscript keeps its measure
  const [citationStyle, setCitationStyle] = useState<"APA" | "MLA" | "Chicago">("APA");
  const [pendingStyle, setPendingStyle] = useState<"APA" | "MLA" | "Chicago">("APA");
  const [refFilter, setRefFilter] = useState<'all' | string>('all');
  // Assistant answers float over the page as comments; dismissing only hides them
  const [dismissedComments, setDismissedComments] = useState<Set<string>>(new Set());
  const [commentsHidden, setCommentsHidden] = useState(false);
  // Section outline widget open/closed per section (open by default; the user can collapse it)
  const [guideOpen, setGuideOpen] = useState<Record<string, boolean>>({});

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

  const { speak: speakSection, stop: stopSpeakingSection, isSpeaking: isSpeakingSection, isSupported: ttsSupported } = useTextToSpeech();
  const toggleReadSectionAloud = () => {
    if (isSpeakingSection) {
      stopSpeakingSection();
      return;
    }
    speakSection(stripMarkup(currentSection?.content || ""));
  };

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
    setCommentsHidden(false);
    sendMessage({ text: input });
  };

  const handleAudit = () => {
    if (!selectedSectionId || !currentSection || isLoading) return;
    setCommentsHidden(false);
    sendMessage({ text: AUDIT_PROMPT });
  };

  const handleFindReferences = () => {
    if (!selectedSectionId || !currentSection || isLoading) return;
    setCommentsHidden(false);
    sendMessage({ text: `${FIND_REFS_PREFIX} "${currentSection.title}"` });
  };

  const insertGuideHeading = (title: string) => {
    editor?.chain().focus("end").insertContent(`<h2>${title}</h2><p></p>`).run();
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
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">
            Select a section from the outline to start writing.
          </p>
          <Button variant="outline" onClick={() => setViewMode("dashboard")}>
            <ChevronLeft />
            Back to overview
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

  const sectionWords = currentSection.content?.split(/\s+/).filter(Boolean).length || 0;

  // Group the section's chat into comment threads: one question + the assistant's reply
  const messageText = (m: any): string =>
    (m.parts as any[] | undefined)?.filter(p => p.type === "text").map(p => p.text).join("") ?? m.content ?? "";
  const threads: { id: string; question: string; replies: any[] }[] = [];
  for (const m of messages as any[]) {
    if (m.role === "user") threads.push({ id: m.id, question: messageText(m), replies: [] });
    else if (threads.length > 0) threads[threads.length - 1].replies.push(m);
    else threads.push({ id: m.id, question: "", replies: [m] });
  }
  const visibleThreads = threads.filter(t => !dismissedComments.has(t.id)).reverse(); // newest first
  const latestThreadId = threads.at(-1)?.id;

  const guidePoints = guideFor(currentSection);
  const isGuideOpen = guideOpen[currentSection.id] ?? true; // open until the user collapses it

  const toolbarGroups = [
    [
      { icon: <Bold className="h-3.5 w-3.5" />, title: 'Bold', action: fmt.bold, active: editor?.isActive('bold') },
      { icon: <Italic className="h-3.5 w-3.5" />, title: 'Italic', action: fmt.italic, active: editor?.isActive('italic') },
      { icon: <Strikethrough className="h-3.5 w-3.5" />, title: 'Strikethrough', action: fmt.strike, active: editor?.isActive('strike') },
    ],
    [
      { icon: <Heading2 className="h-3.5 w-3.5" />, title: 'Heading 2', action: fmt.h2, active: editor?.isActive('heading', { level: 2 }) },
      { icon: <Heading3 className="h-3.5 w-3.5" />, title: 'Heading 3', action: fmt.h3, active: editor?.isActive('heading', { level: 3 }) },
    ],
    [
      { icon: <List className="h-3.5 w-3.5" />, title: 'Bullet list', action: fmt.bullet, active: editor?.isActive('bulletList') },
      { icon: <ListOrdered className="h-3.5 w-3.5" />, title: 'Numbered list', action: fmt.ordered, active: editor?.isActive('orderedList') },
      { icon: <Quote className="h-3.5 w-3.5" />, title: 'Blockquote', action: fmt.blockquote, active: editor?.isActive('blockquote') },
      { icon: <Minus className="h-3.5 w-3.5" />, title: 'Divider', action: fmt.divider, active: false },
    ],
  ];

  const closeTooltip = () => {
    isMatchingRef.current = false;
    setSelectionTooltip(null);
    setRefMatchState({ loading: false, ref: null, inserted: false, noMatch: false });
  };

  return (
    <div className="flex-1 flex overflow-hidden h-full min-h-0 bg-background">
      {/* ── References Sidebar ─────────────────────────────────────────────── */}
      <aside
        className="border-r border-border bg-card flex flex-col shrink-0 h-full min-h-0 transition-[width] duration-200"
        style={{ width: refsOpen ? '18rem' : '2.75rem' }}
      >
        {refsOpen ? (
          <div className="px-4 pt-5 pb-3 shrink-0 border-b border-border">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-base font-semibold">References</h3>
              <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground"
                  onClick={() => setShowReferenceForm(true)}
                  title="Add reference manually"
                >
                  <Plus />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground"
                  onClick={() => setRefsOpen(false)}
                  title="Collapse references"
                >
                  <ChevronLeft />
                </Button>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <label htmlFor="ref-filter" className="sr-only">Filter references by section</label>
              <select
                id="ref-filter"
                value={refFilter}
                onChange={e => setRefFilter(e.target.value)}
                className="flex-1 min-w-0 h-8 text-xs rounded-full border border-input bg-card px-3 outline-none focus:border-ring"
              >
                <option value="all">All sections</option>
                {allSections.map(sec => (
                  <option key={sec.id} value={sec.id}>{sec.title}</option>
                ))}
              </select>
              <span className="text-xs text-subtle-foreground tabular-nums shrink-0">
                {displayedRefs.length}
              </span>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setRefsOpen(true)}
            className="flex-1 flex flex-col items-center pt-5 gap-3 text-muted-foreground hover:text-highlight-strong transition-colors duration-150"
            title="Open references"
          >
            <ChevronRight className="h-4 w-4" />
            <span className="text-xs [writing-mode:vertical-rl] rotate-180 tracking-wide">References</span>
          </button>
        )}

        {refsOpen && (
          <div className="flex-1 overflow-y-auto">
            {displayedRefs.length === 0 ? (
              <div className="text-xs text-muted-foreground px-4 py-8 leading-relaxed">
                <p className="text-foreground font-medium mb-1">No references yet</p>
                <p>
                  Ask the assistant to search for literature. Results are added here automatically in APA 7 format.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {displayedRefs.map((ref) => {
                  const inBib = (project?.bibliography || []).includes(ref.id);
                  const expanded = expandedRefId === ref.id;
                  return (
                    <li key={ref.id} className="text-xs">
                      <button
                        className="w-full text-left px-4 pt-3 pb-2 flex items-start gap-2 transition-colors duration-150"
                        onClick={() => setExpandedRefId(expanded ? null : ref.id)}
                        aria-expanded={expanded}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium leading-snug line-clamp-2 text-foreground">
                            {ref.title}
                          </p>
                          <p className="mt-1 truncate text-muted-foreground">
                            {ref.authors.length > 0
                              ? `${toAPA7Author(ref.authors[0])}${ref.authors.length > 1 ? " et al." : ""}`
                              : "Unknown author"}{" "}
                            ({ref.year})
                          </p>
                        </div>
                        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 mt-1 text-subtle-foreground transition-transform duration-150", expanded && "rotate-180")} />
                      </button>

                      {expanded && (
                        <div className="px-4 pb-2 pt-1 space-y-3">
                          <div>
                            <p className="eyebrow mb-1">
                              {citationStyle === 'APA' ? 'APA 7' : citationStyle === 'MLA' ? 'MLA 9' : 'Chicago'} citation
                            </p>
                            <p className="leading-relaxed text-foreground/90 select-text">
                              {formatCitation(ref, citationStyle)}
                            </p>
                          </div>
                          {ref.notes && (
                            <div>
                              <p className="eyebrow mb-1">Abstract</p>
                              <p className="text-muted-foreground leading-relaxed line-clamp-6">{ref.notes}</p>
                            </div>
                          )}
                          {ref.doi && (
                            <a
                              href={ref.doi.startsWith("http") ? ref.doi : `https://doi.org/${ref.doi}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline hover:text-highlight-strong underline-offset-2"
                            >
                              <ExternalLink className="h-3 w-3" />
                              View source
                            </a>
                          )}
                        </div>
                      )}

                      <div className="px-4 pb-3">
                        <button
                          onClick={() => inBib ? removeFromBibliography(ref.id) : addToBibliography(ref.id)}
                          className={cn(
                            "inline-flex items-center gap-1 text-xs transition-colors duration-150",
                            inBib ? "text-primary" : "text-muted-foreground hover:text-highlight-strong"
                          )}
                          title={inBib ? "Remove from bibliography" : "Add to bibliography"}
                        >
                          {inBib ? <><Check className="h-3 w-3" /> In bibliography</> : <><Plus className="h-3 w-3" /> Use in paper</>}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {/* Manual add-reference form */}
        {refsOpen && showReferenceForm && (
          <div className="p-4 border-t border-border shrink-0 bg-background">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">Add reference</span>
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-6 w-6 text-muted-foreground"
                onClick={() => setShowReferenceForm(false)}
                aria-label="Close"
              >
                <X />
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
              <Input name="title" placeholder="Title" className="h-8 text-xs md:text-xs" required />
              <Input name="authors" placeholder="Authors (comma separated)" className="h-8 text-xs md:text-xs" required />
              <Input name="year" placeholder="Year" className="h-8 text-xs md:text-xs" required />
              <Button type="submit" size="sm" className="w-full">
                Add reference
              </Button>
            </form>
          </div>
        )}
      </aside>

      {/* ── Main Editor ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 h-full min-h-0 writing-col">
        {/* Section header */}
        <div className="h-14 border-b border-border bg-card flex items-center justify-between px-4 shrink-0 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <h2 className="font-serif text-base font-semibold leading-tight truncate">{currentSection.title}</h2>
              {currentSection.description && (
                <p className="text-xs text-muted-foreground truncate">{currentSection.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {ttsSupported && (
              <button
                onClick={toggleReadSectionAloud}
                disabled={!currentSection.content?.trim()}
                className="text-muted-foreground hover:text-highlight-strong disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title={isSpeakingSection ? "Stop reading" : "Read section aloud"}
              >
                {isSpeakingSection ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
            )}
            <span className="text-xs text-muted-foreground tabular-nums">
              {sectionWords.toLocaleString()} words
            </span>
          </div>
        </div>

        {/* Formatting toolbar */}
        <div className="shrink-0 border-b border-border bg-card flex items-center gap-1 px-3 py-1 flex-wrap" role="toolbar" aria-label="Formatting">
          {toolbarGroups.map((group, gi) => (
            <div key={gi} className="flex items-center gap-1">
              {gi > 0 && <div className="w-px h-4 bg-border mx-2" />}
              {group.map(({ icon, title, action, active }) => (
                <button
                  key={title}
                  title={title}
                  aria-label={title}
                  aria-pressed={!!active}
                  onClick={action}
                  className={cn(
                    "p-2 rounded-full transition-colors duration-150",
                    active ? "bg-accent text-foreground" : "text-muted-foreground hover:text-highlight-strong"
                  )}
                >
                  {icon}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Rich-text editor; the section outline and assistant comments float over it */}
        <div className="flex-1 min-h-0 relative">
        <div
          ref={editorWrapRef}
          className="h-full overflow-y-auto tiptap-editor relative bg-card flex flex-col"
        >
          <EditorContent editor={editor} className="flex-1" />

          {/* ── Selection reference tooltip ── */}
          {selectionTooltip && (
            <div
              className="absolute z-50 rounded-md border border-border bg-popover shadow-popover overflow-hidden animate-in fade-in-0 duration-150"
              style={{
                left: Math.max(8, Math.min(selectionTooltip.x, (editorWrapRef.current?.clientWidth ?? 600) - 296)),
                top: Math.max(8, selectionTooltip.y),
                width: 288,
              }}
              onMouseDown={e => { e.preventDefault(); e.stopPropagation(); }}
            >
              <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                <span className="eyebrow">Cite a source</span>
                <button onClick={closeTooltip} className="text-subtle-foreground hover:text-highlight-strong transition-colors" aria-label="Close">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="px-3 py-2 border-b border-border">
                <p className="text-xs text-muted-foreground italic line-clamp-2 font-serif">&ldquo;{selectionTooltip.text}&rdquo;</p>
              </div>

              <div className="px-3 py-3 space-y-2">
                {!refMatchState.ref && !refMatchState.loading && !refMatchState.noMatch && (
                  <Button size="sm" className="w-full" onClick={findMatchingReference}>
                    Find matching reference
                  </Button>
                )}

                {refMatchState.noMatch && !refMatchState.loading && (
                  <div className="space-y-2">
                    <p className="text-center text-xs text-muted-foreground">No matching reference found.</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => { setRefMatchState(s => ({ ...s, noMatch: false })); findMatchingReference(); }}
                    >
                      Try again
                    </Button>
                  </div>
                )}

                {refMatchState.loading && (
                  <div className="flex items-center gap-2 py-1 justify-center text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Searching references…
                  </div>
                )}

                {refMatchState.ref && !refMatchState.inserted && (
                  <>
                    <div className="pb-3 mb-1 border-b border-border">
                      <p className="eyebrow mb-1">Best match</p>
                      <p className="text-xs text-foreground leading-snug line-clamp-3">{refMatchState.ref.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {refMatchState.ref.authors?.[0] && `${refMatchState.ref.authors[0].trim().split(/\s+/).at(-1)} `}
                        {refMatchState.ref.year && `(${refMatchState.ref.year})`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1" onClick={findMatchingReference}>
                        Try again
                      </Button>
                      <Button size="sm" className="flex-1" onClick={insertCitationAtSelection}>
                        Insert citation
                      </Button>
                    </div>
                  </>
                )}

                {refMatchState.inserted && (
                  <p className="flex items-center justify-center gap-2 text-xs text-primary py-1">
                    <Check className="h-3.5 w-3.5" /> Citation inserted
                  </p>
                )}

                {!refMatchState.loading && !refMatchState.ref && !refMatchState.inserted && (() => {
                  const total = [
                    project?.outline.introduction.references?.length ?? 0,
                    ...(project?.outline.body.map(s => s.references?.length ?? 0) ?? []),
                    project?.outline.conclusion.references?.length ?? 0,
                  ].reduce((a, b) => a + b, 0);
                  return total === 0 ? (
                    <p className="text-xs text-warning text-center leading-relaxed">
                      This project has no references yet. Ask the assistant to search for literature first.
                    </p>
                  ) : (
                    <p className="text-xs text-subtle-foreground text-center">
                      Matches against {total} reference{total !== 1 ? 's' : ''} in this project
                    </p>
                  );
                })()}
              </div>
            </div>
          )}
        </div>

          {/* ── Floating right column (stays put while the page scrolls): outline, then comments ── */}
          <div className="absolute top-4 right-4 bottom-4 z-30 w-80 flex flex-col items-end gap-3 pointer-events-none">

            {/* Section outline widget — collapses to a small pill */}
            <section
              aria-label="Section outline"
              className={cn(
                "pointer-events-auto shrink-0 border border-border bg-popover shadow-popover transition-[border-radius] duration-200",
                isGuideOpen ? "w-full rounded-2xl" : "rounded-full",
              )}
            >
              <button
                onClick={() => setGuideOpen(prev => ({ ...prev, [currentSection.id]: !isGuideOpen }))}
                aria-expanded={isGuideOpen}
                className={cn("w-full flex items-center justify-between gap-3 text-left group", isGuideOpen ? "px-4 pt-4 pb-3" : "px-4 py-2")}
              >
                {isGuideOpen ? (
                  <span className="min-w-0">
                    <span className="eyebrow block">Section outline</span>
                    <span className="block text-sm text-foreground mt-1 truncate group-hover:text-highlight-strong transition-colors duration-150">
                      What to cover in {currentSection.title}
                    </span>
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-xs text-muted-foreground group-hover:text-highlight-strong transition-colors duration-150">
                    <ListOrdered className="h-3.5 w-3.5" />
                    Section outline
                  </span>
                )}
                <ChevronDown className={cn("h-4 w-4 shrink-0 text-subtle-foreground transition-transform duration-200", isGuideOpen && "rotate-180")} />
              </button>
              <AnimatePresence initial={false}>
                {isGuideOpen && (
                  <motion.div
                    key="guide"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto", transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } }}
                    exit={{ opacity: 0, height: 0, transition: { duration: 0.2 } }}
                    className="overflow-hidden"
                  >
                    <ol className="max-h-[45vh] overflow-y-auto px-4 pb-2">
                      {guidePoints.map((point, i) => (
                        <li key={point.title} className="flex items-start gap-3 py-3 border-t border-border group">
                          <span className="w-5 pt-px text-xs text-subtle-foreground tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-medium text-foreground">{point.title}</span>
                            <span className="block text-xs text-muted-foreground mt-1 leading-relaxed">{point.hint}</span>
                            <button
                              onClick={() => insertGuideHeading(point.title)}
                              className="mt-1 text-xs text-subtle-foreground hover:text-highlight-strong transition-colors duration-150"
                              title={`Add "${point.title}" as a heading in your text`}
                            >
                              + Add as heading
                            </button>
                          </span>
                        </li>
                      ))}
                    </ol>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

            {/* Assistant comments */}
            {threads.length > 0 && (
              commentsHidden || visibleThreads.length === 0 ? (
                visibleThreads.length > 0 && (
                  <button
                    onClick={() => setCommentsHidden(false)}
                    className="pointer-events-auto shrink-0 flex items-center gap-2 rounded-full border border-border bg-popover px-4 py-2 text-xs text-muted-foreground shadow-popover hover:text-highlight-strong transition-colors duration-150"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Show {visibleThreads.length} comment{visibleThreads.length !== 1 ? "s" : ""}
                  </button>
                )
              ) : (
                <aside
                  aria-label="Assistant comments"
                  className="pointer-events-auto w-full min-h-0 overflow-y-auto flex flex-col gap-3 pb-1"
                >
                  <div className="flex items-center justify-between px-2">
                    <span className="eyebrow">Assistant comments</span>
                    <button
                      onClick={() => setCommentsHidden(true)}
                      className="text-xs text-muted-foreground hover:text-highlight-strong transition-colors duration-150"
                    >
                      Hide
                    </button>
                  </div>
                <AnimatePresence initial={false}>
                  {visibleThreads.map(thread => {
                    const hasReply = thread.replies.some(r =>
                      messageText(r).trim() || (r.parts as any[] | undefined)?.some(p => p.type === "tool-search_scholarly_articles"));
                    const waiting = isLoading && thread.id === latestThreadId && !hasReply;
                    return (
                      <motion.article
                        key={thread.id}
                        layout
                        initial={{ opacity: 0, y: -6, filter: "blur(3px)" }}
                        animate={{ opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } }}
                        exit={{ opacity: 0, transition: { duration: 0.15 } }}
                        className="rounded-2xl border border-border bg-popover p-4 shadow-popover"
                      >
                        <div className="flex items-start gap-2">
                          <p className="flex-1 text-xs text-muted-foreground italic line-clamp-2">
                            {thread.question ? promptLabel(thread.question) : "Assistant"}
                          </p>
                          <button
                            onClick={() => setDismissedComments(prev => new Set(prev).add(thread.id))}
                            className="shrink-0 -mr-1 -mt-1 h-6 w-6 flex items-center justify-center rounded-full text-subtle-foreground hover:text-highlight-strong transition-colors duration-150"
                            aria-label="Dismiss comment"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="mt-2 max-h-80 overflow-y-auto text-sm text-foreground">
                          {waiting ? (
                            <p className="flex items-center gap-2 text-muted-foreground">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
                            </p>
                          ) : !hasReply ? (
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              No answer came back. The assistant needs an <span className="font-mono">HF_API_TOKEN</span> in <span className="font-mono">.env.local</span>; once it&rsquo;s set, ask again.
                            </p>
                          ) : (
                            thread.replies.map((msg: any) =>
                              (msg.parts as any[])?.map((part: any, i: number) => {
                                if (part.type === "text") return <ChatMarkdown key={`${msg.id}-${i}`} text={part.text} />;
                                if (part.type === "tool-search_scholarly_articles") {
                                  const count = Array.isArray(part.output) ? part.output.length : 0;
                                  return (
                                    <p key={`${msg.id}-${i}`} className="flex items-center gap-2 text-xs my-2 text-muted-foreground">
                                      <BookMarked className="h-3 w-3 shrink-0" />
                                      {part.state === "output-available"
                                        ? `Found ${count} reference${count !== 1 ? "s" : ""} on OpenAlex. Added to References.`
                                        : "Searching OpenAlex…"}
                                    </p>
                                  );
                                }
                                return null;
                              }) ?? <p key={msg.id} className="whitespace-pre-wrap">{msg.content}</p>
                            )
                          )}
                        </div>
                      </motion.article>
                    );
                  })}
                </AnimatePresence>
              </aside>
              )
            )}
          </div>
        </div>

        {/* ── Ask the assistant (answers appear as comments on the page) ────── */}
        <div className="px-4 py-3 border-t border-border shrink-0 bg-card">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn("shrink-0", isRecording ? "text-foreground bg-accent" : "text-muted-foreground")}
              onClick={() => setIsRecording(!isRecording)}
              aria-label={isRecording ? "Stop dictation" : "Start dictation"}
              aria-pressed={isRecording}
            >
              {isRecording ? <MicOff /> : <Mic />}
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
              aria-label="Send"
            >
              {isLoading ? <Loader2 className="animate-spin" /> : <Send />}
            </Button>
          </form>
          <div className="mt-2 ml-12 flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={handleAudit} disabled={isLoading}>
              <AlertTriangle className="h-3 w-3" />
              Review this section
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={handleFindReferences} disabled={isLoading}>
              <BookMarked className="h-3 w-3" />
              Find references
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
