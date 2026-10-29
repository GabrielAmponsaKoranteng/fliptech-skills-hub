// Static images used by the UI and the sample data. Not API data.

/** Unsplash image URL at a given width. */
export const unsplash = (id: string, w = 900) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=70`;
const u = unsplash;

/** Widths offered to the browser in `srcset`; it picks the smallest that's sharp on the screen. */
const WIDTHS = [96, 160, 240, 320, 480, 640, 800, 1200, 1600, 2000];

/** Image hosts that resize on request with a `w=` parameter. Uploaded photos (data URLs) are fixed. */
const resizable = (url: string) => /^https:\/\/images\.unsplash\.com\//.test(url) && /[?&]w=\d+/.test(url);

/** The same image at another width; URLs that can't be resized come back unchanged. */
export const resized = (url: string, w: number) => (resizable(url) ? url.replace(/([?&])w=\d+/, `$1w=${w}`) : url);

/** A `srcset` up to `max` pixels wide (default: the width the URL asks for), or undefined if the URL can't be resized. */
export function srcSetFor(url: string, max?: number): string | undefined {
  if (!resizable(url)) return undefined;
  const cap = max ?? Number(url.match(/[?&]w=(\d+)/)![1]);
  const widths = WIDTHS.filter((w) => w <= cap);
  return (widths.length ? widths : [cap]).map((w) => `${resized(url, w)} ${w}w`).join(', ');
}

export const IMG = {
  hero: u('1504328345606-18bbc8c9d7d1', 2000),
  welding1: u('1504328345606-18bbc8c9d7d1'),
  welding2: u('1530124566582-a618bc2615dc'),
  welding3: u('1504917595217-d4dc5ebe6122'),
  welding4: u('1530046339160-ce3e530c7d2f'),
  tailoring1: u('1558769132-cb1aea458c5e'),
  tailoring2: u('1595475038784-bbe439ff41e6'),
  plumbing1: u('1607472586893-edb57bdc0e39'),
  plumbing2: u('1585704032915-c3400ca199e7'),
  auto1: u('1487754180451-c456f719a1fc'),
  auto2: u('1625047509248-ec889cbff17f'),
  hair1: u('1560066984-138dadb4c035'),
  hair2: u('1522337360788-8b13dee7a37e'),
  electrical1: u('1621905251189-08b45d6a269e'),
  electrical2: u('1621905252507-b35492cc74b4'),
  carpentry1: u('1503387762-592deb58ef4e'),
  carpentry2: u('1572981779307-38b8cabb2407'),
  team: u('1531482615713-2afd69097998'),
  construction: u('1541888946425-d81bb19240f5'),
  student: u('1619642751034-765dfdf7c58e'),
  workshop: u('1523240795612-9a054b0db644'),
};

/** Homepage artwork (hero, pillar cards, community avatars). */
export const HOME_IMG = {
  hero: u('1791511241332-a712092ecfe1', 1600),
  training: u('1776597172706-08d4ef926a56', 600),
  learning: u('1604933762021-54a5858c9832', 600),
  market: u('1768734836548-5be5fd6ef617', 600),
  people: [u('1681597107753-58e48bb38c32', 160), u('1659422440915-d516c6dc932e', 160), u('1743871698163-a2e470d8eac7', 160)],
};
