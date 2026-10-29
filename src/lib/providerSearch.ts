// Filtering and ranking for the provider search page. Filters live in the URL
// (?q=&trade=&area=&fee=&verified=&sort=) so searches can be shared, bookmarked and restored with Back.
import { tradeById } from '../data/catalog';
import { didYouMean, score, type Field } from './search';
import type { Provider } from '../types';

export type SortKey = 'relevance' | 'fee' | 'intake' | 'rating' | 'duration';
export type FilterKey = 'q' | 'trade' | 'area' | 'fee' | 'verified';

export interface ProviderFilters { q: string; trade: string; area: string; fee: number; verified: string; sort: SortKey }

export const FILTER_KEYS: FilterKey[] = ['q', 'trade', 'area', 'fee', 'verified'];

export function readFilters(params: URLSearchParams): ProviderFilters {
  return {
    q: params.get('q')?.trim() || '',
    trade: params.get('trade') || '',
    area: params.get('area') || '',
    fee: Number(params.get('fee')) || 0,
    verified: params.get('verified') || '',
    sort: (params.get('sort') as SortKey) || 'relevance',
  };
}

const fieldsOf = (p: Provider): Field[] => [
  [p.name, 3],
  [tradeById(p.trade)?.name, 2.5],
  [p.area, 2],
  [p.programmes.map((x) => x.name).join(' '), 1.5],
  [p.blurb, 1],
];

/** Text the "did you mean" suggestions can draw on. */
export const vocabulary = (providers: Provider[]) =>
  providers.flatMap((p) => [p.name, p.area, tradeById(p.trade)?.name ?? '', ...p.programmes.map((x) => x.name)]);

/** Upcoming intakes first (soonest first), then centres whose listed intake has passed. */
const byIntake = (today: string) => (a: Provider, b: Provider) => {
  const pa = a.intake < today, pb = b.intake < today;
  return pa !== pb ? (pa ? 1 : -1) : a.intake.localeCompare(b.intake);
};

/** Best-rated centres with the most reviews first; used to break ties. */
const byReputation = (a: Provider, b: Provider) => b.rating - a.rating || b.reviews - a.reviews;

export function filterProviders(providers: Provider[], f: ProviderFilters, today = new Date().toISOString().slice(0, 10)): Provider[] {
  const scored: [Provider, number][] = [];
  for (const p of providers) {
    if (f.trade && p.trade !== f.trade) continue;
    if (f.area && p.area !== f.area) continue;
    if (f.fee && p.fee > f.fee) continue;
    if (f.verified === 'ctvet' && !p.ctvet) continue;
    if (f.verified === 'visited' && !p.visited) continue;
    if (f.verified === 'both' && !(p.ctvet && p.visited)) continue;
    const s = score(f.q, fieldsOf(p));
    if (s > 0) scored.push([p, s]);
  }
  const sorters: Record<SortKey, (a: [Provider, number], b: [Provider, number]) => number> = {
    relevance: (a, b) => b[1] - a[1] || byReputation(a[0], b[0]),
    fee: (a, b) => a[0].fee - b[0].fee || byReputation(a[0], b[0]),
    intake: (a, b) => byIntake(today)(a[0], b[0]),
    rating: (a, b) => byReputation(a[0], b[0]),
    duration: (a, b) => a[0].months - b[0].months || byReputation(a[0], b[0]),
  };
  return scored.sort(sorters[f.sort] ?? sorters.relevance).map(([p]) => p);
}

/** Ways out of an empty result: drop one filter (with how many results that gives) or fix a typo. */
export function noResultHelp(providers: Provider[], f: ProviderFilters) {
  const relax = FILTER_KEYS
    .filter((k) => (k === 'fee' ? f.fee > 0 : !!f[k]))
    .map((k) => ({ key: k, count: filterProviders(providers, { ...f, [k]: k === 'fee' ? 0 : '' }).length }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);
  const fixed = f.q ? didYouMean(f.q, vocabulary(providers)) : null;
  // Worth pointing out if the corrected word finds anything at all; other filters can be loosened next.
  const spelling = fixed && filterProviders(providers, readFilters(new URLSearchParams({ q: fixed }))).length > 0 ? fixed : null;
  return { relax, spelling };
}
