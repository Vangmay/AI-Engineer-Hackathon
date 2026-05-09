import { useEffect, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { StatusBar } from '@/components/ui/StatusBar';
import { ConsolePanel } from '@/components/ui/ConsolePanel';
import { CornerTicks } from '@/components/ui/CornerTicks';
import { WaveformBar } from '@/components/ui/WaveformBar';
import { WitnessCard } from '@/components/WitnessCard';
import { VictimProfile } from '@/components/VictimProfile';
import { EvidenceList } from '@/components/EvidenceList';

const CALL_911_TRANSCRIPT = [
  { t: 0.0, speaker: 'OPERATOR', text: '911, what is your emergency?' },
  {
    t: 1.3,
    speaker: 'CALLER',
    text:
      "I — I came in to clean and Mr Teo, he's in the bedroom, he's not — he's not breathing, oh god —",
  },
  { t: 5.4, speaker: 'OPERATOR', text: 'Ma’am, I need your address.' },
  {
    t: 6.6,
    speaker: 'CALLER',
    text: 'Marina One, the penthouse, 47-B. Please hurry.',
  },
  {
    t: 9.4,
    speaker: 'OPERATOR',
    text: 'Stay on the line. Do not touch anything. Officers are en route.',
  },
];

export function CaseLoadScreen() {
  const caseData = useGameStore((s) => s.caseData)!;
  const generationMs = useGameStore((s) => s.generationMs);
  const startInterrogation = useGameStore((s) => s.startInterrogation);
  const goToAccusation = useGameStore((s) => s.goToAccusation);

  const [callPlaying, setCallPlaying] = useState(false);
  const [callElapsed, setCallElapsed] = useState(0);

  // Auto-play 911 call 1.5s after mount.
  useEffect(() => {
    const start = setTimeout(() => setCallPlaying(true), 1500);
    return () => clearTimeout(start);
  }, []);

  useEffect(() => {
    if (!callPlaying) return;
    const startedAt = performance.now();
    const id = setInterval(() => {
      const e = (performance.now() - startedAt) / 1000;
      setCallElapsed(e);
      if (e > 14) {
        setCallPlaying(false);
        clearInterval(id);
      }
    }, 80);
    return () => clearInterval(id);
  }, [callPlaying]);

  const visibleLines = CALL_911_TRANSCRIPT.filter((l) => callElapsed >= l.t);

  return (
    <div className="h-full flex flex-col bg-[var(--bg-base)]">
      <StatusBar caseId={caseData.case_id} phase="CASE BRIEFING" />

      <div className="flex-1 grid grid-rows-[55%_45%] overflow-hidden">
        {/* Crime scene image */}
        <div className="relative border-b border-[var(--border-yellow)] overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse at 30% 40%, rgba(214, 196, 64, 0.08), transparent 60%), linear-gradient(160deg, #14110a 0%, #0a0d0b 60%, #050605 100%)',
            }}
          />
          {/* Mock evidence markers */}
          {[
            { id: 1, top: '38%', left: '42%' },
            { id: 2, top: '62%', left: '28%' },
            { id: 3, top: '54%', left: '68%' },
          ].map((m) => (
            <div
              key={m.id}
              className="absolute w-7 h-7 grid place-items-center -translate-x-1/2 -translate-y-1/2"
              style={{ top: m.top, left: m.left }}
            >
              <span className="absolute inset-0 border border-[var(--accent-yellow)]" />
              <span className="absolute -inset-2 border border-[var(--accent-yellow)]/30" />
              <span className="text-[var(--accent-yellow)] text-[11px] font-medium">
                {m.id}
              </span>
            </div>
          ))}
          {/* Victim outline silhouette suggestion */}
          <div
            className="absolute"
            style={{
              top: '35%',
              left: '45%',
              width: '180px',
              height: '60px',
              border: '1px dashed rgba(198, 67, 56, 0.4)',
              transform: 'rotate(-12deg)',
            }}
          />

          {/* Generation badge */}
          <div className="absolute top-4 right-4 px-2.5 py-1 bg-[var(--bg-statusbar)] border border-[var(--accent-yellow)]/50 text-[10px] tracking-[0.2em] text-[var(--accent-yellow)] uppercase">
            <span className="text-[var(--text-faint)] mr-2">◉</span>
            GENERATED IN {((generationMs ?? 8300) / 1000).toFixed(1)}s
          </div>
          <div className="absolute top-4 left-4 px-2.5 py-1 text-[10px] tracking-[0.2em] text-[var(--text-muted)] uppercase">
            SCENE — {caseData.victim.location}
          </div>
          <div className="absolute bottom-4 left-4 right-4 flex justify-between text-[10px] uppercase tracking-[0.2em] text-[var(--text-faint)]">
            <span>FRAME 01 / 03</span>
            <span>{caseData.title}</span>
            <span>EXPOSURE 1/60 · ISO 1600</span>
          </div>
          <CornerTicks size={14} />
        </div>

        {/* Bottom split */}
        <div className="grid grid-cols-[42%_58%] overflow-hidden">
          {/* 911 call panel */}
          <div className="border-r border-[var(--border-yellow)] p-4 flex flex-col gap-3 overflow-hidden">
            <ConsolePanel
              label="911 CALL // 04:22 SGT"
              rightSlot={callPlaying ? '◉ LIVE' : 'PLAYBACK'}
              className="shrink-0"
            >
              <div className="flex items-center gap-3 mb-3">
                <button
                  onClick={() => {
                    setCallPlaying(true);
                    setCallElapsed(0);
                  }}
                  className="w-9 h-9 grid place-items-center border border-[var(--accent-yellow)] text-[var(--accent-yellow)] hover:bg-[var(--accent-yellow)] hover:text-[var(--bg-base)] transition-colors"
                  aria-label="Replay 911 call"
                >
                  ▶
                </button>
                <WaveformBar
                  active={callPlaying}
                  bars={36}
                  height={28}
                  className="flex-1"
                />
                <span className="text-[10px] text-[var(--text-faint)] tabular-nums">
                  {callElapsed.toFixed(1)}s
                </span>
              </div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-faint)] mb-2">
                TRANSCRIPT
              </div>
              <ul className="space-y-2 text-[12px] leading-relaxed max-h-[140px] overflow-y-auto">
                {visibleLines.map((l, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-[var(--accent-yellow)] text-[10px] tracking-[0.18em] w-16 shrink-0">
                      {l.speaker}
                    </span>
                    <span className="text-[var(--text-primary)]">{l.text}</span>
                  </li>
                ))}
              </ul>
            </ConsolePanel>
            <div className="flex-1 min-h-0">
              <EvidenceList clues={caseData.clues} />
            </div>
          </div>

          {/* Right: victim + witnesses */}
          <div className="p-4 grid grid-rows-[auto_1fr_auto] gap-3 overflow-hidden">
            <VictimProfile victim={caseData.victim} />

            <div className="min-h-0 overflow-hidden">
              <div className="flex items-baseline justify-between mb-2 px-1">
                <span className="text-[10px] uppercase tracking-[0.22em] text-[var(--accent-yellow)]">
                  WITNESSES // {caseData.witnesses.length}
                </span>
                <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-faint)]">
                  TAP TO INTERROGATE
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {caseData.witnesses.map((w, i) => (
                  <WitnessCard
                    key={w.id}
                    witness={w}
                    index={i}
                    onSelect={startInterrogation}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-[var(--border-yellow)] pt-3">
              <p className="text-[11px] text-[var(--text-muted)] max-w-[60%] leading-snug">
                {caseData.brief}
              </p>
              <button
                onClick={goToAccusation}
                className="px-4 py-2 bg-[var(--accent-yellow)] text-[var(--bg-base)] text-[11px] uppercase tracking-[0.22em] font-medium hover:bg-[var(--accent-yellow)]/85"
              >
                Make Accusation →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
