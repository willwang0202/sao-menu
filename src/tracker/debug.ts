import { palmScale, type HandFrame } from '../shared/hand/landmarks';
import { classifyPose } from '../shared/hand/pose';
import type { RecognizerEvent } from '../shared/hand/recognizer';

const POINT_RADIUS = 4;
let lastEvent = '';

/** Development-only view (SAO_HAND_DEBUG=1) used to tune recognizer thresholds. */
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
