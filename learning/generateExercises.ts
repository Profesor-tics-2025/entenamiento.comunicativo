import Anthropic from '@anthropic-ai/sdk';
import pool from '../server/db.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

function similarity(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\s+/));
  const setB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = [...setA].filter(w => setB.has(w)).length;
  return intersection / Math.max(setA.size, setB.size);
}

export async function generateExercises(): Promise<number> {
  // Find top 3 categories by lowest pass rate in last 14 days
  const [catRows] = await pool.query(
    `SELECT ep.category, COUNT(*) as total, SUM(s.passed) as passed,
            COALESCE(SUM(s.passed) / COUNT(*), 0) as pass_rate
     FROM sessions s JOIN exercise_prompts ep ON ep.id = s.exercise_id
     WHERE s.started_at >= DATE_SUB(NOW(), INTERVAL 14 DAY) AND s.ended_at IS NOT NULL
     GROUP BY ep.category HAVING total >= 3
     ORDER BY pass_rate ASC LIMIT 3`
  ) as any;

  if ((catRows as any[]).length === 0) return 0;

  let created = 0;
  for (const cat of catRows as any[]) {
    try {
      // Get existing exercise titles in this category
      const [exRows] = await pool.query('SELECT title_es FROM exercise_prompts WHERE category = ?', [cat.category]) as any;
      const existingTitles = (exRows as any[]).map((r: any) => r.title_es);

      const prompt = `Genera un nuevo ejercicio de comunicación oral en español para la categoría "${cat.category}".
Responde SOLO con JSON válido:
{
  "title_es": "string (max 60 chars)",
  "description_es": "string (max 200 chars, instrucciones claras)",
  "duration_target_seconds": number (30-600),
  "difficulty": "short"|"medium"|"long",
  "prompt_text_es": "string o null"
}
Títulos existentes (NO repetir): ${existingTitles.slice(0, 10).join(', ')}`;

      const resp = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = resp.content[0].type === 'text' ? resp.content[0].text.trim() : '';
      const newEx = JSON.parse(text.replace(/```json?/g, '').replace(/```/g, '').trim());

      // Similarity check
      const isSimilar = existingTitles.some((t: string) => similarity(t, newEx.title_es) > 0.8);
      if (isSimilar) continue;

      const levelMap: Record<string, number> = {
        'Lectura Controlada': 1, 'Soltura y Desinhibición': 4, 'Presentación Personal': 5,
        'Estructura Oral': 6, 'Entrevista Laboral': 6, 'Videoconferencia Profesional': 8,
        'Resistencia Comunicativa': 9,
      };

      await pool.query(
        'INSERT INTO exercise_prompts (category, level_required, title_es, description_es, duration_target_seconds, difficulty, prompt_text_es) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [cat.category, levelMap[cat.category] || 5, newEx.title_es, newEx.description_es, newEx.duration_target_seconds, newEx.difficulty, newEx.prompt_text_es || null]
      );
      created++;
    } catch (e) {
      console.warn(`[generateExercises] Failed for category ${cat.category}:`, e);
    }
  }

  console.log(`[generateExercises] Created ${created} new exercises`);
  return created;
}
