export async function createFalImageDraft(input: {
  apiKey: string;
  prompt: string;
  model?: string;
}): Promise<{ outputUri: string; modelName: string }> {
  const model = input.model ?? 'fal-ai/flux/dev';
  const response = await fetch(`https://fal.run/${model}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Key ${input.apiKey}`,
    },
    body: JSON.stringify({
      prompt: input.prompt,
    }),
  });

  if (!response.ok) {
    throw new Error(`fal request failed: ${response.status} ${await response.text()}`);
  }

  const payload = (await response.json()) as {
    images?: Array<{ url?: string }>;
  };

  const outputUri = payload.images?.[0]?.url;
  if (!outputUri) {
    throw new Error('fal response did not contain an image URL.');
  }

  return {
    outputUri,
    modelName: model,
  };
}
