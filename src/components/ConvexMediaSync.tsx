import { useAction } from 'convex/react';
import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { api } from '../../convex/_generated/api';

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL as string | undefined;

interface LobbyHydration {
  sceneImageUrl: string | null;
  call911AudioUrl: string | null;
  witnessIntroAudioUrls: Record<string, string>;
  witnessPortraitUrls: Record<string, string>;
  evidenceImageUrls: Record<string, string>;
  evidenceModels: Record<string, string>;
  evidenceModelPreviewUrls: Record<string, string>;
}

async function convexQuery<T>(name: string, args: Record<string, unknown>): Promise<T | null> {
  if (!CONVEX_URL) return null;
  try {
    const res = await fetch(`${CONVEX_URL}/api/query`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: name, args }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { status: string; value: T };
    return data.status === 'success' ? data.value : null;
  } catch {
    return null;
  }
}

function ConvexMediaSyncInner() {
  const ensureLobbyMediaIfMissingForSlug = useAction(api.media.ensureLobbyMediaIfMissingForSlug);
  const caseData = useGameStore((s) => s.caseData);
  const caseId = caseData?.case_id ?? null;
  const witnessCount = caseData?.witnesses?.length ?? 0;
  const clueCount = caseData?.clues?.length ?? 0;
  const setConvexMedia = useGameStore((s) => s.setConvexMedia);
  const activeSlug = useRef<string | null>(null);
  const ensureRequested = useRef(false);

  useEffect(() => {
    ensureRequested.current = false;
  }, [caseId]);

  useEffect(() => {
    if (!CONVEX_URL || !caseId) return;
    activeSlug.current = caseId;

    let attempts = 0;
    const maxAttempts = 36;
    const intervalMs = 2200;

    const apply = (h: LobbyHydration) => {
      setConvexMedia({
        sceneImageUrl: h.sceneImageUrl,
        evidenceImageUrls: h.evidenceImageUrls,
        evidenceModelUrls: h.evidenceModels,
        evidenceModelPreviewUrls: h.evidenceModelPreviewUrls,
        call911AudioUrl: h.call911AudioUrl ?? undefined,
        witnessIntroAudioUrls:
          Object.keys(h.witnessIntroAudioUrls).length > 0 ? h.witnessIntroAudioUrls : undefined,
        witnessPortraitUrls:
          Object.keys(h.witnessPortraitUrls ?? {}).length > 0
            ? (h.witnessPortraitUrls ?? {})
            : undefined,
      });
    };

    let iv = 0;
    const tick = async () => {
      if (activeSlug.current !== caseId) return;
      attempts += 1;
      const h = await convexQuery<LobbyHydration>('media:getLobbyMediaHydration', {
        dossierSlug: caseId,
      });
      if (h && activeSlug.current === caseId) {
        apply(h);
        const nonEmptyIntros = Object.keys(h.witnessIntroAudioUrls ?? {}).filter((id) =>
          Boolean(h.witnessIntroAudioUrls[id]?.trim()),
        ).length;
        const missingIntro = witnessCount > 0 ? nonEmptyIntros < witnessCount : false;
        const missing911 = !h.call911AudioUrl?.trim();
        let missingEvidence = false;
        for (let i = 0; i < clueCount; i++) {
          if (!h.evidenceImageUrls[String(i)]?.trim()) {
            missingEvidence = true;
            break;
          }
        }
        const missingScene = !h.sceneImageUrl?.trim();
        const portraitMap = h.witnessPortraitUrls ?? {};
        const widList = useGameStore.getState().caseData?.witnesses?.map((w) => w.id) ?? [];
        const missingPortrait =
          widList.length > 0 && widList.some((wid) => !String(portraitMap[wid] ?? '').trim());
        if (
          !ensureRequested.current &&
          (missing911 || missingIntro || missingScene || missingEvidence || missingPortrait) &&
          activeSlug.current === caseId
        ) {
          ensureRequested.current = true;
          void ensureLobbyMediaIfMissingForSlug({ dossierSlug: caseId }).catch(() => {
            ensureRequested.current = false;
          });
        }
      }
      if (attempts >= maxAttempts && iv) window.clearInterval(iv);
    };

    void tick();
    iv = window.setInterval(() => void tick(), intervalMs);
    return () => {
      if (iv) window.clearInterval(iv);
    };
  }, [caseId, setConvexMedia, witnessCount, clueCount, ensureLobbyMediaIfMissingForSlug]);

  return null;
}

/** Polls Convex for lobby URLs; triggers FAL (scene + clue stills) and TTS when gaps are detected. */
export function ConvexMediaSync() {
  if (!CONVEX_URL) return null;
  return <ConvexMediaSyncInner />;
}
