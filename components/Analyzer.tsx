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

export function Analyzer() {
  const [step, setStep] = useState(1);
  const [purpose, setPurpose] = useState('independent');
  const [criteriaMin, setCriteriaMin] = useState('');
  const [criteriaMax, setCriteriaMax] = useState('');

  // Dynamic Groups
  const [groups, setGroups] = useState<GroupConfig[]>([
    { id: '1', name: 'Variable A', sheet: '', col: '', data: '20, 22, 19, 24, 25, 28, 21, 22, , 900' },
    { id: '2', name: 'Variable B', sheet: '', col: '', data: '12, 15, 14, 18, 10, 35, 12, 11, NaN,' }
  ]);

  const addGroup = () => {
    setGroups(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        name: `Variable ${String.fromCharCode(65 + prev.length)}`,
        sheet: sheetNames[0] || '',
        col: '',
        data: ''
      }
    ]);
  };

  const removeGroup = (id: string) => {
    setGroups(prev => prev.length <= 2 ? prev : prev.filter(g => g.id !== id));
  };

  const updateGroup = (id: string, field: keyof GroupConfig, value: string) => {
    setGroups(prev => prev.map(g => g.id === id ? { ...g, [field]: value } : g));
  };

  // Excel File State
  const [workbook, setWorkbook] = useState<any>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [sheetColsCache, setSheetColsCache] = useState<Record<string, string[]>>({});

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSheetColumns = (wb: any, sheetName: string, XLSX: any) => {
    if (!wb || !sheetName) return [];
    try {
      const ws = wb.Sheets[sheetName];
      if (!ws) return [];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
      return (data[0] || []) as string[];
    } catch (e) {
      return [];
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const XLSX = await import('xlsx');
      const reader = new FileReader();
      reader.onload = (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        setWorkbook(wb);
        const sheets = wb.SheetNames;
        setSheetNames(sheets);

        if (sheets.length > 0) {
          const defaultSheet = sheets[0];
          const cols = loadSheetColumns(wb, defaultSheet, XLSX);
          setSheetColsCache({ [defaultSheet]: cols });

          setGroups(prev => prev.map((g, i) => ({
             ...g,
             sheet: defaultSheet,
             col: cols[i] || cols[0] || ''
          })));
        }
      };
      reader.readAsBinaryString(file);
    } catch (err: any) {
      setError("Failed to parse Excel file.");
    }
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

    const newGroups = groups.map(g => {
       if (g.sheet && g.col) {
         try {
           const ws = workbook.Sheets[g.sheet];
           if (ws) {
             const data = XLSX.utils.sheet_to_json(ws);
             const ext = data.map((row: any) => row[g.col] === undefined || row[g.col] === null ? '' : row[g.col]).join(', ');
             return { ...g, data: ext };
           }
         } catch(e) {}
       }
       return g;
    });
    setGroups(newGroups);
  };

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      if (purpose !== 'independent' && groups.length > 2) {
        throw new Error(`The '${purpose}' test currently only supports exactly 2 variables. Please remove extra groups or select Independent test.`);
      }

      const payloadGroups: Record<string, (number | null)[]> = {};
      groups.forEach(g => {
        payloadGroups[g.name] = g.data.split(',').map(n => {
           const trimmed = n.trim();
           if (!trimmed || trimmed.toLowerCase() === 'nan') return null;
           const parsed = parseFloat(trimmed);
           return isNaN(parsed) ? null : parsed;
        });
      });

      const payload = {
        groups: payloadGroups,
        criteria_min: criteriaMin ? parseFloat(criteriaMin) : null,
        criteria_max: criteriaMax ? parseFloat(criteriaMax) : null,
        purpose: purpose
      };

      const response = await fetch('http://localhost:8000/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setResult(data);
      setStep(3);
    } catch (err: any) {
      setError(err.message || 'Failed to connect to backend.');
    } finally {
      setLoading(false);
    }
  };

  const ReportRow = ({ label, r }: { label: string, r: any }) => (
    <div className="mb-4 bg-white dark:bg-zinc-950 p-4 rounded-lg border border-zinc-100 dark:border-zinc-800 shadow-sm">
      <h4 className="font-semibold text-zinc-800 dark:text-zinc-200 mb-2">{label} Data Health</h4>
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex flex-col"><span className="text-zinc-500 text-xs uppercase">Initial</span><span className="font-mono">{r.initial_count}</span></div>
        <div className="flex flex-col"><span className="text-zinc-500 text-xs uppercase">Missing Removed</span><span className="font-mono text-amber-600">{r.missing_removed}</span></div>
        <div className="flex flex-col"><span className="text-zinc-500 text-xs uppercase">Criteria Excluded</span><span className="font-mono text-amber-600">{r.criteria_removed}</span></div>
        <div className="flex flex-col"><span className="text-zinc-500 text-xs uppercase">Outliers Removed</span><span className="font-mono text-red-500">{r.outliers_removed}</span></div>
        <div className="flex flex-col"><span className="text-zinc-500 text-xs uppercase font-semibold">Final Cleaned</span><span className="font-mono font-semibold text-emerald-600 dark:text-emerald-500">{r.final_count}</span></div>
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm mt-8">

      {/* Wizard Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-2 text-zinc-900 dark:text-zinc-100">
          Psychology Test Analyzer
        </h2>

        <div className="flex items-center justify-between mt-6 max-w-sm">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm transition-colors duration-300 ${
                step === s ? 'bg-blue-600 text-white shadow-md' :
                step > s ? 'bg-emerald-500 text-white' : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500'
              }`}>
                {s}
              </div>
              <span className={`text-xs mt-2 font-medium ${step === s ? 'text-blue-700 dark:text-blue-400' : 'text-zinc-400'}`}>
                {s === 1 ? 'Data' : s === 2 ? 'Goal' : 'Results'}
              </span>
            </div>
          ))}
          <div className="absolute w-[200px] h-[2px] bg-zinc-100 dark:bg-zinc-800 -z-10 ml-4 mt-[-20px]" />
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200 dark:bg-red-900/10 dark:text-red-400 dark:border-red-900/50 flex items-start">
          <Activity className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
          <p>Error: {error}</p>
        </div>
      )}

      {/* STEP 1: DATA INPUT */}
      {step === 1 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
          <div className="p-5 bg-blue-50/50 dark:bg-blue-900/5 border border-blue-100 dark:border-blue-900/30 rounded-xl">
            <h3 className="text-sm font-semibold mb-3 text-blue-900 flex items-center dark:text-blue-200">
              <UploadCloud className="w-4 h-4 mr-2" />
              Upload Data via Excel / CSV
            </h3>
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileUpload}
              className="block w-full text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-white file:text-blue-700 file:shadow-sm hover:file:bg-blue-50 dark:file:bg-zinc-800 dark:file:text-blue-400 mb-4 cursor-pointer"
            />

            {workbook && sheetNames.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-blue-100 dark:border-blue-900/30">
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-800 dark:text-blue-300">Map Columns to Variables</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {groups.map((group) => {
                    const cols = sheetColsCache[group.sheet] || [];
                    return (
                      <div key={`map_${group.id}`} className="bg-white dark:bg-zinc-950 p-3 rounded-lg shadow-sm border border-zinc-100 dark:border-zinc-800">
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">{group.name} Source</h4>
                        </div>
                        <div className="space-y-2">
                            <select className="w-full text-xs p-2 rounded border border-zinc-200 dark:border-zinc-700 bg-transparent text-zinc-900 dark:text-zinc-100" value={group.sheet} onChange={(e) => handleSheetChange(group.id, e.target.value)}>
                              {sheetNames.map(s => <option key={`${group.id}_${s}`} value={s}>{s}</option>)}
                            </select>
                            {cols.length > 0 && (
                              <select className="w-full text-xs p-2 rounded border border-zinc-200 dark:border-zinc-700 bg-transparent text-zinc-900 dark:text-zinc-100" value={group.col} onChange={(e) => updateGroup(group.id, 'col', e.target.value)}>
                                {cols.map(c => <option key={`${group.id}_col_${c}`} value={c}>{c}</option>)}
                              </select>
                            )}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <button onClick={applyColumns} className="w-full bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-sm font-medium py-2 rounded-md transition-colors shadow-sm">
                  Extract Data Below
                </button>
              </div>
            )}
          </div>

          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Variables/Groups</h3>
              <button onClick={addGroup} className="flex items-center text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 px-3 py-1.5 rounded-md transition-colors">
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Group
              </button>
            </div>

            {groups.map((group) => (
              <div key={group.id} className="relative group/field">
                <div className="flex items-center justify-between mb-1.5">
                  <input
                    className="text-sm font-medium bg-transparent border-none p-0 focus:ring-0 text-zinc-700 dark:text-zinc-300 outline-none w-1/3 placeholder-zinc-400"
                    value={group.name}
                    onChange={(e) => updateGroup(group.id, 'name', e.target.value)}
                    placeholder="E.g. Treatment Group"
                  />
                  {groups.length > 2 && (
                    <button onClick={() => removeGroup(group.id)} className="opacity-0 group-hover/field:opacity-100 text-red-500 hover:text-red-600 transition-opacity p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <textarea
                  rows={2}
                  className="w-full px-4 py-3 bg-zinc-50/50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none shadow-sm transition-shadow resize-none font-mono text-xs leading-relaxed"
                  value={group.data}
                  onChange={(e) => updateGroup(group.id, 'data', e.target.value)}
                  placeholder="Enter comma-separated values (e.g. 1.2, 3.4, NaN, 5)"
                />
              </div>
            ))}

            <div className="flex gap-4 p-4 mt-6 border border-zinc-100 dark:border-zinc-800 rounded-lg bg-zinc-50/50 dark:bg-zinc-900/50">
              <div className="flex-1">
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2 text-zinc-500 dark:text-zinc-400">Exclusion Criteria Min</label>
                <input type="number" className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-sm text-sm" value={criteriaMin} onChange={(e) => setCriteriaMin(e.target.value)} placeholder="Optional" />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2 text-zinc-500 dark:text-zinc-400">Exclusion Criteria Max</label>
                <input type="number" className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-sm text-sm" value={criteriaMax} onChange={(e) => setCriteriaMax(e.target.value)} placeholder="Optional" />
              </div>
            </div>
          </div>

          <div className="pt-6 flex justify-end border-t border-zinc-100 dark:border-zinc-800">
            <button
              onClick={() => setStep(2)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-6 rounded-lg transition-colors shadow-md hover:shadow-lg"
            >
              Continue to Step 2
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: PURPOSE SELECTION */}
      {step === 2 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">What is the goal of your research?</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Select the purpose. For 3+ variables, we automatically run ANOVA and Post-hoc test pipelines.</p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <label className={`relative flex cursor-pointer rounded-xl border p-4 shadow-sm focus:outline-none transition-all duration-200 ${purpose === 'independent' ? 'border-blue-600 ring-1 ring-blue-600 bg-blue-50/30 dark:bg-blue-900/10' : 'border-zinc-200 dark:border-zinc-800 hover:border-blue-300 dark:hover:border-blue-800 bg-white dark:bg-zinc-950'}`}>
              <input type="radio" name="purpose" value="independent" className="sr-only" checked={purpose === 'independent'} onChange={(e) => setPurpose(e.target.value)} />
              <div className="flex w-full items-center justify-between">
                <div className="flex items-center">
                  <div className="text-sm">
                    <div className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-100">
                      <SplitSquareHorizontal className="w-5 h-5 text-blue-500" />
                      Compare Independent Groups
                    </div>
                    <div className="text-zinc-500 dark:text-zinc-400 mt-1 pl-7">
                      Compare means between different groups. (T-test, ANOVA/Welch, Kruskal-Wallis).
                    </div>
                  </div>
                </div>
                {purpose === 'independent' && <div className="h-5 w-5 rounded-full border-[6px] border-blue-600" />}
              </div>
            </label>

            <label className={`relative flex cursor-pointer rounded-xl border p-4 shadow-sm focus:outline-none transition-all duration-200 ${purpose === 'paired' ? 'border-blue-600 ring-1 ring-blue-600 bg-blue-50/30 dark:bg-blue-900/10' : 'border-zinc-200 dark:border-zinc-800 hover:border-blue-300 dark:hover:border-blue-800 bg-white dark:bg-zinc-950'} ${groups.length > 2 ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <input type="radio" name="purpose" value="paired" className="sr-only" checked={purpose === 'paired'} disabled={groups.length > 2} onChange={(e) => setPurpose(e.target.value)} />
              <div className="flex w-full items-center justify-between">
                <div className="flex items-center">
                  <div className="text-sm">
                    <div className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-100">
                      <RefreshCw className="w-5 h-5 text-emerald-500" />
                      Compare Related/Paired Data {groups.length > 2 && '(Requires exactly 2 groups)'}
                    </div>
                    <div className="text-zinc-500 dark:text-zinc-400 mt-1 pl-7">
                      Measuring same subjects twice. (Paired T-test, Wilcoxon). Max 2 groups.
                    </div>
                  </div>
                </div>
                {purpose === 'paired' && <div className="h-5 w-5 rounded-full border-[6px] border-blue-600" />}
              </div>
            </label>

            <label className={`relative flex cursor-pointer rounded-xl border p-4 shadow-sm focus:outline-none transition-all duration-200 ${purpose === 'correlation' ? 'border-blue-600 ring-1 ring-blue-600 bg-blue-50/30 dark:bg-blue-900/10' : 'border-zinc-200 dark:border-zinc-800 hover:border-blue-300 dark:hover:border-blue-800 bg-white dark:bg-zinc-950'} ${groups.length > 2 ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <input type="radio" name="purpose" value="correlation" className="sr-only" checked={purpose === 'correlation'} disabled={groups.length > 2} onChange={(e) => setPurpose(e.target.value)} />
              <div className="flex w-full items-center justify-between">
                <div className="flex items-center">
                  <div className="text-sm">
                    <div className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-100">
                      <Activity className="w-5 h-5 text-purple-500" />
                      Find Correlation {groups.length > 2 && '(Requires exactly 2 groups)'}
                    </div>
                    <div className="text-zinc-500 dark:text-zinc-400 mt-1 pl-7">
                      Find relationships linearly between two variables. Max 2 variables.
                    </div>
                  </div>
                </div>
                {purpose === 'correlation' && <div className="h-5 w-5 rounded-full border-[6px] border-blue-600" />}
              </div>
            </label>
          </div>

          <div className="pt-6 flex justify-between items-center border-t border-zinc-100 dark:border-zinc-800">
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 font-medium py-2 px-4 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <button
              onClick={handleAnalyze}
              disabled={loading}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 px-6 rounded-lg transition-colors shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>Analyzing...</>
              ) : (
                <>
                  <TestTube2 className="w-4 h-4" />
                  Run Advanced Analysis
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: RESULTS */}
      {step === 3 && result && (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">

          <div className="p-6 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800/30 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Activity className="w-24 h-24 text-indigo-500" />
            </div>

            <h3 className="font-bold text-xl mb-1 text-indigo-950 dark:text-indigo-100">Research Results</h3>
            <p className="text-indigo-700/80 dark:text-indigo-300 font-medium mb-5 text-sm">
              We evaluated your data using the strict Homogeneity &amp; Normality flowchart pipeline to select your test.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white/60 dark:bg-zinc-950/50 backdrop-blur-sm p-4 rounded-lg border border-white/40 dark:border-zinc-800">
                <p className="text-xs uppercase tracking-wider font-semibold text-zinc-500 dark:text-zinc-400 mb-1">Recommended Test</p>
                <div className="text-indigo-700 dark:text-indigo-400 font-bold text-lg flex items-center gap-2">
                  <TestTube2 className="w-5 h-5" />
                  {result.recommended_test}
                </div>
              </div>

              <div className="bg-white/60 dark:bg-zinc-950/50 backdrop-blur-sm p-4 rounded-lg border border-white/40 dark:border-zinc-800">
                <p className="text-xs uppercase tracking-wider font-semibold text-zinc-500 dark:text-zinc-400 mb-1">Omnibus Conclusion</p>
                <div>
                  {result.significant ? (
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold text-lg flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                       Statistically Significant
                    </span>
                  ) : (
                    <span className="text-zinc-600 dark:text-zinc-400 font-bold text-lg flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full bg-zinc-400" />
                       Not Significant
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 bg-white/60 dark:bg-zinc-950/50 backdrop-blur-sm p-4 rounded-lg border border-white/40 dark:border-zinc-800 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Test Statistic</p>
                <p className="font-mono mt-1 text-zinc-900 dark:text-zinc-100 font-semibold">{result.statistic}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">P-Value</p>
                <p className="font-mono mt-1 text-zinc-900 dark:text-zinc-100 font-semibold">{result.p_value}</p>
              </div>
            </div>

            {result.significant && (
              <div className="mt-4 text-sm text-indigo-800 dark:text-indigo-300 bg-indigo-100/50 dark:bg-indigo-900/30 p-3 rounded-md border border-indigo-200/50 dark:border-indigo-800/50">
                <strong>Interpretation:</strong> The p-value ({result.p_value}) is less than 0.05. We reject the null hypothesis across the groups.
              </div>
            )}
            {!result.significant && (
              <div className="mt-4 text-sm text-zinc-700 dark:text-zinc-300 bg-zinc-100/80 dark:bg-zinc-800/80 p-3 rounded-md border border-zinc-200 dark:border-zinc-700">
                <strong>Interpretation:</strong> The p-value ({result.p_value}) is greater than 0.05. We fail to reject the null hypothesis. There is no significant difference/relationship.
              </div>
            )}

            {result.post_hoc && result.post_hoc.length > 0 && result.significant && (
              <div className="mt-6 pt-4 border-t border-indigo-200 dark:border-indigo-800">
                <h4 className="font-semibold text-lg text-indigo-900 dark:text-indigo-100 mb-2">Post-Hoc Pairwise Comparisons</h4>
                <p className="text-xs text-indigo-700/80 dark:text-indigo-300 mb-4">Because the omnibus test was significant, here are the pairwise differences.</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead>
                      <tr className="border-b border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200">
                        <th className="pb-2 font-semibold">Group A</th>
                        <th className="pb-2 font-semibold">Group B</th>
                        <th className="pb-2 font-semibold">P-Value</th>
                        <th className="pb-2 font-semibold">Significance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.post_hoc.map((ph: any, idx: number) => {
                        const sig = ph.p_value < 0.05;
                        return (
                          <tr key={idx} className="border-b border-indigo-100 dark:border-indigo-900/50 last:border-0 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/30">
                            <td className="py-2.5 text-zinc-700 dark:text-zinc-300">{ph.A}</td>
                            <td className="py-2.5 text-zinc-700 dark:text-zinc-300">{ph.B}</td>
                            <td className="py-2.5 font-mono">{ph.p_value.toFixed(4)}</td>
                            <td className="py-2.5">
                              {sig ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">Sig</span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-400">Not Sig</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="p-5 bg-zinc-50 dark:bg-zinc-900/30 rounded-xl border border-zinc-200 dark:border-zinc-800/50 text-sm">
            <h3 className="font-semibold text-lg mb-4 text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Activity className="w-5 h-5 text-zinc-500" />
              Data Quality &amp; Cleaning Report
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(result.cleaning_report).map(([gName, gRep]: [string, any]) => (
                <ReportRow key={gName} label={gName} r={gRep} />
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
               <h4 className="font-semibold text-zinc-800 dark:text-zinc-200 mb-2">Internal Flowchart Logic</h4>
               <ul className="list-disc pl-5 text-zinc-600 dark:text-zinc-400 text-xs font-mono space-y-1">
                 {Object.entries(result.logic_steps).map(([k, v]) => (
                   <li key={k}>{k}: {String(v)}</li>
                 ))}
               </ul>
            </div>
          </div>

          <div className="pt-4 flex justify-center border-t border-zinc-100 dark:border-zinc-800">
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 font-medium py-2.5 px-6 rounded-lg transition-colors shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Analyze Another Dataset
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
