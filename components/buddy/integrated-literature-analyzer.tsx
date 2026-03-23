'use client';

import { useState } from 'react';
import { FileText, BookOpen, UploadCloud, Layers, CheckCircle2, AlertCircle, Lightbulb, Trash2, ArrowRight, RefreshCw, Library, BookMarked } from 'lucide-react';
import { useBuddyStore } from '@/lib/store';
import type { Reference } from '@/lib/types';

export function IntegratedLiteratureAnalyzer() {
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
      setError("No references found in your bibliography. Add references via the writing view and use '+ Use in Paper'.");
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
      <div className="flex-1 flex flex-col items-center justify-center" style={{ backgroundColor: '#ffffff' }}>
        <Library className="h-10 w-10 mb-4 opacity-30" style={{ color: '#381d18' }} />
        <p className="font-medium" style={{ color: '#381d18' }}>Please open a project to analyze its literature gap.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto flex flex-col" style={{ backgroundColor: '#ffffff' }}>

      {/* Page header */}
      <div className="px-6 py-5 border-b shrink-0" style={{ backgroundColor: '#381d18' }}>
        <h2 className="text-xl font-serif font-bold flex items-center gap-3 text-white">
          <Library className="w-5 h-5" style={{ color: '#a0ad6d' }} />
          Literature Gap Analyzer
        </h2>
        <p className="text-xs mt-1 text-white/60">
          Automatically evaluates your draft against your bibliography to surface gaps and coverage.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="px-6 py-3 border-b text-sm flex items-start gap-3" style={{ backgroundColor: '#fff3e0', borderColor: '#fb804a', color: '#381d18' }}>
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#fb804a' }} />
          <p>{error}</p>
        </div>
      )}

      {/* Input panels — side by side */}
      {!result && (
        <div className="flex flex-1 min-h-0 divide-x" style={{ borderColor: '#e5e7eb' }}>

          {/* Left: Project Draft */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="px-5 py-3 border-b shrink-0" style={{ backgroundColor: '#a0ad6d', borderColor: '#e5e7eb' }}>
              <h3 className="font-semibold text-sm text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-white" />
                Your Project Draft
              </h3>
              <p className="text-[11px] mt-0.5 text-white/70">Auto-synced from your workspace</p>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8" style={{ backgroundColor: '#ffffff' }}>
              <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4 border-2" style={{ backgroundColor: '#ffffff', borderColor: '#a0ad6d' }}>
                <CheckCircle2 className="w-7 h-7" style={{ color: '#a0ad6d' }} />
              </div>
              <h4 className="font-semibold mb-1" style={{ color: '#381d18' }}>{project.title}</h4>
              <p className="text-xs mb-5" style={{ color: '#a0ad6d' }}>{wordCount} words synchronized</p>
              <button
                onClick={() => setViewMode('writing')}
                className="text-xs font-semibold px-4 py-2 rounded-full border transition-colors hover:opacity-80"
                style={{ backgroundColor: '#fef5dd', color: '#381d18', borderColor: '#a0ad6d' }}
              >
                Edit Content First
              </button>
            </div>
          </div>

          {/* Right: Bibliography refs */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="px-5 py-3 border-b shrink-0" style={{ backgroundColor: '#a0ad6d', borderColor: '#e5e7eb' }}>
              <h3 className="font-semibold text-sm text-white flex items-center gap-2">
                <BookMarked className="w-4 h-4 text-white" />
                Reference Articles
              </h3>
              <p className="text-[11px] mt-0.5 text-white/70">Auto-pulled from your bibliography</p>
            </div>

            <div className="flex-1 overflow-y-auto divide-y" style={{ borderColor: '#e5e7eb', backgroundColor: '#ffffff' }}>
              {bibRefs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center gap-3 p-8">
                  <BookMarked className="w-8 h-8 opacity-20" style={{ color: '#381d18' }} />
                  <p className="text-sm" style={{ color: '#381d18' }}>No bibliography references yet.</p>
                  <button
                    onClick={() => setViewMode('writing')}
                    className="text-xs font-semibold px-4 py-2 rounded-full border transition-colors hover:opacity-80"
                    style={{ backgroundColor: '#fef5dd', color: '#381d18', borderColor: '#381d18' }}
                  >
                    Go add references →
                  </button>
                </div>
              ) : (
                bibRefs.map((ref, i) => (
                  <div key={ref.id} className="flex items-start gap-3 px-5 py-3 text-xs">
                    <span className="font-bold shrink-0 mt-0.5" style={{ color: '#a0ad6d' }}>[{i + 1}]</span>
                    <div className="min-w-0">
                      <p className="font-medium" style={{ color: '#381d18' }}>{ref.title}</p>
                      {ref.doi
                        ? <p className="truncate mt-0.5 opacity-50" style={{ color: '#381d18' }}>{ref.doi}</p>
                        : <p className="mt-0.5 opacity-40 italic" style={{ color: '#381d18' }}>No DOI — citation text used</p>
                      }
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Extra PDFs */}
            <div className="px-5 py-4 border-t space-y-2 shrink-0" style={{ borderColor: '#e5e7eb', backgroundColor: '#ffffff' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#a0ad6d' }}>+ Additional PDFs</p>
              <label className="border-2 border-dashed rounded-lg flex items-center justify-center gap-2 py-2.5 cursor-pointer hover:opacity-80 transition-colors" style={{ borderColor: '#a0ad6d', backgroundColor: '#fef5dd' }}>
                <UploadCloud className="w-4 h-4" style={{ color: '#a0ad6d' }} />
                <span className="text-xs font-medium" style={{ color: '#381d18' }}>Upload extra PDFs</span>
                <input type="file" multiple accept=".pdf,.txt" className="sr-only" onChange={handleRefsUpload} />
              </label>
              {refFiles.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between px-3 py-2 rounded-lg border" style={{ backgroundColor: '#fef5dd', borderColor: '#e5e7eb' }}>
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: '#a0ad6d' }} />
                    <span className="text-xs font-medium truncate" style={{ color: '#381d18' }}>{file.name}</span>
                  </div>
                  <button onClick={() => removeRef(idx)} className="hover:opacity-70 p-1">
                    <Trash2 className="w-3.5 h-3.5" style={{ color: '#fb804a' }} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Run button */}
      {!result && (
        <div className="border-t shrink-0" style={{ borderColor: '#e5e7eb' }}>
          <button
            onClick={runAnalysis}
            disabled={loading || bibRefs.length === 0}
            className="w-full py-4 font-semibold text-white flex items-center justify-center gap-3 transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#381d18' }}
          >
            {loading ? (
              <><RefreshCw className="w-5 h-5 animate-spin" />Extracting &amp; Analyzing with AI (takes up to 30s)…</>
            ) : (
              <><BookOpen className="w-5 h-5" style={{ color: '#a0ad6d' }} />Generate Literature Gap Analysis</>
            )}
          </button>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">

          {/* Result banner */}
          <div className="px-6 py-4 border-b shrink-0" style={{ backgroundColor: '#381d18', borderColor: '#e5e7eb' }}>
            <h3 className="font-bold text-white">Analysis Complete</h3>
            <p className="text-xs text-white/60 mt-0.5">
              Evaluated against {bibRefs.length + refFiles.length} reference{bibRefs.length + refFiles.length !== 1 ? 's' : ''}.
            </p>
          </div>

          {/* Gaps row */}
          <div className="flex divide-x border-b" style={{ borderColor: '#e5e7eb' }}>
            <div className="flex-1 flex flex-col min-w-0">
              <div className="px-5 py-3 border-b shrink-0" style={{ backgroundColor: '#381d18', borderColor: '#e5e7eb' }}>
                <h4 className="font-semibold text-sm text-white flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" style={{ color: '#fb804a' }} />
                  Missing Gaps in Literature
                </h4>
              </div>
              <ul className="divide-y" style={{ borderColor: '#e5e7eb' }}>
                {result.established_gaps?.map((gap: string, i: number) => (
                  <li key={i} className="flex gap-3 text-sm px-5 py-3" style={{ color: '#381d18' }}>
                    <span className="font-bold shrink-0" style={{ color: '#fb804a' }}>0{i + 1}</span>
                    {gap}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex-1 flex flex-col min-w-0">
              <div className="px-5 py-3 border-b shrink-0" style={{ backgroundColor: '#381d18', borderColor: '#e5e7eb' }}>
                <h4 className="font-semibold text-sm text-white flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" style={{ color: '#a0ad6d' }} />
                  How Your Draft Fills Gaps
                </h4>
              </div>
              <ul className="divide-y" style={{ borderColor: '#e5e7eb' }}>
                {result.draft_evaluation?.gaps_filled?.map((filled: string, i: number) => (
                  <li key={i} className="flex gap-3 text-sm px-5 py-3" style={{ color: '#381d18' }}>
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#a0ad6d' }} />
                    {filled}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Strengths & Weaknesses */}
          {result.draft_evaluation && (
            <div className="border-b" style={{ borderColor: '#e5e7eb' }}>
              <div className="px-5 py-3 border-b" style={{ backgroundColor: '#381d18', borderColor: '#e5e7eb' }}>
                <h4 className="font-semibold text-sm text-white flex items-center gap-2">
                  <FileText className="w-4 h-4" style={{ color: '#a0ad6d' }} />
                  Draft Evaluation
                </h4>
              </div>
              <div className="flex divide-x" style={{ borderColor: '#e5e7eb' }}>
                <div className="flex-1 px-5 py-4">
                  <h5 className="font-semibold text-xs uppercase tracking-wider mb-3" style={{ color: '#a0ad6d' }}>Major Strengths</h5>
                  <ul className="list-disc pl-4 space-y-2 text-sm" style={{ color: '#381d18' }}>
                    {result.draft_evaluation.strengths?.map((str: string, i: number) => <li key={i}>{str}</li>)}
                  </ul>
                </div>
                <div className="flex-1 px-5 py-4">
                  <h5 className="font-semibold text-xs uppercase tracking-wider mb-3" style={{ color: '#fb804a' }}>Crucial Weaknesses</h5>
                  <ul className="list-disc pl-4 space-y-2 text-sm" style={{ color: '#381d18' }}>
                    {result.draft_evaluation.weaknesses?.map((wk: string, i: number) => <li key={i}>{wk}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Unexplored angles */}
          {!result.draft_evaluation && result.unexplored_angles && (
            <div className="border-b" style={{ borderColor: '#e5e7eb' }}>
              <div className="px-5 py-3 border-b" style={{ backgroundColor: '#381d18', borderColor: '#e5e7eb' }}>
                <h4 className="font-semibold text-sm text-white flex items-center gap-2">
                  <Lightbulb className="w-4 h-4" style={{ color: '#fb804a' }} />
                  Unexplored Angles &amp; Unanswered Questions
                </h4>
              </div>
              <ul className="divide-y" style={{ borderColor: '#e5e7eb' }}>
                {result.unexplored_angles.map((angle: string, i: number) => (
                  <li key={i} className="flex gap-3 text-sm px-5 py-3" style={{ color: '#381d18' }}>
                    <ArrowRight className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#a0ad6d' }} />
                    {angle}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Suggestions */}
          <div className="border-b" style={{ borderColor: '#e5e7eb' }}>
            <div className="px-5 py-3 border-b" style={{ backgroundColor: '#381d18', borderColor: '#e5e7eb' }}>
              <h4 className="font-semibold text-sm text-white flex items-center gap-2">
                <Lightbulb className="w-4 h-4" style={{ color: '#fb804a' }} />
                Actionable Next Steps
              </h4>
            </div>
            <div className="divide-y" style={{ borderColor: '#e5e7eb' }}>
              {result.suggestions?.map((sug: string, i: number) => (
                <div key={i} className="flex gap-3 px-5 py-3">
                  <span className="text-xs font-bold shrink-0 mt-0.5" style={{ color: '#fb804a' }}>0{i + 1}</span>
                  <p className="text-sm" style={{ color: '#381d18' }}>{sug}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Clear */}
          <div className="px-5 py-4 flex justify-center shrink-0">
            <button
              onClick={() => setResult(null)}
              className="flex items-center gap-2 font-semibold text-sm transition-colors py-2 px-5 rounded-lg border hover:opacity-80"
              style={{ color: '#381d18', borderColor: '#381d18', backgroundColor: '#fef5dd' }}
            >
              <RefreshCw className="w-4 h-4" />
              Clear Analysis
            </button>
          </div>

        </div>
      )}

    </div>
  );
}
