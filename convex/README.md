# Backend Foundation

This directory is the Convex backend target for Crime Scene.

The frontend currently talks to `src/backend/client.ts`, which uses a local
adapter implementing the same backend contract. Once Convex is configured, swap
that client to call these server functions through the generated Convex API.

## Files

- `schema.ts` defines sessions, cases, witnesses, transcripts, and media.
- `caseEngine.ts` holds mystery JSON shape, validation, template generator, LLM prompts, and static fallback dossier.
- `openaiJson.ts` calls OpenAI JSON mode (`/v1/responses`).
- `exaSearch.ts` calls the Exa search API and builds a bounded text corpus (queries prefer `site:en.wikipedia.org` so hits are often Wikipedia summaries).
- `cases.ts` exposes `startNewCase` **action**: optional Exa retrieval → OpenAI JSON dossier (corpus-backed prompt when enough text) → validate → persist; template fallback if keys or parsing fail. Also `startNewCaseFromTemplate` **mutation**, `generateCase`, and `getSessionSnapshot`.
- `sessions.ts` handles phase transitions and transcript persistence.
- `accusations.ts` evaluates an accusation against hidden truth and saves reveal state.

## Next Steps

1. Run `npm run convex:dev` (or `npx convex dev`) to generate `convex/_generated/*`.
2. In **Convex Dashboard → Settings → Environment variables**, set `OPENAI_API_KEY` and **`EXA_API_KEY`** for real-case–inspired generation. Optionally set `OPENAI_MODEL` (defaults to `gpt-4o-mini` in code). Never put these behind `VITE_`.
3. From the frontend, set **`VITE_CONVEX_URL`** in `.env.local` (restart Vite). `src/main.tsx` creates **`ConvexReactClient`**, calls **`setGameBackend(createConvexGameBackend(client))` synchronously** (so the loading screen does not hit local Raymond first), then wraps **`ConvexProvider`**. **`loadStaticCase`** calls **`cases.startNewCase`**. Without `VITE_CONVEX_URL`, the app keeps the local Raymond adapter.
4. Add server-side provider calls for image/audio/live voice when ready.
5. Replace `src/backend/client.ts` with a Convex-backed adapter.
6. Only `VITE_CONVEX_URL` should be exposed to the browser for Convex connectivity.
