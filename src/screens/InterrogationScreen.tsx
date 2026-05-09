import type { CSSProperties } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Evidence3DViewer } from '@/components/Evidence3DViewer';
import type { WitnessQuestionErrorCode } from '@/backend/contracts';
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

const SUGGESTED_PROMPTS: { chip: string; text: string }[] = [
  { chip: 'ALIBI', text: 'Where were you during the killing window?' },
  { chip: 'MOTIVE', text: 'Why would anyone want the victim gone?' },
  { chip: 'RELATIONSHIP', text: 'How did you actually know them day-to-day?' },
];

export function InterrogationScreen() {
  const caseData = useGameStore((s) => s.caseData)!;
  const witnessId = useGameStore((s) => s.activeWitnessId)!;
  const transcript = useGameStore((s) => s.transcript);
  const witnessPortraitUrls = useGameStore((s) => s.witnessPortraitUrls);
  const witnessModelUrls = useGameStore((s) => s.witnessModelUrls);
  const witnessQuestionCounts = useGameStore((s) => s.witnessQuestionCounts);
  const sendWitnessQuestion = useGameStore((s) => s.sendWitnessQuestion);
  const endInterrogation = useGameStore((s) => s.endInterrogation);
  const goToAccusation = useGameStore((s) => s.goToAccusation);
  const witnessIntroAudioUrls = useGameStore((s) => s.witnessIntroAudioUrls);
  const voiceModels = useGameStore((s) => s.voiceModels);
  const introAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isIntroPlaying, setIsIntroPlaying] = useState(false);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const witness = useMemo(
    () => caseData.witnesses.find((w) => w.id === witnessId)!,
    [caseData, witnessId],
  );

  const witnessThread = useMemo(() => {
    return transcript.filter(
      (line) =>
        line.witnessId === witnessId && line.speaker !== 'system',
    );
  }, [transcript, witnessId]);

  const convexMode = !!(import.meta.env.VITE_CONVEX_URL as string | undefined);

  const questionsUsed =
    witnessQuestionCounts?.[witnessId] ??
    witnessThread.filter((line) => line.speaker === 'detective').length;
  const questionsRemaining = Math.max(0, 3 - questionsUsed);

  const introAudioUrl = witnessIntroAudioUrls[witnessId] ?? null;
  const voiceModel = voiceModels[witnessId];

  useEffect(() => {
    setDraft('');
    setBanner(null);
  }, [witnessId]);

  useEffect(() => {
    if (!introAudioUrl) return;
    const audio = new Audio(introAudioUrl);
    introAudioRef.current = audio;
    audio.addEventListener('play', () => setIsIntroPlaying(true));
    audio.addEventListener('pause', () => setIsIntroPlaying(false));
    audio.addEventListener('ended', () => setIsIntroPlaying(false));

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

  const firstName = witness.name.split(' ')[0]?.toUpperCase() ?? witness.name.toUpperCase();
  const portraitUrl = witnessPortraitUrls[witness.id];
  const modelUrl = witnessModelUrls[witness.id];

  const submitQuestion = async (raw: string) => {
    const text = raw.trim();
    if (!text || sending) return;
    if (questionsRemaining <= 0) {
      setBanner('You already used three questions with this witness for this session.');
      return;
    }
    setSending(true);
    setBanner(null);
    const outcome = await sendWitnessQuestion(witnessId, text);
    setSending(false);
    setDraft('');
    if (!outcome.ok) {
      const msgs: Partial<Record<WitnessQuestionErrorCode, string>> = {
        EMPTY_QUESTION: 'Type a question first.',
        LIMIT: 'Interview limit reached: three detective questions per witness.',
        QUESTION_TOO_LONG: 'Question is too long; shorten under 600 characters.',
        NO_API_KEY:
          'Convex needs OPENAI_API_KEY on the deployment for AI personas. Add it in Convex → Settings.',
        NO_SESSION: 'Lost session sync—reload the dossier.',
        NOT_INTERVIEW: 'Open the interrogation booth again from the roster.',
        WRONG_WITNESS: 'Interview state drifted—return to roster and reopen this witness.',
        WITNESS_NOT_FOUND: 'This witness dossier snapshot is stale.',
        LLM_ERROR: outcome.message ?? 'Model call failed.',
      };
      setBanner(msgs[outcome.code] ?? outcome.message ?? 'Could not reach the booth.');
      return;
    }
  };

  const canSend =
    draft.trim().length > 0 && questionsRemaining > 0 && !sending;

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
            <div className="relative h-[380px] w-full overflow-hidden" style={{ background: '#0e110e' }}>
              {modelUrl ? (
                <Evidence3DViewer
                  inline
                  glbUrl={modelUrl}
                  previewUrl={portraitUrl}
                  label={witness.name}
                  description={witness.role}
                />
              ) : portraitUrl ? (
                <img
                  src={portraitUrl}
                  alt={`${witness.name} portrait`}
                  className="h-full w-full object-cover grayscale"
                />
              ) : (
                <div className="photo-ph h-full p-3 text-[11px]">
                  PORTRAIT — {witness.portrait_prompt}
                </div>
              )}
              {modelUrl && (
                <div
                  className="absolute bottom-2 left-2 text-[8px] tracking-[0.15em] pointer-events-none"
                  style={{ color: 'rgba(255,255,255,0.35)' }}
                >
                  DRAG · ROTATE &nbsp;|&nbsp; SCROLL · ZOOM
                </div>
              )}
            </div>
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
                <div className="text-[11px] opacity-70">age {witness.age}</div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={toggleIntroAudio}
                  className="h-10 w-10 rounded-full bg-[#3a342c] text-[16px]"
                  aria-label="Play subject intro"
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
                {witness.profile ?? witness.knows}
              </p>
              {witness.persona && (
                <div className="mt-2 rounded-sm border border-dashed border-[var(--ink)] px-2 py-1.5 text-[11px] leading-[1.5] opacity-75">
                  <span className="mr-1 tracking-[0.12em] opacity-55">PERSONA</span>
                  {witness.persona}
                </div>
              )}
              <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-[var(--ink)] pt-2.5 border-dashed">
                <span className="rounded border border-[var(--ink)] px-2 py-0.5 text-[10px] tracking-[0.12em]">
                  QUESTIONS LEFT · {questionsRemaining} / 3
                </span>
                <span className="text-[10px] tracking-[0.08em] opacity-65">
                  {convexMode
                    ? 'VOICE PROFILE + OPENAI PERSONA (SERVER)'
                    : 'LOCAL HEURISTIC DIALOG · NO LLM ROUTE'}
                </span>
              </div>
              {voiceModel?.providerVoiceId && (
                <div className="mt-2 text-[10px] tracking-[0.08em] opacity-55">
                  ELEVENLABS · {voiceModel.providerVoiceId}
                </div>
              )}
            </div>

    <div className="paper-card lined-paper min-h-[280px] flex-1 flex flex-col p-[14px_18px_16px]">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-dashed border-[var(--ink)] pb-1">
        <div className="text-[12px] tracking-[0.1em]">LIVE TRANSCRIPT</div>
        <div className="text-[10px] tracking-[0.12em] opacity-65">
          {questionsRemaining <= 0
            ? 'INTERVIEW LIMIT REACHED'
            : 'TYPE A QUESTION BELOW'}
        </div>
      </div>
      <div className="mt-1 flex-1 overflow-y-auto text-[12px] leading-[24px] max-h-[320px]">
        {witnessThread.length === 0 && (
          <div className="opacity-50 italic">No questions yet. Open the thread.</div>
        )}
        {witnessThread.map((line, i) => {
          if (line.speaker === 'system') return null;
          const speaker = line.speaker === 'detective' ? 'YOU' : firstName;
          return (
            <div key={`${line.timestamp}-${i}-${line.text.slice(0, 24)}`}>
              <span className="inline-block w-[50px] opacity-60">{speaker}</span>
              {line.text}
            </div>
          );
        })}
      </div>
      {banner && (
        <div className="mt-2 rounded border border-[var(--oxblood)] bg-[rgba(139,58,54,0.08)] px-2 py-1.5 text-[11px] leading-[1.45]">
          {banner}
        </div>
      )}
      <label className="mt-3 block text-[10px] tracking-[0.12em] opacity-70">
        YOUR QUESTION
        <textarea
          className="mt-1 block w-full min-h-[76px] border border-[var(--ink)] bg-[transparent] px-2 py-1.5 text-[12px] leading-[1.45] resize-y outline-none disabled:opacity-45"
          value={draft}
          disabled={sending || questionsRemaining <= 0}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={
            questionsRemaining <= 0
              ? 'No questions remaining for this witness.'
              : 'Ask in character—as the investigator…'
          }
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && canSend) {
              e.preventDefault();
              void submitQuestion(draft);
            }
          }}
        />
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!canSend}
          onClick={() => void submitQuestion(draft)}
          className="bg-[var(--ink)] px-3 py-1.5 text-[10px] tracking-[0.15em] text-[var(--cream-on-dark)] disabled:opacity-40"
        >
          {sending ? 'RECORDING RESPONSE…' : 'SEND TO SUBJECT'}
        </button>
        {questionsRemaining <= 0 && (
          <span className="py-1.5 text-[10px] tracking-[0.12em] opacity-60 uppercase">
            Return to dossier → another witness → accuse when ready.
          </span>
        )}
      </div>
    </div>
          </section >
        </section >

    <footer className="mt-6 flex items-center justify-between gap-4 border-t border-[var(--ink)] pt-2.5 max-[900px]:flex-col max-[900px]:items-start">
      <div className="text-[10px] tracking-[0.15em] opacity-70">
        PROMPT BANK · EACH CHIP FILLS YOUR QUEST FIELD
      </div>
      <div className="flex flex-wrap gap-2">
        {SUGGESTED_PROMPTS.map(({ chip, text }) => (
          <button
            key={chip}
            type="button"
            disabled={questionsRemaining <= 0}
            className="border border-[var(--ink)] px-2 py-1 text-[10px] tracking-[0.15em] disabled:opacity-35"
            onClick={() =>
              questionsRemaining <= 0 ? undefined : setDraft(text)
            }
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
      </div >

      <Stamp text="INTERVIEW IN PROGRESS" top={50} left={880} rotate={4} size={11} />
      <div className="dossier-grain" />
    </main >
  );
}
