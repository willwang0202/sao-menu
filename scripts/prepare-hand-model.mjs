import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Pinned so a changed upstream model can never ship silently.
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const MODEL_SHA256 = 'fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1';
const WASM_FILES = ['vision_wasm_internal.js', 'vision_wasm_internal.wasm'];
const output = path.resolve('public/mediapipe');
const model = path.join(output, 'hand_landmarker.task');

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

async function hasVerifiedModel() {
  try { return sha256(await readFile(model)) === MODEL_SHA256; } catch { return false; }
}

async function downloadModel() {
  const response = await fetch(MODEL_URL);
  if (!response.ok) throw new Error(`Hand model download failed: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (sha256(bytes) !== MODEL_SHA256) throw new Error('Hand model checksum mismatch; refusing to install it.');
  const temporary = `${model}.${process.pid}.tmp`;
  await writeFile(temporary, bytes);
  await rename(temporary, model);
}

await mkdir(output, { recursive: true });
const source = path.resolve('node_modules/@mediapipe/tasks-vision/wasm');
await Promise.all(WASM_FILES.map(name => copyFile(path.join(source, name), path.join(output, name))));
if (!(await hasVerifiedModel())) await downloadModel();
