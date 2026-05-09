interface VoiceLibraryVoice {
  voice_id?: string;
  name?: string;
}

export async function createVoiceCloneDraft(input: {
  apiKey: string;
  name: string;
  sampleText: string;
  modelId?: string;
}): Promise<{ voiceId?: string; previewText: string }> {
  const response = await fetch('https://api.elevenlabs.io/v1/voices', {
    method: 'GET',
    headers: {
      'xi-api-key': input.apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`ElevenLabs voice lookup failed: ${response.status} ${await response.text()}`);
  }

  const payload = (await response.json()) as { voices?: VoiceLibraryVoice[] };
  const existing = payload.voices?.find((voice) => voice.name === input.name);

  return {
    voiceId: existing?.voice_id,
    previewText: input.sampleText,
  };
}
