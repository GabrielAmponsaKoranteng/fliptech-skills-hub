/** Simple bar chart; `alt` draws a lighter comparison series beside each bar. */
export function BarChart({ data, labels, alt }: { data: number[]; labels: string[]; alt?: number[] }) {
  // At least 1, so a chart of all zeros draws flat bars instead of dividing by zero.
  const max = Math.max(1, ...data, ...(alt || []));
  return (
    <div className="bars" role="img" aria-label="Bar chart">
      {data.map((v, i) => (
        <div key={i} className="bar-col">
          <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: '100%', width: '100%', justifyContent: 'center' }}>
            {alt && <div className="bar alt" style={{ height: `${(alt[i] / max) * 100}%` }} data-v={alt[i]} />}
            <div className="bar" style={{ height: `${(v / max) * 100}%` }} data-v={v} />
          </div>
          <span>{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}
