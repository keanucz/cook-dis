// ===========================================
// ElevenLabs Text-to-Speech Service
// ===========================================

export class ElevenLabsService {
  private apiKey: string;
  private voiceId: string;
  private baseUrl = 'https://api.elevenlabs.io/v1';

  constructor() {
    this.apiKey = process.env.ELEVENLABS_API_KEY!;
    this.voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // Rachel voice
    
    if (!this.apiKey) {
      throw new Error('ELEVENLABS_API_KEY is not configured');
    }
  }

  async synthesizeSpeech(
    text: string,
    voiceId?: string
  ): Promise<Buffer> {
    const voice = voiceId || this.voiceId;

    const response = await fetch(
      `${this.baseUrl}/text-to-speech/${voice}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} - ${error}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  // Generate narration for a cooking step
  async generateStepNarration(
    stepInstruction: string,
    stepIndex: number,
    voiceId?: string
  ): Promise<Buffer> {
    // Add context to make the narration more natural
    const narrationText = `Step ${stepIndex + 1}. ${stepInstruction}`;
    
    return this.synthesizeSpeech(narrationText, voiceId);
  }

  // Get available voices
  async getVoices(): Promise<ElevenLabsVoice[]> {
    const response = await fetch(`${this.baseUrl}/voices`, {
      headers: {
        'xi-api-key': this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch voices');
    }

    const data = await response.json();
    return data.voices;
  }
}

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  labels: Record<string, string>;
}

// Singleton instance
let elevenLabsInstance: ElevenLabsService | null = null;

export function getElevenLabsService(): ElevenLabsService {
  if (!elevenLabsInstance) {
    elevenLabsInstance = new ElevenLabsService();
  }
  return elevenLabsInstance;
}
