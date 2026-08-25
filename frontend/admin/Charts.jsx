import { useId, useState } from "react";

/* Charts are inline SVG rather than a charting library: two small figures do
   not justify the bundle, and the axes, marks and tooltips here are simpler to
   get right by hand than to configure. */

const CHART_COLORS = {
  done:     "rgb(var(--chart-done))",
  pending:  "rgb(var(--chart-pending))",
  declined: "rgb(var(--chart-declined))",
  archived: "rgb(var(--chart-archived))",
};

/* ── Trend ────────────────────────────────────────────────────────────────────
   One series over time, so this is an area in a single hue — categorical colour
   would imply a distinction that isn't there, and a legend would name the only
   thing on the chart. The title does that instead. */

export function TrendChart({ data = [], height = 160 }) {
  const gradientId = useId();
  const [hover, setHover] = useState(null);

  if (!data.length) {
    return <p className="text-sm text-muted-fg text-center py-10">No data yet</p>;
  }

  const W = 640, H = height, PAD_L = 28, PAD_R = 8, PAD_T = 10, PAD_B = 22;
  const max = Math.max(1, ...data.map(d => d.count));
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const x = i => PAD_L + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
  const y = v => PAD_T + plotH - (v / max) * plotH;

  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.count).toFixed(1)}`).join(" ");
  const area = `${line} L${x(data.length - 1).toFixed(1)},${PAD_T + plotH} L${x(0).toFixed(1)},${PAD_T + plotH} Z`;

  // Three ticks: the top of the scale, the middle, and zero. More lines than
  // that compete with the data they are supposed to support.
  const ticks = [max, Math.round(max / 2), 0].filter((v, i, a) => a.indexOf(v) === i);
  const label = iso => {
    const d = new Date(`${iso}T00:00:00`);
    return d.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
  };

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto overflow-visible"
        role="img"
        aria-label={`Consultation requests per day for the last ${data.length} days`}
        onPointerLeave={() => setHover(null)}
        onPointerMove={e => {
          const box = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - box.left) / box.width) * W;
          const i = Math.round(((px - PAD_L) / plotW) * (data.length - 1));
          setHover(Math.max(0, Math.min(data.length - 1, i)));
        }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="rgb(var(--chart-line))" stopOpacity="0.22" />
            <stop offset="100%" stopColor="rgb(var(--chart-line))" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Hairline grid, solid not dashed — dashing adds noise the data has to
            compete with. */}
        {ticks.map(v => (
          <g key={v}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(v)} y2={y(v)}
              stroke="rgb(var(--border))" strokeWidth="1" />
            <text x={PAD_L - 6} y={y(v) + 3.5} textAnchor="end"
              className="fill-[rgb(var(--subtle-fg))]" fontSize="10">{v}</text>
          </g>
        ))}

        <path d={area} fill={`url(#${gradientId})`} />
        <path d={line} fill="none" stroke="rgb(var(--chart-line))"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* First and last dates only. A label per point is unreadable at 320px. */}
        <text x={PAD_L} y={H - 6} fontSize="10" className="fill-[rgb(var(--subtle-fg))]">
          {label(data[0].day)}
        </text>
        <text x={W - PAD_R} y={H - 6} fontSize="10" textAnchor="end"
          className="fill-[rgb(var(--subtle-fg))]">
          {label(data[data.length - 1].day)}
        </text>

        {hover !== null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={PAD_T} y2={PAD_T + plotH}
              stroke="rgb(var(--border-strong))" strokeWidth="1" />
            {/* A surface-coloured ring keeps the marker readable wherever it
                lands on the fill. */}
            <circle cx={x(hover)} cy={y(data[hover].count)} r="5"
              fill="rgb(var(--chart-line))" stroke="rgb(var(--surface))" strokeWidth="2" />
          </g>
        )}
      </svg>

      <figcaption className="text-xs text-muted-fg mt-2 text-center min-h-[1.25rem]" aria-live="polite">
        {hover !== null
          ? `${label(data[hover].day)} — ${data[hover].count} request${data[hover].count === 1 ? "" : "s"}`
          : `${data.reduce((a, d) => a + d.count, 0)} requests over ${data.length} days`}
      </figcaption>
    </figure>
  );
}

/* ── Status split ─────────────────────────────────────────────────────────────
   Part-to-whole at a glance, four segments. A donut is only honest at that
   size and only for this job; anything comparing close values belongs in the
   legend's numbers, which is why every segment is labelled with its count. */

export function StatusDonut({ segments = [], size = 168 }) {
  const total = segments.reduce((a, s) => a + s.value, 0);

  if (!total) {
    return <p className="text-sm text-muted-fg text-center py-10">No requests yet</p>;
  }

  const R = size / 2, STROKE = 22, r = R - STROKE / 2;
  const circumference = 2 * Math.PI * r;
  // A 2px surface-coloured gap between segments, so neighbouring fills read as
  // separate marks rather than one continuous band.
  const GAP = 2;

  let offset = 0;
  const arcs = segments.filter(s => s.value > 0).map(s => {
    const fraction = s.value / total;
    const len = Math.max(circumference * fraction - GAP, 1);
    const arc = { ...s, len, offset, pct: Math.round(fraction * 100) };
    offset += circumference * fraction;
    return arc;
  });

  return (
    <div className="flex flex-col xs:flex-row items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
        className="shrink-0" role="img"
        aria-label={segments.map(s => `${s.label}: ${s.value}`).join(", ")}>
        <g transform={`rotate(-90 ${R} ${R})`}>
          <circle cx={R} cy={R} r={r} fill="none"
            stroke="rgb(var(--surface-2))" strokeWidth={STROKE} />
          {arcs.map(a => (
            <circle key={a.key} cx={R} cy={R} r={r} fill="none"
              stroke={CHART_COLORS[a.key]} strokeWidth={STROKE}
              strokeDasharray={`${a.len} ${circumference - a.len}`}
              strokeDashoffset={-a.offset} strokeLinecap="butt" />
          ))}
        </g>
        <text x={R} y={R - 2} textAnchor="middle" fontSize="26" fontWeight="700"
          className="fill-[rgb(var(--fg))]">{total}</text>
        <text x={R} y={R + 16} textAnchor="middle" fontSize="11"
          className="fill-[rgb(var(--muted-fg))]">requests</text>
      </svg>

      {/* The legend is not decoration — it carries the numbers, because a ring
          cannot be read precisely and identity must never be colour alone. */}
      <ul className="w-full space-y-2 min-w-0">
        {segments.map(s => (
          <li key={s.key} className="flex items-center gap-2.5 text-sm">
            <span aria-hidden="true" className="w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ background: CHART_COLORS[s.key] }} />
            <span className="text-muted-fg truncate">{s.label}</span>
            <span className="ml-auto font-semibold text-fg tabular-nums">{s.value}</span>
            <span className="text-subtle-fg text-xs tabular-nums w-9 text-right">
              {total ? Math.round((s.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
