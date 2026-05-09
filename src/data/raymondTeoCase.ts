import type { MysteryCase } from '../types/case.ts';

// Hardcoded seed case used while live generation is stubbed.
// Replaced by GPT-5.5 output once src/api/generateCase.ts is wired.
export const raymondTeoCase: MysteryCase = {
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
  truth: {
    killer: 'w_priya',
    motive:
      'Raymond was about to fire her and report unauthorised wire transfers she had been making to cover her brother’s gambling debts.',
    method:
      'Sedative slipped into the victim’s nightcap, then suffocation with a silk pillow once he was unconscious.',
    hidden_clue:
      'A deleted calendar entry titled "P. — termination + audit" scheduled for 09:00 the morning of the death.',
  },
  witnesses: [
    {
      id: 'w_marcus',
      name: 'Marcus Lim',
      role: 'Building concierge',
      age: 34,
      knows:
        'Saw Priya leave the lobby at 03:12, much later than her usual departure. Logged a delivery van that was never on the manifest.',
      hiding:
        'Was asleep at his desk between 01:30 and 02:30 — broke building protocol and is afraid of losing his job.',
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
        'Knows the full schedule, the penthouse access codes, and that Raymond had recently pulled all wire-transfer logs.',
      hiding:
        'Embezzlement of S$340,000 over eight months. The murder itself.',
      lies: true,
      voice_id: 'EXAVITQu4vr4xnSDxMaL',
      portrait_prompt:
        'Singaporean Indian woman, late 20s, sharp blazer, composed but eyes that don’t settle',
    },
    {
      id: 'w_eleanor',
      name: 'Eleanor Teo',
      role: 'Estranged wife',
      age: 44,
      knows:
        'Raymond mentioned a "staff problem" he was finally going to deal with this week. He sounded relieved, not afraid.',
      hiding:
        'A pending divorce filing she planned to serve on Monday — unrelated to the death, but she fears it makes her look guilty.',
      lies: false,
      voice_id: 'ThT5KcBeYPX3keUQqHPh',
      portrait_prompt:
        'Singaporean Chinese woman, mid-40s, cream blouse, controlled grief, expensive but understated jewellery',
    },
  ],
  // 2 real clues + 1 red herring. Game treats index 2 as the red herring.
  clues: [
    'Tumbler on the nightstand contains residue of a benzodiazepine not prescribed to the victim.',
    'Penthouse access log shows door opened from the inside at 02:51, three minutes after estimated TOD.',
    'A second wine glass in the kitchen sink — lipstick on rim matches no one in the building.',
  ],
  scene_prompt:
    'Top-down forensic photograph of a luxury Singapore penthouse bedroom at night, single male victim on a king-size bed, silk pillow displaced beside him, half-empty tumbler on nightstand, floor-to-ceiling windows with Marina Bay skyline, evidence markers numbered 1–3',
  brief:
    'Raymond Teo, 47, founder of Teo Holdings, was found unresponsive in the master bedroom of his Marina One penthouse at 04:22 by his housekeeper. No forced entry. No sign of struggle visible from the doorway. Cause of death pending pathology, but the responding officer flagged the scene as suspicious.',
};
