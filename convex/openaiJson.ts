/**
 * Convex action runtime: call OpenAI JSON mode (responses API — same shape as scripts/lib/openai.ts).
 */

interface OpenAIResponsePayload {
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
}

export async function fetchOpenAiJson<T>(params: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
}): Promise<T> {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: params.system }],
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: params.user }],
        },
      ],
      text: {
        format: {
          type: 'json_object',
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI ${response.status}: ${await response.text()}`);
  }

  const payload = (await response.json()) as OpenAIResponsePayload;
  const text = payload.output
    ?.flatMap((item) => item.content ?? [])
    .find((item) => item.type === 'output_text' && item.text)?.text;

  if (!text) throw new Error('OpenAI returned no JSON text output.');

  return JSON.parse(text) as T;
}
