/** 911 dossier excerpt; UI shows text while audio reads a derived script */
export interface Call911Line {
  who: 'DISP' | 'CALL';
  text: string;
}

export interface Witness {
  id: string;
  name: string;
  role: string;
  age: number;
  knows: string;
  hiding: string;
  lies: boolean;
  voice_id: string;
  portrait_prompt: string;
}

export interface MysteryCase {
  case_id: string;
  title: string;
  victim: {
    name: string;
    age: number;
    occupation: string;
    time_of_death: string;
    location: string;
    date: string;
  };
  truth: {
    killer: string; // witness id
    motive: string;
    method: string;
    hidden_clue: string;
  };
  witnesses: Witness[];
  clues: string[]; // 2 real + 1 red herring (game knows by position)
  scene_prompt: string;
  brief: string;
  /** If missing (legacy bundles), UI uses a canned fallback */
  call911_transcript?: Call911Line[];
}

export interface TranscriptLine {
  speaker: 'witness' | 'detective' | 'system';
  text: string;
  timestamp: number;
}

export type GamePhase =
  | 'LOADING'
  | 'CASE_BRIEF'
  | 'INTERROGATING'
  | 'ACCUSING'
  | 'REVEAL';
