import OpenAI from 'openai';
import fs from 'fs';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export interface TranscriptionResult {
  text: string;
  words?: Array<{ word: string; start: number; end: number }>;
}

export async function transcribeAudio(filePath: string): Promise<TranscriptionResult> {
  const response = await openai.audio.transcriptions.create({
    file: fs.createReadStream(filePath),
    model: 'whisper-1',
    language: 'es',
    response_format: 'verbose_json',
    // @ts-ignore — timestamp_granularities is valid for verbose_json
    timestamp_granularities: ['word'],
  });

  return {
    text: response.text,
    // @ts-ignore — words is present in verbose_json
    words: (response as any).words || [],
  };
}
