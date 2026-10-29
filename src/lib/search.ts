// Text search shared by the provider search and the marketplace/course catalogue.
// Every word of the query must match somewhere (so "welding tema" narrows down), and
// matches in the name count for more than matches in the description.

/** Lower case, without accents or punctuation, e.g. "Adjoa’s Créations" → "adjoas creations". */
export const normalize = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

export const words = (s: string) => normalize(s).split(' ').filter(Boolean);

/** A searchable field and how much a match in it is worth. */
export type Field = [text: string | undefined, weight: number];

/**
 * How well `query` matches the fields: 0 if any query word matches nowhere, otherwise higher for
 * matches in heavier fields, at the start of a word, or on a whole word. An empty query scores 1.
 * Partial words ("weld" → "welding") only count in key fields (weight KEY_FIELD and up); long text
 * such as descriptions needs whole words, so "soap" doesn't find a toolkit that mentions "soapstone".
 */
export const KEY_FIELD = 1.5;

export function score(query: string, fields: Field[]): number {
  const q = words(query);
  if (!q.length) return 1;
  const fieldWords = fields.map(([text, weight]) => [words(text ?? ''), weight] as const);
  let total = 0;
  for (const w of q) {
    let best = 0;
    for (const [fw, weight] of fieldWords) {
      for (const x of fw) {
        const whole = x === w || x === `${w}s` || w === `${x}s`;
        const s = whole ? 1 : weight < KEY_FIELD ? 0 : x.startsWith(w) ? 0.8 : w.length >= 3 && x.includes(w) ? 0.4 : 0;
        if (s * weight > best) best = s * weight;
      }
    }
    if (!best) return 0;
    total += best;
  }
  return total;
}

/** Edit distance between two short strings (Levenshtein). */
export function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length];
}

/**
 * A corrected query when some words look misspelled, e.g. "weldng tem" → "welding tema", using the
 * words that actually appear in the data. Returns null when every word is already known, or when
 * nothing is close enough.
 */
export function didYouMean(query: string, vocabulary: Iterable<string>): string | null {
  const vocab = [...new Set([...vocabulary].flatMap(words))].filter((w) => w.length > 2);
  const q = words(query);
  let changed = false;
  const fixed = q.map((w) => {
    if (w.length < 3 || vocab.some((v) => v.startsWith(w))) return w;
    // Allow one typo in short words, two in longer ones.
    const limit = w.length <= 5 ? 1 : 2;
    let best: string | null = null;
    let bestD = limit + 1;
    for (const v of vocab) {
      if (Math.abs(v.length - w.length) > limit) continue;
      const d = distance(w, v);
      if (d < bestD) { best = v; bestD = d; }
    }
    if (best) { changed = true; return best; }
    return w;
  });
  return changed ? fixed.join(' ') : null;
}
