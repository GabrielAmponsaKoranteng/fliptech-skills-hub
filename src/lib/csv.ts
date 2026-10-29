// Spreadsheet exports. Files open cleanly in Excel and Google Sheets: every cell is quoted, rows end
// with CRLF, and a byte-order mark tells Excel the file is UTF-8 (so "GH₵" and "–" survive).

export type Cell = string | number | boolean | null | undefined;

export function toCsv(header: string[], rows: Cell[][]): string {
  const esc = (v: Cell) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
}

/** Downloads a CSV named e.g. "fliptech-users-2026-10-28.csv". */
export function downloadCsv(name: string, header: string[], rows: Cell[][]) {
  const url = URL.createObjectURL(new Blob(['﻿' + toCsv(header, rows)], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `fliptech-${name}-${new Date().toISOString().slice(0, 10)}.csv` });
  a.click();
  URL.revokeObjectURL(url);
}
