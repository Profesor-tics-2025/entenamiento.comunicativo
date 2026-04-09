import pool from '../server/db.js';

const METRICS = [
  'wpm', 'filler_per_min', 'gaze_percentage', 'facial_rigidity_score',
  'head_movement_score', 'latency_ms', 'long_pauses', 'lexical_richness',
];

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

export async function updateThresholds(): Promise<number> {
  let updated = 0;

  for (let level = 1; level <= 10; level++) {
    for (const metric of METRICS) {
      const [rows] = await pool.query(
        `SELECT sm.${metric} as val FROM session_metrics sm
         JOIN sessions s ON s.id = sm.session_id
         WHERE s.level = ? AND s.passed = 1 AND sm.${metric} IS NOT NULL
         ORDER BY s.started_at DESC LIMIT 200`,
        [level]
      ) as any;

      const values = (rows as any[]).map((r: any) => parseFloat(r.val)).filter((v: number) => !isNaN(v)).sort((a: number, b: number) => a - b);

      if (values.length < 10) continue; // Not enough data

      const p25 = percentile(values, 25);
      const p50 = percentile(values, 50);
      const p75 = percentile(values, 75);

      await pool.query(
        `INSERT INTO adaptive_thresholds (level, metric_name, p25, p50, p75, sample_count)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE p25=VALUES(p25), p50=VALUES(p50), p75=VALUES(p75), sample_count=VALUES(sample_count)`,
        [level, metric, p25, p50, p75, values.length]
      );
      updated++;
    }
  }

  console.log(`[updateThresholds] Updated ${updated} threshold rows`);
  return updated;
}
