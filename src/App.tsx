import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import type { GamePhase } from '@/types/case';
import { CaseLoadScreen } from '@/screens/CaseLoadScreen';
import { InterrogationScreen } from '@/screens/InterrogationScreen';
import { AccusationScreen } from '@/screens/AccusationScreen';
import { RevealScreen } from '@/screens/RevealScreen';
import { ConvexMediaSync } from '@/components/ConvexMediaSync';

export default function App() {
  const phase = useGameStore((s) => s.phase);
  const caseData = useGameStore((s) => s.caseData);
  const activeWitnessId = useGameStore((s) => s.activeWitnessId);
  const loadStaticCase = useGameStore((s) => s.loadStaticCase);
  const historyReady = useRef(false);
  const applyingPopState = useRef(false);

  useEffect(() => {
    void loadStaticCase();
  }, [loadStaticCase]);

  // Dev shortcut: R resets to a fresh case from any screen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'r' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        useGameStore.setState({ phase: 'LOADING', caseData: null });
        void loadStaticCase();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [loadStaticCase]);

  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      const state = event.state as
        | { crimeScene?: true; phase?: GamePhase; activeWitnessId?: string | null }
        | null;
      if (!state?.crimeScene || !state.phase) return;
      applyingPopState.current = true;
      useGameStore.setState({
        phase: state.phase,
        activeWitnessId: state.activeWitnessId ?? null,
      });
      window.setTimeout(() => {
        applyingPopState.current = false;
      }, 0);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (!caseData || phase === 'LOADING') return;
    if (applyingPopState.current) return;

    const state = { crimeScene: true, phase, activeWitnessId };
    const hash = `#${phase.toLowerCase().replace('_', '-')}`;
    if (!historyReady.current) {
      window.history.replaceState(state, '', hash);
      historyReady.current = true;
      return;
    }

    const current = window.history.state as
      | { crimeScene?: true; phase?: GamePhase; activeWitnessId?: string | null }
      | null;
    if (current?.phase === phase && current.activeWitnessId === activeWitnessId) {
      return;
    }
    window.history.pushState(state, '', hash);
  }, [activeWitnessId, caseData, phase]);

  useEffect(() => {
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0 });
    });
  }, [activeWitnessId, phase]);

  if (phase === 'LOADING' || !caseData) {
    return (
      <div className="min-h-screen w-full grid place-items-center">
        <span className="text-[11px] tracking-[0.25em] opacity-50 uppercase">Loading case…</span>
      </div>
    );
  }

  let screen;
  if (phase === 'CASE_BRIEF') screen = <CaseLoadScreen />;
  else if (phase === 'INTERROGATING') screen = <InterrogationScreen />;
  else if (phase === 'ACCUSING') screen = <AccusationScreen />;
  else screen = <RevealScreen />;

  return (
    <div className="min-h-screen w-full relative">
      <div className="pointer-events-none absolute left-1/2 top-5 z-40 w-full max-w-[420px] -translate-x-1/2 px-4 select-none max-[640px]:top-3">
        <div className="flex items-center gap-3 text-[rgba(57,44,36,0.55)]">
          <div className="h-px flex-1 bg-[linear-gradient(to_right,transparent,rgba(57,44,36,0.22))]" />
          <div className="flex flex-col items-center">
            <div className="text-[9px] uppercase tracking-[0.42em]">Case Archive</div>
            <div className="font-serif text-[28px] leading-none tracking-[0.14em] text-[var(--ink)]">
              Archive_404
            </div>
          </div>
          <div className="h-px flex-1 bg-[linear-gradient(to_left,transparent,rgba(57,44,36,0.22))]" />
        </div>
      </div>
      <ConvexMediaSync />
      {screen}
    </div>
  );
}
