/** Launcher looks shipped by the original SAO Utils 2 theme packages, plus the custom Sky recolour. */
export const THEME_IDS = ['sao', 'alo', 'ggo', 'sky'] as const;
export type ThemeId = typeof THEME_IDS[number];
export const THEME_NAMES: Record<ThemeId, string> = { sao: 'Sword Art Online', alo: 'ALfheim Online', ggo: 'Gun Gale Online', sky: 'Sky (Custom)' };
export const isThemeId = (value: unknown): value is ThemeId => typeof value === 'string' && (THEME_IDS as readonly string[]).includes(value);

export type SoundEvent = 'click' | 'popupLauncher' | 'popupMenu' | 'popupPanel' | 'dismissLauncher' | 'ready' | 'congratulations' | 'invitation';
const SAO_SOUNDS: Record<SoundEvent, string> = {
  click: 'Feedback.SAO.Click.wav', popupLauncher: 'Popup.SAO.Launcher.wav', popupMenu: 'Popup.SAO.Menu.wav',
  popupPanel: 'Popup.SAO.Panel.wav', dismissLauncher: 'Dismiss.SAO.Launcher.wav', ready: 'Ready.SAO.Welcome.wav',
  congratulations: 'Notify.SAO.Present.wav', invitation: 'Popup.SAO.Message.wav',
};
/** Per-theme overrides; unlisted events use the SAO sound, as the original SFX presets do. */
const THEME_SOUNDS: Record<ThemeId, Partial<Record<SoundEvent, string>>> = {
  sao: {},
  // com.gpbeta.theme.sao/Presets/sfx-alo.json: panel and menu popups keep the SAO sounds.
  alo: { click: 'Feedback.ALO.Click.wav', popupLauncher: 'Popup.ALO.Launcher.wav', dismissLauncher: 'Dismiss.ALO.Launcher.wav', ready: 'Ready.ALO.Welcome.wav', invitation: 'Popup.ALO.Message.wav' },
  ggo: {},
  sky: {},
};
export function themeSound(theme: ThemeId, event: SoundEvent): string {
  return THEME_SOUNDS[theme][event] ?? SAO_SOUNDS[event];
}
