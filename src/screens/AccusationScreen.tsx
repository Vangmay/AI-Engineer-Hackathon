import type { CSSProperties } from 'react';
import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';

export function AccusationScreen() {
  const caseData = useGameStore((s) => s.caseData)!;
  const witnessPortraitUrls = useGameStore((s) => s.witnessPortraitUrls);
  const submitAccusation = useGameStore((s) => s.submitAccusation);
  const endInterrogation = useGameStore((s) => s.endInterrogation);
  const suspects = caseData.witnesses.filter((w) => w.category === 'suspect');
  const [selectedSuspectId, setSelectedSuspectId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const selectedSuspect = suspects.find((suspect) => suspect.id === selectedSuspectId) ?? null;

  const handleSubmit = async () => {
    if (!selectedSuspectId || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await submitAccusation(selectedSuspectId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Submission failed. Please try again.';
      setSubmitError(message);
      setIsSubmitting(false);
    }
  };

  return (
    <main className="dossier-page">
      <div className="dossier-tab" />
      <div className="dossier-artboard grid min-h-screen place-items-center">
        <section className="paper-card lifted relative w-[980px] max-w-full p-8">
          <div className="tape-corner left" />
          <div className="tape-corner right" />

          <div className="dossier-overline">Formal Accusation · Final Selection</div>
          <h1 className="mt-3 text-[34px] leading-none">Choose The Killer</h1>
          <div className="mx-auto mt-4 h-0 w-full border-t-2 border-[var(--ink)]" />

          <div className="mx-auto mt-7 max-w-[680px] text-center text-[13px] leading-relaxed opacity-75">
            Review the suspect board, select one person, and file the accusation.
            The case will immediately return a right-or-wrong verdict after your final
            selection.
          </div>

          <section className="mt-8 grid gap-4 md:grid-cols-2">
            {suspects.map((suspect) => {
              const portraitUrl = witnessPortraitUrls[suspect.id];
              const isSelected = suspect.id === selectedSuspectId;
              const factRows = [
                ['AGE', String(suspect.age)],
                ['SEX', suspect.sex],
                ['OCCUPATION', suspect.occupation],
                ['RESIDENCE', suspect.residence],
                ['CONNECTION', suspect.relationship_to_victim],
              ].filter(([, value]) => Boolean(value));
              return (
                <button
                  key={suspect.id}
                  type="button"
                  onClick={() => {
                    setSelectedSuspectId(suspect.id);
                    setSubmitError(null);
                  }}
                  className={`paper-card flex w-full items-start gap-4 p-4 text-left transition-all ${
                    isSelected
                      ? 'border-2 border-[var(--oxblood)] bg-[var(--paper-warm-base)] shadow-[0_10px_25px_rgba(90,31,24,0.16)]'
                      : 'border border-[var(--ink)] bg-[var(--paper-card)] hover:-translate-y-0.5 hover:bg-[var(--paper-warm-base)]'
                  }`}
                  aria-pressed={isSelected}
                >
                  {portraitUrl ? (
                    <img
                      src={portraitUrl}
                      alt={`${suspect.name} portrait`}
                      className="h-[132px] w-[102px] shrink-0 object-cover grayscale"
                    />
                  ) : (
                    <div className="grid h-[132px] w-[102px] shrink-0 place-items-center border border-dashed border-[var(--ink)] text-[10px] tracking-[0.18em] opacity-60">
                      NO PHOTO
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] tracking-[0.18em] opacity-60">
                          SUSPECT CARD
                        </div>
                        <h2 className="mt-1 text-[24px] leading-tight">{suspect.name}</h2>
                      </div>
                      <div
                        className={`border px-2 py-1 text-[10px] tracking-[0.16em] ${
                          isSelected
                            ? 'border-[var(--oxblood)] text-[var(--oxblood)]'
                            : 'border-[var(--ink)] opacity-70'
                        }`}
                      >
                        {isSelected ? 'SELECTED' : 'OPEN'}
                      </div>
                    </div>

                    <dl className="mt-3 grid grid-cols-[86px_1fr] gap-x-2 gap-y-1 text-[11px] leading-snug opacity-70">
                      {factRows.map(([label, value]) => (
                        <div key={`${suspect.id}-${label}`} className="contents">
                          <dt className="tracking-[0.14em]">
                            {label}
                          </dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                    </dl>
                    <p className="mt-3 text-[13px] leading-relaxed opacity-80">
                      {suspect.profile || suspect.knows}
                    </p>
                    {suspect.role && (
                      <p className="mt-2 text-[12px] leading-relaxed opacity-72">
                        <span className="mr-1 tracking-[0.14em] opacity-60">ROLE</span>
                        {suspect.role}
                      </p>
                    )}
                    {suspect.persona && (
                      <p className="mt-2 text-[12px] leading-relaxed opacity-72">
                        <span className="mr-1 tracking-[0.14em] opacity-60">PERSONA</span>
                        {suspect.persona}
                      </p>
                    )}
                    <p className="mt-2 text-[12px] leading-relaxed opacity-72">
                      <span className="mr-1 tracking-[0.14em] opacity-60">KNOWS</span>
                      {suspect.knows}
                    </p>
                    <p className="mt-3 text-[12px] leading-relaxed opacity-65">
                      <span className="mr-1 tracking-[0.14em] opacity-60">WITHHOLDS</span>
                      {suspect.hiding}
                    </p>
                  </div>
                </button>
              );
            })}
          </section>

          <section className="lined-paper mt-7 p-[16px_18px] shadow-[0_4px_12px_rgba(0,0,0,0.12)]">
            <div className="border-b border-dashed border-[var(--ink)] pb-1 text-[11px] tracking-[0.15em] opacity-70">
              FINAL ACCUSATION
            </div>
            <div className="mt-3 flex items-center justify-between gap-4 max-[720px]:flex-col max-[720px]:items-start">
              <div>
                <div className="text-[10px] tracking-[0.16em] opacity-60">
                  SELECTED SUSPECT
                </div>
                <div className="mt-1 text-[22px] leading-tight">
                  {selectedSuspect?.name ?? 'No suspect selected'}
                </div>
                {selectedSuspect && (
                  <div className="mt-2 max-w-[520px] text-[12px] leading-relaxed opacity-72">
                    {selectedSuspect.role}
                  </div>
                )}
                <div className="mt-2 text-[12px] opacity-65">
                  {selectedSuspect
                    ? 'Finalizing will immediately reveal whether this choice is correct.'
                    : 'Choose one suspect card to unlock the final accusation.'}
                </div>
                {submitError && (
                  <div className="mt-3 text-[12px] font-semibold text-[var(--oxblood)]">
                    {submitError}
                  </div>
                )}
              </div>

              <button
                type="button"
                disabled={!selectedSuspectId || isSubmitting}
                onClick={() => {
                  void handleSubmit();
                }}
                className="min-w-[220px] border border-[var(--ink)] bg-[var(--ink)] px-4 py-3 text-[11px] tracking-[0.18em] text-[var(--cream-on-dark)] transition-opacity disabled:cursor-not-allowed disabled:opacity-35"
              >
                {isSubmitting ? 'SUBMITTING…' : 'FINALIZE ACCUSATION'}
              </button>
            </div>
          </section>

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
