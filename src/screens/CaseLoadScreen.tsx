import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Evidence3DViewer } from '@/components/Evidence3DViewer';
import { useGameStore } from '@/store/gameStore';

const CALL_911_TRANSCRIPT = [
  { who: 'DISP', text: "Nine-one-one, what's your emergency?" },
  { who: 'CALL', text: "I-- I think Ray is dead. He's not breathing. Oh god." },
  { who: 'DISP', text: "Ma'am, where are you?" },
  { who: 'CALL', text: 'Marina One penthouse. Forty-seventh floor. Please hurry.' },
  { who: 'DISP', text: 'Stay on the line. Is anyone else with you?' },
  { who: 'CALL', text: 'No. The apartment is empty. Everyone left hours ago.' },
];

function Stamp({ text, top, left, rotate, color, size }: {
  text: string; top: number; left: number; rotate: number; color?: string; size?: number;
}) {
  return (
    <div
      className="dossier-stamp"
      style={{ top, left, '--stamp-rotate': `${rotate}deg`, '--stamp-color': color ?? 'var(--oxblood)', '--stamp-size': size ? `${size}px` : undefined } as CSSProperties}
    >
      {text}
    </div>
  );
}

function PaperClip({ left, top, rotate }: { left: number; top: number; rotate: number }) {
  return (
    <div className="absolute drop-shadow-[0_2px_1px_rgba(0,0,0,0.25)]" style={{ left, top, transform: `rotate(${rotate}deg)` }}>
      <svg width="36" height="80" viewBox="0 0 36 80" aria-hidden="true">
        <path d="M18 6 Q28 6 28 18 L28 62 Q28 74 18 74 Q8 74 8 62 L8 24 Q8 14 18 14 Q22 14 22 18 L22 60"
          fill="none" stroke="var(--clip-grey)" strokeLinecap="round" strokeWidth="3" />
      </svg>
    </div>
  );
}

function Waveform({ activeBars = 28 }: { activeBars?: number }) {
  return (
    <svg width="220" height="24" viewBox="0 0 220 24" aria-hidden="true">
      {Array.from({ length: 44 }).map((_, i) => {
        const h = 4 + Math.abs(Math.sin(i * 0.6) * Math.cos(i * 0.15)) * 18;
        return (
          <rect key={i} x={i * 5} y={(24 - h) / 2} width="2.5" height={h}
            fill="var(--ink)" opacity={i < activeBars ? 1 : 0.25} />
        );
      })}
    </svg>
  );
}

