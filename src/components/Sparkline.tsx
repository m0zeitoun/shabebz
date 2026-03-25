import type { PriceHistory } from '../types';

interface Props {
  history: PriceHistory[];
  width?: number;
  height?: number;
  positive?: boolean;
}

export default function Sparkline({ history, width = 80, height = 32, positive }: Props) {
  if (history.length < 2) {
    return <div style={{ width, height }} className="flex items-center justify-center text-white/20 text-xs">—</div>;
  }

  const prices = history.map(h => h.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const points = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * width;
    const y = height - ((p - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  const color = positive ? '#00ff88' : '#ff4757';
  const fillColor = positive ? 'rgba(0,255,136,0.1)' : 'rgba(255,71,87,0.1)';

  // Create fill path
  const fillPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polygon points={fillPoints} fill={fillColor} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
