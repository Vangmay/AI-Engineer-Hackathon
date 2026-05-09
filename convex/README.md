# Backend Foundation

This directory is the Convex backend target for Crime Scene.

The frontend currently talks to `src/backend/client.ts`, which uses a local
adapter implementing the same backend contract. Once Convex is configured, swap
that client to call these server functions through the generated Convex API.

## Files

- `schema.ts` defines sessions, cases, witnesses, transcripts, and media.
- `cases.ts` creates a static fallback case/session and reads a session snapshot.
- `sessions.ts` handles phase transitions and transcript persistence.
- `accusations.ts` evaluates an accusation against hidden truth and saves reveal state.

## Next Steps

1. Run `npx convex dev` to generate `convex/_generated/*`.
2. Replace the static fallback in `cases.ts` with the mystery generation engine.
3. Add server-side provider calls for image/audio/live voice.
4. Replace `src/backend/client.ts` with a Convex-backed adapter.
5. Keep provider API keys server-side. Only `VITE_CONVEX_URL` should be public.
