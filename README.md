# Archive_404

An interactive detective experience where players investigate a murder by reviewing evidence, listening to the emergency call, interrogating AI witnesses/suspects (with distinct voices), and filing an accusation.

Built for hackathon judging with end-to-end sponsor integration.

## Hackathon Submission Snapshot

### Problem
Most detective demos are either:
- static story viewers, or
- AI chat demos with no gameplay structure.

We wanted a playable loop where AI is not just a gimmick: clues, interviews, voices, and reveal all connect to one coherent case state.

### Solution
This app delivers a full case pipeline:
1. Generate or load case dossiers.
2. Hydrate media (scene/evidence/witness assets + audio).
3. Let the player interrogate witnesses with grounded AI personas.
4. Enforce investigation constraints (max 3 questions per witness).
5. Score accusation and reveal outcome.

### Why it is different
- Structured game flow, not freeform chat.
- Case-backed witness personas tied to evidence context.
- Distinct voice playback for witness responses.
- Persistent case/session state and reusable generated assets.

## Sponsor Technology Usage

### Convex (primary backend sponsor surface)
- Case/session/transcript persistence
- Function orchestration (`query`, `mutation`, `action`, `internal*`)
- Storage for generated images/audio URLs
- Media hydration polling + backfill workflows
- Admin curation utility for rendered case quality

### OpenAI
- Case generation in strict JSON format
- Persona response generation for interrogation
- Image fallback generation (scene/evidence/portraits)
- TTS fallback generation for 911 and witness speech

### ElevenLabs
- Primary voice generation for:
  - 911 call narration
  - witness intro lines
  - witness reply audio in interrogation
- Voice IDs per witness/suspect to keep voices distinct

### FAL
- Primary visual generation path for scene/evidence renders

### Exa
- Retrieval/corpus grounding for more realistic case generation prompts

## Core Gameplay

### Start State
- App boots into a concrete anchor case: `case_colonel_russell_williams_2010`.
- Player can click **Investigate New Case** to shuffle to another existing case.

### Case Dossier Screen
- Scene image (+ optional 3D model)
- 911 transcript and user-controlled playback (no autoplay)
- Incident lead sheet with actionable context
- Evidence cards (+ optional 3D asset view)
- Suspect/witness roster with portraits

### Interrogation Screen
- One witness thread at a time
- AI persona replies grounded in:
  - public brief
  - witness public profile
  - hidden behavior constraints (lie/cooperate strategy)
- Hard cap: **3 questions per witness**
- Reply lines can include generated voice audio and playback controls

### Accusation + Reveal
- Player files suspect accusation
- Backend evaluates against hidden truth
- Reveal screen explains outcome

## Architecture Overview

- **Frontend:** React + TypeScript + Vite + Zustand
- **Backend:** Convex
- **Storage:** Convex `_storage`
- **UI style:** dossier/noir investigative interface

## Key Modules

- `src/screens/*` - case, interrogation, accusation, reveal
- `src/store/gameStore.ts` - global state and backend orchestration
- `src/backend/*` - local/Convex adapters
- `convex/caseEngine.ts` - case schema, validation, fallback 911 normalization
- `convex/cases.ts` - case creation/loading/snapshots + admin pruning
- `convex/media.ts` - image/audio generation and hydration
- `convex/interrogation.ts` - witness persona Q&A + voice reply synthesis
- `convex/sessions.ts` - phase transitions + transcript persistence

## Setup

### 1) Install
```bash
npm install
```

### 2) Environment
Use `.env.local` for frontend vars and configure provider secrets in Convex dashboard.

Frontend:
- `VITE_CONVEX_URL`
- `VITE_ACTIVE_CASE_ID` (optional local package mode)

Convex environment:
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_IMAGE_MODEL`
- `OPENAI_IMAGE_SIZE`
- `OPENAI_IMAGE_QUALITY`
- `OPENAI_WITNESS_PORTRAIT_SIZE`
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_MODEL_ID`
- `ELEVENLABS_CALL911_VOICE_ID`
- `EXA_API_KEY`
- `FAL_API_KEY`

### 3) Run backend
```bash
npx convex dev
```

### 4) Run frontend
```bash
npm run dev
```

### 5) Build check
```bash
npm run build
```

## Reliability / Degradation Behavior

- If Convex is unavailable, app can run local backend fallback.
- If one generation provider fails, fallback paths continue where possible.
- If voice synthesis fails for a witness reply, text reply still lands.
- Media generation is persisted and reused across sessions.

## Admin Utility (Data Curation)

`cases:pruneCasesKeepingRendered`
- Keeps top N fully rendered cases
- Deletes non-selected case trees and linked session/transcript/media/audio rows
- Supports dry-run mode

Example:
```bash
npx convex run cases:pruneCasesKeepingRendered '{"targetCount":5,"dryRun":true}'
```

## Quick Demo Script (for judges)

1. Open app -> default case loads.
2. Play 911 call and show incident lead sheet.
3. Open one suspect interview.
4. Ask 2-3 questions and play generated voice replies.
5. Return and file accusation.
6. Show reveal.

This demonstrates a complete sponsor-powered gameplay loop:
**retrieval -> generation -> media synthesis -> interrogation -> scoring -> reveal**.
