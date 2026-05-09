import { useEffect, useState } from 'react';

interface Props {
  bars?: number;
  active?: boolean;
  height?: number;
  className?: string;
  color?: string;
}

export function WaveformBar({
  bars = 48,
  active = true,
  height = 36,
  className = '',
  color = 'var(--accent-yellow)',
}: Props) {
  const [seed, setSeed] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setSeed((s) => s + 1), 90);
    return () => clearInterval(id);
  }, [active]);

  const heights = Array.from({ length: bars }, (_, i) => {
    if (!active) return 0.15;
    const phase = (i + seed) * 0.6;
    const v = 0.25 + Math.abs(Math.sin(phase) * Math.cos(phase * 0.4)) * 0.75;
    return Math.max(0.1, Math.min(1, v));
  });

  return (
    <div
      className={`flex items-center gap-[2px] ${className}`}
      style={{ height }}
    >
      {heights.map((h, i) => (
        <span
          key={i}
          className="flex-1 rounded-[1px] transition-[height] duration-100"
          style={{
            height: `${h * 100}%`,
            background: color,
            opacity: active ? 0.85 : 0.25,
          }}
        />
      ))}
    </div>
  );
}
