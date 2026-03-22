'use client';

import { useState } from 'react';
import { FileText, BookOpen, UploadCloud, Layers, CheckCircle2, AlertCircle, Lightbulb, Trash2, ArrowRight, RefreshCw, Library } from 'lucide-react';
import { useBuddyStore } from '@/lib/store';

export function IntegratedLiteratureAnalyzer() {
  const { getCurrentProject, setViewMode } = useBuddyStore();
  const project = getCurrentProject();

  const [refFiles, setRefFiles] = useState<File[]>([]);
  const [refDois, setRefDois] = useState("");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-aggregate draft text from project sections
  let aggregatedDraftText = '';
  if (project) {
    const sections = [project.outline.introduction, ...project.outline.body, project.outline.conclusion];
    aggregatedDraftText = sections.map(s => `${s.title}\n${s.content}`).join('\n\n');
  }

  const wordCount = aggregatedDraftText.split(/\s+/).filter(Boolean).length || 0;

  const handleRefsUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setRefFiles(prev => [...prev, ...filesArray]);
    }
  };

  const removeRef = (idx: number) => {
    setRefFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const runAnalysis = async () => {
    if (refFiles.length === 0 && refDois.trim() === "") {
      setError("Please upload at least one Reference Paper or provide a DOI link.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();

    // Inject automatically aggregated text payload as a pseudo-File
    if (aggregatedDraftText.trim().length > 50) {
      const draftBlob = new Blob([aggregatedDraftText], { type: 'text/plain' });
      formData.append("draft", draftBlob, "buddy-workspace-draft.txt");
    }

    if (refFiles.length > 0) {
      refFiles.forEach(file => {
        formData.append("references", file);
      });
    }

    formData.append("reference_dois", refDois);

    try {
      const response = await fetch('http://localhost:8000/analyze-literature', {
        method: 'POST',
        body: formData,
      });

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
      <div className="flex-1 flex flex-col items-center justify-center bg-[#f8f7f8]">
        <Library className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
        <p className="text-muted-foreground font-medium">Please open a project to analyze its literature gap.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#f8f7f8] p-6">
      <div className="max-w-4xl mx-auto space-y-6 pb-20">

        {/* Header */}
        <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-2xl font-serif font-bold mb-2 flex items-center gap-2 text-zinc-900">
            <Library className="w-6 h-6 text-primary" />
            Literature Gap Analyzer
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Verify whether your current project draft successfully fills the existing gaps in your field's literature.
            We automatically pull your workspace's written text into the evaluation engine.
          </p>
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200 flex items-start shadow-sm">
            <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {/* Input Section */}
        {!result && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Sync Status Card */}
            <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm flex flex-col h-full">
              <h3 className="text-lg font-semibold text-zinc-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500" />
                Your Project Draft
              </h3>

              <div className="flex-1 flex flex-col items-center justify-center p-6 bg-indigo-50/50 border border-indigo-100 rounded-xl text-center">
                <div className="w-16 h-16 bg-white shadow-sm rounded-full flex items-center justify-center mb-4 border border-indigo-100">
                   <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
                <h4 className="font-semibold text-indigo-950 mb-1 leading-tight">{project.title}</h4>
                <p className="text-xs text-indigo-600/80 mb-4">{wordCount} words synchronized</p>
                <button
                  onClick={() => setViewMode('writing')}
                  className="text-xs font-semibold text-indigo-600 bg-white hover:bg-zinc-50 border border-indigo-200 px-4 py-2 rounded-full transition-colors"
                >
                  Edit Content First
                </button>
              </div>
            </div>

            {/* References Batch Upload */}
            <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm flex flex-col h-full">
              <h3 className="text-lg font-semibold text-zinc-900 mb-4 flex items-center gap-2">
                 <Layers className="w-5 h-5 text-emerald-500" />
                 Reference Articles
              </h3>

              <div className="flex-1 flex flex-col">
                <label className="border-2 border-dashed border-zinc-300 hover:border-emerald-400 rounded-xl flex flex-col items-center justify-center p-6 transition-colors cursor-pointer bg-zinc-50 hover:bg-emerald-50/50 mb-2">
                    <UploadCloud className="w-8 h-8 text-zinc-400 mb-2" />
                    <span className="text-xs font-medium text-zinc-700">Upload Reference PDFs</span>
                    <input type="file" multiple accept=".pdf,.txt" className="sr-only" onChange={handleRefsUpload} />
                </label>

                <div className="my-2 flex items-center gap-2">
                   <div className="h-px bg-zinc-200 flex-1" />
                   <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">Or Link DOIs</span>
                   <div className="h-px bg-zinc-200 flex-1" />
                </div>

                <textarea
                   rows={2}
                   placeholder="10.1016/j... or https://doi.org/..."
                   value={refDois}
                   onChange={(e) => setRefDois(e.target.value)}
                   className="w-full text-xs p-3 border border-zinc-200 rounded-lg bg-zinc-50 focus:ring-1 focus:ring-emerald-500 outline-none mb-3 resize-none shadow-sm"
                />

                <div className="flex-1 overflow-y-auto max-h-[80px] space-y-2 pr-2">
                  {refFiles.length === 0 && refDois.trim() === "" ? (
                     <div className="h-full flex items-center justify-center text-xs text-zinc-400 italic">No references added.</div>
                  ) : (
                    refFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-zinc-50 border border-zinc-100 p-2 rounded-md">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <FileText className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                          <span className="text-xs font-medium truncate text-zinc-700">{file.name}</span>
                        </div>
                        <button onClick={() => removeRef(idx)} className="text-zinc-400 hover:text-red-500 transition-colors p-1">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="md:col-span-2 mt-2">
              <button
                onClick={runAnalysis}
                disabled={loading || (refFiles.length === 0 && refDois.trim() === '')}
                className="w-full relative overflow-hidden group bg-primary hover:bg-primary/90 disabled:bg-primary/50 disabled:cursor-not-allowed text-primary-foreground font-semibold py-4 rounded-xl shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-3"
              >
                 {loading ? (
                   <>
                     <RefreshCw className="w-5 h-5 animate-spin" />
                     Extracting &amp; Analyzing with AI (Takes up to 30s)...
                   </>
                 ) : (
                   <>
                     <BookOpen className="w-5 h-5" />
                     Generate Literature Gap Analysis
                   </>
                 )}
              </button>
            </div>
          </div>
        )}

        {/* Results Dashboard */}
        {result && !loading && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

            <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 shadow-sm relative overflow-hidden">
              <div className="relative z-10">
                <h3 className="text-xl font-bold mb-1 text-primary">Analysis Complete</h3>
                <p className="text-muted-foreground text-sm max-w-xl leading-relaxed">
                  The Groq AI mapped out your structural logic and evaluated {refFiles.length + (refDois.trim() ? refDois.split(/[\n,]+/).filter(d => d.trim()).length : 0)} reference inputs.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm">
                <h4 className="text-lg font-bold text-zinc-900 flex items-center gap-2 mb-4">
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                  Missing Gaps in Literature
                </h4>
                <ul className="space-y-4">
                  {result.established_gaps?.map((gap: string, i: number) => (
                    <li key={i} className="flex gap-3 text-sm text-zinc-700 leading-relaxed bg-amber-50/50 p-3 rounded-lg border border-amber-100/50">
                      <span className="font-bold text-amber-600 shrink-0">0{i+1}</span>
                      {gap}
                    </li>
                  ))}
                </ul>
              </div>

               <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm">
                <h4 className="text-lg font-bold text-zinc-900 flex items-center gap-2 mb-4">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  How Your Draft Fills Gaps
                </h4>
                <ul className="space-y-4">
                  {result.draft_evaluation?.gaps_filled?.map((filled: string, i: number) => (
                    <li key={i} className="flex gap-3 text-sm text-zinc-700 leading-relaxed bg-emerald-50/50 p-3 rounded-lg border border-emerald-100/50">
                      <span className="font-bold text-emerald-600 shrink-0"><CheckCircle2 className="w-4 h-4 mt-0.5" /></span>
                      {filled}
                    </li>
                  ))}
                </ul>
              </div>

            </div>

            {result.draft_evaluation ? (
              <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm">
                 <h4 className="text-lg font-bold text-zinc-900 flex items-center gap-2 mb-6">
                    <FileText className="w-5 h-5 text-blue-500" />
                    Draft Evaluation
                 </h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:divide-x divide-zinc-200">
                    <div className="pr-0 md:pr-8">
                      <h5 className="font-semibold text-emerald-700 mb-3 uppercase tracking-wider text-xs">Major Strengths</h5>
                      <ul className="list-disc pl-5 space-y-2 text-sm text-zinc-600">
                        {result.draft_evaluation.strengths?.map((str: string, i: number) => (
                          <li key={i}>{str}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="pl-0 md:pl-8 pt-6 md:pt-0 border-t border-zinc-200 md:border-t-0">
                      <h5 className="font-semibold text-rose-700 mb-3 uppercase tracking-wider text-xs">Crucial Weaknesses</h5>
                      <ul className="list-disc pl-5 space-y-2 text-sm text-zinc-600">
                        {result.draft_evaluation.weaknesses?.map((wk: string, i: number) => (
                          <li key={i}>{wk}</li>
                        ))}
                      </ul>
                    </div>
                 </div>
              </div>
            ) : result.unexplored_angles ? (
              <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm">
                 <h4 className="text-lg font-bold text-zinc-900 flex items-center gap-2 mb-4">
                    <Lightbulb className="w-5 h-5 text-purple-500 fill-purple-100" />
                    Unexplored Angles &amp; Unanswered Questions
                 </h4>
                 <ul className="space-y-4">
                    {result.unexplored_angles.map((angle: string, i: number) => (
                       <li key={i} className="flex gap-3 text-sm text-zinc-700 leading-relaxed bg-purple-50/50 p-3 rounded-lg border border-purple-100/50">
                         <span className="text-purple-600 shrink-0"><ArrowRight className="w-4 h-4 mt-0.5" /></span>
                         {angle}
                       </li>
                    ))}
                 </ul>
              </div>
            ) : null}

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 shadow-sm">
              <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
                  <Lightbulb className="w-5 h-5 text-amber-500 fill-amber-500" />
                  Actionable Next Steps
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {result.suggestions?.map((sug: string, i: number) => (
                  <div key={i} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                    <span className="text-xs font-bold text-blue-500 mb-1 block">Suggestion 0{i+1}</span>
                    <p className="text-sm text-zinc-700 leading-relaxed">{sug}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-center pt-4">
              <button
                onClick={() => setResult(null)}
                className="flex items-center gap-2 text-zinc-500 hover:text-zinc-800 font-semibold text-sm transition-colors py-2 px-4 rounded-lg hover:bg-zinc-200"
              >
                <RefreshCw className="w-4 h-4" />
                Clear Analysis
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
