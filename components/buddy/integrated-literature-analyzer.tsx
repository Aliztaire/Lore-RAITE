'use client';

import { useState } from 'react';
import { FileText, UploadCloud, AlertCircle, Trash2, ArrowRight, RefreshCw, Eye, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBuddyStore } from '@/lib/store';
import type { Reference } from '@/lib/types';

export function IntegratedLiteratureAnalyzer({ onPreview }: { onPreview?: () => void }) {
  const { getCurrentProject, setViewMode } = useBuddyStore();
  const project = getCurrentProject();

  const [refFiles, setRefFiles] = useState<File[]>([]);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  let aggregatedDraftText = '';
  const allSections = project
    ? [project.outline.introduction, ...project.outline.body, project.outline.conclusion]
    : [];

  if (project) {
    aggregatedDraftText = allSections.map(s => `${s.title}\n${s.content}`).join('\n\n');
  }

  const wordCount = aggregatedDraftText.split(/\s+/).filter(Boolean).length || 0;

  // Pull bibliography references from all sections
  const bibIds = project?.bibliography || [];
  const allRefs = allSections.flatMap(s => s.references || []);
  const bibRefs: Reference[] = bibIds.map(id => allRefs.find(r => r.id === id)).filter(Boolean) as Reference[];
  const bibDois = bibRefs.filter(r => r.doi).map(r => r.doi!).join('\n');

  const handleRefsUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setRefFiles(prev => [...prev, ...Array.from(e.target.files!)]);
  };

  const removeRef = (idx: number) => setRefFiles(prev => prev.filter((_, i) => i !== idx));

  const runAnalysis = async () => {
    if (bibRefs.length === 0 && refFiles.length === 0) {
      setError("Your bibliography is empty. In the writing view, choose 'Use in paper' on a reference to add it.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    if (aggregatedDraftText.trim().length > 50) {
      const draftBlob = new Blob([aggregatedDraftText], { type: 'text/plain' });
      formData.append("draft", draftBlob, "buddy-workspace-draft.txt");
    }
    refFiles.forEach(file => formData.append("references", file));
    // Send bibliography DOIs + citation text for refs without DOIs
    const doisAndCitations = [
      ...bibRefs.filter(r => r.doi).map(r => r.doi!),
      ...bibRefs.filter(r => !r.doi).map(r => r.citation || r.title),
    ].join('\n');
    formData.append("reference_dois", doisAndCitations);

    try {
      const response = await fetch('http://localhost:8000/analyze-literature', { method: 'POST', body: formData });
      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to analyze literature. Ensure your Python backend is running.");
    } finally {
      setLoading(false);
    }
  };

  if (!project) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background">
        <p className="text-muted-foreground">Open a paper to analyze its literature gap.</p>
      </div>
    );
  }

  const totalSources = bibRefs.length + refFiles.length;

  const ResultList = ({ title, items, numbered = true }: { title: string; items?: string[]; numbered?: boolean }) =>
    items && items.length > 0 ? (
      <section>
        <h3 className="font-serif text-lg font-semibold mb-3">{title}</h3>
        <ol className="border-y border-border divide-y divide-border">
          {items.map((item, i) => (
            <li key={i} className="flex gap-4 py-3 text-[0.95rem] leading-relaxed">
              {numbered && <span className="w-6 shrink-0 text-sm text-subtle-foreground tabular-nums pt-0.5">{String(i + 1).padStart(2, '0')}</span>}
              <span className="flex-1">{item}</span>
            </li>
          ))}
        </ol>
      </section>
    ) : null;

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-5xl mx-auto px-10 py-12">

        {/* Title */}
        <header className="pb-8 mb-8 border-b border-border">
          <p className="eyebrow mb-3">Research tools</p>
          <h1 className="font-serif text-[2rem] leading-tight font-semibold">Literature gap analysis</h1>
          <p className="mt-2 text-muted-foreground max-w-2xl">
            Compares your draft against your bibliography to show which gaps the literature leaves open and how your paper addresses them.
          </p>
        </header>

        {error && (
          <div role="alert" className="mb-8 px-4 py-3 rounded-md text-sm flex items-start gap-3 border border-destructive/30 bg-destructive/5 text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {/* Inputs */}
        {!result && (
          <>
            <div className="grid md:grid-cols-2 gap-10">

              {/* Draft */}
              <section>
                <h2 className="eyebrow mb-3">Your draft</h2>
                <div className="rounded-md border border-border bg-card p-5">
                  <p className="font-serif text-lg font-semibold leading-snug">{project.title}</p>
                  <p className="text-sm text-muted-foreground mt-1 tabular-nums">
                    {wordCount.toLocaleString()} words across {allSections.length} sections, synced from your workspace
                  </p>
                  <div className="flex flex-wrap gap-2 mt-5">
                    {onPreview && (
                      <Button variant="outline" size="sm" onClick={onPreview}>
                        <Eye /> Preview draft
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setViewMode('writing')}>
                      Edit draft
                    </Button>
                  </div>
                </div>
              </section>

              {/* References */}
              <section>
                <div className="flex items-baseline justify-between mb-3">
                  <h2 className="eyebrow">Bibliography</h2>
                  <span className="text-xs text-subtle-foreground tabular-nums">{bibRefs.length} source{bibRefs.length !== 1 ? 's' : ''}</span>
                </div>

                {bibRefs.length === 0 ? (
                  <div className="rounded-md border border-dashed border-input p-5 text-sm text-muted-foreground">
                    <p>No sources in your bibliography yet.</p>
                    <Button variant="link" className="px-0 h-auto mt-1" onClick={() => setViewMode('writing')}>
                      Add references in the writing view <ArrowRight />
                    </Button>
                  </div>
                ) : (
                  <ol className="border-y border-border divide-y divide-border max-h-72 overflow-y-auto">
                    {bibRefs.map((ref, i) => (
                      <li key={ref.id} className="flex items-start gap-3 py-2.5 text-sm">
                        <span className="text-subtle-foreground tabular-nums shrink-0 text-xs pt-0.5">[{i + 1}]</span>
                        <div className="min-w-0">
                          <p className="leading-snug">{ref.title}</p>
                          {ref.doi
                            ? <p className="truncate text-xs text-subtle-foreground mt-0.5 font-mono">{ref.doi}</p>
                            : <p className="text-xs text-subtle-foreground mt-0.5 italic">No DOI; citation text will be used</p>
                          }
                        </div>
                      </li>
                    ))}
                  </ol>
                )}

                {/* Extra PDFs */}
                <div className="mt-5">
                  <label className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors duration-150">
                    <UploadCloud className="w-4 h-4" />
                    Attach additional PDFs
                    <input type="file" multiple accept=".pdf,.txt" className="sr-only" onChange={handleRefsUpload} />
                  </label>
                  {refFiles.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {refFiles.map((file, idx) => (
                        <li key={idx} className="flex items-center justify-between px-3 py-1.5 rounded-md border border-border bg-card text-sm">
                          <span className="flex items-center gap-2 min-w-0">
                            <FileText className="w-3.5 h-3.5 shrink-0 text-subtle-foreground" />
                            <span className="truncate">{file.name}</span>
                          </span>
                          <button onClick={() => removeRef(idx)} className="p-1 text-subtle-foreground hover:text-destructive transition-colors" aria-label={`Remove ${file.name}`}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            </div>

            <div className="mt-10 pt-6 border-t border-border flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                {loading ? 'Extracting and analyzing sources. This can take up to 30 seconds.' : `Ready to compare against ${totalSources} source${totalSources !== 1 ? 's' : ''}.`}
              </p>
              <Button size="lg" onClick={runAnalysis} disabled={loading || bibRefs.length === 0}>
                {loading ? <><Loader2 className="animate-spin" /> Analyzing…</> : <>Run analysis <ArrowRight /></>}
              </Button>
            </div>
          </>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="space-y-12">
            <div className="flex items-baseline justify-between">
              <p className="text-sm text-muted-foreground">
                Evaluated against {totalSources} source{totalSources !== 1 ? 's' : ''}.
              </p>
              <Button variant="ghost" size="sm" onClick={() => setResult(null)}>
                <RefreshCw /> Start over
              </Button>
            </div>

            <div className="grid md:grid-cols-2 gap-10">
              <ResultList title="Gaps in the literature" items={result.established_gaps} />
              <ResultList title="How your draft addresses them" items={result.draft_evaluation?.gaps_filled} />
            </div>

            {result.draft_evaluation && (
              <div className="grid md:grid-cols-2 gap-10">
                <ResultList title="Strengths" items={result.draft_evaluation.strengths} numbered={false} />
                <ResultList title="Weaknesses" items={result.draft_evaluation.weaknesses} numbered={false} />
              </div>
            )}

            {!result.draft_evaluation && (
              <ResultList title="Unexplored angles and open questions" items={result.unexplored_angles} />
            )}

            <ResultList title="Recommended next steps" items={result.suggestions} />
          </div>
        )}
      </div>
    </div>
  );
}