export function CaseLoadScreen() {
  const caseData = useGameStore((s) => s.caseData)!;
  const sceneImageUrl = useGameStore((s) => s.sceneImageUrl);
  const call911AudioUrl = useGameStore((s) => s.call911AudioUrl);
  const witnessPortraitUrls = useGameStore((s) => s.witnessPortraitUrls);
  const evidenceImageUrls = useGameStore((s) => s.evidenceImageUrls);
  const evidenceModelUrls = useGameStore((s) => s.evidenceModelUrls);
  const evidenceModelPreviewUrls = useGameStore((s) => s.evidenceModelPreviewUrls);
  const startInterrogation = useGameStore((s) => s.startInterrogation);
  const goToAccusation = useGameStore((s) => s.goToAccusation);

  const [isPlaying911, setIsPlaying911] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!call911AudioUrl) return;
    const audio = new Audio(call911AudioUrl);
    audioRef.current = audio;
    audio.addEventListener('play', () => setIsPlaying911(true));
    audio.addEventListener('pause', () => setIsPlaying911(false));
    audio.addEventListener('ended', () => setIsPlaying911(false));
    void audio.play().catch(() => setIsPlaying911(false));
    return () => { audio.pause(); audio.currentTime = 0; audioRef.current = null; };
  }, [call911AudioUrl]);

  const toggle911Audio = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play(); else audio.pause();
  };

  return (
    <main className="dossier-page">
      <div className="dossier-tab" />
      <div className="dossier-artboard">
        <header className="dossier-header">
          <div>
            <div className="dossier-overline">SPF · CID</div>
            <h1 className="dossier-title">CASE FILE — {caseData.title.toUpperCase()}</h1>
          </div>
          <div className="text-right text-[12px] leading-normal">
            <div>FILE NO. {caseData.case_id}</div>
            <div>{caseData.victim.date.toUpperCase()} · ACTIVE</div>
            <button
              type="button"
              onClick={goToAccusation}
              className="mt-2 bg-[var(--oxblood)] px-3 py-1.5 text-[10px] tracking-[0.15em] text-[var(--cream-on-dark)]"
            >
              FILE ACCUSATION →
            </button>
          </div>
        </header>

        <section className="mt-[22px] grid grid-cols-[1.35fr_1fr] gap-8 max-[900px]:grid-cols-1">
          {/* LEFT COLUMN */}
          <div className="flex flex-col gap-[18px]">
            {/* Scene photo */}
            <section className="paper-card lifted p-[14px_14px_18px]">
              <div className="tape-corner left" />
              <div className="tape-corner right" />
              <div className="case-scene-frame h-[240px]">
                {sceneImageUrl ? (
                  <img src={sceneImageUrl} alt="Crime scene" className="h-full w-full object-cover" />
                ) : (
                  <div className="photo-ph h-full text-[11px] leading-relaxed">
                    {caseData.victim.location.toUpperCase()}
                  </div>
                )}
              </div>
              <div className="mt-2 flex justify-between gap-4 text-[10px] opacity-70">
                <span>EXHIBIT A · SCENE PHOTOGRAPH 01</span>
                <span>RESPONDING OFFICER · 04:22 SGT</span>
              </div>
              <Stamp text="CONFIDENTIAL" top={-22} left={310} rotate={-8} />
            </section>

            {/* Evidence Collected — inline 3D models */}
            <section className="paper-card p-[14px_16px]">
              <div className="dossier-overline mb-2">Evidence Collected</div>
              {caseData.clues.map((clue, i) => {
                const modelUrl = evidenceModelUrls[String(i)];
                const renderUrl = evidenceImageUrls[String(i)];
                const previewUrl = evidenceModelPreviewUrls[String(i)] || renderUrl;
                return (
                  <div key={clue} className="border-t border-dashed border-[rgba(26,20,16,0.3)] pt-2 first:border-t-0">
                    <div className="flex items-start gap-2 pb-1">
                      <span className="w-[26px] shrink-0 text-[11px] opacity-70 pt-0.5">
                        EX-{String.fromCharCode(65 + i)}
                      </span>
                      <span className="text-[12px] leading-snug">{clue}</span>
                    </div>
                    {modelUrl ? (
                      <Evidence3DViewer
                        inline
                        glbUrl={modelUrl}
                        previewUrl={previewUrl}
                        label={`Exhibit ${String.fromCharCode(65 + i)}`}
                        description={clue}
                      />
                    ) : renderUrl ? (
                      <img src={renderUrl} alt={`Evidence ${String.fromCharCode(65 + i)}`}
                        className="w-full h-[120px] object-cover mt-1" />
                    ) : null}
                  </div>
                );
              })}
            </section>
          </div>

          {/* RIGHT COLUMN */}
          <aside className="flex flex-col gap-[18px]">
            {/* Victim */}
            <section className="paper-card p-[14px_16px_16px]">
              <PaperClip left={-10} top={-22} rotate={-12} />
              <div className="dossier-overline">Victim</div>
              <h2 className="mt-0.5 text-[22px]">{caseData.victim.name}</h2>
              <dl className="mt-2.5 grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1 text-[12px]">
                <dt className="opacity-[0.65]">AGE</dt>
                <dd>{caseData.victim.age}</dd>
                <dt className="opacity-[0.65]">OCCUPATION</dt>
                <dd>{caseData.victim.occupation}</dd>
                <dt className="opacity-[0.65]">LOCATION</dt>
                <dd>{caseData.victim.location}</dd>
                <dt className="opacity-[0.65]">TIME OF DEATH</dt>
                <dd className="font-bold text-[var(--oxblood)]">{caseData.victim.time_of_death}</dd>
                <dt className="opacity-[0.65]">CAUSE</dt>
                <dd>██████████ <span className="opacity-55">(pending tox)</span></dd>
              </dl>
            </section>

            {/* 911 call — compact */}
            <section className="paper-card lined-paper p-[12px_16px]">
              <div className="flex items-center justify-between border-b border-dashed border-[var(--ink)] pb-1 mb-2">
                <span className="text-[12px] tracking-[0.1em]">911 CALL</span>
                <span className="text-[10px] opacity-70">04:22 SGT</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggle911Audio}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--ink)] text-[10px] text-[var(--cream-on-dark)]"
                  aria-label="Play 911 call"
                >
                  {isPlaying911 ? '❚❚' : '▶'}
                </button>
                <Waveform />
                <div className="text-[10px] opacity-70 shrink-0">
                  {call911AudioUrl ? (isPlaying911 ? 'LIVE' : 'READY') : 'NO AUDIO'}
                </div>
              </div>
              <div className="mt-2 text-[11px] leading-[22px]">
                {CALL_911_TRANSCRIPT.map((line, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="w-[38px] shrink-0 opacity-55">{line.who}</span>
                    <span>{line.text}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Witnesses */}
            <section className="paper-card p-[14px_16px]">
              <PaperClip left={250} top={-22} rotate={8} />
              <div className="dossier-overline mb-2">Witnesses</div>
              {caseData.witnesses.map((witness, i) => (
                <div
                  key={witness.id}
                  className="flex items-center gap-2.5 border-t border-dashed border-[rgba(26,20,16,0.3)] py-2 first:border-t-0"
                >
                  {witnessPortraitUrls[witness.id] ? (
                    <img src={witnessPortraitUrls[witness.id]} alt={witness.name}
                      className="h-[48px] w-[38px] object-cover grayscale shrink-0" />
                  ) : (
                    <div className="grid h-[46px] w-[38px] shrink-0 place-items-center bg-[var(--ink)] text-[9px] text-[var(--cream-on-dark)]">
                      W{i + 1}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px]">{witness.name}</div>
                    <div className="truncate text-[11px] opacity-[0.65]">{witness.role}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => startInterrogation(witness.id)}
                    className="bg-[var(--ink)] px-2.5 py-1.5 text-[11px] tracking-[0.1em] text-[var(--cream-on-dark)] shrink-0"
                  >
                    INTERVIEW →
                  </button>
                </div>
              ))}
            </section>

            {/* Accusation */}
            <section className="paper-card border-2 border-[var(--oxblood)] p-[14px_16px]">
              <button
                type="button"
                onClick={goToAccusation}
                className="w-full bg-[var(--oxblood)] px-3 py-2.5 text-[11px] tracking-[0.15em] text-[var(--cream-on-dark)]"
              >
                FILE ACCUSATION →
              </button>
            </section>
          </aside>
        </section>

        <div className="dossier-footer mt-7">
          <span>DO NOT REMOVE FROM PREMISES · CHAIN OF CUSTODY {caseData.case_id}</span>
          <button type="button" onClick={goToAccusation}>READY TO ACCUSE · PAGE 01 / 04</button>
        </div>
      </div>

      <Stamp text="CASE OPEN" top={56} left={920} rotate={6} />
      <div className="dossier-grain" />
    </main>
  );
}
