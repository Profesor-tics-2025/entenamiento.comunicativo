import Anthropic from '@anthropic-ai/sdk';
import pool from '../server/db.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function detectNewFillers(): Promise<number> {
  // Load reports from last 30 days
  const [rows] = await pool.query(
    `SELECT r.report_json FROM reports r
     JOIN sessions s ON s.id = r.session_id
     WHERE s.started_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`
  ) as any;

  if ((rows as any[]).length === 0) return 0;

  // Extract topFillers from reports
  const tokenCounts: Record<string, number> = {};
  let totalReports = 0;

  for (const row of rows as any[]) {
    try {
      const report = typeof row.report_json === 'string' ? JSON.parse(row.report_json) : row.report_json;
      const fillers: string[] = report?.muletillasFluidez?.topFillers || [];
      totalReports++;
      for (const f of fillers) {
        const word = f.replace(/"([^"]+)" x\d+/, '$1').trim().toLowerCase();
        if (word) tokenCounts[word] = (tokenCounts[word] || 0) + 1;
      }
    } catch { /* skip malformed */ }
  }

  // Load known filler words
  const [knownRows] = await pool.query('SELECT word FROM filler_words') as any;
  const known = new Set((knownRows as any[]).map((r: any) => r.word.toLowerCase()));

  // Find candidates: appear in > 5% of sessions with freq > 3
  const candidates = Object.entries(tokenCounts)
    .filter(([word, count]) => !known.has(word) && count > 3 && count / totalReports > 0.05)
    .map(([word]) => word);

  if (candidates.length === 0) return 0;

  let added = 0;
  for (const word of candidates.slice(0, 10)) {
    try {
      const resp = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 150,
        messages: [{ role: 'user', content: `Dame una alternativa profesional para la muletilla "${word}" en español. Responde solo con la alternativa, sin explicaciones.` }],
      });
      const alt = resp.content[0].type === 'text' ? resp.content[0].text.trim() : null;
      await pool.query(
        'INSERT IGNORE INTO filler_words (word, source, suggested_alternative) VALUES (?, "detected", ?)',
        [word, alt]
      );
      added++;
    } catch { /* skip */ }
  }

  console.log(`[detectNewFillers] Added ${added} new filler words`);
  return added;
}
