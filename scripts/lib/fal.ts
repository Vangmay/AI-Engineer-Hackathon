interface FalImageFile {
  url?: string;
  width?: number;
  height?: number;
  content_type?: string;
  file_name?: string;
  file_size?: number;
}

interface FalImageResponse {
  images?: FalImageFile[];
}

interface FalModelResponse {
  model_glb?: FalImageFile;
  model_mesh?: FalImageFile;
  thumbnail?: FalImageFile;
  model_urls?: {
    glb?: FalImageFile;
    obj?: FalImageFile;
    fbx?: FalImageFile;
    usdz?: FalImageFile;
  };
  output?: string;
}

interface FalQueueSubmitResponse {
  request_id: string;
  response_url?: string;
  status_url?: string;
}

interface FalQueueStatusResponse {
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED';
  response_url?: string;
  error?: string;
  error_type?: string;
}

interface FalQueueResultResponse<T> {
  status?: string;
  response?: T;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`fal request failed: ${response.status} ${text}`);
  }
  return JSON.parse(text) as T;
}

async function falRun<T>(input: {
  apiKey: string;
  model: string;
  body: Record<string, unknown>;
}): Promise<T> {
  const response = await fetch(`https://fal.run/${input.model}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Key ${input.apiKey}`,
    },
    body: JSON.stringify(input.body),
  });
  return readJsonResponse<T>(response);
}

async function falQueueRun<T>(input: {
  apiKey: string;
  model: string;
  body: Record<string, unknown>;
  timeoutMs?: number;
  pollMs?: number;
}): Promise<T> {
  const timeoutMs = input.timeoutMs ?? 8 * 60 * 1000;
  const pollMs = input.pollMs ?? 2500;
  const submitted = await readJsonResponse<FalQueueSubmitResponse>(
    await fetch(`https://queue.fal.run/${input.model}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Key ${input.apiKey}`,
      },
      body: JSON.stringify(input.body),
    }),
  );

  const statusUrl =
    submitted.status_url ??
    `https://queue.fal.run/${input.model}/requests/${submitted.request_id}/status`;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const status = await readJsonResponse<FalQueueStatusResponse>(
      await fetch(`${statusUrl}${statusUrl.includes('?') ? '&' : '?'}logs=1`, {
        headers: { authorization: `Key ${input.apiKey}` },
      }),
    );

    if (status.error) {
      throw new Error(
        `fal queue failed: ${status.error_type ?? 'unknown'} ${status.error}`,
      );
    }

    if (status.status === 'COMPLETED') {
      const responseUrl =
        status.response_url ??
        submitted.response_url ??
        `https://queue.fal.run/${input.model}/requests/${submitted.request_id}`;
      const payload = await readJsonResponse<FalQueueResultResponse<T> | T>(
        await fetch(responseUrl, {
          headers: { authorization: `Key ${input.apiKey}` },
        }),
      );
      if (
        typeof payload === 'object' &&
        payload !== null &&
        'response' in payload &&
        payload.response !== undefined
      ) {
        return payload.response;
      }
      return payload as T;
    }

    await sleep(pollMs);
  }

  throw new Error(`fal queue timed out for ${input.model}`);
}

function firstUrl(files: FalImageFile[] | undefined): string | undefined {
  return files?.find((file) => file.url)?.url;
}

export function isUsableFalInputUrl(url: string | undefined): boolean {
  if (!url) return false;
  if (url.startsWith('data:')) return true;
  try {
    const parsed = new URL(url);
    return (
      (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
      parsed.hostname !== 'example.local' &&
      parsed.hostname !== 'localhost' &&
      parsed.hostname !== '127.0.0.1'
    );
  } catch {
    return false;
  }
}

export async function createFalImageDraft(input: {
  apiKey: string;
  prompt: string;
  model?: string;
  imageUrl?: string;
  aspectRatio?: '1:1' | '4:3' | '3:4' | '16:9' | '9:16';
}): Promise<{ outputUri: string; modelName: string }> {
  const hasReference = isUsableFalInputUrl(input.imageUrl);
  const model =
    input.model ??
    (hasReference
      ? 'fal-ai/flux-pro/kontext/max'
      : 'fal-ai/flux-pro');
  const payload = await falRun<FalImageResponse>({
    apiKey: input.apiKey,
    model,
    body: {
      prompt: input.prompt,
      ...(hasReference ? { image_url: input.imageUrl } : {}),
      aspect_ratio: input.aspectRatio ?? (hasReference ? '3:4' : '4:3'),
      num_images: 1,
      output_format: 'jpeg',
      safety_tolerance: 6,
      enhance_prompt: false,
    },
  });

  const outputUri = firstUrl(payload.images);
  if (!outputUri) {
    throw new Error('fal response did not contain an image URL.');
  }

  return {
    outputUri,
    modelName: model,
  };
}

export async function createFalImageTo3DDraft(input: {
  apiKey: string;
  imageUrl: string;
  model?: string;
}): Promise<{ outputUri: string; previewUri?: string; modelName: string }> {
  const model = input.model ?? 'fal-ai/hyper3d/rodin';
  const isRodin = model.includes('rodin');
  const isHunyuan = model.includes('hunyuan3d');

  const body: Record<string, unknown> = isRodin
    ? {
        input_image_urls: [input.imageUrl],
        geometry_file_format: 'glb',
        quality: 'high',
        material: 'PBR',
      }
    : isHunyuan
      ? {
          input_image_url: input.imageUrl,
          face_count: 500000,
          generate_type: 'Normal',
          polygon_type: 'triangle',
          enable_pbr: true,
        }
      : {
          image_url: input.imageUrl,
          topology: 'triangle',
          target_polycount: 30000,
          enable_pbr: true,
        };

  const payload = await falQueueRun<FalModelResponse>({
    apiKey: input.apiKey,
    model,
    body,
  });

  const outputUri =
    payload.model_mesh?.url ??
    payload.model_glb?.url ??
    payload.model_urls?.glb?.url ??
    payload.output;
  if (!outputUri) {
    throw new Error('fal image-to-3d response did not contain a model URL.');
  }

  return {
    outputUri,
    previewUri: payload.thumbnail?.url,
    modelName: model,
  };
}

export async function createFalTextTo3DDraft(input: {
  apiKey: string;
  prompt: string;
  model?: string;
}): Promise<{ outputUri: string; previewUri?: string; modelName: string }> {
  const model = input.model ?? 'fal-ai/meshy/v6/text-to-3d';
  const payload = await falQueueRun<FalModelResponse>({
    apiKey: input.apiKey,
    model,
    body: {
      prompt: input.prompt,
      enable_animation: false,
      enable_rigging: false,
    },
  });

  const outputUri =
    payload.model_glb?.url ?? payload.model_urls?.glb?.url ?? payload.output;
  if (!outputUri) {
    throw new Error('fal text-to-3d response did not contain a model URL.');
  }

  return {
    outputUri,
    previewUri: payload.thumbnail?.url,
    modelName: model,
  };
}
