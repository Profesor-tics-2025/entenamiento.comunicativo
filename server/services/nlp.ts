// NLP processing for Spanish speech analysis
export interface NLPResult {
  wpm: number;
  fillerCount: number;
  fillerPerMin: number;
  topFillers: string[];
  lexicalRichness: number;
  hasOpening: boolean;
  hasClosing: boolean;
  longPauses: number;
  shortPauses: number;
}

export interface VerboseWord {
  word: string;
  start: number;
  end: number;
}

const FILLERS_ES = new Set([
  'o sea que', 'en plan', 'osea', 'o sea', 'bueno', 'este', 'esteee',
  'a ver', 'pues', 'y nada', 'tipo', 'es que', 'mmm', 'eh', 'ahh', 'eeeh', 'umm',
]);

const OPENERS = [
  'en primer lugar', 'respecto a', 'en relacion con',
  'para comenzar', 'antes de nada', 'primeramente',
];

const CLOSERS = [
  'en definitiva', 'para concluir', 'en sintesis',
  'en resumen', 'como conclusion', 'finalmente', 'para terminar',
];

export function analyzeTranscript(text: string, durationSeconds: number, words?: VerboseWord[]): NLPResult {
  const lower = text.toLowerCase();
  const clean = lower.replace(/[^\w\s]/g, '');
  const tokens = clean.split(/\s+/).filter(Boolean);

  const fillerCounts: Record<string, number> = {};
  let i = 0;
  while (i < tokens.length) {
    let matched = false;
    // Try trigram
    if (i + 2 < tokens.length) {
      const trigram = `${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`;
      if (FILLERS_ES.has(trigram)) {
        fillerCounts[trigram] = (fillerCounts[trigram] || 0) + 1;
        i += 3;
        matched = true;
      }
    }
    // Try bigram
    if (!matched && i + 1 < tokens.length) {
      const bigram = `${tokens[i]} ${tokens[i + 1]}`;
      if (FILLERS_ES.has(bigram)) {
        fillerCounts[bigram] = (fillerCounts[bigram] || 0) + 1;
        i += 2;
        matched = true;
      }
    }
    // Try unigram
    if (!matched) {
      if (FILLERS_ES.has(tokens[i])) {
        fillerCounts[tokens[i]] = (fillerCounts[tokens[i]] || 0) + 1;
      }
      i++;
    }
  }

  const fillerCount = Object.values(fillerCounts).reduce((a, b) => a + b, 0);
  const durationMin = Math.max(durationSeconds / 60, 0.01);
  const fillerPerMin = Math.round((fillerCount / durationMin) * 100) / 100;
  const wpm = Math.round(tokens.length / durationMin);
  const lexicalRichness = tokens.length > 0
    ? Math.round((new Set(tokens).size / tokens.length) * 1000) / 1000
    : 0;
  const hasOpening = OPENERS.some(o => lower.includes(o));
  const hasClosing = CLOSERS.some(c => lower.includes(c));

  const sorted = Object.entries(fillerCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const topFillers = sorted.map(([w, c]) => `"${w}" x${c}`);

  // Pause detection from word timestamps
  let longPauses = 0;
  let shortPauses = 0;
  if (words && words.length > 1) {
    for (let j = 1; j < words.length; j++) {
      const gap = words[j].start - words[j - 1].end;
      if (gap > 3.0) longPauses++;
      else if (gap >= 0.5 && gap <= 1.5) shortPauses++;
    }
  }

  return { wpm, fillerCount, fillerPerMin, topFillers, lexicalRichness, hasOpening, hasClosing, longPauses, shortPauses };
}
