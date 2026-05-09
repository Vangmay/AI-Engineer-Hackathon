import { useEffect, useState } from 'react';

interface Props {
  caseId?: string;
  phase?: string;
}

export function StatusBar({ caseId, phase }: Props) {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const ts = time.toISOString().slice(11, 19);
  return (
    <div className="flex items-center justify-between px-4 h-7 bg-[var(--bg-statusbar)] border-b border-[var(--border-yellow)] text-[10px] uppercase tracking-[0.22em] font-mono shrink-0">
      <div className="flex items-center gap-4">
        <span className="text-[var(--accent-yellow)] flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent-yellow)] pulse-yellow" />
          CRIME//SCENE
        </span>
        <span className="text-[var(--text-faint)]">v0.1.0</span>
      </div>
      <div className="flex items-center gap-6 text-[var(--text-muted)]">
        {caseId && <span>CASE: {caseId}</span>}
        {phase && <span className="text-[var(--accent-yellow-dim)]">{phase}</span>}
        <span>SGT {ts}</span>
        <span className="text-[var(--accent-yellow)]">SECURE</span>
      </div>
    </div>
  );
}
