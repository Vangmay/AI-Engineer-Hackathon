import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL as string | undefined;

interface ConvexMediaDoc {
  sceneImageUrl?: string;
  evidenceRenders?: Record<string, string>;
  evidenceModels?: Record<string, string>;
  evidenceModelPreviews?: Record<string, string>;
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
    const data = await res.json() as { status: string; value: T };
    return data.status === 'success' ? data.value : null;
  } catch {
    return null;
  }
}

export function ConvexMediaSync() {
  const synced = useRef(false);
  const caseData = useGameStore((s) => s.caseData);
  const setConvexMedia = useGameStore((s) => s.setConvexMedia);

  const caseId = caseData?.case_id ?? null;

  useEffect(() => {
    if (synced.current || !CONVEX_URL || !caseId) return;
    synced.current = true;

    void (async () => {
      const media = await convexQuery<ConvexMediaDoc>('media:getMediaByCaseStringId', { caseId });
      if (!media) return;

      const hasModels = media.evidenceModels && Object.keys(media.evidenceModels).length > 0;
      if (!hasModels && !media.sceneImageUrl) return;

      setConvexMedia({
        sceneImageUrl: media.sceneImageUrl ?? null,
        evidenceImageUrls: media.evidenceRenders ?? {},
        evidenceModelUrls: media.evidenceModels ?? {},
        evidenceModelPreviewUrls: media.evidenceModelPreviews ?? {},
      });
    })();
  }, [caseId, setConvexMedia]);

  return null;
}
