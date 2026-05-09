import { useEffect, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { StatusBar } from '@/components/ui/StatusBar';
import { ConsolePanel } from '@/components/ui/ConsolePanel';
import { CornerTicks } from '@/components/ui/CornerTicks';

export function RevealScreen() {
  const caseData = useGameStore((s) => s.caseData)!;
  const isCorrect = useGameStore((s) => s.isCorrect);
  const accusation = useGameStore((s) => s.accusation);
  const revealNarration = useGameStore((s) => s.revealNarration);
  const resetCase = useGameStore((s) => s.resetCase);

  const [flash, setFlash] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setFlash(false), 900);
    return () => clearTimeout(t);
  }, []);

  const killer = caseData.witnesses.find((w) => w.id === caseData.truth.killer);
  const verdictColor = isCorrect ? 'var(--accent-yellow)' : 'var(--accent-red)';
  const verdictLabel = isCorrect ? 'CASE CLOSED' : 'INCORRECT';

  return (
    <div className="h-full flex flex-col bg-[var(--bg-base)] relative overflow-hidden">
      <StatusBar caseId={caseData.case_id} phase={`REVEAL // ${verdictLabel}`} />

      {flash && (
        <div
          className="pointer-events-none fixed inset-0 z-50"
          style={{
            background: verdictColor,
            opacity: 0.85,
            animation: 'flash-overlay 0.9s ease-out forwards',
          }}
        />
      )}

      <div className="flex-1 grid grid-cols-[55%_45%] overflow-hidden">
        {/* Left: verdict stamp */}
        <div className="relative grid place-items-center p-8 border-r border-[var(--border-yellow)]">
          <div className="relative">
            <CornerTicks size={20} />
            <div
              className="px-12 py-8 border-4"
              style={{
                borderColor: verdictColor,
                color: verdictColor,
                transform: 'rotate(-4deg)',
              }}
            >
              <div className="text-[10px] uppercase tracking-[0.32em] mb-2 opacity-70">
                FINAL DETERMINATION
              </div>
              <div className="text-[56px] font-medium tracking-[0.12em] uppercase leading-none">
                {verdictLabel}
              </div>
              <div className="text-[10px] uppercase tracking-[0.32em] mt-3 opacity-70">
                {new Date().toISOString().slice(0, 10)} · CRIME//SCENE
              </div>
            </div>
          </div>

          <div className="absolute bottom-8 left-8 right-8">
            <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--text-faint)] mb-1">
              YOUR ACCUSATION
            </div>
            <div className="text-[15px] text-[var(--text-primary)] italic">
              “{accusation || '—'}”
            </div>
          </div>
        </div>

        {/* Right: full reveal */}
        <div className="p-6 flex flex-col gap-4 overflow-y-auto">
          <ConsolePanel label="THE TRUTH" rightSlot="DECLASSIFIED">
            <div className="space-y-3 text-[13px] leading-relaxed">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-faint)]">Killer</div>
                <div className="text-[var(--accent-yellow)] text-base">{killer?.name} — {killer?.role}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-faint)]">Motive</div>
                <div className="text-[var(--text-primary)]">{caseData.truth.motive}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-faint)]">Method</div>
                <div className="text-[var(--text-primary)]">{caseData.truth.method}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-faint)]">Hidden detail</div>
                <div className="text-[var(--text-primary)]">{caseData.truth.hidden_clue}</div>
              </div>
            </div>
          </ConsolePanel>

          <ConsolePanel label="NARRATION">
            <p className="text-[13px] leading-relaxed text-[var(--text-primary)]">
              {revealNarration}
            </p>
          </ConsolePanel>

          <button
            onClick={resetCase}
            className="self-start px-4 py-2 bg-[var(--accent-yellow)] text-[var(--bg-base)] text-[11px] uppercase tracking-[0.22em] font-medium hover:bg-[var(--accent-yellow)]/85"
          >
            Open new case →
          </button>
        </div>
      </div>
    </div>
  );
}
