// Builds the public record for a training centre from its application. Registration creates it
// as "Pending"; approving the application publishes it.
import type { Programme, Provider, TradeId } from '../../types';

/** Rough map positions for areas, so new centres land in the right part of the map. */
const AREA_COORDS: Record<string, [number, number]> = {
  'Accra Central': [5.5502, -0.2174], 'East Legon': [5.637, -0.161], Madina: [5.6681, -0.1665], Tema: [5.6698, -0.0166],
  Kasoa: [5.534, -0.417], Kaneshie: [5.5667, -0.2367], Spintex: [5.6346, -0.1037], Osu: [5.556, -0.1824], Dansoman: [5.5446, -0.2659],
};
const ACCRA: [number, number] = [5.6037, -0.187];

export const slugify = (name: string) => name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'centre';

/** A slug for `name` that isn't already taken. */
export function uniqueId(name: string, taken: Set<string>) {
  const base = slugify(name);
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  return id;
}

export interface CentreDraft {
  id: string;
  name: string;
  area: string;
  trade: TradeId;
  phone: string;
  email?: string;
  address?: string;
  about: string;
  ctvet: boolean;
  images: string[];
  programmes: Programme[];
}

export function draftCentre(d: CentreDraft): Provider {
  const cheapest = [...d.programmes].sort((a, b) => a.fee - b.fee)[0];
  const intakes = d.programmes.map((p) => p.intake).filter(Boolean).sort();
  const [lat, lng] = AREA_COORDS[d.area] ?? ACCRA;
  const about = d.about.trim() || `${d.name} is a training centre in ${d.area}.`;
  return {
    id: d.id, name: d.name, area: d.area, trade: d.trade,
    fee: cheapest?.fee ?? 0, months: cheapest?.months ?? 0, intake: intakes[0] ?? '',
    ctvet: d.ctvet, visited: null, rating: 0, reviews: 0, students: 0, founded: new Date().getFullYear(),
    places: d.programmes.reduce((s, p) => s + p.places, 0),
    phone: d.phone, email: d.email || null, address: d.address || undefined,
    hours: 'Mon – Fri, 8:00am – 5:00pm', images: d.images,
    blurb: about.length > 110 ? about.slice(0, 109).trimEnd() + '…' : about, about,
    programmeType: cheapest?.type ?? 'Certificate', payment: 'Mobile Money or cash', programmes: d.programmes,
    // Nudge centres in the same area apart so their map pins don't overlap.
    coords: [lat + (Math.random() - 0.5) * 0.01, lng + (Math.random() - 0.5) * 0.01],
  };
}
