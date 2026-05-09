import { useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';
import { LoadingScreen } from '@/screens/LoadingScreen';
import { CaseLoadScreen } from '@/screens/CaseLoadScreen';
import { InterrogationScreen } from '@/screens/InterrogationScreen';
import { AccusationScreen } from '@/screens/AccusationScreen';
import { RevealScreen } from '@/screens/RevealScreen';

export default function App() {
  const phase = useGameStore((s) => s.phase);
  const caseData = useGameStore((s) => s.caseData);

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

  let screen;
  if (phase === 'LOADING' || !caseData) screen = <LoadingScreen />;
  else if (phase === 'CASE_BRIEF') screen = <CaseLoadScreen />;
  else if (phase === 'INTERROGATING') screen = <InterrogationScreen />;
  else if (phase === 'ACCUSING') screen = <AccusationScreen />;
  else screen = <RevealScreen />;

  return (
    <div className="min-h-screen w-full relative">
      {screen}
    </div>
  );
}
