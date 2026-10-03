import { palmScale, type HandFrame } from '../shared/hand/landmarks';
import { classifyPose, fingerState } from '../shared/hand/pose';
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
  const fingers = (['index', 'middle', 'ring', 'pinky'] as const).map(finger => `${finger}: ${fingerState(hand, finger)}`).join('  ');
  readout.textContent = `pose: ${classifyPose(hand)}\n${fingers}\npalm scale: ${palmScale(hand).toFixed(3)}\nlast: ${lastEvent}`;
}
