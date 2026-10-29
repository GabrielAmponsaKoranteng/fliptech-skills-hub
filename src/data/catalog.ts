// Reference data (training centres, trades, areas, categories) loaded from the API at startup.
//
// These are ES module *live bindings*: `setCatalog` reassigns them, and every importer sees the new
// values. The app renders nothing until the first load finishes (see AppProvider), so reads are always
// populated. Admin edits call `setCatalog` again and re-render through context.
import type { Provider, SiteInfo, SkillCategory, Trade, TradeId } from '../types';
import { isDefined } from '../lib/format';

export interface Catalog {
  providers: Provider[];
  trades: Trade[];
  areas: string[];
  categories: SkillCategory[];
  site: SiteInfo;
  /** A trainer's own centre while it isn't public yet (awaiting verification); never listed in search */
  myCentre?: Provider;
}

export let PROVIDERS: Provider[] = [];
export let TRADES: Trade[] = [];
export let AREAS: string[] = [];
export let SKILL_CATEGORIES: SkillCategory[] = [];
export let SITE: SiteInfo = {
  supportPhone: '030 222 1100', supportEmail: 'hello@fliptech.com', announcement: '', maintenance: false, signups: true, trainerReg: true, reviews: true,
};
/** The signed-in trainer's centre when it isn't public yet */
export let MY_CENTRE: Provider | undefined;

export function setCatalog(c: Catalog) {
  PROVIDERS = c.providers;
  TRADES = c.trades;
  AREAS = c.areas;
  SKILL_CATEGORIES = c.categories;
  SITE = c.site;
  MY_CENTRE = c.myCentre;
}

/** Known TradeIds always have an entry once the catalog has loaded. */
export function tradeById(id: TradeId): Trade;
export function tradeById(id: string): Trade | undefined;
export function tradeById(id: string) {
  return TRADES.find((t) => t.id === id);
}

export const providerById = (id: string | undefined): Provider | undefined =>
  PROVIDERS.find((p) => p.id === id) ?? (MY_CENTRE?.id === id ? MY_CENTRE : undefined);

/** Resolves saved/compared ids to providers, silently dropping ids that no longer exist. */
export const providersByIds = (ids: string[]): Provider[] => ids.map(providerById).filter(isDefined);
