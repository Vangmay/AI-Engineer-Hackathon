import { useEffect, useMemo, useRef, useState } from 'react';
import type { WitnessQuestionErrorCode } from '@/backend/contracts';
import { useGameStore } from '@/store/gameStore';

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: {
    resultIndex: number;
    results: ArrayLike<ArrayLike<{ transcript: string }>>;
  }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechCtor = new () => SpeechRecognitionLike;

export function InterrogationScreen() {
  const caseData = useGameStore((s) => s.caseData)!;
  const witnessId = useGameStore((s) => s.activeWitnessId)!;
  const transcript = useGameStore((s) => s.transcript);
  const witnessPortraitUrls = useGameStore((s) => s.witnessPortraitUrls);
  const witnessQuestionCounts = useGameStore((s) => s.witnessQuestionCounts);
  const sendWitnessQuestion = useGameStore((s) => s.sendWitnessQuestion);
  const endInterrogation = useGameStore((s) => s.endInterrogation);
  const goToAccusation = useGameStore((s) => s.goToAccusation);
  const witnessIntroAudioUrls = useGameStore((s) => s.witnessIntroAudioUrls);

  const introAudioRef = useRef<HTMLAudioElement | null>(null);
  const replyAudioRef = useRef<HTMLAudioElement | null>(null);
  const speechRef = useRef<SpeechRecognitionLike | null>(null);
  const autoPlayedReplyTsRef = useRef<number | null>(null);

  const [isIntroPlaying, setIsIntroPlaying] = useState(false);
  const [playingReplyTs, setPlayingReplyTs] = useState<number | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [sending, setSending] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [liveDraft, setLiveDraft] = useState('');

  const witness = useMemo(
    () => caseData.witnesses.find((w) => w.id === witnessId)!,
    [caseData, witnessId],
  );

  const witnessThread = useMemo(
    () =>
      transcript.filter(
        (line) => line.witnessId === witnessId && line.speaker !== 'system',
      ),
    [transcript, witnessId],
  );

  const questionsUsed =
    witnessQuestionCounts?.[witnessId] ??
    witnessThread.filter((line) => line.speaker === 'detective').length;
  const questionsRemaining = Math.max(0, 3 - questionsUsed);
  const introAudioUrl = witnessIntroAudioUrls[witnessId] ?? null;
  const firstName =
    witness.name.split(' ')[0]?.toUpperCase() ?? witness.name.toUpperCase();
  const portraitUrl = witnessPortraitUrls[witness.id] ?? '';

  useEffect(() => {
    setLiveDraft('');
    setBanner(null);
    speechRef.current?.stop();
    setIsListening(false);
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

  useEffect(
    () => () => {
      introAudioRef.current?.pause();
      replyAudioRef.current?.pause();
      speechRef.current?.stop();
    },
    [],
  );

  const toggleIntroAudio = () => {
    const audio = introAudioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play();
    else audio.pause();
  };

  const playReplyAudio = (audioUrl: string, timestamp: number) => {
    replyAudioRef.current?.pause();
    replyAudioRef.current = null;
    const audio = new Audio(audioUrl);
    replyAudioRef.current = audio;
    setPlayingReplyTs(timestamp);
    const clear = () => {
      setPlayingReplyTs((prev) => (prev === timestamp ? null : prev));
      if (replyAudioRef.current === audio) replyAudioRef.current = null;
    };
    audio.addEventListener('ended', clear, { once: true });
    audio.addEventListener('pause', clear, { once: true });
    void audio.play().catch(clear);
  };

  useEffect(() => {
    const latestWitnessLine = [...witnessThread]
      .reverse()
      .find((line) => line.speaker === 'witness' && line.audioUrl?.trim());
    if (!latestWitnessLine?.audioUrl) return;
    if (autoPlayedReplyTsRef.current === latestWitnessLine.timestamp) return;
    autoPlayedReplyTsRef.current = latestWitnessLine.timestamp;
    playReplyAudio(latestWitnessLine.audioUrl, latestWitnessLine.timestamp);
  }, [witnessThread]);

  const askQuestion = async (question: string) => {
    const text = question.trim();
    if (!text || sending) return;
    if (questionsRemaining <= 0) {
      setBanner('Call limit reached for this witness (3 questions).');
      return;
    }
    setSending(true);
    setBanner(null);
    const outcome = await sendWitnessQuestion(witnessId, text);
    setSending(false);
    setLiveDraft('');
    if (!outcome.ok) {
      const msgs: Partial<Record<WitnessQuestionErrorCode, string>> = {
        EMPTY_QUESTION: 'No question captured. Try speaking again.',
        LIMIT: 'Call limit reached for this witness.',
        QUESTION_TOO_LONG: 'Question was too long.',
        NO_API_KEY: 'Backend missing OPENAI_API_KEY.',
        NO_SESSION: 'Session out of sync. Reopen interview.',
        NOT_INTERVIEW: 'Interview not active.',
        WRONG_WITNESS: 'Witness call desynced. Reopen interview.',
        WITNESS_NOT_FOUND: 'Witness not found in active case snapshot.',
        LLM_ERROR: outcome.message ?? 'Model call failed.',
      };
      setBanner(msgs[outcome.code] ?? outcome.message ?? 'Call failed.');
    }
  };

  const toggleVoiceInput = () => {
    const speechApi = window as unknown as {
      SpeechRecognition?: SpeechCtor;
      webkitSpeechRecognition?: SpeechCtor;
    };
    const Ctor = speechApi.SpeechRecognition || speechApi.webkitSpeechRecognition;
    if (!Ctor) {
      setBanner('Voice input is not supported in this browser.');
      return;
    }

    if (isListening && speechRef.current) {
      speechRef.current.stop();
      setIsListening(false);
      return;
    }

    const recognition = new Ctor();
    speechRef.current = recognition;
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;
    let finalText = '';
    recognition.onresult = (event) => {
      let text = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        text += event.results[i]?.[0]?.transcript ?? '';
      }
      finalText = text.trim();
      setLiveDraft(finalText);
    };
    recognition.onerror = (event) => {
      setBanner(`Voice input error: ${event.error}`);
      setIsListening(false);
    };
    recognition.onend = () => {
      setIsListening(false);
      if (finalText.trim().length > 0) void askQuestion(finalText);
    };
    setBanner(null);
    setIsListening(true);
    recognition.start();
  };

  return (
    <main className="dossier-page">
      <div className="dossier-artboard min-h-screen !pb-[36px]">
        <header className="dossier-header">
          <div className="dossier-overline">Secure Voice Call · {caseData.case_id}</div>
          <div className="flex items-center gap-3 text-[12px]">
            <span>{isListening ? 'LISTENING…' : sending ? 'PROCESSING…' : 'LIVE CALL'}</span>
            <button
              type="button"
              onClick={endInterrogation}
              className="border border-[var(--ink)] px-2.5 py-1 text-[10px] tracking-[0.15em]"
            >
              HANG UP
            </button>
          </div>
        </header>

        <section className="mt-5 grid grid-cols-[1.1fr_1fr] gap-6 max-[900px]:grid-cols-1">
          <section className="paper-card p-4">
            <div className="text-[10px] tracking-[0.12em] opacity-65">CONNECTED TO</div>
            <h2 className="mt-1 text-[24px]">{witness.name}</h2>
            <div className="text-[12px] opacity-70">
              {witness.role || witness.category || 'Witness'} · age {witness.age}
            </div>
            <div className="mt-4 h-[380px] overflow-hidden rounded-sm bg-[#111]">
              {portraitUrl ? (
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
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={toggleVoiceInput}
                disabled={questionsRemaining <= 0 || sending}
                className="bg-[var(--ink)] px-3 py-1.5 text-[10px] tracking-[0.15em] text-[var(--cream-on-dark)] disabled:opacity-40"
              >
                {isListening ? 'STOP TALKING' : 'TALK TO SUBJECT'}
              </button>
              <button
                type="button"
                onClick={toggleIntroAudio}
                className="border border-[var(--ink)] px-3 py-1.5 text-[10px] tracking-[0.15em]"
              >
                {isIntroPlaying ? 'STOP INTRO' : 'PLAY INTRO'}
              </button>
              <button
                type="button"
                onClick={goToAccusation}
                className="border border-[var(--oxblood)] px-3 py-1.5 text-[10px] tracking-[0.15em] text-[var(--oxblood)]"
              >
                FILE ACCUSATION
              </button>
            </div>
            <div className="mt-2 text-[11px] opacity-65">
              Questions left for this call: {questionsRemaining} / 3
            </div>
            {liveDraft && (
              <div className="mt-2 rounded border border-dashed border-[var(--ink)] px-2 py-1 text-[11px] opacity-75">
                Captured speech: "{liveDraft}"
              </div>
            )}
            {banner && (
              <div className="mt-2 rounded border border-[var(--oxblood)] bg-[rgba(139,58,54,0.08)] px-2 py-1.5 text-[11px]">
                {banner}
              </div>
            )}
          </section>

          <section className="paper-card lined-paper min-h-[520px] p-[14px_18px_16px]">
            <div className="flex items-center justify-between border-b border-dashed border-[var(--ink)] pb-1">
              <div className="text-[12px] tracking-[0.1em]">CALL TRANSCRIPT</div>
              <div className="text-[10px] tracking-[0.12em] opacity-65">
                {witnessThread.length > 0 ? 'LIVE UPDATES' : 'SHOWS AFTER EXCHANGES'}
              </div>
            </div>
            <div className="mt-2 max-h-[470px] overflow-y-auto text-[12px] leading-[1.8]">
              {witnessThread.length === 0 && (
                <div className="opacity-50 italic">
                  Transcript will appear after you talk to the subject.
                </div>
              )}
              {witnessThread.map((line, i) => {
                const speaker = line.speaker === 'detective' ? 'YOU' : firstName;
                return (
                  <div key={`${line.timestamp}-${i}`} className="mb-1.5 flex items-start gap-2">
                    <span className="inline-block w-[56px] shrink-0 opacity-60">{speaker}</span>
                    <span className="min-w-0 flex-1">{line.text}</span>
                    {line.speaker === 'witness' && line.audioUrl && (
                      <button
                        type="button"
                        onClick={() => playReplyAudio(line.audioUrl!, line.timestamp)}
                        className="shrink-0 rounded border border-[var(--ink)] px-1.5 py-0.5 text-[9px] tracking-[0.08em]"
                      >
                        {playingReplyTs === line.timestamp ? 'PLAYING' : 'PLAY'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </section>
      </div>
      <div className="dossier-grain" />
    </main>
  );
}
