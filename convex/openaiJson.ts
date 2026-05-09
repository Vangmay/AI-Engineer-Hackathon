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

type ChatCompletionPayload = {
  choices?: Array<{
    message?: { role?: string; content?: string | Array<{ text?: string }> };
    finish_reason?: string;
  }>;
};

/** Plain conversational reply (Chat Completions) for witness personas. */
export async function fetchOpenAiChatText(params: {
  apiKey: string;
  model: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
}): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      messages: params.messages,
      temperature: 0.75,
      max_tokens: 400,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI chat ${response.status}: ${await response.text()}`);
  }

  const payload = (await response.json()) as ChatCompletionPayload;
  const raw = payload.choices?.[0]?.message?.content;

  const text =
    typeof raw === 'string'
      ? raw.trim()
      : Array.isArray(raw)
        ? raw
            .filter((chunk) => typeof chunk?.text === 'string')
            .map((chunk) => chunk.text as string)
            .join('')
            .trim()
        : '';

  if (!text) throw new Error('OpenAI returned no chat text.');
  return text;
}
