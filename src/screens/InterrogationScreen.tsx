import type { CSSProperties } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import type { TranscriptLine } from '@/types/case';

function stubConversation(witnessId: string): TranscriptLine[] {
  const base = Date.now();
  switch (witnessId) {
    case 'person_w_priya':
    case 'w_priya':
      return [
        { speaker: 'detective', text: 'Where were you between two and three this morning?', timestamp: base },
        { speaker: 'witness', text: 'Asleep. At home. I dropped Mr Teo off after dinner and went straight back.', timestamp: base + 1 },
        { speaker: 'detective', text: 'The lobby cam puts you in the building at three twelve.', timestamp: base + 2 },
        { speaker: 'witness', text: '... I came back. He texted me. He wanted his calendar updated.', timestamp: base + 3 },
      ];
    case 'person_w_marcus':
    case 'w_marcus':
      return [
        { speaker: 'detective', text: 'Anything unusual on your shift?', timestamp: base },
        { speaker: 'witness', text: "A van I didn't have on the manifest. And Ms Naidu left around three.", timestamp: base + 1 },
        { speaker: 'detective', text: 'She normally leaves earlier?', timestamp: base + 2 },
        { speaker: 'witness', text: 'Eight, nine PM at the latest. Three is not normal.', timestamp: base + 3 },
      ];
    default:
      return [
        { speaker: 'detective', text: 'When did you last speak to Raymond?', timestamp: base },
        { speaker: 'witness', text: 'Two days ago. He sounded relieved. Said he was finally going to deal with a staff problem.', timestamp: base + 1 },
        { speaker: 'detective', text: 'Did he name the staff member?', timestamp: base + 2 },
        { speaker: 'witness', text: 'No. Raymond liked people to wonder what he knew.', timestamp: base + 3 },
      ];
  }
}

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

function LiveWaveform() {
  return (
    <svg width="100%" height="56" viewBox="0 0 480 56" aria-hidden="true">
      {Array.from({ length: 96 }).map((_, i) => {
        const h =
          4 +
          Math.abs(
            Math.sin(i * 0.42) * Math.cos(i * 0.18 + 1) +
              0.3 * Math.sin(i * 1.1),
          ) *
            22;
        return (
          <rect
            key={i}
            x={i * 5}
            y={(56 - h) / 2}
            width="3"
            height={h}
            fill="var(--ink)"
            opacity={0.85}
          />
        );
      })}
    </svg>
  );
}

