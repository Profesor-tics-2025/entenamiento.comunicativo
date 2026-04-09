/**
 * AudioAnalyzer — records WebM audio, analyzes RMS/dB, detects pauses.
 * Does NOT connect AnalyserNode to destination (no playback feedback).
 */
export class AudioAnalyzer {
  private audioCtx: AudioContext;
  private analyser: AnalyserNode;
  private mediaRecorder: MediaRecorder;
  private chunks: BlobPart[] = [];
  private silenceStart: number | null = null;
  private longPauses = 0;
  private shortPauses = 0;
  private readonly SILENCE_THRESHOLD_DB = -45;
  private readonly buffer: Float32Array<ArrayBuffer>;

  constructor(stream: MediaStream) {
    this.audioCtx = new AudioContext();
    const source = this.audioCtx.createMediaStreamSource(stream);

    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 2048;
    // Connect source → analyser only (NOT to destination)
    source.connect(this.analyser);

    this.buffer = new Float32Array(this.analyser.fftSize) as Float32Array<ArrayBuffer>;

    // MediaRecorder takes raw stream directly
    this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    this.mediaRecorder.ondataavailable = (e: BlobEvent) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
  }

  start(timeslice = 1000) {
    this.mediaRecorder.start(timeslice);
  }

  getFrame(): { rms: number; db: number; isSpeaking: boolean } {
    this.analyser.getFloatTimeDomainData(this.buffer);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buf = this.buffer as any as number[];
    const rms = Math.sqrt(buf.reduce((s: number, v: number) => s + v * v, 0) / buf.length);
    const db = 20 * Math.log10(rms + 1e-9);
    const isSpeaking = db > this.SILENCE_THRESHOLD_DB;

    const now = Date.now();
    if (!isSpeaking) {
      if (this.silenceStart === null) this.silenceStart = now;
    } else {
      if (this.silenceStart !== null) {
        const gap = (now - this.silenceStart) / 1000;
        if (gap > 3.0) this.longPauses++;
        else if (gap >= 0.5) this.shortPauses++;
        this.silenceStart = null;
      }
    }

    return { rms, db, isSpeaking };
  }

  async stop(): Promise<Blob> {
    return new Promise((resolve) => {
      this.mediaRecorder.onstop = () => {
        resolve(new Blob(this.chunks, { type: 'audio/webm' }));
      };
      if (this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      } else {
        resolve(new Blob(this.chunks, { type: 'audio/webm' }));
      }
      this.audioCtx.close();
    });
  }

  getSummary(): { longPauses: number; shortPauses: number } {
    return { longPauses: this.longPauses, shortPauses: this.shortPauses };
  }
}
