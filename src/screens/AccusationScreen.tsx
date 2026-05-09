import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { StatusBar } from '@/components/ui/StatusBar';
import { CornerTicks } from '@/components/ui/CornerTicks';
import { WaveformBar } from '@/components/ui/WaveformBar';

// Web Speech API typings are unstable; use loose any-cast.
type SR = any;

export function AccusationScreen() {
  const caseData = useGameStore((s) => s.caseData)!;
  const submitAccusation = useGameStore((s) => s.submitAccusation);
  const endInterrogation = useGameStore((s) => s.endInterrogation);

  const [holding, setHolding] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [supported, setSupported] = useState(true);
  const recRef = useRef<SR | null>(null);

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: SR;
      webkitSpeechRecognition?: SR;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      setSupported(false);
      return;
    }
    const rec = new Ctor();
    rec.lang = 'en-SG';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e: any) => {
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
      try { rec.stop(); } catch { /* noop */ }
    };
  }, []);

  const start = () => {
    setTranscript('');
    setHolding(true);
    try { recRef.current?.start(); } catch { /* already started */ }
  };

  const stop = () => {
    setHolding(false);
    try { recRef.current?.stop(); } catch { /* noop */ }
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
    <div className="h-full flex flex-col bg-[var(--bg-base)]">
      <StatusBar caseId={caseData.case_id} phase="ACCUSATION" />

      <div className="flex-1 grid place-items-center px-6">
        <div className="w-full max-w-[640px] flex flex-col items-center text-center">
          <div className="text-[10px] uppercase tracking-[0.32em] text-[var(--text-faint)] mb-3">
            FORMAL ACCUSATION · ON THE RECORD
          </div>
          <h1 className="text-[28px] font-light text-[var(--accent-yellow)] tracking-[0.18em] uppercase mb-10">
            Speak the name of the killer
          </h1>

          <div className="relative w-[200px] h-[200px] mb-8 grid place-items-center">
            <CornerTicks size={18} />
            <button
              onMouseDown={start}
              onMouseUp={stop}
              onMouseLeave={() => holding && stop()}
              onTouchStart={start}
              onTouchEnd={stop}
              disabled={!supported}
              className={`w-[140px] h-[140px] rounded-full grid place-items-center text-4xl border transition-all select-none ${
                holding
                  ? 'bg-[var(--accent-red)] border-[var(--accent-red)] text-[var(--text-primary)] scale-105'
                  : 'bg-[var(--bg-panel)] border-[var(--accent-yellow)] text-[var(--accent-yellow)] hover:bg-[var(--accent-yellow)]/10'
              }`}
            >
              ◉
            </button>
          </div>

          <div className="w-full mb-6">
            <WaveformBar active={holding} bars={56} height={32} />
          </div>

          <div className="min-h-[60px] w-full mb-6 px-4 py-3 border border-[var(--border-yellow)] bg-[var(--bg-panel)] text-left">
            <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-faint)] mb-1">
              CAPTURED
            </div>
            <div className="text-[15px] text-[var(--text-primary)] min-h-[20px]">
              {transcript || (
                <span className="text-[var(--text-faint)] italic">
                  {supported ? 'Hold the button and say the name…' : 'Speech recognition unavailable in this browser.'}
                </span>
              )}
              {holding && <span className="cursor-blink ml-1 text-[var(--accent-yellow)]">_</span>}
            </div>
          </div>

          {!supported && (
            <form onSubmit={submitTextFallback} className="w-full flex gap-2 mb-6">
              <input
                name="name"
                placeholder="Type the killer's name"
                className="flex-1 px-3 py-2 bg-[var(--bg-panel)] border border-[var(--border-yellow)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-yellow)]"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-[var(--accent-yellow)] text-[var(--bg-base)] text-[11px] uppercase tracking-[0.22em]"
              >
                Submit
              </button>
            </form>
          )}

          <button
            onClick={endInterrogation}
            className="text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)] hover:text-[var(--accent-yellow)]"
          >
            ← Return to brief
          </button>
        </div>
      </div>
    </div>
  );
}
