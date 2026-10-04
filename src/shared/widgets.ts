import type { Position } from './contracts';
import type { SocialSnapshot } from './social';

/** Original SAO theme clock preset (`Presets/widget-clock.xml`). */
export const CLOCK_SIZE = { width: 304, height: 80 } as const;
export const CLOCK_SAMPLE_MS = 5000;
/** Original `widget-mail` menu-widget button. */
export const MESSAGE_BUTTON_SIZE = 56;
/** Port inset of the HP display from the work-area corner. */
export const WIDGET_INSET = 24;
/** theme-widget.json places the mail button 28,128 from the HP widget's desktop origin. */
const MESSAGE_OFFSET = { x: 28, y: 128 } as const;

const HOURS_PER_DIAL = 12, MINUTES_PER_DIAL = 60, DEGREES = 360;
export function clockAngles(now: Date): { hour: number; minute: number } {
  const hours = (now.getHours() % HOURS_PER_DIAL) + now.getMinutes() / MINUTES_PER_DIAL;
  return { hour: hours / HOURS_PER_DIAL * DEGREES, minute: now.getMinutes() / MINUTES_PER_DIAL * DEGREES };
}
const pad = (value: number) => String(value).padStart(2, '0');
export const clockText = (now: Date) => `${pad(now.getHours())}:${pad(now.getMinutes())}`;

export const unreadMessages = (snapshot: SocialSnapshot | null) =>
  snapshot?.conversations.reduce((total, conversation) => total + Math.max(0, conversation.unread), 0) ?? 0;

export interface WorkArea { x: number; y: number; width: number; height: number }
export function widgetPositions(area: WorkArea): { messageButton: Position; clock: Position } {
  const hp = { x: area.x + WIDGET_INSET, y: area.y + WIDGET_INSET };
  return {
    messageButton: { x: hp.x + MESSAGE_OFFSET.x, y: hp.y + MESSAGE_OFFSET.y },
    clock: { x: area.x + area.width - WIDGET_INSET - CLOCK_SIZE.width, y: hp.y },
  };
}

export interface WidgetState { unread: number; reducedMotion: boolean }
export interface WidgetAPI { getState(): Promise<WidgetState>; onState(callback: (state: WidgetState) => void): () => void; openMessages(): Promise<void> }
declare global { interface Window { saoWidget?: WidgetAPI } }
