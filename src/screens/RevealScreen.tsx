import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import { useGameStore } from '@/store/gameStore';

function Stamp({
  text,
  top,
  left,
  rotate,
  color,
  size,
}: {
  text: string;
  top: number;
  left: number;
  rotate: number;
  color?: string;
  size?: number;
}) {
  return (
    <div
      className="dossier-stamp"
      style={
        {
          top,
          left,
          '--stamp-rotate': `${rotate}deg`,
          '--stamp-color': color ?? 'var(--oxblood)',
          '--stamp-size': size ? `${size}px` : undefined,
        } as CSSProperties
      }
    >
      {text}
    </div>
  );
}

function PaperClip({
  left,
  top,
  rotate,
}: {
  left: number;
  top: number;
  rotate: number;
}) {
  return (
    <div
      className="absolute drop-shadow-[0_2px_1px_rgba(0,0,0,0.25)]"
      style={{ left, top, transform: `rotate(${rotate}deg)` }}
    >
      <svg width="36" height="80" viewBox="0 0 36 80" aria-hidden="true">
        <path
          d="M18 6 Q28 6 28 18 L28 62 Q28 74 18 74 Q8 74 8 62 L8 24 Q8 14 18 14 Q22 14 22 18 L22 60"
          fill="none"
          stroke="var(--clip-grey)"
          strokeLinecap="round"
          strokeWidth="3"
        />
      </svg>
    </div>
  );
}

export function RevealScreen() {
  const caseData = useGameStore((s) => s.caseData)!;
  const isCorrect = useGameStore((s) => s.isCorrect);
  const accusation = useGameStore((s) => s.accusation);
  const revealNarration = useGameStore((s) => s.revealNarration);
  const witnessPortraitUrls = useGameStore((s) => s.witnessPortraitUrls);
  const resetCase = useGameStore((s) => s.resetCase);
  const goToBrief = useGameStore((s) => s.goToBrief);

  const [flash, setFlash] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setFlash(false), 650);
    return () => window.clearTimeout(t);
  }, []);

  const killer = caseData.witnesses.find((w) => w.id === caseData.truth.killer);
  const verdictLabel = isCorrect ? 'CASE CLOSED' : 'WRONG CALL';
  const verdictColor = isCorrect ? 'var(--ink)' : 'var(--oxblood)';
  const killerPortraitUrl = killer ? witnessPortraitUrls[killer.id] : undefined;

  return (
    <main className="dossier-page">
      <div className="dossier-tab" />
      {flash && (
        <div
          className="pointer-events-none fixed inset-0 z-50"
          style={{
            background: isCorrect ? 'var(--paper-warm-base)' : 'var(--oxblood)',
            opacity: 0.75,
            animation: 'flash-overlay 0.65s ease-out forwards',
          }}
        />
      )}

      <div className="dossier-artboard">
        <header className="dossier-header">
          <div>
            <div className="dossier-overline">Final Determination · {caseData.case_id}</div>
            <h1 className="dossier-title">REVEAL — {caseData.title.toUpperCase()}</h1>
          </div>
          <div className="text-right text-[12px] leading-normal">
            <div>ACCUSED · {accusation || 'NO STATEMENT'}</div>
            <div>STATUS · {verdictLabel}</div>
            <div>{new Date().toISOString().slice(0, 10)}</div>
          </div>
        </header>

        <section className="mt-[22px] grid grid-cols-[0.9fr_1.1fr] gap-8 max-[900px]:grid-cols-1">
          <section className="paper-card lifted relative min-h-[560px] p-6">
            <div className="tape-corner left" />
            <div className="tape-corner right" />
            <PaperClip left={-8} top={64} rotate={-10} />

            <div className="dossier-overline">Filed Verdict</div>
            <div
              className="mx-auto mt-12 max-w-[420px] border-[5px] p-8 text-center"
              style={{
                borderColor: verdictColor,
                color: verdictColor,
                transform: 'rotate(-4deg)',
              }}
            >
              <div className="text-[11px] tracking-[0.28em] opacity-70">
                FINAL DETERMINATION
              </div>
              <div className="mt-3 text-[52px] font-bold leading-none tracking-[0.1em]">
                {verdictLabel}
              </div>
              <div className="mt-4 text-[10px] tracking-[0.25em] opacity-70">
                CRIME SCENE · CID SINGAPORE
              </div>
            </div>

            <div className="lined-paper mt-12 p-[14px_18px] shadow-[0_4px_12px_rgba(0,0,0,0.12)]">
              <div className="border-b border-dashed border-[var(--ink)] pb-1 text-[11px] tracking-[0.15em] opacity-70">
                YOUR ACCUSATION
              </div>
              <p className="mt-2 text-[15px] italic leading-[24px]">
                "{accusation || 'No accusation recorded.'}"
              </p>
            </div>

            <Stamp
              text={verdictLabel}
              top={24}
              left={260}
              rotate={6}
              color={verdictColor}
              size={12}
            />
          </section>

          <section className="flex flex-col gap-[18px]">
            <section className="paper-card p-[16px_18px]">
              <PaperClip left={300} top={-22} rotate={8} />
              <div className="dossier-overline">The Truth · Declassified</div>
              <div className="mt-3 flex gap-4 max-[620px]:flex-col">
                {killerPortraitUrl && (
                  <img
                    src={killerPortraitUrl}
                    alt={`${killer?.name ?? 'Killer'} portrait`}
                    className="h-[138px] w-[108px] shrink-0 object-cover grayscale"
                  />
                )}
                <h2 className="text-[28px] leading-tight">
                  {killer?.name ?? 'Unknown'} — {killer?.role ?? 'No role recorded'}
                </h2>
              </div>
              <dl className="mt-5 grid grid-cols-[90px_1fr] gap-x-4 gap-y-3 text-[13px] leading-relaxed">
                <dt className="opacity-[0.65]">MOTIVE</dt>
                <dd>{caseData.truth.motive}</dd>
                <dt className="opacity-[0.65]">METHOD</dt>
                <dd>{caseData.truth.method}</dd>
                <dt className="opacity-[0.65]">MISSED</dt>
                <dd className="text-[var(--oxblood)]">{caseData.truth.hidden_clue}</dd>
              </dl>
            </section>

            <section className="paper-card lined-paper flex-1 p-[16px_18px]">
              <div className="border-b border-dashed border-[var(--ink)] pb-1 text-[12px] tracking-[0.12em]">
                RECONSTRUCTION NOTES
              </div>
              <p className="mt-3 text-[13px] leading-[24px]">
                {revealNarration}
              </p>
            </section>

            <section className="paper-card p-[14px_16px]">
              <div className="dossier-overline mb-3">Next Filing</div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={goToBrief}
                  className="border border-[var(--ink)] px-3 py-2 text-[11px] tracking-[0.15em]"
                >
                  REVIEW CASE FILE
                </button>
                <button
                  type="button"
                  onClick={resetCase}
                  className="bg-[var(--ink)] px-3 py-2 text-[11px] tracking-[0.15em] text-[var(--cream-on-dark)]"
                >
                  OPEN NEW CASE →
                </button>
              </div>
            </section>
          </section>
        </section>

        <div className="dossier-footer mt-7">
          <span>DECLASSIFIED AFTER ACCUSATION · CHAIN OF CUSTODY {caseData.case_id}</span>
          <span>PAGE 04 / 04</span>
        </div>
      </div>

      <div className="dossier-grain" />
    </main>
  );
}
