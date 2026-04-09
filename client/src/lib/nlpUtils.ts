// Client-side NLP utilities (mirrors server/services/nlp.ts)

const FILLERS_ES = new Set([
  'o sea que', 'en plan', 'osea', 'o sea', 'bueno', 'este', 'esteee',
  'a ver', 'pues', 'y nada', 'tipo', 'es que', 'mmm', 'eh', 'ahh', 'eeeh', 'umm',
]);

const OPENERS = ['en primer lugar', 'respecto a', 'en relacion con', 'para comenzar', 'antes de nada', 'primeramente'];
const CLOSERS = ['en definitiva', 'para concluir', 'en sintesis', 'en resumen', 'como conclusion', 'finalmente', 'para terminar'];

export interface NLPResult {
  wpm: number;
  fillerCount: number;
  fillerPerMin: number;
  topFillers: string[];
  lexicalRichness: number;
  hasOpening: boolean;
  hasClosing: boolean;
}

export function analyzePartialTranscript(text: string, elapsedSeconds: number): NLPResult {
  const lower = text.toLowerCase().replace(/[^\w\s]/g, '');
  const tokens = lower.split(/\s+/).filter(Boolean);
  const durationMin = Math.max(elapsedSeconds / 60, 0.01);

  const fillerCounts: Record<string, number> = {};
  let i = 0;
  while (i < tokens.length) {
    let matched = false;
    if (i + 2 < tokens.length) {
      const tri = `${tokens[i]} ${tokens[i+1]} ${tokens[i+2]}`;
      if (FILLERS_ES.has(tri)) { fillerCounts[tri] = (fillerCounts[tri] || 0) + 1; i += 3; matched = true; }
    }
    if (!matched && i + 1 < tokens.length) {
      const bi = `${tokens[i]} ${tokens[i+1]}`;
      if (FILLERS_ES.has(bi)) { fillerCounts[bi] = (fillerCounts[bi] || 0) + 1; i += 2; matched = true; }
    }
    if (!matched) {
      if (FILLERS_ES.has(tokens[i])) fillerCounts[tokens[i]] = (fillerCounts[tokens[i]] || 0) + 1;
      i++;
    }
  }

  const fillerCount = Object.values(fillerCounts).reduce((a, b) => a + b, 0);
  const topFillers = Object.entries(fillerCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([w, c]) => `"${w}" x${c}`);

  return {
    wpm: Math.round(tokens.length / durationMin),
    fillerCount,
    fillerPerMin: Math.round((fillerCount / durationMin) * 100) / 100,
    topFillers,
    lexicalRichness: tokens.length > 0 ? new Set(tokens).size / tokens.length : 0,
    hasOpening: OPENERS.some(o => lower.includes(o)),
    hasClosing: CLOSERS.some(c => lower.includes(c)),
  };
}
