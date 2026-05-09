export interface GeneratedCall911Line {
  who: 'DISP' | 'CALL';
  text: string;
}

export interface GeneratedWitness {
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

export interface GeneratedPublicCase {
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
  witnesses: GeneratedWitness[];
  clues: string[];
  scene_prompt: string;
  brief: string;
  call911_transcript: GeneratedCall911Line[];
}

export interface GeneratedHiddenTruth {
  killer: string;
  motive: string;
  method: string;
  hidden_clue: string;
}

export interface GeneratedCaseBundle {
  publicCase: GeneratedPublicCase;
  hiddenTruth: GeneratedHiddenTruth;
  generationMs: number;
}

export const staticPublicCase: GeneratedPublicCase = {
  case_id: 'CS-2026-0509-001',
  title: 'The Marina One Penthouse',
  victim: {
    name: 'Raymond Teo',
    age: 47,
    occupation: 'Property developer',
    time_of_death: '02:47 SGT',
    location: 'Marina One, Penthouse 47-B, Singapore',
    date: '2026-05-09',
  },
  witnesses: [
    {
      id: 'w_marcus',
      name: 'Marcus Lim',
      role: 'Building concierge',
      age: 34,
      knows:
        'Saw Priya leave the lobby at 03:12, much later than her usual departure.',
      hiding:
        'Was asleep at his desk between 01:30 and 02:30 and is afraid of losing his job.',
      lies: false,
      voice_id: 'pNInz6obpgDQGcFmaJgB',
      portrait_prompt:
        'Singaporean man in his mid-30s, navy concierge uniform, polite but tired eyes',
    },
    {
      id: 'w_priya',
      name: 'Priya Naidu',
      role: 'Personal assistant to the victim',
      age: 29,
      knows:
        'Knows the full schedule, access codes, and that Raymond had pulled wire-transfer logs.',
      hiding: 'Embezzlement of S$340,000 over eight months. The murder itself.',
      lies: true,
      voice_id: 'EXAVITQu4vr4xnSDxMaL',
      portrait_prompt:
        'Singaporean Indian woman, late 20s, sharp blazer, composed but eyes that do not settle',
    },
    {
      id: 'w_eleanor',
      name: 'Eleanor Teo',
      role: 'Estranged wife',
      age: 44,
      knows:
        'Raymond mentioned a staff problem he was finally going to deal with this week.',
      hiding:
        'A pending divorce filing she planned to serve on Monday, unrelated to the death.',
      lies: false,
      voice_id: 'ThT5KcBeYPX3keUQqHPh',
      portrait_prompt:
        'Singaporean Chinese woman, mid-40s, cream blouse, controlled grief',
    },
  ],
  clues: [
    'Tumbler on the nightstand contains residue of a benzodiazepine not prescribed to the victim.',
    'Penthouse access log shows door opened from the inside at 02:51, three minutes after estimated TOD.',
    'A second wine glass in the kitchen sink -- lipstick on rim matches no one in the building.',
  ],
  scene_prompt:
    'Top-down forensic photograph of a luxury Singapore penthouse bedroom at night, single male victim on a king-size bed, silk pillow displaced beside him, half-empty tumbler on nightstand.',
  brief:
    'Raymond Teo, 47, founder of Teo Holdings, was found unresponsive in the master bedroom of his Marina One penthouse at 04:22 by his housekeeper.',
  call911_transcript: [
    { who: 'DISP', text: "Nine-one-one, what's your emergency?" },
    { who: 'CALL', text: "I-- I think Ray is dead. He's not breathing. Oh god." },
    { who: 'DISP', text: "Ma'am, where are you?" },
    {
      who: 'CALL',
      text: 'Marina One penthouse. Forty-seventh floor. Please hurry.',
    },
    { who: 'DISP', text: 'Stay on the line. Is anyone else with you?' },
    { who: 'CALL', text: 'No. The apartment is empty. Everyone left hours ago.' },
  ],
};

export const staticHiddenTruth: GeneratedHiddenTruth = {
  killer: 'w_priya',
  motive:
    'Raymond was about to fire her and report unauthorised wire transfers she had made to cover family debts.',
  method:
    'Sedative slipped into the victim’s nightcap, then suffocation with a silk pillow once he was unconscious.',
  hidden_clue:
    'A deleted calendar entry titled "P. -- termination + audit" scheduled for 09:00 the morning of the death.',
};

const FIRST_NAMES = [
  'Aiden',
  'Bianca',
  'Chloe',
  'Darren',
  'Ethan',
  'Farah',
  'Grace',
  'Harish',
  'Ivy',
  'Jasper',
  'Kai',
  'Lina',
];
const LAST_NAMES = [
  'Tan',
  'Lim',
  'Koh',
  'Lee',
  'Rajan',
  'Ng',
  'Goh',
  'Chong',
  'Pillai',
  'Yeo',
];
const OCCUPATIONS = [
  'Tech founder',
  'Restaurateur',
  'Art dealer',
  'Fund manager',
  'Startup investor',
];
const LOCATIONS = [
  'Keppel Bay penthouse, Singapore',
  'Orchard Road townhouse, Singapore',
  'Sentosa Cove villa, Singapore',
  'Marina Bay residence, Singapore',
];
const WITNESS_ROLES = [
  'Executive assistant',
  'Building concierge',
  'Business partner',
  'Estranged spouse',
  'Driver',
  'Private chef',
];
const MOTIVES = [
  'The victim discovered a long-running embezzlement scheme and planned to hand the records to police.',
  'A financial betrayal ruined the killer and they believed the victim was about to expose them publicly.',
  'The victim threatened to cut the killer out of a deal worth millions and end their career.',
];
const METHODS = [
  'Sedative in a nightcap, followed by suffocation once the victim lost consciousness.',
  'A staged fall after the victim was disoriented by a drugged drink.',
  'Poison delivered through medication, then the scene rearranged to look accidental.',
];
const HIDDEN_CLUES = [
  'A deleted calendar entry scheduling a termination meeting with the killer.',
  'A partially erased voice memo where the victim names the killer by first name.',
  'A transfer approval email draft saved in the victim notes and addressed to the killer.',
];
const CLUE_TEMPLATES = [
  'Residue of an unprescribed sedative found in the victim drink.',
  'Access log shows movement inside the apartment minutes after time of death.',
  'A red herring: unidentified print on a service tray from an earlier dinner.',
];
const VOICE_IDS = ['pNInz6obpgDQGcFmaJgB', 'EXAVITQu4vr4xnSDxMaL', 'ThT5KcBeYPX3keUQqHPh'];

export function synthesizeFallback911Lines(context: GeneratedPublicCase['victim']): GeneratedCall911Line[] {
  const loc = context.location.slice(0, 120);
  const nameWord = context.name.split(/\s+/)[0] ?? 'They';
  return [
    { who: 'DISP', text: "Nine-one-one, what's your emergency?" },
    {
      who: 'CALL',
      text: `${nameWord} won't wake up—I think they're hurt bad. Send someone now.`,
    },
    { who: 'DISP', text: 'Help is on the way. Where exactly are you calling from?' },
    { who: 'CALL', text: `${loc}. I need units here right now.` },
    { who: 'DISP', text: 'Stay with me—are they breathing at all?' },
    {
      who: 'CALL',
      text:
        'I—I can barely tell. Hurry. The building is quiet but the door was unlocked.',
    },
  ];
}

/** Ensures call911_transcript exists and is valid (mutates publicCase). */
export function normalize911Transcript(publicCase: GeneratedPublicCase): void {
  if (!publicCase.victim?.name || !publicCase.victim?.location) {
    publicCase.call911_transcript = [
      { who: 'DISP', text: "Nine-one-one, what's your emergency?" },
      { who: 'CALL', text: 'Please — send help immediately. Someone is hurt.' },
      { who: 'DISP', text: 'What is your address or location?' },
      {
        who: 'CALL',
        text: 'I am at the scene. I need police and EMS right away.',
      },
      { who: 'DISP', text: 'Stay on the line—are you safe?' },
      { who: 'CALL', text: "Yes—please hurry. I don't know what's happening." },
    ];
    return;
  }

  let lines =
    Array.isArray(publicCase.call911_transcript) && publicCase.call911_transcript.length > 0
      ? [...publicCase.call911_transcript]
      : synthesizeFallback911Lines(publicCase.victim);

  lines = lines.map((line) => {
    const raw = typeof line?.who === 'string' ? line.who.toUpperCase() : '';
    const who: GeneratedCall911Line['who'] = raw.includes('DISP') ? 'DISP' : 'CALL';
    const text = typeof line?.text === 'string' ? line.text.trim() : '';
    return { who, text };
  }).filter((l) => l.text.length > 0);

  if (lines.length < 6) {
    lines = synthesizeFallback911Lines(publicCase.victim);
  }

  const hasDisp = lines.some((l) => l.who === 'DISP');
  const hasCall = lines.some((l) => l.who === 'CALL');
  if (!hasDisp || !hasCall) {
    lines = synthesizeFallback911Lines(publicCase.victim);
  }

  publicCase.call911_transcript = lines.slice(0, 16);
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function makeCaseId(timestamp: number) {
  return `CS-${new Date(timestamp).toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0')}`;
}

function makePersonName() {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}

function generateWitnesses(killerIndex: number): GeneratedWitness[] {
  const usedIds = new Set<string>();
  return Array.from({ length: 3 }).map((_, index) => {
    const idBase = `w_${makePersonName().toLowerCase().replace(/\s+/g, '_')}`;
    let id = idBase;
    while (usedIds.has(id)) {
      id = `${idBase}_${Math.floor(Math.random() * 100)}`;
    }
    usedIds.add(id);
    const lies = index === killerIndex;
    const name = makePersonName();
    return {
      id,
      name,
      role: pick(WITNESS_ROLES),
      age: 27 + Math.floor(Math.random() * 24),
      knows: lies
        ? 'They know exact movement timings and who had access to the scene that night.'
        : 'They observed unusual behavior shortly before the death and remember one concrete detail.',
      hiding: lies
        ? 'Their direct involvement in the murder and prior financial motive.'
        : 'A personal detail that feels incriminating but is unrelated to the murder.',
      lies,
      voice_id: VOICE_IDS[index] ?? VOICE_IDS[0],
      portrait_prompt: `${name}, noir portrait, tense expression, cinematic lighting`,
    };
  });
}

export function validateCaseBundle(bundle: GeneratedCaseBundle): boolean {
  const { publicCase, hiddenTruth } = bundle;

  const victim = publicCase?.victim;
  if (
    !publicCase?.case_id ||
    !publicCase?.title ||
    !publicCase?.brief ||
    !publicCase?.scene_prompt ||
    typeof victim?.name !== 'string' ||
    typeof victim?.age !== 'number' ||
    typeof victim?.occupation !== 'string' ||
    typeof victim?.time_of_death !== 'string' ||
    typeof victim?.location !== 'string' ||
    typeof victim?.date !== 'string'
  )
    return false;

  if (publicCase.witnesses.length !== 3) return false;
  if (publicCase.clues.length !== 3) return false;

  if (!Array.isArray(publicCase.call911_transcript) || publicCase.call911_transcript.length < 6)
    return false;
  if (!publicCase.call911_transcript.some((l) => l.who === 'DISP')) return false;
  if (!publicCase.call911_transcript.some((l) => l.who === 'CALL')) return false;
  for (const line of publicCase.call911_transcript) {
    if ((line.who !== 'DISP' && line.who !== 'CALL') || !line?.text?.trim()) return false;
  }
  if (
    typeof hiddenTruth?.killer !== 'string' ||
    !hiddenTruth?.motive ||
    !hiddenTruth?.method ||
    !hiddenTruth?.hidden_clue
  )
    return false;

  const witnessIds = new Set(publicCase.witnesses.map((w) => w.id));
  if (witnessIds.size !== publicCase.witnesses.length) return false;

  for (const w of publicCase.witnesses) {
    if (
      typeof w.id !== 'string' ||
      !w.name ||
      !w.role ||
      typeof w.age !== 'number' ||
      !w.knows ||
      !w.hiding ||
      typeof w.lies !== 'boolean' ||
      typeof w.voice_id !== 'string' ||
      !w.portrait_prompt
    )
      return false;
  }

  if (!witnessIds.has(hiddenTruth.killer)) return false;
  const killerWitness = publicCase.witnesses.find((w) => w.id === hiddenTruth.killer);
  if (!killerWitness?.lies) return false;

  const liars = publicCase.witnesses.filter((w) => w.lies);
  if (liars.length !== 1) return false;

  return true;
}

export function normalizeVoiceAssignments(publicCase: GeneratedPublicCase): void {
  publicCase.witnesses.forEach((w, i) => {
    w.voice_id = VOICE_IDS[i] ?? VOICE_IDS[0];
  });
}

/** Accepts `{ hiddenTruth, publicCase }` from JSON */
export function tryParseLLMCaseBundle(
  parsed: Record<string, unknown>,
  elapsedMs: number,
): GeneratedCaseBundle | null {
  const ht = parsed.hiddenTruth as GeneratedHiddenTruth | undefined;
  const pc = parsed.publicCase as GeneratedPublicCase | undefined;
  if (!ht || !pc) return null;

  normalizeVoiceAssignments(pc);
  normalize911Transcript(pc);

  const bundle: GeneratedCaseBundle = {
    publicCase: pc,
    hiddenTruth: ht,
    generationMs: elapsedMs,
  };

  return validateCaseBundle(bundle) ? bundle : null;
}

export const LLM_CASE_SYSTEM = `You write compact noir homicide mysteries for an interactive detective game.
Output MUST be a single JSON object (no markdown) with keys "hiddenTruth" and "publicCase".`;

export const LLM_CASE_USER = `Define the CASE TRUTH FIRST, then expose only what detectives should see publicly.

(hiddenTruth schema)
{
  "killer": string — MUST equal exactly one witness id from publicCase.witnesses, and MUST be that witness's id ONLY,
  "motive": string — why they killed,
  "method": string — how they killed (no impossible physics),
  "hidden_clue": string — evidence that could convince a careful detective
}

(publicCase schema)
{
  "case_id": string — format CS-YYYYMMDD-NNN using the victim/date context,
  "title": string — short noir title,
  "victim": { "name","age"(number),"occupation","time_of_death","location","date"(ISO date string) },
  "witnesses": array of exactly 3 objects: { "id","name","role","age"(number),"knows","hiding","lies"(boolean),"voice_id":"stub","portrait_prompt" },
  "clues": array of exactly 3 strings — first two substantive; clue[2] MUST be plausible but misleading (red herring),
  "scene_prompt": string — cinematic forensic image prompt,
  "brief": string — 3–5 tense sentences for the dossier opener,
  "call911_transcript": array of exactly 6–12 objects alternating { "who":"DISP"|"CALL", "text": string } starting with DISP; caller panic; reference victim LOCATION by name/context; plausible dispatch questions
}

HARD RULES:
1. Exactly ONE witness has "lies": true — that SAME witness id MUST be hiddenTruth.killer.
2. The two honest witnesses tell the truth based on hiddenTruth; killer's "knows"/"hiding" should support gameplay (lie strategy on surface detail; truth in hidden fields only for engine).
3. Witness ids MUST be lowercase with prefix w_ and alphanumeric/underscore only, unique among the three (e.g. w_morgan_reed).
4. Do NOT put hiddenTruth anywhere inside publicCase. Do NOT contradict hiddenTruth.method when writing accessible clues versus brief.
5. Set voice_id on each witness to literal "stub" — the server overwrites voices.
6. call911_transcript must have at least 6 lines mixed DISP and CALL voices; grounded in victim.name and victim.location; no spoilers naming the culprit.
7. Make it original (not Raymond Teo / Marina One / Singapore cliché unless organically fitting). Variety in motive and setting is good.`;

export const LLM_CORPUS_SYSTEM_NOTE = `
When corpus excerpts below are included: they summarize real documented events from encyclopedic or news retrieval (via Exa, often Wikipedia). Your JSON is gameplay FICTION—invent plausible character names for all witnesses/victim titles, avoid directly accusing named real civilians, and do not claim factual legal findings. Hidden truth defines the game's designated culprit only.`;

/**
 * Combines corpus text from Exa retrieval with the base dossier prompt.
 */
export function buildCorpusBackedUserPrompt(
  corpusMarkdown: string,
  auditLineForInternalUse: string,
): string {
  const appendix = `\n\n---\n\n## Corpus-backed mode (ENABLED)
Reference document for provenance logging (summarize only; avoid pasting URLs into user-facing dossier fields): ${auditLineForInternalUse}

### Retrieved excerpts (Exa — often Wikipedia; may omit details)
${corpusMarkdown}

CORPUS-SPECIFIC RULES (additive):
9. Ground tone, timelines, contradiction patterns, and setting on excerpts—but characters in publicCase MUST use invented or clearly fictionalised names suited to playable interrogation (no copying full real names from excerpts).
10. The killer you encode in hiddenTruth.killer MUST be ONE of exactly three fictional witnesses reflecting tension implied by excerpts; this may contradict real-world adjudication when the excerpt describes an unsolved matter—this mystery is deliberately closed for the game loop.
`;
  return LLM_CASE_USER + appendix;

}

export function generateCaseBundle(): GeneratedCaseBundle {
  const start = Date.now();
  const timestamp = Date.now();
  const killerIndex = Math.floor(Math.random() * 3);
  const witnesses = generateWitnesses(killerIndex);
  const victimName = makePersonName();
  const victim = {
    name: victimName,
    age: 35 + Math.floor(Math.random() * 21),
    occupation: pick(OCCUPATIONS),
    time_of_death: `${String(1 + Math.floor(Math.random() * 4)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')} SGT`,
    location: pick(LOCATIONS),
    date: new Date(timestamp).toISOString().slice(0, 10),
  };
  const publicCase: GeneratedPublicCase = {
    case_id: makeCaseId(timestamp),
    title: `The ${pick(['Midnight Ledger', 'Silent Penthouse', 'Last Signature', 'Broken Alibi'])}`,
    victim,
    witnesses,
    clues: CLUE_TEMPLATES,
    scene_prompt:
      'Forensic photo of a high-end residence at night, victim in bedroom, overturned glass, evidence markers.',
    brief:
      'The victim was found unresponsive in a private residence before dawn. No forced entry was reported, but timeline inconsistencies suggest homicide.',
    call911_transcript: synthesizeFallback911Lines(victim),
  };

  const hiddenTruth: GeneratedHiddenTruth = {
    killer: witnesses[killerIndex].id,
    motive: pick(MOTIVES),
    method: pick(METHODS),
    hidden_clue: pick(HIDDEN_CLUES),
  };

  const bundle: GeneratedCaseBundle = {
    publicCase,
    hiddenTruth,
    generationMs: Date.now() - start,
  };

  return validateCaseBundle(bundle)
    ? bundle
    : {
        publicCase: staticPublicCase,
        hiddenTruth: staticHiddenTruth,
        generationMs: 8300,
      };
}
