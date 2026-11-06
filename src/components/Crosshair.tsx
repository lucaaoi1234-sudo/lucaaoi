/** Tâm ngắm dạng chữ thập có khoảng trống ở giữa. Màu được kiểm tra để tránh chèn giá trị lạ vào SVG. */
export function Crosshair({ size, color }: { size: number; color: string }) {
  const safeColor = /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#7ff7ff";
  const gap = Math.max(2, Math.round(size / 3));
  const arm = Math.max(4, size);
  const stroke = Math.max(1.5, size / 10);
  const half = gap + arm + 2;
  const total = half * 2;
  const c = half;
  return (
    <svg width={total} height={total} viewBox={`0 0 ${total} ${total}`} aria-hidden="true" className="block">
      <g stroke={safeColor} strokeWidth={stroke} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 4px ${safeColor})` }}>
        <line x1={c} y1={c - gap} x2={c} y2={c - gap - arm} />
        <line x1={c} y1={c + gap} x2={c} y2={c + gap + arm} />
        <line x1={c - gap} y1={c} x2={c - gap - arm} y2={c} />
        <line x1={c + gap} y1={c} x2={c + gap + arm} y2={c} />
      </g>
      <circle cx={c} cy={c} r={Math.max(1.2, stroke * 0.8)} fill={safeColor} style={{ filter: `drop-shadow(0 0 3px ${safeColor})` }} />
    </svg>
  );
}
