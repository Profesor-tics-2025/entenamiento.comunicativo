import pool from '../server/db.js';

export async function updateUserMemory(): Promise<number> {
  // Find active users in last 7 days
  const [userRows] = await pool.query(
    `SELECT DISTINCT user_id FROM sessions WHERE started_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`
  ) as any;

  let updated = 0;
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  for (const { user_id } of userRows as any[]) {
    try {
      const [metricRows] = await pool.query(
        `SELECT AVG(sm.filler_per_min) as avg_filler, AVG(sm.gaze_percentage) as avg_gaze,
                AVG(sm.latency_ms) as avg_latency
         FROM session_metrics sm JOIN sessions s ON s.id = sm.session_id
         WHERE s.user_id = ? AND s.ended_at IS NOT NULL ORDER BY s.started_at DESC LIMIT 10`,
        [user_id]
      ) as any;

      const m = (metricRows as any[])[0];
      if (!m) continue;

      const avgFiller = parseFloat(m.avg_filler) || 0;
      const avgGaze = parseFloat(m.avg_gaze) || 0;
      const avgLatency = parseFloat(m.avg_latency) || 0;

      if (avgFiller > 4) {
        await pool.query(
          `INSERT INTO user_memory (user_id, memory_type, description, occurrence_count, last_seen)
           VALUES (?, 'filler', ?, 1, ?)
           ON DUPLICATE KEY UPDATE description=VALUES(description), occurrence_count=occurrence_count+1, last_seen=VALUES(last_seen)`,
          [user_id, `Promedio de muletillas: ${avgFiller.toFixed(1)}/min`, now]
        );
        updated++;
      }

      if (avgGaze < 50) {
        await pool.query(
          `INSERT INTO user_memory (user_id, memory_type, description, occurrence_count, last_seen)
           VALUES (?, 'gaze', ?, 1, ?)
           ON DUPLICATE KEY UPDATE description=VALUES(description), occurrence_count=occurrence_count+1, last_seen=VALUES(last_seen)`,
          [user_id, `Contacto visual promedio: ${avgGaze.toFixed(1)}%`, now]
        );
        updated++;
      }

      if (avgLatency > 2500) {
        await pool.query(
          `INSERT INTO user_memory (user_id, memory_type, description, occurrence_count, last_seen)
           VALUES (?, 'rigidity', ?, 1, ?)
           ON DUPLICATE KEY UPDATE description=VALUES(description), occurrence_count=occurrence_count+1, last_seen=VALUES(last_seen)`,
          [user_id, `Latencia de inicio promedio: ${Math.round(avgLatency)}ms`, now]
        );
        updated++;
      }
    } catch (e) {
      console.warn(`[updateUserMemory] Error for user ${user_id}:`, e);
    }
  }

  console.log(`[updateUserMemory] Updated ${updated} memory entries`);
  return updated;
}
