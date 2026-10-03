import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { fromMediaPipe } from '../shared/hand/landmarks';
import { initialRecognizerState, recognize, type RecognizerState } from '../shared/hand/recognizer';
import { parseTrackerConfig, TRACKER_FPS, type TrackerAPI, type TrackerConfig, type TrackerEvent } from '../shared/hand/protocol';
import { drawDebug } from './debug';

const CAMERA = { width: 640, height: 480 } as const;
const MS_PER_SECOND = 1000;
// MediaPipe's defaults; stricter values dropped blurred or partly framed hands on a real webcam.
const DETECTION = { minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5 } as const;
const MAX_MESSAGE = 300;

// Outside Electron (e.g. opened directly in a browser) the page runs with no host to report to.
const bridge: TrackerAPI = window.saoTracker ?? { emit: () => {}, onConfig: () => () => {} };
const video = document.querySelector<HTMLVideoElement>('#camera')!;
const canvas = document.querySelector<HTMLCanvasElement>('#overlay')!;
const readout = document.querySelector<HTMLElement>('#readout')!;

let config: TrackerConfig = { fps: TRACKER_FPS.idle, menuOpen: false, origin: { x: 0.5, y: 0.5 }, debug: false };
let recognizer: RecognizerState = initialRecognizerState();

function friendlyError(error: unknown): string {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError') return 'Camera access was denied. Allow SAO Utils 2 in System Settings → Privacy & Security → Camera.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No camera was found.';
  if (name === 'NotReadableError') return 'The camera is in use by another application.';
  const detail = error instanceof Error ? error.message : String(error);
  return `Hand tracking could not start: ${detail}`.slice(0, MAX_MESSAGE);
}

async function openCamera(): Promise<void> {
  video.srcObject = await navigator.mediaDevices.getUserMedia({
    audio: false, video: { width: { ideal: CAMERA.width }, height: { ideal: CAMERA.height }, facingMode: 'user' },
  });
  await video.play();
}

async function createLandmarker(): Promise<HandLandmarker> {
  const base = new URL('./mediapipe/', location.href);
  const fileset = await FilesetResolver.forVisionTasks(base.href.replace(/\/$/, ''));
  const options = (delegate: 'GPU' | 'CPU') => ({
    baseOptions: { modelAssetPath: new URL('hand_landmarker.task', base).href, delegate },
    runningMode: 'VIDEO' as const, numHands: 1, ...DETECTION,
  });
  try {
    return await HandLandmarker.createFromOptions(fileset, options('GPU'));
  } catch (error) {
    console.warn('GPU delegate unavailable; using CPU hand tracking.', error);
    return HandLandmarker.createFromOptions(fileset, options('CPU'));
  }
}

function processFrame(landmarker: HandLandmarker, lastVideoTime: number): number {
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.currentTime === lastVideoTime) return lastVideoTime;
  const t = performance.now();
  const result = landmarker.detectForVideo(video, t);
  const hand = fromMediaPipe(result, video.videoWidth, video.videoHeight);
  const next = recognize(recognizer, { t, hand, menuOpen: config.menuOpen, origin: config.origin });
  recognizer = next.state;
  next.events.forEach(event => bridge.emit(event as TrackerEvent));
  if (config.debug) drawDebug(canvas, readout, hand, next.events);
  return video.currentTime;
}

function run(landmarker: HandLandmarker): void {
  let lastVideoTime = -1;
  const tick = () => {
    try {
      lastVideoTime = processFrame(landmarker, lastVideoTime);
    } catch (error) {
      bridge.emit({ kind: 'status', state: 'error', message: friendlyError(error) });
      return;
    }
    setTimeout(tick, MS_PER_SECOND / config.fps);
  };
  tick();
}

async function start(): Promise<void> {
  bridge.onConfig(next => { config = parseTrackerConfig(next) ?? config; });
  bridge.emit({ kind: 'status', state: 'starting' });
  try {
    await openCamera();
    const landmarker = await createLandmarker();
    bridge.emit({ kind: 'status', state: 'running' });
    run(landmarker);
  } catch (error) {
    bridge.emit({ kind: 'status', state: 'error', message: friendlyError(error) });
  }
}

void start();
