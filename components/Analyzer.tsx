'use client';
import { useState } from 'react';
import { ArrowRight, ArrowLeft, RefreshCw, UploadCloud, Activity, SplitSquareHorizontal, Plus, Trash2, ChevronDown, Check, Loader2, AlertCircle } from 'lucide-react';
import { useBuddyStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type GroupConfig = {
  id: string;
  name: string;
  sheet: string;
  col: string;
  data: string;
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
  const [showSectionPicker, setShowSectionPicker] = useState(false);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [sendSuccess, setSendSuccess] = useState(false);

  const { projects, currentProjectId, updateSection } = useBuddyStore();
  const currentProject = projects.find(p => p.id === currentProjectId) || null;
  const allSections = currentProject
    ? [currentProject.outline.introduction, ...currentProject.outline.body, currentProject.outline.conclusion]
    : [];

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

  const buildResultsMarkdown = () => {
    if (!result) return '';
    const sig = result.significant
      ? `The p-value (${result.p_value}) is below 0.05. We reject the null hypothesis — there is a statistically significant difference across the groups.`
      : `The p-value (${result.p_value}) exceeds 0.05. We fail to reject the null hypothesis — no significant difference was found.`;

    let md = `\n\n## Statistical Analysis Results\n\n`;
    md += `**Test:** ${result.recommended_test}  \n`;
    md += `**Test Statistic:** ${result.statistic}  \n`;
    md += `**P-Value:** ${result.p_value}  \n`;
    md += `**Result:** ${result.significant ? 'Statistically Significant (p < 0.05)' : 'Not Significant (p ≥ 0.05)'}  \n\n`;
    md += `**Interpretation:** ${sig}\n`;

    if (result.post_hoc?.length > 0 && result.significant) {
      md += `\n### Post-Hoc Pairwise Comparisons\n\n`;
      md += `| Group A | Group B | P-Value | Significance |\n`;
      md += `|---------|---------|---------|---------------|\n`;
      result.post_hoc.forEach((ph: any) => {
        md += `| ${ph.A} | ${ph.B} | ${ph.p_value.toFixed(4)} | ${ph.p_value < 0.05 ? 'Significant' : 'Not sig.'} |\n`;
      });
    }

    md += `\n### Data Quality Report\n\n`;
    Object.entries(result.cleaning_report).forEach(([gName, gRep]: [string, any]) => {
      md += `**${gName}:** ${gRep.initial_count} initial → ${gRep.final_count} final (removed: ${gRep.missing_removed} missing, ${gRep.criteria_removed} excluded, ${gRep.outliers_removed} outliers)  \n`;
    });

    return md;
  };

  const handleSendToSection = () => {
    if (!selectedSectionId || !result) return;
    const section = allSections.find(s => s.id === selectedSectionId);
    if (!section) return;
    const append = buildResultsMarkdown();
    updateSection(selectedSectionId, { content: (section.content || '') + append });
    setSendSuccess(true);
    setTimeout(() => {
      setShowSectionPicker(false);
      setSendSuccess(false);
    }, 1500);
  };

  const STEPS = ['Data', 'Goal', 'Results'];

  const PURPOSES = [
    {
      value: 'independent',
      icon: <SplitSquareHorizontal className="w-4 h-4" />,
      label: 'Compare independent groups',
      desc: 'Compare means between separate groups. T-test, ANOVA, Kruskal–Wallis.',
      disabled: false,
    },
    {
      value: 'paired',
      icon: <RefreshCw className="w-4 h-4" />,
      label: 'Compare related or paired data',
      desc: `The same subjects measured twice. Paired t-test, Wilcoxon.${groups.length > 2 ? ' Requires exactly two groups.' : ''}`,
      disabled: groups.length > 2,
    },
    {
      value: 'correlation',
      icon: <Activity className="w-4 h-4" />,
      label: 'Find a correlation',
      desc: `Linear relationship between two variables. Pearson, Spearman.${groups.length > 2 ? ' Requires exactly two groups.' : ''}`,
      disabled: groups.length > 2,
    },
  ];

  const fieldClass = 'w-full px-3 py-2 rounded-md border border-input bg-card text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/15 transition-colors';

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-4xl mx-auto px-10 py-12">

        {/* Title */}
        <header className="pb-8 mb-8 border-b border-border">
          <p className="eyebrow mb-3">Research tools</p>
          <h1 className="font-serif text-[2rem] leading-tight font-semibold">Statistical analysis</h1>
          <p className="mt-2 text-muted-foreground">Enter your data, state your goal, and Buddy selects and runs an appropriate test.</p>

          <ol className="flex items-center gap-3 mt-8 text-sm" aria-label="Progress">
            {STEPS.map((label, idx) => {
              const s = idx + 1;
              const active = step === s;
              const done = step > s;
              return (
                <li key={s} className="flex items-center gap-3">
                  <span className={cn('flex items-center gap-2', active ? 'text-foreground' : done ? 'text-muted-foreground' : 'text-subtle-foreground')}>
                    <span className={cn('h-6 w-6 rounded-full border flex items-center justify-center text-xs tabular-nums',
                      active ? 'border-primary bg-primary text-primary-foreground' : done ? 'border-primary text-primary' : 'border-input')}>
                      {done ? <Check className="h-3 w-3" /> : s}
                    </span>
                    <span className={active ? 'font-medium' : ''}>{label}</span>
                  </span>
                  {s < STEPS.length && <span className="w-10 h-px bg-border" />}
                </li>
              );
            })}
          </ol>
        </header>

        {error && (
          <div role="alert" className="mb-8 px-4 py-3 rounded-md text-sm flex items-start gap-3 border border-destructive/30 bg-destructive/5 text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {/* STEP 1 */}
        {step === 1 && (
          <div className="space-y-12">

            {/* Upload */}
            <section>
              <h2 className="font-serif text-lg font-semibold mb-1">Import a spreadsheet</h2>
              <p className="text-sm text-muted-foreground mb-4">Optional. Load an Excel or CSV file and map its columns to your variables.</p>
              <label className="flex items-center justify-center gap-3 border border-dashed border-input rounded-md py-6 cursor-pointer bg-card hover:bg-accent/40 transition-colors duration-150">
                <UploadCloud className="w-5 h-5 text-subtle-foreground" />
                <span className="text-sm text-foreground">Choose a file</span>
                <span className="text-xs text-subtle-foreground">.xlsx, .xls, .csv</span>
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="sr-only" />
              </label>

              {workbook && sheetNames.length > 0 && (
                <div className="mt-6">
                  <p className="eyebrow mb-3">Map columns to variables</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {groups.map(group => {
                      const cols = sheetColsCache[group.sheet] || [];
                      return (
                        <div key={`map_${group.id}`} className="p-4 rounded-md border border-border bg-card">
                          <p className="text-sm font-medium mb-3">{group.name}</p>
                          <div className="space-y-2">
                            <select aria-label={`${group.name} sheet`} className={cn(fieldClass, 'text-xs')} value={group.sheet} onChange={e => handleSheetChange(group.id, e.target.value)}>
                              {sheetNames.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            {cols.length > 0 && (
                              <select aria-label={`${group.name} column`} className={cn(fieldClass, 'text-xs')} value={group.col} onChange={e => updateGroup(group.id, 'col', e.target.value)}>
                                {cols.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <Button variant="outline" className="mt-4" onClick={applyColumns}>
                    Extract data <ArrowRight />
                  </Button>
                </div>
              )}
            </section>

            {/* Variables */}
            <section>
              <div className="flex items-end justify-between mb-4">
                <div>
                  <h2 className="font-serif text-lg font-semibold mb-1">Variables</h2>
                  <p className="text-sm text-muted-foreground">Comma-separated values. Blank and NaN entries are treated as missing.</p>
                </div>
                <Button variant="ghost" size="sm" onClick={addGroup}>
                  <Plus /> Add group
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {groups.map(group => (
                  <div key={group.id} className="group/field rounded-md border border-border bg-card p-4">
                    <div className="flex items-center justify-between mb-2">
                      <input
                        aria-label="Group name"
                        className="text-sm font-medium bg-transparent border-none p-0 outline-none focus:underline underline-offset-4 decoration-border"
                        value={group.name}
                        onChange={e => updateGroup(group.id, 'name', e.target.value)}
                        placeholder="Group name"
                      />
                      {groups.length > 2 && (
                        <button onClick={() => removeGroup(group.id)} className="opacity-0 group-hover/field:opacity-100 focus:opacity-100 transition-opacity duration-150 p-1 rounded text-subtle-foreground hover:text-destructive" title="Remove group">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <textarea
                      rows={3}
                      aria-label={`${group.name} values`}
                      className={cn(fieldClass, 'text-xs font-mono leading-relaxed resize-none')}
                      value={group.data}
                      onChange={e => updateGroup(group.id, 'data', e.target.value)}
                      placeholder="e.g. 1.2, 3.4, NaN, 5"
                    />
                  </div>
                ))}
              </div>
            </section>

            {/* Exclusion criteria */}
            <section>
              <h2 className="font-serif text-lg font-semibold mb-1">Exclusion criteria</h2>
              <p className="text-sm text-muted-foreground mb-4">Optional. Values outside this range are removed before testing.</p>
              <div className="grid grid-cols-2 gap-4 max-w-md">
                {[
                  { label: 'Minimum', val: criteriaMin, set: setCriteriaMin },
                  { label: 'Maximum', val: criteriaMax, set: setCriteriaMax },
                ].map(({ label, val, set }) => (
                  <div key={label}>
                    <label htmlFor={`crit-${label}`} className="eyebrow block mb-1.5">{label}</label>
                    <input id={`crit-${label}`} type="number" className={cn(fieldClass, 'font-mono')} value={val} onChange={e => set(e.target.value)} placeholder="None" />
                  </div>
                ))}
              </div>
            </section>

            <div className="flex justify-end border-t border-border pt-6">
              <Button size="lg" onClick={() => setStep(2)}>
                Continue <ArrowRight />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div>
            <h2 className="font-serif text-xl font-semibold mb-1">What is the goal of your analysis?</h2>
            <p className="text-sm text-muted-foreground mb-6">With three or more variables, ANOVA and post-hoc comparisons run automatically.</p>

            <div role="radiogroup" className="border-y border-border divide-y divide-border mb-10">
              {PURPOSES.map(({ value, icon, label, desc, disabled }) => {
                const active = purpose === value;
                return (
                  <label key={value} className={cn('flex items-start gap-4 px-2 py-4 transition-colors duration-150',
                    disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-accent/40',
                    active && 'bg-primary-soft/60')}>
                    <input type="radio" name="purpose" value={value} className="sr-only peer" checked={active} disabled={disabled} onChange={e => setPurpose(e.target.value)} />
                    <span className={cn('mt-0.5 h-4 w-4 rounded-full border flex items-center justify-center shrink-0 peer-focus-visible:ring-2 peer-focus-visible:ring-ring/40',
                      active ? 'border-primary' : 'border-input bg-card')}>
                      {active && <span className="h-2 w-2 rounded-full bg-primary" />}
                    </span>
                    <span className="flex-1">
                      <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <span className="text-subtle-foreground">{icon}</span>
                        {label}
                      </span>
                      <span className="block text-sm text-muted-foreground mt-0.5">{desc}</span>
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>
                <ArrowLeft /> Back
              </Button>
              <Button size="lg" onClick={handleAnalyze} disabled={loading}>
                {loading ? <><Loader2 className="animate-spin" /> Analyzing…</> : <>Run analysis <ArrowRight /></>}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && result && (
          <div className="space-y-12">

            <section>
              <p className="eyebrow mb-2">Recommended test</p>
              <div className="flex items-baseline gap-4 flex-wrap">
                <h2 className="font-serif text-3xl font-semibold">{result.recommended_test}</h2>
                <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm border text-xs',
                  result.significant ? 'border-primary/40 bg-primary-soft text-primary' : 'border-border text-muted-foreground')}>
                  {result.significant ? 'Significant at p < .05' : 'Not significant at p < .05'}
                </span>
              </div>

              <dl className="grid grid-cols-2 mt-6 border-y border-border">
                {[
                  { label: 'Test statistic', value: result.statistic },
                  { label: 'p-value', value: result.p_value },
                ].map(({ label, value }, i) => (
                  <div key={label} className={cn('py-5', i > 0 && 'pl-6 border-l border-border')}>
                    <dt className="eyebrow">{label}</dt>
                    <dd className="mt-1.5 font-mono text-2xl text-foreground tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>

              <p className="mt-6 text-[0.95rem] leading-relaxed text-foreground max-w-prose border-l-2 border-border pl-4">
                <span className="font-medium">Interpretation. </span>
                {result.significant
                  ? `The p-value (${result.p_value}) is below 0.05. We reject the null hypothesis: there is a statistically significant difference across the groups.`
                  : `The p-value (${result.p_value}) exceeds 0.05. We fail to reject the null hypothesis: no significant difference was found.`}
              </p>
            </section>

            {result.post_hoc?.length > 0 && result.significant && (
              <section>
                <h3 className="font-serif text-lg font-semibold mb-1">Post-hoc pairwise comparisons</h3>
                <p className="text-sm text-muted-foreground mb-4">Shown because the omnibus test was significant.</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-y border-border">
                    <thead>
                      <tr className="border-b border-border">
                        {['Group A', 'Group B', 'p-value', 'Result'].map(h => (
                          <th key={h} scope="col" className="px-3 py-2.5 text-left eyebrow">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {result.post_hoc.map((ph: any, idx: number) => {
                        const sig = ph.p_value < 0.05;
                        return (
                          <tr key={idx}>
                            <td className="px-3 py-2.5">{ph.A}</td>
                            <td className="px-3 py-2.5">{ph.B}</td>
                            <td className="px-3 py-2.5 font-mono tabular-nums">{ph.p_value.toFixed(4)}</td>
                            <td className={cn('px-3 py-2.5', sig ? 'text-primary' : 'text-muted-foreground')}>
                              {sig ? 'Significant' : 'Not significant'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            <section>
              <h3 className="font-serif text-lg font-semibold mb-4">Data quality</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-y border-border">
                  <thead>
                    <tr className="border-b border-border">
                      {['Group', 'Initial', 'Missing', 'Excluded', 'Outliers', 'Final'].map((h, i) => (
                        <th key={h} scope="col" className={cn('px-3 py-2.5 eyebrow', i === 0 ? 'text-left' : 'text-right')}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {Object.entries(result.cleaning_report).map(([gName, gRep]: [string, any]) => (
                      <tr key={gName}>
                        <td className="px-3 py-2.5">{gName}</td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums">{gRep.initial_count}</td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums text-muted-foreground">−{gRep.missing_removed}</td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums text-muted-foreground">−{gRep.criteria_removed}</td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums text-muted-foreground">−{gRep.outliers_removed}</td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums font-medium">{gRep.final_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h3 className="font-serif text-lg font-semibold mb-3">How the test was chosen</h3>
              <dl className="border-y border-border divide-y divide-border">
                {Object.entries(result.logic_steps).map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[minmax(8rem,14rem)_1fr] gap-4 px-3 py-2 text-xs">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="font-mono text-foreground">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            </section>

            {/* Send to Writing */}
            {currentProject && (
              <section className="rounded-md border border-border bg-card p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">Add to your paper</p>
                    <p className="text-sm text-muted-foreground mt-0.5">Append these results to a section of your draft.</p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => { setShowSectionPicker(v => !v); setSendSuccess(false); }}
                    aria-expanded={showSectionPicker}
                  >
                    Choose section
                    <ChevronDown className={cn('transition-transform duration-150', showSectionPicker && 'rotate-180')} />
                  </Button>
                </div>

                {showSectionPicker && (
                  <div className="mt-5 pt-5 border-t border-border">
                    <div role="radiogroup" aria-label="Target section" className="space-y-0.5 mb-4 max-h-56 overflow-y-auto">
                      {allSections.map(section => {
                        const on = selectedSectionId === section.id;
                        return (
                          <label key={section.id} className={cn('flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer transition-colors duration-150',
                            on ? 'bg-accent' : 'hover:bg-accent/50')}>
                            <input
                              type="radio"
                              name="target-section"
                              value={section.id}
                              checked={on}
                              onChange={() => setSelectedSectionId(section.id)}
                              className="sr-only peer"
                            />
                            <span className={cn('h-3.5 w-3.5 rounded-full border flex items-center justify-center shrink-0 peer-focus-visible:ring-2 peer-focus-visible:ring-ring/40', on ? 'border-primary' : 'border-input bg-card')}>
                              {on && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                            </span>
                            <span className="text-sm">{section.title}</span>
                            {section.content && (
                              <span className="ml-auto text-xs text-subtle-foreground">Has content</span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                    <Button
                      className="w-full"
                      onClick={handleSendToSection}
                      disabled={!selectedSectionId || sendSuccess}
                    >
                      {sendSuccess ? <><Check /> Results added</> : 'Insert results'}
                    </Button>
                  </div>
                )}
              </section>
            )}

            <div className="flex justify-center border-t border-border pt-8">
              <Button variant="ghost" onClick={() => setStep(1)}>
                <RefreshCw /> Analyze another dataset
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
