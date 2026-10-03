/** Scene boundaries in seconds, measured frame-by-frame from the reference clip (cCfJvBgAd3E). */
export const STARTUP = {
  darkEnd: 1.376,
  lightIn: 1.5,
  tunnelEnd: 5.1,
  sensorsStart: 5.25,
  sensorsEnd: 8.95,
  languageStart: 9.05,
  loginStart: 10.45,
  /** Empty login card, before the source types its placeholder credentials. */
  loginHold: 10.62,
  /** Card fade-out after real authentication; skips the source's fake typing. */
  loginResume: 11.64,
  registrationStart: 11.84,
  grayStart: 13.68,
  welcomeStart: 14.2,
  warpStart: 16.25,
  whiteEnd: 18.94,
  end: 19.11,
} as const;

export type Scene = 'dark' | 'tunnel' | 'sensors' | 'language' | 'login' | 'registration' | 'welcome' | 'warp' | 'done';

export function sceneAt(t: number): Scene {
  if (t < STARTUP.darkEnd) return 'dark';
  if (t < STARTUP.sensorsStart) return 'tunnel';
  if (t < STARTUP.languageStart) return 'sensors';
  if (t < STARTUP.loginStart) return 'language';
  if (t < STARTUP.registrationStart) return 'login';
  if (t < STARTUP.grayStart) return 'registration';
  if (t < STARTUP.warpStart) return 'welcome';
  if (t < STARTUP.end) return 'warp';
  return 'done';
}
