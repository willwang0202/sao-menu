/** Languages for the Link Start blue cards (language, login, character registration). Official anime text elsewhere stays original. */
export const STARTUP_LANGUAGES = ['en', 'ja', 'zh-Hant', 'zh-Hans', 'ko', 'es', 'fr', 'de'] as const;
export type StartupLanguage = typeof STARTUP_LANGUAGES[number];
export type StartupLanguageSetting = 'system' | StartupLanguage;
export const isStartupLanguageSetting = (value: unknown): value is StartupLanguageSetting =>
  value === 'system' || (STARTUP_LANGUAGES as readonly unknown[]).includes(value);

export interface StartupStrings {
  languageLabel: string; languageName: string;
  login: string; signUp: string; account: string; password: string;
  registrationTitle: string; registrationBody: readonly [string, string]; yes: string; no: string;
}

const STRINGS: Record<StartupLanguage, StartupStrings> = {
  // The anime's own cards: English language/login labels, Japanese registration.
  ja: { languageLabel: 'Language', languageName: 'Japanese', login: 'Log in_::', signUp: 'Sign up_::', account: ':account', password: ':password',
    registrationTitle: 'キャラクター登録', registrationBody: ['βテスト時に登録したデータが', '残っていますが、使用しますか？'], yes: 'YES', no: 'NO' },
  en: { languageLabel: 'Language', languageName: 'English', login: 'Log in_::', signUp: 'Sign up_::', account: ':account', password: ':password',
    registrationTitle: 'Character Registration', registrationBody: ['Data registered during the beta test', 'still remains. Do you want to use it?'], yes: 'YES', no: 'NO' },
  'zh-Hant': { languageLabel: '語言', languageName: '繁體中文', login: '登入_::', signUp: '註冊_::', account: ':帳號', password: ':密碼',
    registrationTitle: '角色登錄', registrationBody: ['β測試時登錄的資料仍然保留，', '要使用嗎？'], yes: '是', no: '否' },
  'zh-Hans': { languageLabel: '语言', languageName: '简体中文', login: '登录_::', signUp: '注册_::', account: ':账号', password: ':密码',
    registrationTitle: '角色登录', registrationBody: ['β测试时登录的数据仍然保留，', '要使用吗？'], yes: '是', no: '否' },
  ko: { languageLabel: '언어', languageName: '한국어', login: '로그인_::', signUp: '회원가입_::', account: ':계정', password: ':비밀번호',
    registrationTitle: '캐릭터 등록', registrationBody: ['베타 테스트 때 등록한 데이터가', '남아 있습니다. 사용하시겠습니까?'], yes: '예', no: '아니요' },
  es: { languageLabel: 'Idioma', languageName: 'Español', login: 'Iniciar sesión_::', signUp: 'Registrarse_::', account: ':cuenta', password: ':contraseña',
    registrationTitle: 'Registro de personaje', registrationBody: ['Aún quedan datos registrados durante', 'la prueba beta. ¿Quieres usarlos?'], yes: 'SÍ', no: 'NO' },
  fr: { languageLabel: 'Langue', languageName: 'Français', login: 'Connexion_::', signUp: 'Inscription_::', account: ':compte', password: ':mot de passe',
    registrationTitle: 'Création du personnage', registrationBody: ['Des données enregistrées pendant le bêta-test', 'existent encore. Voulez-vous les utiliser ?'], yes: 'OUI', no: 'NON' },
  de: { languageLabel: 'Sprache', languageName: 'Deutsch', login: 'Anmelden_::', signUp: 'Registrieren_::', account: ':Konto', password: ':Passwort',
    registrationTitle: 'Charakterregistrierung', registrationBody: ['Im Betatest gespeicherte Daten sind', 'noch vorhanden. Möchtest du sie verwenden?'], yes: 'JA', no: 'NEIN' },
};

/** Option labels, each in its own language. */
export const STARTUP_LANGUAGE_NAMES: Record<StartupLanguage, string> = { en: 'English', ja: '日本語', 'zh-Hant': '繁體中文', 'zh-Hans': '简体中文', ko: '한국어', es: 'Español', fr: 'Français', de: 'Deutsch' };

export function resolveStartupLanguage(setting: StartupLanguageSetting, systemLocale: string): StartupLanguage {
  if (setting !== 'system') return setting;
  const locale = systemLocale.toLowerCase();
  if (locale.startsWith('zh')) return /-(?:hant|tw|hk|mo)\b/.test(locale) ? 'zh-Hant' : 'zh-Hans';
  const base = locale.split('-')[0];
  return (STARTUP_LANGUAGES as readonly string[]).includes(base) ? base as StartupLanguage : 'en';
}
export const startupStrings = (language: StartupLanguage): StartupStrings => STRINGS[language];
