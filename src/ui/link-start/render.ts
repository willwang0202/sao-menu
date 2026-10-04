import { DARK_COLOR, backgroundLevel, darkOverlay, vignetteImage } from './background';
import { coverTransform } from './viewport';
import { STARTUP } from './timeline';
import { drawTunnel } from './tunnel';
import { drawSensors } from './sensors';
import { drawLanguage, drawLogin, drawRegistration } from './panels';
import { drawWelcome } from './welcome';
import { drawWarp, whiteOverlay } from './warp';
import { startupStrings, type StartupStrings } from '../../shared/startup-language';

export type FrameOptions = Readonly<{
  /** Real credential lengths shown as the source's asterisks after authentication. */
  accountLength: number;
  passwordLength: number;
  creatingAccount?: boolean;
  /** Blue-card text; defaults to the anime's Japanese cards. */
  strings?: StartupStrings;
}>;

const TUNNEL_VISIBLE = [1.9, STARTUP.tunnelEnd] as const;
const WARP_VISIBLE = 16.05;
const WHITE_LEVEL = 253;

/** Draws the Link Start frame for media time t onto a canvas of width×height device pixels. */
export function renderFrame(ctx: CanvasRenderingContext2D, t: number, width: number, height: number, options: FrameOptions) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const level = backgroundLevel(t);
  ctx.fillStyle = `rgb(${level},${level},${level})`;
  ctx.fillRect(0, 0, width, height);

  const cover = coverTransform(width, height);
  ctx.setTransform(cover.scale, 0, 0, cover.scale, cover.x, cover.y);
  if (t >= TUNNEL_VISIBLE[0] && t < TUNNEL_VISIBLE[1]) drawTunnel(ctx, t);
  if (t >= STARTUP.sensorsStart && t < STARTUP.sensorsEnd) drawSensors(ctx, t, cover.scale);
  const strings = options.strings ?? startupStrings('ja');
  if (t >= STARTUP.languageStart && t < STARTUP.loginStart) drawLanguage(ctx, t, strings);
  if (t >= STARTUP.loginStart && t < STARTUP.registrationStart) drawLogin(ctx, t, strings, options.accountLength, options.passwordLength, options.creatingAccount);
  if (t >= STARTUP.registrationStart && t < STARTUP.grayStart) drawRegistration(ctx, t, strings);
  if (t >= WARP_VISIBLE) drawWarp(ctx, t);
  if (t >= STARTUP.welcomeStart && t < STARTUP.warpStart + 0.1) drawWelcome(ctx, t);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(vignetteImage(), 0, 0, width, height);
  const white = whiteOverlay(t);
  if (white > 0) {
    ctx.globalAlpha = white;
    ctx.fillStyle = `rgb(${WHITE_LEVEL},${WHITE_LEVEL},${WHITE_LEVEL})`;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;
  }
  const dark = darkOverlay(t);
  if (dark > 0) {
    ctx.globalAlpha = dark;
    ctx.fillStyle = DARK_COLOR;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;
  }
}
