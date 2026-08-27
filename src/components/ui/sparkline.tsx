export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
}

function Sparkline({ data, width = 96, height = 28, className }: SparklineProps) {
  if (data.length < 2) return null;
  const strokeWidth = 1.5;
  const inset = strokeWidth / 2;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const points = data
    .map((v, i) => `${i * step},${inset + (1 - (v - min) / range) * (height - strokeWidth)}`)
    .join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} role="img" aria-label="Tendencia">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export { Sparkline };
