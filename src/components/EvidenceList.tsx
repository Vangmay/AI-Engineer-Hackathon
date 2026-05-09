import { ConsolePanel } from './ui/ConsolePanel';

interface Props {
  clues: string[];
}

export function EvidenceList({ clues }: Props) {
  return (
    <ConsolePanel label="EVIDENCE LOG" rightSlot={`${clues.length} ITEMS`}>
      <ul className="space-y-3">
        {clues.map((clue, i) => {
          const tag = String.fromCharCode(65 + i);
          return (
            <li key={i} className="flex gap-3 items-start">
              <span className="shrink-0 w-6 h-6 grid place-items-center text-[10px] font-medium text-[var(--accent-yellow)] border border-[var(--border-yellow)]">
                {tag}
              </span>
              <span className="text-[12px] leading-snug text-[var(--text-primary)]">
                {clue}
              </span>
            </li>
          );
        })}
      </ul>
    </ConsolePanel>
  );
}
