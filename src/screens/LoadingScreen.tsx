import { useEffect, useState } from 'react';
import { useGameStore } from '@/store/gameStore';

const STAGES = [
  'Opening case envelope',
  'Indexing victim profile',
  'Sorting witness statements',
  'Dusting scene photograph',
  'Threading 911 tape',
  'Stamping active file',
];

export function LoadingScreen() {
  const loadStaticCase = useGameStore((s) => s.loadStaticCase);
  const [stage, setStage] = useState(0);
  const [t, setT] = useState(0);

  useEffect(() => {
    void loadStaticCase();
    const start = performance.now();
    const tick = setInterval(() => setT(performance.now() - start), 80);
    const stages = setInterval(() => {
      setStage((s) => Math.min(STAGES.length - 1, s + 1));
    }, 700);
    return () => {
      clearInterval(tick);
      clearInterval(stages);
    };
  }, [loadStaticCase]);

  return (
    <main className="dossier-page grid min-h-screen place-items-center px-6">
      <div className="dossier-tab" />
      <section className="paper-card lifted w-[560px] max-w-full p-8">
        <div className="dossier-overline">Singapore Police Force · CID</div>
        <h1 className="mt-2 text-[32px] leading-none">CASE FILE</h1>
        <div className="mt-1 text-[18px]">Death at Duxton Hill</div>
        <div className="my-6 border-t-2 border-[var(--ink)]" />
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] tracking-[0.25em] opacity-70">
            UNPACKING DOSSIER
          </span>
          <span className="text-[22px] text-[var(--oxblood)]">
            {(t / 1000).toFixed(1)}s
          </span>
        </div>
        <ul className="mt-5 space-y-2 text-[13px]">
          {STAGES.map((label, i) => {
            const state = i < stage ? 'done' : i === stage ? 'active' : 'pending';
            return (
              <li key={label} className="flex items-center gap-3">
                <span
                  className={
                    state === 'done'
                      ? 'text-[var(--oxblood)]'
                      : state === 'active'
                        ? 'text-[var(--ink)]'
                        : 'opacity-35'
                  }
                >
                  {state === 'done' ? '×' : state === 'active' ? '▶' : '·'}
                </span>
                <span className={state === 'pending' ? 'opacity-35' : ''}>
                  {label}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
      <div className="dossier-grain" />
    </main>
  );
}
