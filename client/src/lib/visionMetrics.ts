// MediaPipe vision metrics computation for browser
// Uses @mediapipe/tasks-vision FaceLandmarker and PoseLandmarker

export interface VisionMetrics {
  gazePercentage: number;
  prolongedDeviations: number;
  blinkRate: number;
  facialRigidityScore: number;
  mandibularTensionScore: number;
  lipCompressionEvents: number;
  headMovementPeaks: number;
  asymmetryScore: number;
  avgResponseLatencyMs: number;
  smileEvents: number;
}

interface Point3D { x: number; y: number; z: number }

function dist(a: Point3D, b: Point3D): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function midpoint(a: Point3D, b: Point3D): Point3D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
}

/** Eye Aspect Ratio for blink detection */
export function calcEAR(landmarks: Point3D[]): number {
  const vertical = dist(landmarks[159], landmarks[145]);
  const horizontal = dist(landmarks[33], landmarks[133]);
  return vertical / (horizontal || 0.001);
}

/** Returns true if iris is looking toward camera */
export function calcGaze(landmarks: Point3D[]): boolean {
  if (!landmarks[468]) return false;
  const irisCenter = landmarks[468];
  const eyeCenter = midpoint(landmarks[33], landmarks[133]);
  const gazeVec = { x: irisCenter.x - eyeCenter.x, y: irisCenter.y - eyeCenter.y, z: 0 };
  return Math.abs(gazeVec.x) < 0.012 && Math.abs(gazeVec.y) < 0.012;
}

/** Computes facial rigidity from landmark movement variance */
export function calcFacialRigidity(landmarks: Point3D[], buffer: number[]): number {
  const pts = [13, 14, 17, 61, 291, 152, 377, 137, 0];
  const selected = pts.map(i => landmarks[i]).filter(Boolean);
  if (selected.length === 0) return 0;

  const cx = selected.reduce((s, p) => s + p.x, 0) / selected.length;
  const cy = selected.reduce((s, p) => s + p.y, 0) / selected.length;
  const dists = selected.map(p => Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2));
  const mean = dists.reduce((a, b) => a + b, 0) / dists.length;
  buffer.push(mean);
  if (buffer.length > 60) buffer.shift(); // 2000ms at ~30fps
  if (buffer.length < 2) return 0;
  const variance = buffer.reduce((s, v) => s + (v - mean) ** 2, 0) / buffer.length;
  return Math.min(variance * 1000, 1); // normalize
}

/** Returns true if lips are compressed (low area) */
export function calcLipCompression(landmarks: Point3D[]): boolean {
  const lipPts = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146];
  const pts = lipPts.map(i => landmarks[i]).filter(Boolean);
  if (pts.length < 3) return false;
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i].x * pts[j].y;
    area -= pts[j].x * pts[i].y;
  }
  area = Math.abs(area) / 2;
  return area < 0.0008;
}

/** Computes facial asymmetry score */
export function calcAsymmetry(landmarks: Point3D[]): number {
  const axis = landmarks[1];
  if (!axis) return 0;
  const leftPts = [234, 93, 132, 58, 172].map(i => landmarks[i]).filter(Boolean);
  const rightPts = [454, 323, 361, 288, 397].map(i => landmarks[i]).filter(Boolean);
  const len = Math.min(leftPts.length, rightPts.length);
  if (len === 0) return 0;
  let totalDiff = 0;
  for (let i = 0; i < len; i++) {
    const dl = dist(leftPts[i], axis);
    const dr = dist(rightPts[i], axis);
    totalDiff += Math.abs(dl - dr);
  }
  return totalDiff / len;
}

/** Session state tracker */
export class VisionTracker {
  private gazeFrames = 0;
  private totalFrames = 0;
  private prolongedDevStart: number | null = null;
  private prolongedDeviations = 0;
  private blinkCount = 0;
  private earBelow = 0;
  private rigidityBuffer: number[] = [];
  private rigiditySum = 0;
  private rigidityCount = 0;
  private lipCompEvents = 0;
  private prevLipComp = false;
  private headPeaks = 0;
  private prevHeadAngle = 0;
  private asymmetrySum = 0;
  private asymmetryCount = 0;
  private latencies: number[] = [];
  private smileEvents = 0;
  private startTime = Date.now();

