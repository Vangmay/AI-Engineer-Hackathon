import type { ReactNode } from 'react';
import { CornerTicks } from './CornerTicks';

interface Props {
  label?: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  rightSlot?: ReactNode;
}

export function ConsolePanel({
  label,
  children,
  className = '',
  contentClassName = '',
  rightSlot,
}: Props) {
  return (
    <div
      className={`relative bg-[var(--bg-panel)] border border-[var(--border-yellow)] ${className}`}
    >
      <CornerTicks />
      {(label || rightSlot) && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-yellow)]">
          {label && (
            <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--accent-yellow)] font-medium">
              {label}
            </span>
          )}
          {rightSlot && (
            <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
              {rightSlot}
            </span>
          )}
        </div>
      )}
      <div className={`p-4 ${contentClassName}`}>{children}</div>
    </div>
  );
}
