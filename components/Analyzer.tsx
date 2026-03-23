'use client';
import { useState } from 'react';
import { ArrowRight, ArrowLeft, RefreshCw, UploadCloud, TestTube2, Activity, SplitSquareHorizontal, Plus, Trash2 } from 'lucide-react';

type GroupConfig = {
  id: string;
  name: string;
  sheet: string;
  col: string;
  data: string;
};

const C = {
  brown:    '#381d18',
  olive:    '#a0ad6d',
  oliveLt:  '#f0f3e0',
  orange:   '#fb804a',
  orangeLt: '#fef5dd',
  cream:    '#fef5dd',
  muted:    '#b0976a',
};

export function Analyzer() {
  const [step, setStep] = useState(1);
  const [purpose, setPurpose] = useState('independent');
  const [criteriaMin, setCriteriaMin] = useState('');
  const [criteriaMax, setCriteriaMax] = useState('');
  const [groups, setGroups] = useState<GroupConfig[]>([
    { id: '1', name: 'Variable A', sheet: '', col: '', data: '20, 22, 19, 24, 25, 28, 21, 22, , 900' },
    { id: '2', name: 'Variable B', sheet: '', col: '', data: '12, 15, 14, 18, 10, 35, 12, 11, NaN,' }
  ]);
  const [workbook, setWorkbook] = useState<any>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [sheetColsCache, setSheetColsCache] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const addGroup = () => setGroups(prev => [...prev, {
    id: Date.now().toString(),
    name: `Variable ${String.fromCharCode(65 + prev.length)}`,
    sheet: sheetNames[0] || '', col: '', data: ''
  }]);

  const removeGroup = (id: string) =>
    setGroups(prev => prev.length <= 2 ? prev : prev.filter(g => g.id !== id));

  const updateGroup = (id: string, field: keyof GroupConfig, value: string) =>
    setGroups(prev => prev.map(g => g.id === id ? { ...g, [field]: value } : g));

  const loadSheetColumns = (wb: any, sheetName: string, XLSX: any) => {
    try {
      const data = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });
      return (data[0] || []) as string[];
    } catch { return []; }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const XLSX = await import('xlsx');
      const reader = new FileReader();
      reader.onload = (evt) => {
        const wb = XLSX.read(evt.target?.result, { type: 'binary' });
        setWorkbook(wb);
        const sheets = wb.SheetNames;
        setSheetNames(sheets);
        if (sheets.length > 0) {
          const cols = loadSheetColumns(wb, sheets[0], XLSX);
          setSheetColsCache({ [sheets[0]]: cols });
          setGroups(prev => prev.map((g, i) => ({ ...g, sheet: sheets[0], col: cols[i] || cols[0] || '' })));
        }
      };
      reader.readAsBinaryString(file);
    } catch { setError("Failed to parse file."); }
  };

  const handleSheetChange = async (id: string, sheetName: string) => {
    updateGroup(id, 'sheet', sheetName);
    if (!workbook) return;
    if (!sheetColsCache[sheetName]) {
      const XLSX = await import('xlsx');
      const cols = loadSheetColumns(workbook, sheetName, XLSX);
      setSheetColsCache(prev => ({ ...prev, [sheetName]: cols }));
      updateGroup(id, 'col', cols[0] || '');
    } else {
      updateGroup(id, 'col', sheetColsCache[sheetName][0] || '');
    }
  };

  const applyColumns = async () => {
    if (!workbook) return;
    const XLSX = await import('xlsx');
    setGroups(groups.map(g => {
      if (g.sheet && g.col) {
        try {
          const data = XLSX.utils.sheet_to_json(workbook.Sheets[g.sheet]);
          return { ...g, data: data.map((row: any) => row[g.col] ?? '').join(', ') };
        } catch {}
      }
      return g;
    }));
  };

  const handleAnalyze = async () => {
    setLoading(true); setError(null); setResult(null);
    try {
      if (purpose !== 'independent' && groups.length > 2)
        throw new Error(`'${purpose}' requires exactly 2 variables.`);
      const payloadGroups: Record<string, (number | null)[]> = {};
      groups.forEach(g => {
        payloadGroups[g.name] = g.data.split(',').map(n => {
          const t = n.trim();
          if (!t || t.toLowerCase() === 'nan') return null;
          const p = parseFloat(t);
          return isNaN(p) ? null : p;
        });
      });
      const res = await fetch('http://localhost:8000/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groups: payloadGroups, criteria_min: criteriaMin ? parseFloat(criteriaMin) : null, criteria_max: criteriaMax ? parseFloat(criteriaMax) : null, purpose }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data); setStep(3);
    } catch (err: any) {
      setError(err.message || 'Failed to connect to backend.');
    } finally { setLoading(false); }
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto" style={{ background: '#ffffff' }}>

      {/* Hero */}
      <div className="px-10 pt-10 pb-16" style={{ background: C.brown }}>
        <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: C.olive }}>Research Tools</p>
        <h1 className="font-serif text-4xl font-bold text-white leading-tight mb-1">Psychology Test Analyzer</h1>
        <p className="text-sm" style={{ color: '#c8b8a8' }}>Run statistical tests on your research data.</p>
      </div>

      {/* Step pill */}
      <div className="px-10 -mt-6 mb-8">
        <div className="inline-flex items-center gap-1 bg-white rounded-full px-5 py-3 shadow-md border border-white/60">
          {['Data', 'Goal', 'Results'].map((label, idx) => {
            const s = idx + 1;
            const active = step === s;
            const done = step > s;
            return (
              <div key={s} className="flex items-center gap-1">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                    style={{ background: active ? C.olive : done ? C.orangeLt : '#f3f4f6', color: active ? '#fff' : done ? C.orange : '#9ca3af' }}>
                    {done ? '✓' : s}
                  </div>
                  <span className="text-xs font-semibold" style={{ color: active ? C.brown : '#9ca3af' }}>{label}</span>
                </div>
                {s < 3 && <div className="w-8 h-px mx-2" style={{ background: done ? C.orange : '#e5e7eb' }} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="px-10 pb-12">

        {error && (
          <div className="mb-8 px-5 py-4 rounded-2xl text-sm flex items-start gap-3 border" style={{ background: '#fff5f5', borderColor: '#fecaca', color: '#dc2626' }}>
            <Activity className="w-4 h-4 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {/* STEP 1 */}
        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">

            {/* Upload */}
            <div className="mb-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: C.oliveLt }}>
                  <UploadCloud className="w-4 h-4" style={{ color: C.olive }} />
                </div>
                <h2 className="font-semibold text-base" style={{ color: C.brown }}>Import from Excel / CSV</h2>
              </div>
              <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-2xl py-8 cursor-pointer transition-colors hover:border-opacity-80"
                style={{ borderColor: C.olive, background: C.cream }}>
                <UploadCloud className="w-6 h-6" style={{ color: C.olive }} />
                <span className="text-sm font-medium" style={{ color: C.olive }}>Choose file</span>
                <span className="text-xs" style={{ color: C.muted }}>.xlsx · .xls · .csv</span>
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" />
              </label>

              {workbook && sheetNames.length > 0 && (
                <div className="mt-5 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: C.muted }}>Map columns to variables</p>
                  <div className="grid grid-cols-2 gap-3">
                    {groups.map(group => {
                      const cols = sheetColsCache[group.sheet] || [];
                      return (
                        <div key={`map_${group.id}`} className="p-4 rounded-2xl border" style={{ background: C.oliveLt, borderColor: 'transparent' }}>
                          <p className="text-xs font-semibold mb-2" style={{ color: C.olive }}>{group.name}</p>
                          <div className="space-y-2">
                            <select className="w-full text-xs p-2 rounded-lg border bg-white outline-none" style={{ borderColor: '#d1d5db', color: C.brown }} value={group.sheet} onChange={e => handleSheetChange(group.id, e.target.value)}>
                              {sheetNames.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            {cols.length > 0 && (
                              <select className="w-full text-xs p-2 rounded-lg border bg-white outline-none" style={{ borderColor: '#d1d5db', color: C.brown }} value={group.col} onChange={e => updateGroup(group.id, 'col', e.target.value)}>
                                {cols.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button onClick={applyColumns} className="w-full text-sm font-semibold py-2.5 rounded-xl text-white transition-opacity hover:opacity-90" style={{ background: C.olive }}>
                    Extract Data →
                  </button>
                </div>
              )}
            </div>

            {/* Variables */}
            <div className="mb-10">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-semibold text-base" style={{ color: C.brown }}>Variables / Groups</h2>
                <button onClick={addGroup} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
                  style={{ color: C.orange, background: C.orangeLt }}>
                  <Plus className="w-3.5 h-3.5" /> Add Group
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {groups.map((group, gi) => (
                  <div key={group.id} className="group/field relative">
                    <div className="h-1 rounded-t-xl" style={{ background: gi % 2 === 0 ? C.olive : C.orange }} />
                    <div className="p-4 rounded-b-xl" style={{ background: '#fff', border: '1px solid #ede9e3', borderTop: 'none' }}>
                      <div className="flex items-center justify-between mb-3">
                        <input
                          className="text-sm font-semibold bg-transparent border-none p-0 focus:ring-0 outline-none"
                          style={{ color: C.brown }}
                          value={group.name}
                          onChange={e => updateGroup(group.id, 'name', e.target.value)}
                          placeholder="Group name"
                        />
                        {groups.length > 2 && (
                          <button onClick={() => removeGroup(group.id)} className="opacity-0 group-hover/field:opacity-100 transition-opacity p-1 rounded-lg hover:bg-red-50">
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          </button>
                        )}
                      </div>
                      <textarea
                        rows={2}
                        className="w-full px-3 py-2.5 rounded-xl border text-xs font-mono leading-relaxed outline-none resize-none"
                        style={{ background: C.cream, borderColor: '#ede9e3', color: C.brown }}
                        value={group.data}
                        onChange={e => updateGroup(group.id, 'data', e.target.value)}
                        placeholder="Comma-separated values, e.g. 1.2, 3.4, NaN, 5"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Exclusion criteria */}
            <div className="mb-10">
              <h2 className="font-semibold text-base mb-4" style={{ color: C.brown }}>
                Exclusion Criteria <span className="text-xs font-normal ml-1" style={{ color: C.muted }}>(optional)</span>
              </h2>
              <div className="flex gap-5">
                {[
                  { label: 'Minimum', val: criteriaMin, set: setCriteriaMin },
                  { label: 'Maximum', val: criteriaMax, set: setCriteriaMax },
                ].map(({ label, val, set }) => (
                  <div key={label} className="flex-1">
                    <label className="block text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: C.muted }}>{label}</label>
                    <input type="number" className="w-full px-4 py-3 rounded-xl border text-sm outline-none" style={{ background: C.cream, borderColor: '#ede9e3', color: C.brown }} value={val} onChange={e => set(e.target.value)} placeholder="e.g. 0" />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={() => setStep(2)} className="flex items-center gap-2 text-white font-semibold py-3 px-7 rounded-full shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl text-sm" style={{ background: C.brown }}>
                Continue to Goal <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="mb-8">
              <h2 className="font-serif text-2xl font-bold mb-1" style={{ color: C.brown }}>What's the goal of your analysis?</h2>
              <p className="text-sm" style={{ color: C.muted }}>For 3+ variables, ANOVA and post-hoc pipelines run automatically.</p>
            </div>

            <div className="space-y-4 mb-10">
              {[
                {
                  value: 'independent',
                  icon: <SplitSquareHorizontal className="w-6 h-6" />,
                  label: 'Compare Independent Groups',
                  desc: 'Compare means between separate groups. T-test, ANOVA, Kruskal-Wallis.',
                  color: C.olive, bg: C.oliveLt,
                  disabled: false,
                },
                {
                  value: 'paired',
                  icon: <RefreshCw className="w-6 h-6" />,
                  label: 'Compare Related / Paired Data',
                  desc: `Same subjects measured twice. Paired T-test, Wilcoxon.${groups.length > 2 ? ' Requires exactly 2 groups.' : ''}`,
                  color: C.orange, bg: C.orangeLt,
                  disabled: groups.length > 2,
                },
                {
                  value: 'correlation',
                  icon: <Activity className="w-6 h-6" />,
                  label: 'Find Correlation',
                  desc: `Linear relationship between two variables. Pearson / Spearman.${groups.length > 2 ? ' Requires exactly 2 groups.' : ''}`,
                  color: '#7c6fcd', bg: '#f3f0fc',
                  disabled: groups.length > 2,
                },
              ].map(({ value, icon, label, desc, color, bg, disabled }) => {
                const active = purpose === value;
                return (
                  <label key={value} className={`flex items-start gap-5 p-5 rounded-2xl cursor-pointer transition-all border-2 ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:-translate-y-0.5'}`}
                    style={{ background: active ? bg : '#fff', borderColor: active ? color : '#ede9e3' }}>
                    <input type="radio" name="purpose" value={value} className="sr-only" checked={active} disabled={disabled} onChange={e => setPurpose(e.target.value)} />
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: active ? color : '#f3f4f6', color: active ? '#fff' : '#9ca3af' }}>
                      {icon}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm mb-0.5" style={{ color: C.brown }}>{label}</p>
                      <p className="text-xs" style={{ color: C.muted }}>{desc}</p>
                    </div>
                    {active && <div className="w-5 h-5 rounded-full border-[5px] shrink-0 mt-1" style={{ borderColor: color }} />}
                  </label>
                );
              })}
            </div>

            <div className="flex items-center justify-between">
              <button onClick={() => setStep(1)} className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-full" style={{ color: C.muted }}>
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button onClick={handleAnalyze} disabled={loading} className="flex items-center gap-2 text-white font-semibold py-3 px-7 rounded-full shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl text-sm disabled:opacity-50"
                style={{ background: C.brown }}>
                {loading ? 'Analyzing…' : <><TestTube2 className="w-4 h-4" /> Run Analysis</>}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && result && (
          <div className="animate-in fade-in zoom-in-95 duration-300 space-y-10">

            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: C.muted }}>Recommended Test</p>
              <div className="flex items-end gap-4 flex-wrap">
                <h2 className="font-serif text-4xl font-bold" style={{ color: C.brown }}>{result.recommended_test}</h2>
                <span className="mb-1 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold"
                  style={{ background: result.significant ? C.oliveLt : '#f3f4f6', color: result.significant ? C.olive : '#6b7280' }}>
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: result.significant ? C.olive : '#9ca3af' }} />
                  {result.significant ? 'Statistically Significant' : 'Not Significant'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Test Statistic', value: result.statistic, color: C.olive, bg: C.oliveLt },
                { label: 'P-Value', value: result.p_value, color: C.orange, bg: C.orangeLt },
              ].map(({ label, value, color, bg }) => (
                <div key={label} className="rounded-2xl p-6" style={{ background: bg }}>
                  <p className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color }}>{label}</p>
                  <p className="font-mono font-bold text-2xl" style={{ color: C.brown }}>{value}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl p-5" style={{ background: result.significant ? C.oliveLt : '#f7f4ef', borderLeft: `4px solid ${result.significant ? C.olive : C.muted}` }}>
              <p className="text-sm leading-relaxed" style={{ color: C.brown }}>
                <strong>Interpretation — </strong>
                {result.significant
                  ? `The p-value (${result.p_value}) is below 0.05. We reject the null hypothesis — there is a statistically significant difference across the groups.`
                  : `The p-value (${result.p_value}) exceeds 0.05. We fail to reject the null hypothesis — no significant difference was found.`}
              </p>
            </div>

            {result.post_hoc?.length > 0 && result.significant && (
              <div>
                <h3 className="font-semibold text-base mb-1" style={{ color: C.brown }}>Post-Hoc Pairwise Comparisons</h3>
                <p className="text-xs mb-4" style={{ color: C.muted }}>Pairwise breakdown because the omnibus test was significant.</p>
                <div className="rounded-2xl overflow-hidden border" style={{ borderColor: '#ede9e3' }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: C.cream }}>
                        {['Group A', 'Group B', 'P-Value', 'Significance'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest" style={{ color: C.muted }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y" style={{ borderColor: '#f5f0e8' }}>
                      {result.post_hoc.map((ph: any, idx: number) => {
                        const sig = ph.p_value < 0.05;
                        return (
                          <tr key={idx} className="hover:bg-stone-50">
                            <td className="px-4 py-3" style={{ color: C.brown }}>{ph.A}</td>
                            <td className="px-4 py-3" style={{ color: C.brown }}>{ph.B}</td>
                            <td className="px-4 py-3 font-mono" style={{ color: C.brown }}>{ph.p_value.toFixed(4)}</td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                                style={{ background: sig ? C.oliveLt : '#f3f4f6', color: sig ? C.olive : '#6b7280' }}>
                                {sig ? 'Significant' : 'Not sig.'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div>
              <h3 className="font-semibold text-base mb-4" style={{ color: C.brown }}>Data Quality Report</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(result.cleaning_report).map(([gName, gRep]: [string, any], gi) => (
                  <div key={gName} className="rounded-2xl p-5" style={{ background: gi % 2 === 0 ? C.oliveLt : C.orangeLt }}>
                    <p className="font-semibold text-sm mb-4" style={{ color: C.brown }}>{gName}</p>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: 'Initial', value: gRep.initial_count },
                        { label: 'Missing', value: `-${gRep.missing_removed}` },
                        { label: 'Excluded', value: `-${gRep.criteria_removed}` },
                        { label: 'Outliers', value: `-${gRep.outliers_removed}` },
                        { label: 'Final', value: gRep.final_count, bold: true },
                      ].map(({ label, value, bold }) => (
                        <div key={label}>
                          <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: gi % 2 === 0 ? C.olive : '#c09070' }}>{label}</p>
                          <p className={`font-mono text-sm ${bold ? 'font-bold' : ''}`} style={{ color: C.brown }}>{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-sm mb-3" style={{ color: C.muted }}>Flowchart Logic</h3>
              <div className="space-y-1">
                {Object.entries(result.logic_steps).map(([k, v]) => (
                  <div key={k} className="flex items-start gap-3 text-xs font-mono py-1 border-b" style={{ borderColor: '#ede9e3', color: C.brown }}>
                    <span style={{ color: C.olive }}>›</span>
                    <span style={{ color: C.muted }}>{k}:</span>
                    <span>{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-center pt-2">
              <button onClick={() => setStep(1)} className="flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-full border-2"
                style={{ borderColor: '#ede9e3', color: C.brown }}>
                <RefreshCw className="w-4 h-4" /> Analyze Another Dataset
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