export function InterrogationScreen() {
  const caseData = useGameStore((s) => s.caseData)!;
  const witnessId = useGameStore((s) => s.activeWitnessId)!;
  const transcript = useGameStore((s) => s.transcript);
  const witnessPortraitUrls = useGameStore((s) => s.witnessPortraitUrls);
  const appendTranscript = useGameStore((s) => s.appendTranscript);
  const endInterrogation = useGameStore((s) => s.endInterrogation);
  const goToAccusation = useGameStore((s) => s.goToAccusation);
  const witnessIntroAudioUrls = useGameStore((s) => s.witnessIntroAudioUrls);
  const voiceModels = useGameStore((s) => s.voiceModels);
  const introAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isIntroPlaying, setIsIntroPlaying] = useState(false);

  const witness = useMemo(
    () => caseData.witnesses.find((w) => w.id === witnessId)!,
    [caseData, witnessId],
  );
  const introAudioUrl = witnessIntroAudioUrls[witnessId] ?? null;
  const voiceModel = voiceModels[witnessId];

  useEffect(() => {
    let cancelled = false;
    const timeouts: number[] = [];
    const lines = stubConversation(witnessId);
    let i = 0;
    const tick = () => {
      if (cancelled || i >= lines.length) return;
      appendTranscript(lines[i]);
      i += 1;
      timeouts.push(window.setTimeout(tick, 1800 + Math.random() * 700));
    };
    timeouts.push(window.setTimeout(tick, 600));
    return () => {
      cancelled = true;
      timeouts.forEach((id) => window.clearTimeout(id));
    };
  }, [witnessId, appendTranscript]);

  useEffect(() => {
    if (!introAudioUrl) return;
    const audio = new Audio(introAudioUrl);
    introAudioRef.current = audio;
    audio.addEventListener('play', () => setIsIntroPlaying(true));
    audio.addEventListener('pause', () => setIsIntroPlaying(false));
    audio.addEventListener('ended', () => setIsIntroPlaying(false));
    void audio.play().catch(() => {
      setIsIntroPlaying(false);
    });

    return () => {
      audio.pause();
      audio.currentTime = 0;
      introAudioRef.current = null;
    };
  }, [introAudioUrl]);

  const toggleIntroAudio = () => {
    const audio = introAudioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play();
    } else {
      audio.pause();
    }
  };

  const firstName = witness.name.split(' ')[0].toUpperCase();
  const portraitUrl = witnessPortraitUrls[witness.id];

  return (
    <main className="dossier-page">
      <div className="dossier-artboard min-h-screen !pb-[40px]">
        <header className="dossier-header">
          <div className="dossier-overline">Interview Recording · {caseData.case_id}</div>
          <div className="flex flex-wrap items-center justify-end gap-4 text-[12px]">
            <button
              type="button"
              onClick={endInterrogation}
              className="border border-[var(--ink)] px-2.5 py-1 text-[10px] tracking-[0.15em]"
            >
              RETURN TO CASE FILE
            </button>
            <span>REC 00:04:17</span>
            <span>TAPE 02 / SIDE A</span>
          </div>
        </header>

        <section className="mt-[18px] grid grid-cols-[1.05fr_1fr] gap-7 max-[900px]:grid-cols-1">
          <section className="paper-card lifted p-3.5">
            <div className="tape-corner left" />
            <div className="tape-corner right" />
            {portraitUrl ? (
              <img
                src={portraitUrl}
                alt={`${witness.name} generated witness portrait`}
                className="h-[380px] w-full object-cover grayscale"
              />
            ) : (
              <div className="photo-ph h-[380px] p-3 text-[11px]">
                PORTRAIT — {witness.portrait_prompt}
              </div>
            )}
            <Stamp
              text={witness.lies ? 'INCONSISTENT' : 'COOPERATIVE'}
              top={20}
              left={witness.lies ? 230 : 240}
              rotate={-7}
              color={witness.lies ? 'var(--oxblood)' : 'var(--ink)'}
              size={11}
            />
            <div className="mt-2.5 text-[11px] opacity-70">
              SUBJECT PHOTOGRAPH · {witness.name.toUpperCase()} · INTAKE 23:58 SGT
            </div>
            <div className="mt-2.5 flex items-center justify-between bg-[var(--ink)] p-[10px_12px] text-[var(--cream-on-dark)]">
              <div>
                <div className="text-[10px] tracking-[0.15em] opacity-[0.65]">
                  LIVE INTERVIEW
                </div>
                <div className="mt-0.5 text-[18px]">{witness.name}</div>
                <div className="text-[11px] opacity-70">
                  {witness.role} · age {witness.age}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={toggleIntroAudio}
                  className="h-10 w-10 rounded-full bg-[#3a342c] text-[16px]"
                  aria-label="Play witness intro"
                >
                  {isIntroPlaying ? '⏸' : '▶'}
                </button>
                <button
                  type="button"
                  onClick={endInterrogation}
                  className="h-10 w-10 rounded-full bg-[var(--oxblood)] text-[14px]"
                >
                  END
                </button>
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-3.5">
            <div className="paper-card p-[14px_16px]">
              <div className="dossier-overline">Subject File</div>
              <h2 className="mt-0.5 text-[22px]">{witness.name}</h2>
              <p className="mt-1.5 text-[12px] leading-[1.55] opacity-75">
                {witness.knows}
              </p>
              <div className="mt-2.5 text-[10px] tracking-[0.1em] opacity-60">
                VOICE · ELEVENLABS PROFILE (TEXT-TO-VOICE)
              </div>
              {voiceModel?.providerVoiceId && (
                <div className="mt-1 text-[10px] tracking-[0.08em] opacity-55">
                  PROVIDER VOICE ID · {voiceModel.providerVoiceId}
                </div>
              )}
            </div>

            <div className="paper-card p-[12px_14px]">
              <div className="flex justify-between text-[10px] tracking-[0.15em] opacity-60">
                <span>● LIVE · GEMINI VOICE LINK</span>
                <span>SUBJECT SPEAKING</span>
              </div>
              <div className="mt-1.5">
                <LiveWaveform />
              </div>
            </div>

            <div className="paper-card lined-paper min-h-[250px] flex-1 p-[14px_18px_16px]">
              <div className="border-b border-dashed border-[var(--ink)] pb-1 text-[12px] tracking-[0.1em]">
                LIVE TRANSCRIPT
              </div>
              <div className="mt-1 text-[12px] leading-[24px]">
                {transcript.map((line, i) => {
                  if (line.speaker === 'system') return null;
                  const speaker = line.speaker === 'detective' ? 'YOU' : firstName;
                  return (
                    <div key={`${line.timestamp}-${i}`}>
                      <span className="inline-block w-[50px] opacity-60">
                        {speaker}
                      </span>
                      {line.text}
                    </div>
                  );
                })}
                <div className="opacity-45 italic">· · · subject pause, 1.4s · · ·</div>
              </div>
            </div>
          </section>
        </section>

        <footer className="mt-6 flex items-center justify-between gap-4 border-t border-[var(--ink)] pt-2.5 max-[900px]:flex-col max-[900px]:items-start">
          <div className="text-[10px] tracking-[0.15em] opacity-70">
            ASK A QUESTION · OR TAP A SUGGESTED LINE BELOW
          </div>
          <div className="flex flex-wrap gap-2">
            {['ALIBI', 'MOTIVE', 'RELATIONSHIP'].map((chip) => (
              <button
                key={chip}
                type="button"
                className="border border-[var(--ink)] px-2 py-1 text-[10px] tracking-[0.15em]"
              >
                {chip}
              </button>
            ))}
            <button
              type="button"
              onClick={endInterrogation}
              className="border border-[var(--ink)] px-2 py-1 text-[10px] tracking-[0.15em]"
            >
              RETURN TO CASE FILE
            </button>
            <button
              type="button"
              onClick={goToAccusation}
              className="bg-[var(--oxblood)] px-2 py-1 text-[10px] tracking-[0.15em] text-[var(--cream-on-dark)]"
            >
              READY TO ACCUSE →
            </button>
          </div>
        </footer>
      </div>

      <Stamp text="INTERVIEW IN PROGRESS" top={50} left={880} rotate={4} size={11} />
      <div className="dossier-grain" />
    </main>
  );
}
