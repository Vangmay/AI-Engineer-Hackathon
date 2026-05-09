import { useEffect, useRef } from 'react';
import type { TranscriptLine } from '@/types/case';

interface Props {
  lines: TranscriptLine[];
  className?: string;
}

const speakerStyles: Record<TranscriptLine['speaker'], string> = {
  detective: 'text-[var(--accent-yellow)]',
  witness: 'text-[var(--text-primary)]',
  system: 'text-[var(--text-faint)] italic',
};

const speakerLabel: Record<TranscriptLine['speaker'], string> = {
  detective: 'DET',
  witness: 'WIT',
  system: 'SYS',
};

export function TranscriptFeed({ lines, className = '' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines.length]);
  return (
    <div
      ref={ref}
      className={`overflow-y-auto font-mono text-[12px] leading-relaxed ${className}`}
    >
      {lines.length === 0 ? (
        <div className="text-[var(--text-faint)] italic">
          [transcript begins when the call connects]
        </div>
      ) : (
        <ul className="space-y-2">
          {lines.map((l, i) => (
            <li key={i} className="flex gap-2">
              <span className="shrink-0 text-[10px] tracking-[0.18em] text-[var(--text-faint)] pt-0.5 w-9">
                {speakerLabel[l.speaker]}
              </span>
              <span className={speakerStyles[l.speaker]}>{l.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
