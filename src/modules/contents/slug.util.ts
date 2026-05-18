const STOPWORDS_PT = new Set([
  'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas',
  'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas',
  'por', 'para', 'pelo', 'pela', 'com', 'sem', 'sob', 'sobre',
  'e', 'ou', 'que', 'se', 'mas', 'como', 'mais', 'menos',
]);

export function slugify(input: string, opts?: { removeStopwords?: boolean }): string {
  const removeStop = opts?.removeStopwords ?? true;
  const base = input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim();
  const words = base.split(/\s+/);
  const kept = removeStop ? words.filter((w) => w && !STOPWORDS_PT.has(w)) : words;
  return kept.join('-').replace(/-+/g, '-').slice(0, 80) || 'post';
}
