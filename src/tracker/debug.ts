import { palmScale, type HandFrame } from '../shared/hand/landmarks';
import { classifyPose, fingerState } from '../shared/hand/pose';
import { LANDMARK, midpoint } from '../shared/hand/landmarks';
import type { RecognizerEvent } from '../shared/hand/recognizer';

const POINT_RADIUS = 4;
let lastEvent = '';

/** Camera debug view (Preferences → Camera debug view) for checking tracking and tuning thresholds. */
export function drawDebug(canvas: HTMLCanvasElement, readout: HTMLElement, hand: HandFrame | null, events: readonly RecognizerEvent[]): void {
  const context = canvas.getContext('2d');
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  const gesture = events.find(event => event.kind !== 'cursor');
  if (gesture) lastEvent = `${gesture.kind} @ ${performance.now().toFixed(0)}ms`;
  if (!hand) { readout.textContent = `no hand\nlast: ${lastEvent}`; return; }
  context.fillStyle = '#ffb513';
  for (const point of hand.landmarks) {
    context.beginPath();
    context.arc(point.x * canvas.width, point.y * canvas.height, POINT_RADIUS, 0, Math.PI * 2);
    context.fill();
  }
  readout.textContent = `pose: ${classifyPose(hand)}\npalm scale: ${palmScale(hand).toFixed(3)}\nlast: ${lastEvent}`;
}

// TEMPORARY diagnostics for the summon investigation; remove after tuning.
let lastLine = '';
export function logDiagnostics(hand: HandFrame | null, menuOpen: boolean, fps: number, summonSamples: number, events: readonly RecognizerEvent[]): void {
  const pose = classifyPose(hand);
  const fingers = hand ? (['index', 'middle', 'ring', 'pinky'] as const).map(finger => `${finger[0]}=${fingerState(hand, finger)[0]}`).join(' ') : '-';
  const tips = hand ? midpoint(hand, [LANDMARK.INDEX_TIP, LANDMARK.MIDDLE_TIP]) : null;
  const gesture = events.filter(event => event.kind !== 'cursor').map(event => event.kind).join(',');
  const line = `[hand-debug] pose=${pose} ${fingers} menuOpen=${menuOpen} fps=${fps} samples=${summonSamples}${gesture ? ` EVENT=${gesture}` : ''}`;
  recordStats(hand, menuOpen);
  if (line === lastLine && pose !== 'summon') return;
  lastLine = line;
  console.warn(`${line} tipY=${tips ? tips.y.toFixed(3) : '-'} t=${performance.now().toFixed(0)}`);
}

// TEMPORARY: once-per-second detection rate and last palm position, to measure dropouts.
const STATS_INTERVAL_MS = 1000;
let windowStart = performance.now();
let frames = 0;
let detected = 0;
let lastPalm = '-';
function recordStats(hand: HandFrame | null, menuOpen: boolean): void {
  frames += 1;
  if (hand) {
    detected += 1;
    const palm = midpoint(hand, [LANDMARK.WRIST, LANDMARK.INDEX_MCP, LANDMARK.PINKY_MCP]);
    lastPalm = `(${palm.x.toFixed(2)},${palm.y.toFixed(2)}) scale=${palmScale(hand).toFixed(3)}`;
  }
  const now = performance.now();
  if (now - windowStart < STATS_INTERVAL_MS) return;
  console.warn(`[hand-stats] menuOpen=${menuOpen} frames=${frames} detected=${detected} lastPalm=${lastPalm}`);
  windowStart = now; frames = 0; detected = 0;
}
