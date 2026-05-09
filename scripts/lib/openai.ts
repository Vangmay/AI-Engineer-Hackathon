interface OpenAIMessage {
  role: 'system' | 'user';
  content: string;
}

interface OpenAIResponsePayload {
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
}

export async function generateJson<T>(input: {
  apiKey: string;
  model: string;
  system: string;
  prompt: string;
}): Promise<T> {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model: input.model,
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: input.system }],
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: input.prompt }],
        },
      ] satisfies Array<{
        role: OpenAIMessage['role'];
        content: Array<{ type: string; text: string }>;
      }>,
      text: {
        format: {
          type: 'json_object',
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed: ${response.status} ${await response.text()}`);
  }

  const payload = (await response.json()) as OpenAIResponsePayload;
  const text = payload.output
    ?.flatMap((item) => item.content ?? [])
    .find((item) => item.type === 'output_text' && item.text)?.text;

  if (!text) {
    throw new Error('OpenAI response did not return JSON text output.');
  }

  return JSON.parse(text) as T;
}