  update(landmarks: Point3D[], timestamp: number) {
    this.totalFrames++;

    // Gaze
    const isLooking = calcGaze(landmarks);
    if (isLooking) {
      this.gazeFrames++;
      this.prolongedDevStart = null;
    } else {
      if (!this.prolongedDevStart) this.prolongedDevStart = timestamp;
      else if (timestamp - this.prolongedDevStart > 2000) {
        this.prolongedDeviations++;
        this.prolongedDevStart = null;
      }
    }

    // Blink (EAR)
    const ear = calcEAR(landmarks);
    if (ear < 0.20) {
      this.earBelow++;
      if (this.earBelow >= 4) { this.blinkCount++; this.earBelow = 0; }
    } else {
      this.earBelow = 0;
    }

    // Rigidity
    const rig = calcFacialRigidity(landmarks, this.rigidityBuffer);
    this.rigiditySum += rig;
    this.rigidityCount++;

    // Lip compression
    const lc = calcLipCompression(landmarks);
    if (lc && !this.prevLipComp) this.lipCompEvents++;
    this.prevLipComp = lc;

    // Asymmetry
    this.asymmetrySum += calcAsymmetry(landmarks);
    this.asymmetryCount++;

    // Head movement (simplified: use landmark[0].x delta as proxy)
    const headX = landmarks[0]?.x || 0;
    const headDelta = Math.abs(headX - this.prevHeadAngle);
    if (headDelta > 0.05) this.headPeaks++;
    this.prevHeadAngle = headX;
  }

  getSummary(): VisionMetrics {
    const elapsedMin = Math.max((Date.now() - this.startTime) / 60000, 0.01);
    return {
      gazePercentage: this.totalFrames > 0 ? (this.gazeFrames / this.totalFrames) * 100 : 0,
      prolongedDeviations: this.prolongedDeviations,
      blinkRate: this.blinkCount / elapsedMin,
      facialRigidityScore: this.rigidityCount > 0 ? this.rigiditySum / this.rigidityCount : 0,
      mandibularTensionScore: this.asymmetryCount > 0 ? Math.min(this.asymmetrySum / this.asymmetryCount * 10, 1) : 0,
      lipCompressionEvents: this.lipCompEvents,
      headMovementPeaks: this.headPeaks,
      asymmetryScore: this.asymmetryCount > 0 ? this.asymmetrySum / this.asymmetryCount : 0,
      avgResponseLatencyMs: this.latencies.length > 0 ? this.latencies.reduce((a, b) => a + b) / this.latencies.length : 0,
      smileEvents: this.smileEvents,
    };
  }
}

// ── MediaPipe initialization ──────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let faceLandmarker: any = null;

export async function initMediaPipe() {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore — dynamic CDN import, not resolvable at compile time
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const mp = await (Function(
    'return import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/vision_bundle.mjs")'
  )() as Promise<{ FaceLandmarker: { createFromOptions: (resolver: unknown, opts: unknown) => Promise<unknown> }; FilesetResolver: { forVisionTasks: (path: string) => Promise<unknown> } }>);

  const { FaceLandmarker, FilesetResolver } = mp;

  const filesetResolver = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm'
  );

  faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numFaces: 1,
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false,
  });

  return faceLandmarker;
}

export function detectFace(videoEl: HTMLVideoElement, timestampMs: number): Point3D[] | null {
  if (!faceLandmarker) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const result = faceLandmarker.detectForVideo(videoEl, timestampMs) as { faceLandmarks?: Point3D[][] };
    if (result.faceLandmarks?.[0]) return result.faceLandmarks[0];
  } catch { /* ignore */ }
  return null;
}
