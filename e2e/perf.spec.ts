// Page-weight budgets, measured like a mid-range phone on fast 4G (CPU slowed 4×, 9 Mbps, 60 ms RTT).
// Run with `npm run perf`. Not part of `npm run e2e`: the image and font hosts are on the internet,
// so timings depend on the connection. The budgets are on bytes and layout shift, which don't.
import { expect, test } from '@playwright/test';

/** Kilobytes transferred (compressed), per page load with an empty cache. */
const BUDGET = { script: 200, image: 600, font: 100, total: 900 };
/** Layout shift; 0.1 is Google's "good" threshold. */
const MAX_CLS = 0.1;
const PAGES = ['/', '/search', '/marketplace', '/courses', '/providers/accra-central-welding'];

test.setTimeout(120_000);

for (const path of PAGES) {
  test(`${path} stays within budget @perf`, async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 60, downloadThroughput: 9e6 / 8, uploadThroughput: 1.5e6 / 8 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

    const typeOf = new Map<string, string>();
    const kb: Record<string, number> = {};
    cdp.on('Network.requestWillBeSent', (e: { requestId: string; type?: string }) => typeOf.set(e.requestId, (e.type ?? 'Other').toLowerCase()));
    cdp.on('Network.loadingFinished', (e: { requestId: string; encodedDataLength: number }) => {
      const t = typeOf.get(e.requestId) ?? 'other';
      kb[t] = (kb[t] ?? 0) + e.encodedDataLength / 1024;
    });
    await page.addInitScript(() => {
      const w = window as unknown as { __cls: number; __lcp: number };
      w.__cls = 0; w.__lcp = 0;
      new PerformanceObserver((l) => { for (const e of l.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!e.hadRecentInput) w.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver((l) => { for (const e of l.getEntries()) w.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
    });

    await page.goto(path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const m = await page.evaluate(() => {
      const w = window as unknown as { __cls: number; __lcp: number };
      return { cls: w.__cls, lcp: Math.round(w.__lcp), fcp: Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0) };
    });
    const total = Object.values(kb).reduce((a, b) => a + b, 0);
    const r = (n = 0) => Math.round(n);
    console.log(`${path.padEnd(36)} FCP ${m.fcp}ms  LCP ${m.lcp}ms  CLS ${m.cls.toFixed(3)}  JS ${r(kb.script)}KB  images ${r(kb.image)}KB  fonts ${r(kb.font)}KB  total ${r(total)}KB`);

    expect.soft(m.cls, 'layout shift').toBeLessThan(MAX_CLS);
    expect.soft(kb.script ?? 0, 'JavaScript KB').toBeLessThan(BUDGET.script);
    expect.soft(kb.image ?? 0, 'image KB').toBeLessThan(BUDGET.image);
    expect.soft(kb.font ?? 0, 'font KB').toBeLessThan(BUDGET.font);
    expect.soft(total, 'total KB').toBeLessThan(BUDGET.total);
  });
}
