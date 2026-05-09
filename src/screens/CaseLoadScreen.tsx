import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Evidence3DViewer } from '@/components/Evidence3DViewer';
import { Scene3DViewer } from '@/components/Scene3DViewer';
import { useGameStore } from '@/store/gameStore';
import type { Call911Line } from '@/types/case';

const DEFAULT_911_TRANSCRIPT: Call911Line[] = [
  { who: 'DISP', text: "Nine-one-one, what's your emergency?" },
  { who: 'CALL', text: "I-- I think Ray is dead. He's not breathing. Oh god." },
  { who: 'DISP', text: "Ma'am, where are you?" },
  {
    who: 'CALL',
    text: 'Marina One penthouse. Forty-seventh floor. Please hurry.',
  },
  { who: 'DISP', text: 'Stay on the line. Is anyone else with you?' },
  { who: 'CALL', text: 'No. The apartment is empty. Everyone left hours ago.' },
];

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

function WitnessFacts({
  witness,
}: {
  witness: {
    age: number;
    sex?: string;
    occupation?: string;
    residence?: string;
    relationship_to_victim?: string;
  };
}) {
  const facts = [
    ['AGE', String(witness.age)],
    ['SEX', witness.sex],
    ['OCCUPATION', witness.occupation],
    ['RESIDENCE', witness.residence],
    ['CONNECTION', witness.relationship_to_victim],
  ].filter(([, value]) => Boolean(value));

  return (
    <dl className="mt-1.5 grid grid-cols-[78px_1fr] gap-x-2 gap-y-0.5 text-[10px] leading-snug opacity-[0.68]">
      {facts.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="tracking-[0.12em] opacity-[0.7]">
            {label}
          </dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function WitnessProfileNotes({
  witness,
}: {
  witness: {
    role: string;
    profile?: string;
    knows: string;
    hiding: string;
  };
}) {
  return (
    <div className="mt-2.5 space-y-1.5 text-[10px] leading-[1.45]">
      {witness.role && (
        <div>
          <span className="mr-1 tracking-[0.12em] opacity-[0.55]">ROLE</span>
          <span className="opacity-[0.75]">{witness.role}</span>
        </div>
      )}
      {witness.profile && (
        <div>
          <span className="mr-1 tracking-[0.12em] opacity-[0.55]">PROFILE</span>
          <span className="opacity-[0.72]">{witness.profile}</span>
        </div>
      )}
      <div>
        <span className="mr-1 tracking-[0.12em] opacity-[0.55]">KNOWS</span>
        <span className="opacity-[0.72]">{witness.knows}</span>
      </div>
      <div>
        <span className="mr-1 tracking-[0.12em] opacity-[0.55]">WITHHOLDS</span>
        <span className="opacity-[0.72]">{witness.hiding}</span>
      </div>
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

function formatPlaybackTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const remainder = wholeSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function Waveform({ progress = 0 }: { progress?: number }) {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  return (
    <svg width="320" height="28" viewBox="0 0 320 28" aria-hidden="true">
      {Array.from({ length: 64 }).map((_, i) => {
        const h = 4 + Math.abs(Math.sin(i * 0.6) * Math.cos(i * 0.15)) * 22;
        const barProgress = i / 63;
        return (
          <rect
            key={i}
            x={i * 5}
            y={(28 - h) / 2}
            width="2.5"
            height={h}
            fill="var(--ink)"
            opacity={barProgress <= clampedProgress ? 1 : 0.28}
          />
        );
      })}
      <line
        x1={clampedProgress * 320}
        x2={clampedProgress * 320}
        y1="1"
        y2="27"
        stroke="var(--oxblood)"
        strokeWidth="2"
      />
    </svg>
  );
}

export function CaseLoadScreen() {
  const caseData = useGameStore((s) => s.caseData)!;
  const call911Lines: Call911Line[] =
    caseData.call911_transcript && caseData.call911_transcript.length > 0
      ? caseData.call911_transcript
      : DEFAULT_911_TRANSCRIPT;
  const generationMs = useGameStore((s) => s.generationMs);
  const sceneImageUrl = useGameStore((s) => s.sceneImageUrl);
  const sceneModelUrl = useGameStore((s) => s.sceneModelUrl);
  const call911AudioUrl = useGameStore((s) => s.call911AudioUrl);
  const witnessPortraitUrls = useGameStore((s) => s.witnessPortraitUrls);
  const evidenceImageUrls = useGameStore((s) => s.evidenceImageUrls);
  const evidenceModelUrls = useGameStore((s) => s.evidenceModelUrls);
  const evidenceModelPreviewUrls = useGameStore((s) => s.evidenceModelPreviewUrls);
  const startInterrogation = useGameStore((s) => s.startInterrogation);
  const goToAccusation = useGameStore((s) => s.goToAccusation);
  const investigateNewCase = useGameStore((s) => s.investigateNewCase);

  const [activeModel, setActiveModel] = useState<number | null>(null);
  const [isPlaying911, setIsPlaying911] = useState(false);
  const [call911CurrentTime, setCall911CurrentTime] = useState(0);
  const [call911Duration, setCall911Duration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const generatedIn = `${((generationMs ?? 8300) / 1000).toFixed(1)}s`;
  const suspects = caseData.witnesses.filter((entry) => entry.category === 'suspect');
  const witnesses = caseData.witnesses.filter((entry) => entry.category !== 'suspect');
  const leadSheetItems = [
    `Victim ${caseData.victim.name}, ${caseData.victim.age}, was found at ${caseData.victim.location}.`,
    `Estimated incident window centers around ${caseData.victim.time_of_death}.`,
    ...caseData.clues.slice(0, 2).map((clue) => clue),
    ...caseData.witnesses.slice(0, 2).map((w) => `${w.name} reports: ${w.knows}`),
  ];

  useEffect(() => {
    if (!call911AudioUrl) return;
    const audio = new Audio(call911AudioUrl);
    audioRef.current = audio;
    audio.addEventListener('play', () => setIsPlaying911(true));
    audio.addEventListener('pause', () => setIsPlaying911(false));
    audio.addEventListener('ended', () => {
      setIsPlaying911(false);
      setCall911CurrentTime(audio.duration || 0);
    });
    audio.addEventListener('loadedmetadata', () => {
      setCall911Duration(audio.duration || 0);
    });
    audio.addEventListener('timeupdate', () => {
      setCall911CurrentTime(audio.currentTime || 0);
    });
    setIsPlaying911(false);
    setCall911CurrentTime(0);
    setCall911Duration(0);

    return () => {
      audio.pause();
      audio.currentTime = 0;
      audioRef.current = null;
    };
  }, [call911AudioUrl]);

  const toggle911Audio = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play();
    } else {
      audio.pause();
    }
  };

  const call911Progress =
    call911Duration > 0 ? Math.min(1, call911CurrentTime / call911Duration) : 0;

  return (
    <main className="dossier-page">
      <div className="dossier-tab" />
      <div className="dossier-artboard">
        <header className="dossier-header">
          <div>
            <div className="dossier-overline">
              Singapore Police Force · Criminal Investigation Department
            </div>
            <h1 className="dossier-title">
              CASE FILE — {caseData.title.toUpperCase()}
            </h1>
          </div>
          <div className="text-right text-[12px] leading-normal">
            <div>FILE NO. {caseData.case_id}</div>
            <div>OPENED {caseData.victim.date.toUpperCase()}</div>
            <div>STATUS · ACTIVE</div>
            <button
              type="button"
              onClick={() => void investigateNewCase()}
              className="mt-2 border border-[var(--ink)] bg-[var(--paper)] px-3 py-1.5 text-[10px] tracking-[0.15em]"
            >
              INVESTIGATE NEW CASE
            </button>
            <button
              type="button"
              onClick={goToAccusation}
              className="mt-2 bg-[var(--oxblood)] px-3 py-1.5 text-[10px] tracking-[0.15em] text-[var(--cream-on-dark)]"
            >
              FILE ACCUSATION →
            </button>
          </div>
        </header>

        {/* Hero: crime scene left, key evidence right */}
        <section className="mt-[22px] grid grid-cols-[1.6fr_1fr] gap-4 max-[900px]:grid-cols-1">
          {/* Crime scene 3D */}
          <div className="paper-card lifted p-[12px_12px_8px] relative">
            <div className="tape-corner left" />
            <div className="tape-corner right" />
            <div className="overflow-hidden" style={{ height: 400 }}>
              {sceneModelUrl ? (
                <Scene3DViewer glbUrl={sceneModelUrl} previewUrl={sceneImageUrl ?? undefined} />
              ) : sceneImageUrl ? (
                <img
                  src={sceneImageUrl}
                  alt={`Crime scene — ${caseData.title}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="photo-ph h-full text-[11px] leading-relaxed">
                  CRIME SCENE — {caseData.victim.location.toUpperCase()}
                </div>
              )}
            </div>
            <div className="mt-1.5 flex justify-between gap-4 text-[9px] opacity-60">
              <span>EXHIBIT A · CRIME SCENE · HIGHWAY 37 HASTINGS COUNTY</span>
              <span>DRAG · ROTATE | SCROLL · ZOOM</span>
            </div>
            <Stamp text="CONFIDENTIAL" top={-22} left={240} rotate={-8} />
          </div>

          {/* Key evidence: vehicle + weapon */}
          <div className="flex flex-col gap-4">
            {(['4', '5'] as const).map((idx, i) => {
              const modelUrl = evidenceModelUrls[idx];
              const previewUrl = evidenceModelPreviewUrls[idx] || evidenceImageUrls[idx];
              const labels = [
                { tag: 'EXHIBIT B', title: 'SUSPECT VEHICLE', sub: 'Nissan Pathfinder · Tire Match' },
                { tag: 'EXHIBIT C', title: 'MURDER WEAPON', sub: 'Maglite Flashlight · Ligature' },
              ];
              const lbl = labels[i]!;
              return (
                <div key={idx} className="paper-card p-[10px_10px_8px] flex-1 relative">
                  <div
                    className="overflow-hidden cursor-pointer"
                    style={{ height: 188, background: '#1c2030' }}
                    onClick={() => modelUrl && setActiveModel(Number(idx))}
                  >
                    {modelUrl ? (
                      <Evidence3DViewer
                        inline
                        glbUrl={modelUrl}
                        previewUrl={previewUrl}
                        label={lbl.title}
                        description={lbl.sub}
                      />
                    ) : previewUrl ? (
                      <img src={previewUrl} alt={lbl.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full flex items-center justify-center text-[9px] tracking-widest opacity-30">
                        GENERATING…
                      </div>
                    )}
                  </div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-[10px] tracking-[0.12em]">{lbl.title}</span>
                    <span className="text-[8px] opacity-50">{lbl.tag}</span>
                  </div>
                  <div className="text-[8px] opacity-45 tracking-[0.1em]">{lbl.sub}</div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-[22px] grid grid-cols-[1.35fr_1fr] gap-8 max-[900px]:grid-cols-1">
          <div>
            <section className="paper-card p-[14px_16px_16px]">
              <div className="dossier-overline mb-3">Evidence Collected</div>
              <div className="grid grid-cols-2 gap-3">
                {caseData.clues.map((clue, i) => {
                  const modelUrl = evidenceModelUrls[String(i)];
                  const previewUrl = evidenceModelPreviewUrls[String(i)] || evidenceImageUrls[String(i)];
                  return (
                    <div key={clue} className="flex flex-col gap-1">
                      <div
                        className="relative overflow-hidden cursor-pointer"
                        style={{ height: 130, background: '#1c2030' }}
                        onClick={() => modelUrl && setActiveModel(i)}
                      >
                        {modelUrl ? (
                          <Evidence3DViewer
                            inline
                            glbUrl={modelUrl}
                            previewUrl={previewUrl}
                            label={`Exhibit ${String.fromCharCode(65 + i)}`}
                            description={clue}
                          />
                        ) : previewUrl ? (
                          <img src={previewUrl} alt="" className="h-full w-full object-cover opacity-60" />
                        ) : (
                          <div className="h-full flex items-center justify-center text-[9px] opacity-30 tracking-widest">NO MODEL</div>
                        )}
                      </div>
                      <div className="text-[9px] tracking-[0.14em] opacity-60">
                        EX-{String.fromCharCode(65 + i)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="paper-card lined-paper mt-[18px] p-[14px_18px_16px]">
              <div className="flex items-baseline justify-between border-b border-dashed border-[var(--ink)] pb-1">
                <span className="text-[13px] tracking-[0.1em]">911 CALL · TRANSCRIPT</span>
                <span className="text-[11px] opacity-70">04:22 SGT · 1:42</span>
              </div>
              <div className="flex items-center gap-2.5 py-[10px] pb-1.5">
                <button
                  type="button"
                  onClick={toggle911Audio}
                  className="grid h-7 w-7 place-items-center rounded-full bg-[var(--ink)] text-[11px] text-[var(--cream-on-dark)]"
                  aria-label="Play 911 call"
                >
                  {isPlaying911 ? '❚❚' : '▶'}
                </button>
                <Waveform progress={call911Progress} />
                <div className="text-[10px] opacity-70">
                  {call911AudioUrl ? (isPlaying911 ? 'LIVE' : 'READY') : 'NO AUDIO'}
                </div>
              </div>
              <div className="mb-2 flex items-center justify-between text-[10px] opacity-65">
                <span>{formatPlaybackTime(call911CurrentTime)}</span>
                <span>{formatPlaybackTime(call911Duration)}</span>
              </div>
              <div className="mb-3 border-b border-dashed border-[rgba(26,20,16,0.25)] pb-2 text-[11px] leading-[1.5]">
                <div className="tracking-[0.14em] opacity-55">REPORTING PARTY</div>
                <div className="mt-1 font-semibold">
                  {call911Lines.find((line) => line.who === 'CALL')?.label ?? 'Caller not identified'}
                </div>
              </div>
              <div className="text-[12px] leading-[23px]">
                {call911Lines.map((line, i) => (
                  <div key={i} className="flex gap-2.5">
                    <span className="w-[110px] shrink-0 text-[10px] leading-[1.35] opacity-60">
                      {line.label ?? line.who}
                    </span>
                    <span>{line.text}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="paper-card mt-[18px] p-[14px_18px_16px]">
              <div className="flex items-baseline justify-between border-b border-dashed border-[var(--ink)] pb-1">
                <span className="text-[13px] tracking-[0.1em]">INCIDENT LEAD SHEET</span>
                <span className="text-[10px] opacity-70">FIELD NOTES · PLAYER VISIBLE</span>
              </div>
              <ul className="mt-2 space-y-1.5 text-[12px] leading-[1.55]">
                {leadSheetItems.map((item, index) => (
                  <li key={`${item.slice(0, 24)}-${index}`} className="flex gap-2">
                    <span className="mt-[2px] text-[10px] opacity-65">●</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <aside className="flex flex-col gap-[18px]">
            <section className="paper-card p-[14px_16px_16px]">
              <PaperClip left={-10} top={-22} rotate={-12} />
              <div className="dossier-overline">Victim Profile</div>
              <h2 className="mt-0.5 text-[22px]">{caseData.victim.name}</h2>
              <dl className="mt-2.5 grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1 text-[12px]">
                <dt className="opacity-[0.65]">AGE</dt>
                <dd>{caseData.victim.age}</dd>
                <dt className="opacity-[0.65]">OCCUPATION</dt>
                <dd>{caseData.victim.occupation}</dd>
                <dt className="opacity-[0.65]">LOCATION</dt>
                <dd>{caseData.victim.location}</dd>
                <dt className="opacity-[0.65]">TIME OF DEATH</dt>
                <dd className="font-bold text-[var(--oxblood)]">
                  {caseData.victim.time_of_death}
                </dd>
                <dt className="opacity-[0.65]">CAUSE</dt>
                <dd>
                  ██████████ <span className="opacity-55">(pending tox)</span>
                </dd>
              </dl>
            </section>

            <section className="paper-card p-[14px_16px]">
              <PaperClip left={250} top={-22} rotate={8} />
              <div className="dossier-overline mb-2">
                Suspects · {suspects.length} Listed
              </div>
              {suspects.map((witness, i) => (
                <div
                  key={witness.id}
                  className="flex items-start gap-2.5 border-t border-dashed border-[rgba(26,20,16,0.3)] py-3 first:border-t-0"
                >
                  {witnessPortraitUrls[witness.id] ? (
                    <img
                      src={witnessPortraitUrls[witness.id]}
                      alt={`${witness.name} portrait`}
                      className="h-[92px] w-[72px] object-cover grayscale"
                    />
                  ) : (
                    <div className="grid h-[92px] w-[72px] place-items-center bg-[var(--ink)] text-[9px] text-[var(--cream-on-dark)]">
                      W{i + 1}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px]">{witness.name}</div>
                    <WitnessFacts witness={witness} />
                    <WitnessProfileNotes witness={witness} />
                  </div>
                  <button
                    type="button"
                    onClick={() => startInterrogation(witness.id)}
                    className="mt-1 bg-[var(--ink)] px-2.5 py-1.5 text-[11px] tracking-[0.1em] text-[var(--cream-on-dark)]"
                  >
                    INTERVIEW →
                  </button>
                </div>
              ))}
            </section>

            <section className="paper-card p-[14px_16px]">
              <div className="dossier-overline mb-2">
                Witnesses · {witnesses.length} Listed
              </div>
              {witnesses.map((witness, i) => (
                <div
                  key={witness.id}
                  className="flex items-start gap-2.5 border-t border-dashed border-[rgba(26,20,16,0.3)] py-3 first:border-t-0"
                >
                  {witnessPortraitUrls[witness.id] ? (
                    <img
                      src={witnessPortraitUrls[witness.id]}
                      alt={`${witness.name} portrait`}
                      className="h-[92px] w-[72px] object-cover grayscale"
                    />
                  ) : (
                    <div className="grid h-[92px] w-[72px] place-items-center bg-[var(--ink)] text-[9px] text-[var(--cream-on-dark)]">
                      W{i + 1}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px]">{witness.name}</div>
                    <WitnessFacts witness={witness} />
                    <WitnessProfileNotes witness={witness} />
                  </div>
                  <button
                    type="button"
                    onClick={() => startInterrogation(witness.id)}
                    className="mt-1 bg-[var(--ink)] px-2.5 py-1.5 text-[11px] tracking-[0.1em] text-[var(--cream-on-dark)]"
                  >
                    INTERVIEW →
                  </button>
                </div>
              ))}
            </section>

            <section className="paper-card border-2 border-[var(--oxblood)] p-[14px_16px]">
              <div className="dossier-overline mb-2 text-[var(--oxblood)]">
                Final Action
              </div>
              <p className="text-[12px] leading-relaxed opacity-75">
                Ready to put a suspect on record? Review the suspect cards, make
                one final selection, and the dossier will immediately tell you if
                you were correct.
              </p>
              <button
                type="button"
                onClick={goToAccusation}
                className="mt-3 w-full bg-[var(--oxblood)] px-3 py-2 text-[11px] tracking-[0.15em] text-[var(--cream-on-dark)]"
              >
                FILE ACCUSATION →
              </button>
            </section>
          </aside>
        </section>

        <div className="dossier-footer mt-7">
          <span>DO NOT REMOVE FROM PREMISES · CHAIN OF CUSTODY {caseData.case_id}</span>
          <button type="button" onClick={goToAccusation}>
            READY TO ACCUSE · PAGE 01 / 04
          </button>
        </div>
      </div>

      {activeModel !== null && evidenceModelUrls[String(activeModel)] && (
        <Evidence3DViewer
          glbUrl={evidenceModelUrls[String(activeModel)]}
          previewUrl={evidenceModelPreviewUrls[String(activeModel)] || evidenceImageUrls[String(activeModel)]}
          label={`Exhibit ${String.fromCharCode(65 + activeModel)}`}
          description={caseData.clues[activeModel] ?? ''}
          onClose={() => setActiveModel(null)}
        />
      )}

      <Stamp text="CASE OPEN" top={56} left={920} rotate={6} />
      <Stamp
        text={`GENERATED · ${generatedIn}`}
        top={120}
        left={900}
        rotate={-3}
        color="var(--ink)"
        size={10}
      />
      <div className="dossier-grain" />
    </main>
  );
}
