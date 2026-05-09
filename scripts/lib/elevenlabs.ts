interface VoiceLibraryVoice {
  voice_id?: string;
  name?: string;
}

export interface ElevenVoiceChoice {
  voiceId?: string;
  voiceName?: string;
  previewAudioBase64?: string;
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

export async function designVoice(input: {
  apiKey: string;
  voiceDescription: string;
  sampleText: string;
  modelId?: string;
  referenceAudioBase64?: string;
}): Promise<ElevenVoiceChoice> {
  const response = await fetch('https://api.elevenlabs.io/v1/text-to-voice/design', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'xi-api-key': input.apiKey,
    },
    body: JSON.stringify({
      voice_description: input.voiceDescription,
      text: input.sampleText,
      model_id: input.modelId ?? 'eleven_multilingual_ttv_v2',
      should_enhance: true,
      ...(input.referenceAudioBase64
        ? {
            reference_audio_base64: input.referenceAudioBase64,
            prompt_strength: 0.65,
          }
        : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(`ElevenLabs voice design failed: ${response.status} ${await response.text()}`);
  }

  const payload = (await response.json()) as {
    previews?: Array<{
      generated_voice_id?: string;
      audio_base_64?: string;
    }>;
  };
  const preview = payload.previews?.[0];

  return {
    voiceId: preview?.generated_voice_id,
    previewAudioBase64: preview?.audio_base_64,
  };
}

export async function createVoiceFromDesign(input: {
  apiKey: string;
  voiceName: string;
  voiceDescription: string;
  generatedVoiceId: string;
}): Promise<ElevenVoiceChoice> {
  const response = await fetch('https://api.elevenlabs.io/v1/text-to-voice', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'xi-api-key': input.apiKey,
    },
    body: JSON.stringify({
      voice_name: input.voiceName,
      voice_description: input.voiceDescription,
      generated_voice_id: input.generatedVoiceId,
    }),
  });

  if (!response.ok) {
    throw new Error(`ElevenLabs create voice failed: ${response.status} ${await response.text()}`);
  }

  const payload = (await response.json()) as {
    voice_id?: string;
    name?: string;
  };

  return {
    voiceId: payload.voice_id,
    voiceName: payload.name,
  };
}

export async function synthesizeSpeech(input: {
  apiKey: string;
  voiceId: string;
  text: string;
  modelId?: string;
}): Promise<Uint8Array> {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${input.voiceId}?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'xi-api-key': input.apiKey,
      },
      body: JSON.stringify({
        text: input.text,
        model_id: input.modelId ?? 'eleven_multilingual_v2',
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`ElevenLabs speech synthesis failed: ${response.status} ${await response.text()}`);
  }

  return new Uint8Array(await response.arrayBuffer());
}
