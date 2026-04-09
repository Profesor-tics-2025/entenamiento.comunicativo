// Level progression logic and XP rewards

export interface SessionMetrics {
  wpm: number;
  longPauses: number;
  shortPauses: number;
  fillerPerMin: number;
  gazePercentage: number;
  facialRigidityScore: number;
  latencyMs: number;
  structureScore: number;
  lexicalRichness: number;
}

export interface EvalResult {
  passed: boolean;
  xp: number;
}

const XP_BY_LEVEL: Record<number, number> = {
  1: 50, 2: 50, 3: 50,
  4: 100, 5: 100, 6: 100,
  7: 150, 8: 150, 9: 150,
  10: 250,
};

export function evaluateSession(
  metrics: SessionMetrics,
  level: number,
  durationSeconds: number
): EvalResult {
  const { wpm, longPauses, fillerPerMin, gazePercentage, facialRigidityScore, latencyMs, structureScore } = metrics;

  let passed = false;

  switch (level) {
    case 1:
      passed = true; // Any completion
      break;
    case 2:
      passed = wpm >= 100 && wpm <= 160 && longPauses === 0;
      break;
    case 3:
      passed = gazePercentage >= 40;
      break;
    case 4:
      passed = fillerPerMin <= 5 && longPauses <= 3;
      break;
    case 5:
      passed = structureScore >= 60;
      break;
    case 6:
      passed = latencyMs <= 1500 && fillerPerMin <= 3;
      break;
    case 7:
      passed = gazePercentage >= 60 && structureScore >= 70;
      break;
    case 8:
      passed = facialRigidityScore <= 0.3 && gazePercentage >= 65;
      break;
    case 9:
      passed = wpm >= 100 && gazePercentage >= 60 && fillerPerMin <= 3 && longPauses <= 2;
      break;
    case 10:
      passed = true; // Compare first half vs second half would need segment data
      break;
    default:
      passed = false;
  }

  const xp = passed ? (XP_BY_LEVEL[level] || 50) : 0;
  return { passed, xp };
}
