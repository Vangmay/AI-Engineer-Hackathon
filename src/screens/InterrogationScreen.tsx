import { useEffect, useMemo, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { StatusBar } from '@/components/ui/StatusBar';
import { ConsolePanel } from '@/components/ui/ConsolePanel';
import { CornerTicks } from '@/components/ui/CornerTicks';
import { WaveformBar } from '@/components/ui/WaveformBar';
import { TranscriptFeed } from '@/components/TranscriptFeed';
import type { TranscriptLine } from '@/types/case';

// Stub conversation — replaced by Gemini flash-3.1-live in step 2.
function stubConversation(witnessId: string): TranscriptLine[] {
  const base = Date.now();
  switch (witnessId) {
    case 'w_priya':
      return [
        { speaker: 'system', text: 'Call connected · 04:51 SGT', timestamp: base },
        { speaker: 'detective', text: 'Where were you between two and three this morning?', timestamp: base + 1 },
        { speaker: 'witness', text: 'Asleep. At home. I dropped Mr Teo off after dinner and went straight back.', timestamp: base + 2 },
        { speaker: 'detective', text: 'The lobby cam puts you in the building at three twelve.', timestamp: base + 3 },
        { speaker: 'witness', text: '... I came back. He texted me. He wanted his calendar updated.', timestamp: base + 4 },
      ];
    case 'w_marcus':
      return [
        { speaker: 'system', text: 'Call connected · 04:54 SGT', timestamp: base },
        { speaker: 'detective', text: 'Anything unusual on your shift?', timestamp: base + 1 },
        { speaker: 'witness', text: 'A van I didn’t have on the manifest. And Ms Naidu left around three.', timestamp: base + 2 },
        { speaker: 'detective', text: 'She normally leaves earlier?', timestamp: base + 3 },
        { speaker: 'witness', text: 'Eight, nine PM at the latest. Three is — three is not normal.', timestamp: base + 4 },
      ];
    default:
      return [
        { speaker: 'system', text: 'Call connected', timestamp: base },
        { speaker: 'detective', text: 'When did you last speak to Raymond?', timestamp: base + 1 },
        { speaker: 'witness', text: 'Two days ago. He sounded — relieved. Said he was finally going to deal with a staff problem.', timestamp: base + 2 },
      ];
  }
}

export function InterrogationScreen() {
  const caseData = useGameStore((s) => s.caseData)!;
  const witnessId = useGameStore((s) => s.activeWitnessId)!;
  const transcript = useGameStore((s) => s.transcript);
  const appendTranscript = useGameStore((s) => s.appendTranscript);
  const endInterrogation = useGameStore((s) => s.endInterrogation);

  const witness = useMemo(
    () => caseData.witnesses.find((w) => w.id === witnessId)!,
    [caseData, witnessId],
  );

  // Drip-feed stub lines on a timer.
  const cancelled = useRef(false);
  useEffect(() => {
    cancelled.current = false;
    const lines = stubConversation(witnessId);
    let i = 0;
    const tick = () => {
      if (cancelled.current || i >= lines.length) return;
      appendTranscript(lines[i]);
      i += 1;
      setTimeout(tick, 1800 + Math.random() * 700);
    };
    setTimeout(tick, 600);
    return () => {
      cancelled.current = true;
    };
  }, [witnessId, appendTranscript]);

  const witnessSpeaking =
    transcript.length > 0 && transcript[transcript.length - 1].speaker === 'witness';

  const initials = witness.name.split(' ').map((n) => n[0]).slice(0, 2).join('');

  return (
    <div className="h-full flex flex-col bg-[var(--bg-base)]">
      <StatusBar caseId={caseData.case_id} phase={`INTERROGATION // ${witness.id.toUpperCase()}`} />

      <div className="flex-1 grid grid-cols-[1fr_420px] overflow-hidden">
        {/* Left: avatar + waveform */}
        <div className="relative grid place-items-center overflow-hidden">
          <div className="absolute inset-0 opacity-40"
            style={{ background: 'radial-gradient(ellipse at center, rgba(214, 196, 64, 0.12), transparent 60%)' }} />
          <div className="relative w-[360px] flex flex-col items-center">
            <div
              className="relative w-[320px] h-[320px] mb-8 grid place-items-center overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #2a261a 0%, #14110a 100%)',
                border: '1px solid var(--border-strong)',
              }}
            >
              <CornerTicks size={16} />
              <span className="text-[120px] font-light text-[var(--text-primary)]/40">
                {initials}
              </span>
              <div className="absolute top-3 left-3 text-[10px] tracking-[0.22em] text-[var(--accent-yellow)]">
                LIVE FEED
              </div>
              <div className="absolute top-3 right-3 flex items-center gap-1.5 text-[10px] tracking-[0.22em] text-[var(--accent-red)]">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent-red)] pulse-yellow" />
                REC
              </div>
            </div>
            <WaveformBar active={witnessSpeaking} bars={64} height={42} className="w-full" />
            <div className="mt-6 text-center">
              <div className="text-2xl font-light text-[var(--text-primary)]">{witness.name}</div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--text-muted)] mt-1">
                {witness.role} · {witness.age}
              </div>
            </div>
          </div>

          <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between">
            <button
              onClick={endInterrogation}
              className="px-4 py-2 border border-[var(--border-yellow)] text-[var(--text-muted)] text-[11px] uppercase tracking-[0.22em] hover:text-[var(--accent-yellow)] hover:border-[var(--accent-yellow)]"
            >
              ← Back to brief
            </button>
            <button
              onClick={endInterrogation}
              className="px-4 py-2 bg-[var(--accent-red)] text-[var(--text-primary)] text-[11px] uppercase tracking-[0.22em] font-medium hover:opacity-90"
            >
              End Call
            </button>
          </div>
        </div>

        {/* Right: transcript */}
        <div className="border-l border-[var(--border-yellow)] p-4 flex flex-col gap-3 overflow-hidden">
          <ConsolePanel label="LIVE TRANSCRIPT" rightSlot={`${transcript.length} LINES`}>
            <TranscriptFeed lines={transcript} className="max-h-[44vh]" />
          </ConsolePanel>
          <ConsolePanel label="WITNESS DOSSIER">
            <dl className="space-y-2 text-[12px]">
              <div>
                <dt className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-faint)]">Known to investigators</dt>
                <dd className="text-[var(--text-primary)]">{witness.knows}</dd>
              </div>
              <div className="pt-2 border-t border-[var(--border-yellow)]">
                <dt className="text-[10px] uppercase tracking-[0.18em] text-[var(--accent-red)]/80">Suspected concealment</dt>
                <dd className="text-[var(--text-muted)] italic">[determined post-interview]</dd>
              </div>
            </dl>
          </ConsolePanel>
        </div>
      </div>
    </div>
  );
}
