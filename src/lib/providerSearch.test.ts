import { describe, expect, it } from 'vitest';
import { PROVIDERS } from '../data/mock';
import { filterProviders, noResultHelp, readFilters } from './providerSearch';

const f = (query: string) => readFilters(new URLSearchParams(query));
const ids = (query: string, today = '2026-10-28') => filterProviders(PROVIDERS, f(query), today).map((p) => p.id);

describe('provider search', () => {
  it('narrows down with every word, across name, trade and area', () => {
    expect(ids('q=welding tema')).toEqual(['tema-welding']);
    expect(ids('q=WELDING')).toContain('kaneshie-welding');
    expect(ids('q=solar')).toContain('kasoa-electrical'); // from the blurb
  });

  it('ranks name matches first, then by rating', () => {
    const r = ids('q=tailoring');
    expect(r.slice(0, 2).sort()).toEqual(['madina-tailoring', 'osu-tailoring']);
    expect(ids('q=tailoring')[0]).toBe('madina-tailoring'); // 4.9 beats 4.8
  });

  it('combines filters', () => {
    expect(ids('trade=welding&area=Madina')).toEqual(['madina-welding']);
    expect(ids('fee=700').every((id) => PROVIDERS.find((p) => p.id === id)!.fee <= 700)).toBe(true);
    expect(ids('verified=both').every((id) => { const p = PROVIDERS.find((x) => x.id === id)!; return p.ctvet && !!p.visited; })).toBe(true);
  });

  it('puts intakes that have already passed after upcoming ones', () => {
    const r = filterProviders(PROVIDERS, f('sort=intake'), '2026-10-28');
    const firstPast = r.findIndex((p) => p.intake < '2026-10-28');
    expect(r[0].intake >= '2026-10-28').toBe(true);
    expect(r.slice(firstPast).every((p) => p.intake < '2026-10-28')).toBe(true);
  });

  it('suggests which filter to drop, and fixes typos', () => {
    const help = noResultHelp(PROVIDERS, f('trade=welding&area=Kasoa'));
    expect(help.relax.map((x) => x.key).sort()).toEqual(['area', 'trade']);
    expect(noResultHelp(PROVIDERS, f('q=weldng')).spelling).toBe('welding');
    // Pointed out even when another filter still rules everything out.
    expect(noResultHelp(PROVIDERS, f('q=weldng&area=Kasoa')).spelling).toBe('welding');
    expect(noResultHelp(PROVIDERS, f('q=zzzz')).spelling).toBeNull();
  });
});
