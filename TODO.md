# Crime Scene Implementation TODO

This is the practical build list for turning the dossier UI into the actual game loop described in `prd.md`.

## 0. Current State

- React/Vite frontend exists with static Raymond Teo case data.
- Screens exist for loading, case briefing, interview, accusation, and reveal.
- Game state is Zustand backed by a backend contract and local adapter.
- Interview transcript is stubbed with timed fake lines.
- Accusation is evaluated through the backend contract with local fallback logic.
- Convex schema/function scaffolding exists, but the frontend is not yet using deployed Convex.
- No generated cases, media pipeline, or live voice connection yet.

## 1. Backend Foundation

- [x] Choose backend runtime for the hackathon path.
  - Recommended: Convex for session state, case storage, transcript history, and server actions.
  - Fallback: Vercel serverless API routes plus local/in-memory storage for demo.
- [x] Add backend project scaffolding.
  - [x] Install Convex client/server packages if using Convex.
  - [x] Create backend schema for users/sessions/cases/transcripts/media assets.
  - [x] Add `.env.local` keys and update `.env.local.example`.
- [x] Define persisted data models.
  - [x] `sessions`: current phase, active case id, active witness id, accusation, result.
  - [x] `cases`: public case file, hidden truth, generated prompts, created timestamp.
  - [x] `witnesses`: witness persona, voice id, public profile, hidden facts, lie strategy.
  - [x] `transcripts`: session id, witness id, speaker, text, timestamp, optional audio asset.
  - [x] `media`: scene image URL, 911 audio URL, reveal narration URL, ambient audio URL.
- [ ] Replace local-only Zustand state with backend-backed actions.
  - [x] `startNewCase()`
  - [ ] `loadCase(caseId)`
  - [x] `startInterview(witnessId)`
  - [x] `appendTranscriptLine(line)`
  - [x] `submitAccusation(text)`
  - [x] `resetSession()`

## 2. Mystery Generation Engine

- [ ] Implement a server-side `generateCase()` action.
- [ ] Generate truth first.
  - [ ] Killer id.
  - [ ] Motive.
  - [ ] Method.
  - [ ] Timeline.
  - [ ] Hidden clue.
- [ ] Generate player-visible case file from truth.
  - [ ] Victim profile.
  - [ ] Case title.
  - [ ] Scene brief.
  - [ ] Three witnesses.
  - [ ] Two real clues and one red herring.
  - [ ] 911 call script.
- [ ] Validate generated JSON before saving.
  - [ ] Runtime schema validation.
  - [ ] Ensure exactly one killer.
  - [ ] Ensure witness ids match truth.
  - [ ] Ensure each clue is represented in scene prompt or witness knowledge.
  - [ ] Ensure the killer has a consistent lie and at least one contradiction.
- [ ] Store hidden truth separately from the public case payload.
- [ ] Add static fallback case if generation fails.

## 3. Media Pipeline

- [ ] Generate crime scene image from `scene_prompt`.
  - [ ] Call image generation server-side.
  - [ ] Store returned image URL or blob reference in `media`.
  - [ ] Frontend uses real image instead of `.photo-ph` placeholder when available.
- [ ] Generate 911 call audio.
  - [ ] Turn generated 911 transcript into ElevenLabs speech.
  - [ ] Save audio URL.
  - [ ] Auto-play on case briefing after load.
- [ ] Assign witness voices.
  - [ ] Map witness personality to voice id.
  - [ ] Store voice id per witness.
- [ ] Optional polish: reveal narration audio.
  - [ ] Generate reveal script after accusation.
  - [ ] Generate narrator audio.
  - [ ] Play on reveal screen.
- [ ] Optional polish: ambient score.
  - [ ] Add looped ambient audio on case/interview screens.
  - [ ] Fade down during witness speech.

## 4. Live Witness Interrogation

- [ ] Replace stub transcript timer with real voice session.
- [ ] Add browser microphone capture.
  - [ ] Request mic permission only when interview starts.
  - [ ] Show permission failure state.
  - [ ] Add mute/pause/end controls.
- [ ] Connect to Gemini live or chosen realtime model through a server-mediated session.
  - [ ] Avoid exposing provider secrets in the browser.
  - [ ] Create short-lived session token from backend.
  - [ ] Stream user audio to model.
  - [ ] Stream model audio back to browser.
