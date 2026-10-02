// Lightweight keyword matching used to judge how a paper relates to a student's topic.

const STOP = new Set(('a an and are as at be been being between both but by can could did do does for from had has have how in into is it its ' +
  'may might more most of on or other our over per should so some such than that the their them then there these they this those through to ' +
  'under up use used using via was we were what when where which while who whom why will with within would you your study studies research ' +
  'effect effects impact role among students student e.g eg vs versus based new paper review analysis approach data results findings').split(' '))

const stem = (w: string) => w.replace(/(ies)$/, 'y').replace(/(ing|ed|es|s)$/, '')

/** Key terms in a text, as stem → first surface form seen. Hyphenated compounds count as their parts. */
export function keyTerms(text: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const w of text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)) {
    if (w.length < 4 || STOP.has(w)) continue
    const s = stem(w)
    if (s.length >= 4 && !out.has(s)) out.set(s, w)
  }
  return out
}

/** Study terms (surface forms) that also appear in the given text, most specific first. */
export function sharedTerms(studyTerms: Map<string, string>, text: string, limit = 5): string[] {
  const other = keyTerms(text)
  return [...studyTerms.keys()].filter(s => other.has(s)).map(s => studyTerms.get(s)!).slice(0, limit)
}
