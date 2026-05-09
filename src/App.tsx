import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import type { GamePhase } from '@/types/case';
import { LoadingScreen } from '@/screens/LoadingScreen';
import { CaseLoadScreen } from '@/screens/CaseLoadScreen';
import { InterrogationScreen } from '@/screens/InterrogationScreen';
import { AccusationScreen } from '@/screens/AccusationScreen';
import { RevealScreen } from '@/screens/RevealScreen';
import { ConvexMediaSync } from '@/components/ConvexMediaSync';

export default function App() {
  const phase = useGameStore((s) => s.phase);
  const caseData = useGameStore((s) => s.caseData);
  const activeWitnessId = useGameStore((s) => s.activeWitnessId);
  const historyReady = useRef(false);
  const applyingPopState = useRef(false);

  // Dev shortcut: R resets to a fresh case from any screen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'r' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        useGameStore.setState({ phase: 'LOADING', caseData: null });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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

  let screen;
  if (phase === 'LOADING' || !caseData) screen = <LoadingScreen />;
  else if (phase === 'CASE_BRIEF') screen = <CaseLoadScreen />;
  else if (phase === 'INTERROGATING') screen = <InterrogationScreen />;
  else if (phase === 'ACCUSING') screen = <AccusationScreen />;
  else screen = <RevealScreen />;

  return (
    <div className="min-h-screen w-full relative">
      <ConvexMediaSync />
      {screen}
    </div>
  );
}
