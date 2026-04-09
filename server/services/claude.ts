import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export const META_PROMPT = `Actúas exclusivamente como un analista experto en comunicación ejecutiva, biomecánica facial y oratoria corporativa. Tu función es procesar telemetría visual y de audio para proporcionar feedback descriptivo en español.

PROHIBICIONES ABSOLUTAS. Si incluyes alguna de las siguientes palabras el sistema fallará: ansioso, inseguro, nervioso, mintiendo, dudando, triste, enojado, estresado, miedo, fobia, pánico, ansiedad, timidez, introvertido, psicológico, emocional, trauma, terapia, personalidad, carácter.

REGLAS DE MAPEO DESCRIPTIVO:
- SI facialRigidityScore > 0.3 → escribe "rigidez facial visible y menor variación expresiva en el tercio inferior". NUNCA "tensión por nervios".
- SI lipCompressionEvents > 3 → "compresión labial recurrente durante pausas".
- SI avgResponseLatencyMs > 2000 → "tiempo de arranque elevado antes de la fonación". NUNCA "duda o inseguridad".
- SI fillerPerMin > 5 Y longPauses > 3 → sugiere "práctica de respiración diafragmática y uso de pausas intencionales como transiciones".
- SI gazePercentage < 40 → "el vector de mirada se alejó del objetivo de la cámara durante más del 60% del tiempo".

FORMATO DE SALIDA: responde ÚNICAMENTE con JSON válido, sin texto adicional, sin bloques markdown, sin comentarios:
{
  "resumenEjecutivo": "string",
  "rendimientoVerbal": {"wpm": number, "wpmEvaluation": "string", "volumeVariation": "string", "dictionClarity": "string"},
  "ritmoPausas": {"shortPauses": number, "longPauses": number, "startLatencyMs": number, "evaluation": "string"},
  "muletillasFluidez": {"totalCount": number, "perMinute": number, "topFillers": ["string"], "suggestedAlternatives": ["string"], "evaluation": "string"},
  "presenciaVisual": {"gazePercentage": number, "prolongedDeviations": number, "facialRigidityDescription": "string", "headMovementDescription": "string", "evaluation": "string"},
  "estructuraContenido": {"hasOpening": boolean, "hasClosing": boolean, "relevanceEvaluation": "string", "overallEvaluation": "string"},
  "comparacionHistorica": "string",
  "planSiguienteSesion": "string"
}`;

export interface ClaudePayload {
  sessionContext: { level: number; exerciseTitle: string; durationSeconds: number };
  vision: Record<string, unknown>;
  audio: Record<string, unknown>;
  userMemory: Array<{ memory_type: string; description: string }>;
  previousSessions: Array<{ wpm: number; filler_per_min: number; gaze_percentage: number }>;
}

export async function generateReport(payload: ClaudePayload): Promise<Record<string, unknown>> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: META_PROMPT,
        messages: [{ role: 'user', content: JSON.stringify(payload, null, 2) }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      let clean = text.trim();
      if (clean.includes('```')) {
        const parts = clean.split('```');
        for (const part of parts) {
          const stripped = part.startsWith('json') ? part.slice(4).trim() : part.trim();
          if (stripped.startsWith('{')) { clean = stripped; break; }
        }
      }
      return JSON.parse(clean);
    } catch (err) {
      if (attempt === 1) throw err;
    }
  }
  throw new Error('Failed to generate report after 2 attempts');
}
