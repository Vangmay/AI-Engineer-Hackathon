import { useEffect, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { StatusBar } from '@/components/ui/StatusBar';

const STAGES = [
  'INITIALIZING SCENE',
  'GENERATING VICTIM PROFILE',
  'CASTING WITNESSES',
  'COMPOSING CRIME SCENE',
  'SYNTHESIZING 911 CALL',
  'ASSEMBLING CASE FILE',
];

export function LoadingScreen() {
  const loadStaticCase = useGameStore((s) => s.loadStaticCase);
  const [stage, setStage] = useState(0);
  const [t, setT] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const tick = setInterval(() => setT(performance.now() - start), 80);
    const stages = setInterval(() => {
      setStage((s) => Math.min(STAGES.length - 1, s + 1));
    }, 700);
    const done = setTimeout(() => loadStaticCase(), 4500);
    return () => {
      clearInterval(tick);
      clearInterval(stages);
      clearTimeout(done);
    };
  }, [loadStaticCase]);

  return (
    <div className="h-full flex flex-col bg-[var(--bg-base)]">
      <StatusBar phase="LOADING" />
      <div className="flex-1 grid place-items-center px-6">
        <div className="w-[520px] max-w-full">
          <div className="text-[10px] uppercase tracking-[0.32em] text-[var(--text-faint)] mb-4">
            CRIME//SCENE — PROCEDURAL CASE BUILD
          </div>
          <div className="text-[var(--accent-yellow)] text-3xl font-light mb-8 flex items-center gap-3">
            <span className="text-2xl">◉</span>
            <span>{(t / 1000).toFixed(1)}s</span>
            <span className="cursor-blink">_</span>
          </div>
          <ul className="space-y-2 font-mono text-[12px]">
            {STAGES.map((label, i) => {
              const state =
                i < stage ? 'done' : i === stage ? 'active' : 'pending';
              return (
                <li key={label} className="flex items-center gap-3">
                  <span
                    className={
                      state === 'done'
                        ? 'text-[var(--accent-green)]'
                        : state === 'active'
                          ? 'text-[var(--accent-yellow)] pulse-yellow'
                          : 'text-[var(--text-faint)]'
                    }
                  >
                    {state === 'done' ? '✓' : state === 'active' ? '▸' : '·'}
                  </span>
                  <span
                    className={
                      state === 'pending'
                        ? 'text-[var(--text-faint)]'
                        : 'text-[var(--text-primary)]'
                    }
                  >
                    {label}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