- [ ] Build witness system prompt.
  - [ ] Persona: name, age, role, speaking style.
  - [ ] Truth boundary: what they know, what they hide, whether they lie.
  - [ ] Consistency rules: never reveal hidden truth directly unless pressured by evidence.
  - [ ] Response style: 1-3 sentences, natural speech, noir tone.
- [ ] Persist transcript lines.
  - [ ] User turns.
  - [ ] Witness turns.
  - [ ] System events: connected, paused, ended.
- [ ] Update UI from realtime events.
  - [ ] Live waveform from input/output audio analyser.
  - [ ] Auto-scroll transcript.
  - [ ] Disable duplicate transcript insertion.
  - [ ] End call returns to case file.

## 5. Accusation Flow

- [ ] Replace local string-match accusation evaluation.
- [ ] Keep speech input, but persist final accusation.
- [ ] Add text fallback for browsers without speech recognition.
- [ ] Implement backend `evaluateAccusation(sessionId, accusationText)`.
  - [ ] Normalize suspect names and aliases.
  - [ ] Compare against hidden truth.
  - [ ] Ask GPT-5.5 to judge ambiguous spoken names if needed.
  - [ ] Return `isCorrect`, killer name, missed clues, and reveal narration.
- [ ] Save accusation result on session.
- [ ] Route to reveal screen after backend evaluation completes.
- [ ] Add loading state: "Filing accusation..."

## 6. Reveal Screen

- [ ] Adapt reveal screen to the dossier design system.
  - [ ] Case closed / wrong call stamp.
  - [ ] Timeline reconstruction on paper.
  - [ ] Killer card.
  - [ ] Motive, method, hidden clue.
- [ ] Use backend reveal narration instead of local `buildReveal()`.
- [ ] Play reveal narration audio if available.
- [ ] Add "Generate New Case" action.
- [ ] Add "Review Case File" action.

## 7. Frontend State Wiring

- [ ] Replace static `raymondTeoCase` boot flow.
  - [x] Loading screen calls backend `startNewCase()`.
  - [x] Case file renders backend-provided public case.
  - [ ] Media placeholders swap to generated assets when ready.
- [ ] Handle generation progress.
  - [ ] Mystery JSON ready.
  - [ ] Scene image ready.
  - [ ] 911 audio ready.
  - [ ] Witness voices ready.
- [ ] Add error states.
  - [ ] Case generation failed.
  - [ ] Media generation failed but text case is playable.
  - [ ] Voice connection failed.
- [ ] Keep all screen transitions functional.
  - [ ] Briefing to interview.
  - [ ] Interview back to briefing.
  - [ ] Briefing/interview to accusation.
  - [ ] Accusation to reveal.
  - [ ] Reveal to new case.

## 8. Environment Variables

- [ ] `OPENAI_API_KEY`
- [ ] `ELEVENLABS_API_KEY`
- [ ] `GEMINI_API_KEY`
- [x] `CONVEX_DEPLOYMENT` or equivalent backend deployment value.
- [x] `VITE_CONVEX_URL` or equivalent public backend URL.
- [ ] Optional: `LYRIA_API_KEY`

Do not expose server-only provider keys through `VITE_` variables.

## 9. Hackathon MVP Order

1. [ ] Backend session and case storage.
2. [ ] Generate mystery JSON and render it in current UI.
3. [ ] Spoken accusation persisted and evaluated server-side.
4. [ ] Real Gemini live witness call with transcript persistence.
5. [ ] Crime scene image generation.
6. [ ] 911 audio generation and playback.
7. [ ] Reveal narration and polished reveal screen.
8. [ ] Ambient score and cinematic polish.

The demo is shippable once items 1-4 work end to end.

## 10. Acceptance Criteria

- [ ] Starting the app creates or resumes a session.
- [ ] A generated case is saved and can be reloaded by id.
- [ ] Hidden truth never appears in the frontend payload.
- [ ] Interview transcript persists across navigation.
- [ ] Witness answers stay in character and consistent with the hidden truth.
- [ ] Accusation result is evaluated by backend using the saved hidden truth.
- [ ] Reveal explains the correct killer, motive, method, and missed clue.
- [ ] The app remains playable if image/audio generation fails.
- [ ] No API secrets are shipped to the browser.
