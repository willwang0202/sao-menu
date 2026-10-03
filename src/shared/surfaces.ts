export type SurfaceKind = 'browser' | 'image' | 'video' | 'gallery';
export interface MediaPresentation { fill: 'contain' | 'cover'; muted: boolean; autoResize: boolean }
export interface GallerySettings { fill: 'contain' | 'cover'; fillColor: string; frame: string; frameAbove: boolean; shuffle: boolean; transition: string; animateTime: number; stillTime: number }
export interface GalleryImage { title: string; url: string }
export interface SurfaceState {
  id: string; kind: SurfaceKind; title: string; url: string; loading: boolean;
  error: string; canGoBack: boolean; canGoForward: boolean; reducedMotion: boolean;
  restored: boolean; presentation: MediaPresentation;
  gallery?: { images: GalleryImage[]; settings: GallerySettings; revision: number };
}
export interface BrowserFrame { pixels: Uint8Array; width: number; height: number }
export interface SurfaceInput {
  type: 'mouseMove' | 'mouseDown' | 'mouseUp' | 'mouseWheel' | 'keyDown' | 'keyUp' | 'char';
  x?: number; y?: number; button?: 'left' | 'right' | 'middle';
  deltaX?: number; deltaY?: number; keyCode?: string; modifiers?: string[];
}
export interface SurfaceAPI {
  getState(): Promise<SurfaceState>;
  acknowledgeFrame(): void;
  navigate(url: string): Promise<void>;
  command(command: 'back' | 'forward' | 'reload' | 'stop' | 'close' | 'external' | 'change' | 'refresh'): Promise<void>;
  dropFiles(files: File[]): Promise<void>;
  setPresentation(presentation: MediaPresentation): Promise<void>;
  setGallery(settings: GallerySettings): Promise<void>;
  input(input: SurfaceInput): Promise<void>;
  resize(width: number, height: number): Promise<void>;
  move(dx: number, dy: number): Promise<void>;
  onState(callback: (state: SurfaceState) => void): () => void;
  onFrame(callback: (frame: BrowserFrame) => void): () => void;
  onPointer(callback: (point: { x: number; y: number }) => void): () => void;
}
export function browserURL(value: unknown): string {
  if (value === 'about:blank') return value;
  if (typeof value !== 'string' || value.length > 8192 || /[\u0000-\u0020\u007f]/.test(value)) throw new Error('Enter a valid HTTP or HTTPS address.');
  const url = new URL(value.includes('://') ? value : `https://${value}`);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Only HTTP and HTTPS addresses are supported.');
  return url.href;
}
export function mediaKind(file: string): 'image' | 'video' | null {
  const extension = file.split('.').pop()?.toLowerCase();
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp'].includes(extension ?? '')) return 'image';
  if (['mp4', 'webm', 'm4v', 'mov', 'ogv'].includes(extension ?? '')) return 'video';
  return null;
}
// Cylindrical presentation and its inverse use the same mapping, so clicking
// the curved page addresses the corresponding point in the actual browser.
export const pageBend = .11;
export function curveInset(x: number, width: number, height: number): number {
  const normalized = 2 * x / Math.max(1, width) - 1;
  return height * pageBend * (1 - normalized * normalized) / 2;
}
export function pagePoint(x: number, y: number, width: number, height: number): { x: number; y: number } | null {
  if (x < 0 || x >= width) return null;
  const inset = curveInset(x, width, height);
  if (y < inset || y >= height - inset) return null;
  return { x: Math.floor(x), y: Math.floor((y - inset) * height / (height - 2 * inset)) };
}
declare global { interface Window { saoSurface?: SurfaceAPI } }
