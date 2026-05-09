import type { Witness } from '@/types/case';
import { CornerTicks } from './ui/CornerTicks';

interface Props {
  witness: Witness;
  index: number;
  onSelect: (id: string) => void;
}

// Deterministic gradient by id so each witness has a stable "polaroid" color.
function gradientFor(id: string): string {
  const hues = [42, 18, 168, 220, 280];
  const h = hues[id.charCodeAt(id.length - 1) % hues.length];
  return `linear-gradient(135deg, hsl(${h}, 22%, 24%), hsl(${(h + 30) % 360}, 18%, 14%))`;
}

export function WitnessCard({ witness, index, onSelect }: Props) {
  const tag = String.fromCharCode(65 + index); // A, B, C
  return (
    <button
      onClick={() => onSelect(witness.id)}
      className="group relative text-left bg-[var(--bg-panel)] border border-[var(--border-yellow)] hover:border-[var(--accent-yellow)] transition-colors p-3 w-full focus:outline-none focus:border-[var(--accent-yellow)]"
    >
      <CornerTicks size={8} />
      <div
        className="aspect-square w-full mb-3 relative overflow-hidden"
        style={{ background: gradientFor(witness.id) }}
      >
        <span className="absolute top-1.5 left-1.5 text-[9px] uppercase tracking-[0.18em] text-[var(--accent-yellow)]">
          W-{tag}
        </span>
        <span className="absolute bottom-1.5 right-1.5 text-[9px] text-[var(--text-muted)]">
          ID:{witness.id.slice(2, 7).toUpperCase()}
        </span>
        {/* face placeholder — initials */}
        <span className="absolute inset-0 flex items-center justify-center text-3xl font-light text-[var(--text-primary)]/60">
          {witness.name
            .split(' ')
            .map((n) => n[0])
            .slice(0, 2)
            .join('')}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className="text-[var(--text-primary)] text-sm font-medium truncate">
          {witness.name}
        </span>
        <span className="text-[10px] text-[var(--text-faint)]">{witness.age}</span>
      </div>
      <div className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider truncate">
        {witness.role}
      </div>
      <div className="mt-3 pt-2 border-t border-[var(--border-yellow)] flex items-center justify-between text-[10px]">
        <span className="text-[var(--text-faint)] uppercase tracking-wider">
          interview
        </span>
        <span className="text-[var(--accent-yellow)] group-hover:translate-x-0.5 transition-transform">
          →
        </span>
      </div>
    </button>
  );
}
