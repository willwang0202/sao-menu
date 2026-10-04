import { clamp01, progress } from './ease';
import { STARTUP } from './timeline';

/** Flat UI cards from the reference, in its 1920×1080 coordinates. */
const FONT = '"Source Han Sans", "Hiragino Sans", sans-serif';
const BORDER = 'rgba(122,122,128,0.9)';
const BORDER_WIDTH = 6;
const LANGUAGE_BLUE = '#0582fa';
const SELECTED_CYAN = '#05c0ee';
const CARD_BLUE = '#0681be';
const FIELD = '#fafafa';
const CYAN = '#0ef4f8';
const MIN_LINE = 3;
const SCALE_IN = 0.17;
const CARD_FADE = 0.05;

type Box = readonly [number, number, number, number];

function roundedBox(ctx: CanvasRenderingContext2D, [x, y, w, h]: Box, radius: number, fill: string) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = BORDER_WIDTH;
  ctx.strokeStyle = BORDER;
  ctx.stroke();
}

function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'left', spacing = 0) {
  ctx.font = `500 ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.letterSpacing = `${spacing}px`;
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
  ctx.letterSpacing = '0px';
}

/** A bar first appears as a faint line, then opens vertically around its centre. */
function openBar(ctx: CanvasRenderingContext2D, t: number, start: number, box: Box, draw: () => void) {
  const open = progress(t, start, start + SCALE_IN);
  if (t < start) return;
  const [, y, , h] = box;
  const middle = y + h / 2;
  ctx.save();
  ctx.globalAlpha *= 0.3 + 0.7 * open * open;
  ctx.translate(0, middle);
  ctx.scale(1, Math.max(MIN_LINE / h, open));
  ctx.translate(0, -middle);
  draw();
  ctx.restore();
}

const LANGUAGE: Box = [337, 320, 598, 102];
const JAPANESE: Box = [857, 352, 597, 103];
/** The Japanese bar lets the Language bar show through where they overlap. */
const JAPANESE_ALPHA = 0.93;
const LANGUAGE_TIMES = { language: 9.08, japanese: 9.5, selected: 9.79, fadeOut: 10.15, gone: 10.3 } as const;

export function drawLanguage(ctx: CanvasRenderingContext2D, t: number) {
  const fade = 1 - progress(t, LANGUAGE_TIMES.fadeOut, LANGUAGE_TIMES.gone);
  if (fade <= 0) return;
  ctx.save();
  ctx.globalAlpha = fade;
  openBar(ctx, t, LANGUAGE_TIMES.language, LANGUAGE, () => {
    roundedBox(ctx, LANGUAGE, 16, LANGUAGE_BLUE);
    text(ctx, 'Language', 636, 389, 70, '#ffffff', 'center');
  });
  openBar(ctx, t, LANGUAGE_TIMES.japanese, JAPANESE, () => {
    const selected = progress(t, LANGUAGE_TIMES.selected - 0.04, LANGUAGE_TIMES.selected + 0.04);
    ctx.globalAlpha *= JAPANESE_ALPHA;
    roundedBox(ctx, JAPANESE, 16, selected > 0.5 ? SELECTED_CYAN : LANGUAGE_BLUE);
    ctx.globalAlpha /= JAPANESE_ALPHA;
    ctx.beginPath();
    ctx.moveTo(958, 380); ctx.lineTo(997, 403); ctx.lineTo(958, 426); ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    text(ctx, 'Japanese', 1195, 423, 70, '#ffffff', 'center');
  });
  ctx.restore();
}

const LOGIN_CARD: Box = [487, 365, 946, 353];
/** Input rectangles; the real form's inputs are positioned over these. */
export const LOGIN_FIELDS = { account: [983, 492, 372, 46] as Box, password: [983, 616, 372, 46] as Box };
const MAX_STARS = 14;
const STAR_STEP = 26;

function stars(ctx: CanvasRenderingContext2D, [x, y, , h]: Box, count: number) {
  for (let i = 0; i < Math.min(count, MAX_STARS); i++) text(ctx, '*', x + 6 + i * STAR_STEP, y + h + 8, 50, '#3c3c3c');
}

export function drawLogin(ctx: CanvasRenderingContext2D, t: number, accountLength: number, passwordLength: number, creatingAccount = false) {
  const alpha = clamp01((t - STARTUP.loginStart) / CARD_FADE) * (1 - progress(t, STARTUP.loginResume, STARTUP.registrationStart));
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  roundedBox(ctx, LOGIN_CARD, 22, CARD_BLUE);
  text(ctx, creatingAccount ? 'Sign up_::' : 'Log in_::', 566, 472, creatingAccount ? 60 : 70, '#ffffff');
  text(ctx, ':account', 979, 482, 46, '#ffffff');
  text(ctx, ':password', 979, 605, 46, '#ffffff');
  ctx.fillStyle = FIELD;
  for (const field of [LOGIN_FIELDS.account, LOGIN_FIELDS.password]) ctx.fillRect(...field);
  // The source types placeholder credentials; after real login, show the real lengths instead.
  if (t > STARTUP.loginHold) {
    stars(ctx, LOGIN_FIELDS.account, accountLength);
    stars(ctx, LOGIN_FIELDS.password, passwordLength);
  }
  ctx.restore();
}

const TITLE: Box = [620, 224, 683, 94];
const BODY: Box = [313, 352, 1299, 548];
const REGISTRATION_TIMES = { appear: STARTUP.registrationStart, shown: 11.97, yes: 12.56, fadeOut: 13.43, gone: 13.64 } as const;

function pill(ctx: CanvasRenderingContext2D, [x, y, w, h]: Box, fill: string) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function drawRegistration(ctx: CanvasRenderingContext2D, t: number) {
  const alpha = progress(t, REGISTRATION_TIMES.appear, REGISTRATION_TIMES.shown) * (1 - progress(t, REGISTRATION_TIMES.fadeOut, REGISTRATION_TIMES.gone));
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  roundedBox(ctx, TITLE, 47, '#0583bf');
  text(ctx, 'キャラクター登録', 961, 293, 62, '#ffffff', 'center', 4);
  roundedBox(ctx, BODY, 32, '#0381bd');
  text(ctx, 'βテスト時に登録したデータが', 476, 437, 52, '#ffffff', 'left', 9);
  text(ctx, '残っていますが、使用しますか？', 472, 513, 52, '#ffffff', 'left', 9);
  ctx.fillStyle = CYAN;
  ctx.fillRect(737, 628, 446, 61);
  text(ctx, 'Kirito(M)', 961, 680, 52, '#ffffff', 'center', 8);
  const yes = t >= REGISTRATION_TIMES.yes;
  pill(ctx, [613, 790, 197, 48], yes ? '#0bf9fc' : '#09badb');
  pill(ctx, [1109, 790, 197, 48], '#09badb');
  text(ctx, 'YES', 712, 830, 44, yes ? '#2a8fb2' : '#ffffff', 'center');
  text(ctx, 'NO', 1207, 830, 44, '#ffffff', 'center');
  ctx.restore();
}
