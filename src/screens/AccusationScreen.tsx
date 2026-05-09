import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/store/gameStore';

interface SpeechRecognitionResultLike {
  0: { transcript: string };
}

interface SpeechRecognitionEventLike {
  results: SpeechRecognitionResultLike[];
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function AccusationWaveform({ active }: { active: boolean }) {
  return (
    <svg width="100%" height="42" viewBox="0 0 420 42" aria-hidden="true">
      {Array.from({ length: 70 }).map((_, i) => {
        const h =
          5 +
          Math.abs(Math.sin(i * 0.52) * Math.cos(i * 0.17 + (active ? 1 : 0))) *
            (active ? 31 : 16);
        return (
          <rect
            key={i}
            x={i * 6}
            y={(42 - h) / 2}
            width="3"
            height={h}
            fill="var(--ink)"
            opacity={active ? 0.9 : 0.35}
          />
        );
      })}
    </svg>
  );
}

export function AccusationScreen() {
  const caseData = useGameStore((s) => s.caseData)!;
  const submitAccusation = useGameStore((s) => s.submitAccusation);
  const endInterrogation = useGameStore((s) => s.endInterrogation);

  const [holding, setHolding] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [supported] = useState(() => {
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    return !!(w.SpeechRecognition ?? w.webkitSpeechRecognition);
  });
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = 'en-SG';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let text = '';
      for (let i = 0; i < e.results.length; i += 1) {
        text += e.results[i][0].transcript;
      }
      setTranscript(text);
    };
    rec.onerror = () => setHolding(false);
    rec.onend = () => setHolding(false);
    recRef.current = rec;
    return () => {
      try {
        rec.stop();
      } catch {
        /* noop */
      }
    };
  }, []);

  const start = () => {
    setTranscript('');
    setHolding(true);
    try {
      recRef.current?.start();
    } catch {
      /* already started */
    }
  };

  const stop = () => {
    setHolding(false);
    try {
      recRef.current?.stop();
    } catch {
      /* noop */
    }
    if (transcript.trim()) {
      setTimeout(() => submitAccusation(transcript), 350);
    }
  };

  const submitTextFallback = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = (data.get('name') as string)?.trim();
    if (name) submitAccusation(name);
  };

  return (
    <main className="dossier-page">
      <div className="dossier-tab" />
      <div className="dossier-artboard grid min-h-screen place-items-center">
        <section className="paper-card lifted relative w-[720px] max-w-full p-8 text-center">
          <div className="tape-corner left" />
          <div className="tape-corner right" />

          <div className="dossier-overline">Formal Accusation · On The Record</div>
          <h1 className="mt-3 text-[34px] leading-none">Name The Killer</h1>
          <div className="mx-auto mt-4 h-0 w-full border-t-2 border-[var(--ink)]" />

          <div className="mx-auto mt-8 max-w-[520px] text-[13px] leading-relaxed opacity-75">
            Case file {caseData.case_id} is ready for indictment. Record the suspect's
            name clearly, then release the seal to enter it into evidence.
          </div>

          <div className="mx-auto mt-8 grid h-[184px] w-[184px] place-items-center border-2 border-dashed border-[var(--ink)]">
            <button
              type="button"
              onMouseDown={start}
              onMouseUp={stop}
              onMouseLeave={() => holding && stop()}
              onTouchStart={start}
              onTouchEnd={stop}
              disabled={!supported}
              className={`h-[132px] w-[132px] rounded-full border-2 text-[40px] transition-transform ${
                holding
                  ? 'scale-105 border-[var(--oxblood)] bg-[var(--oxblood)] text-[var(--cream-on-dark)]'
                  : 'border-[var(--ink)] bg-[var(--paper-card)] text-[var(--ink)] hover:bg-[var(--paper-warm-base)]'
              } disabled:cursor-not-allowed disabled:opacity-45`}
              aria-label="Hold to record accusation"
            >
              REC
            </button>
          </div>

          <div className="mx-auto mt-6 max-w-[520px]">
            <AccusationWaveform active={holding} />
          </div>

          <div className="lined-paper mx-auto mt-6 min-h-[82px] max-w-[560px] p-[14px_18px] text-left shadow-[0_4px_12px_rgba(0,0,0,0.12)]">
            <div className="border-b border-dashed border-[var(--ink)] pb-1 text-[11px] tracking-[0.15em] opacity-70">
              CAPTURED STATEMENT
            </div>
            <div className="mt-2 min-h-[24px] text-[15px] leading-[24px]">
              {transcript || (
                <span className="opacity-50 italic">
                  {supported
                    ? 'Hold REC and say the suspect name.'
                    : 'Speech recognition unavailable. Type the accusation below.'}
                </span>
              )}
              {holding && <span className="cursor-blink ml-1 text-[var(--oxblood)]">_</span>}
            </div>
          </div>

          {!supported && (
            <form onSubmit={submitTextFallback} className="mx-auto mt-5 flex max-w-[560px] gap-2">
              <input
                name="name"
                placeholder="Type the killer's name"
                className="min-w-0 flex-1 border border-[var(--ink)] bg-[var(--paper-card)] px-3 py-2 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--oxblood)]"
              />
              <button
                type="submit"
                className="bg-[var(--ink)] px-4 py-2 text-[11px] tracking-[0.15em] text-[var(--cream-on-dark)]"
              >
                SUBMIT
              </button>
            </form>
          )}

          <div className="mt-8 flex items-center justify-between gap-4 border-t border-[var(--ink)] pt-3 text-[10px] tracking-[0.15em] max-[620px]:flex-col">
            <button type="button" onClick={endInterrogation} className="border border-[var(--ink)] px-3 py-1.5">
              RETURN TO CASE FILE
            </button>
            <span className="opacity-60">PAGE 04 / 04 · CHAIN OF CUSTODY {caseData.case_id}</span>
          </div>

          <div
            className="dossier-stamp"
            style={
              {
                top: 24,
                right: 28,
                '--stamp-rotate': '6deg',
                '--stamp-color': 'var(--oxblood)',
                '--stamp-size': '11px',
              } as CSSProperties
            }
          >
            FINAL
          </div>
        </section>
      </div>
      <div className="dossier-grain" />
    </main>
  );
}
