import Link from 'next/link';
import { LinkStartHero } from './components/link-start-hero';
import { MenuPreview } from './components/menu-preview';
import { Icon } from './components/icons';
import { RELEASE } from '@/lib/release';
import './landing.css';

const FEATURES = [
  { icon: 'ring', title: 'Summon your menu', text: 'Option + S on Mac. Alt + S on Windows and Linux. Apps, folders and favorite links, a gesture away.' },
  { icon: 'bolt', title: 'Experience Link Start', text: 'The familiar tunnel, redrawn at your display’s refresh rate, with the original Japanese voice.' },
  { icon: 'browser', title: 'Open a floating window', text: 'Web pages, images, GIFs and video on a curved pane that follows your cursor.' },
  { icon: 'hand', title: 'Reach into the interface', text: 'Two fingers to summon. Point to aim. Push to select. Camera gestures are opt-in; video stays on your computer.' },
  { icon: 'friends', title: 'Bring your party', text: 'Friends, presence and direct messages. One account in the app and on the web.' },
] as const;

const BUILDS = [
  { name: 'macOS', detail: 'Apple Silicon', format: '.dmg', href: RELEASE.dmg },
  { name: 'macOS', detail: 'Intel', format: '.dmg', href: RELEASE.macIntel },
  { name: 'Windows', detail: '64-bit installer', format: '.exe', href: RELEASE.windows },
  { name: 'Linux', detail: '64-bit AppImage', format: '.AppImage', href: RELEASE.linux },
  { name: 'Debian / Ubuntu', detail: '64-bit package', format: '.deb', href: RELEASE.linuxDeb },
] as const;

export default function Home() {
  return (
    <div className="sao-landing">
      <LinkStartHero>
        <div className="hero-copy">
          <p className="hero-kicker"><span /> Sword Art Online, on your desktop.</p>
          <h1 id="hero-title" className="hero-title">Link Start.</h1>
          <p className="hero-japanese" lang="ja">ソードアート・オンライン</p>
          <p className="hero-lede">A familiar interface.<br />A whole new way to use your desktop.</p>
          <p className="hero-description">Bring the SAO ring menu to your world. Launch your apps, open floating windows and stay close to your party.</p>
          <div className="hero-actions">
            <a className="menu-button primary" href={RELEASE.dmg}><span className="disc"><Icon name="download" size={23} /></span><span>Download for Mac<small>Apple Silicon · v{RELEASE.version}</small></span></a>
            <a className="hero-builds-link" href="#download">All downloads <Icon name="arrow" size={18} /></a>
          </div>
          <div className="hero-platforms">
            <a href={RELEASE.windows} aria-label="Download for Windows">Windows</a>
            <span aria-hidden="true">/</span>
            <a href={RELEASE.linux} aria-label="Download for Linux">Linux</a>
            <span aria-hidden="true">/</span>
            <a href={RELEASE.macIntel}>Intel Mac</a>
          </div>
          <p className="hero-fan-note">Free & open source. Made by a fan, for fans.</p>
        </div>
        <MenuPreview />
      </LinkStartHero>

      <div className="landing-divider"><span>SAO Menu</span><span>macOS / Windows / Linux</span><a href="#features">Explore the interface <span aria-hidden="true">↓</span></a></div>

      <section id="features" className="features" aria-labelledby="features-title">
        <div className="features-intro">
          <p className="section-label">Beyond the screen</p>
          <h2 id="features-title" className="section-title">Your desktop.<br />Your own Aincrad.</h2>
          <p className="section-lede">The little details you remember, built for the things you do every day.</p>
          <div className="shortcut-panel"><span className="shortcut-symbol"><Icon name="ring" size={24} /></span><div><strong>The world is one shortcut away.</strong><p><kbd>⌥</kbd><span> + </span><kbd>S</kbd><small>macOS</small><span className="shortcut-alt">Alt + S on Windows & Linux</span></p></div></div>
        </div>
        <ul className="item-list">
          {FEATURES.map(feature => (
            <li key={feature.title} className="item-row">
              <span className="item-disc"><Icon name={feature.icon} size={23} /></span>
              <span><strong>{feature.title}</strong><span>{feature.text}</span></span>
            </li>
          ))}
        </ul>
      </section>

      <section className="account-band" aria-labelledby="account-title">
        <div className="account-copy">
          <p className="section-label">Party menu</p>
          <h2 id="account-title" className="section-title">Every adventure<br />starts with a name.</h2>
          <p className="band-text">Choose your player name. Find your friends. Keep the conversation going, from the app to the web.</p>
          <Link href="/register" className="menu-button"><span className="disc"><Icon name="friends" /></span><span>Create an account<small>For friends, parties and messages</small></span></Link>
          <p className="account-signin">Already a player? <Link href="/login">Sign in</Link></p>
        </div>
        <Link href="/login" className="mini-card" aria-label="Sign in on the web">
          <span className="mini-title">Log in_::</span>
          <span className="mini-field"><em>:account</em><i>your player name</i></span>
          <span className="mini-field"><em>:password</em><i>••••••••••</i></span>
          <span className="mini-confirm"><span>Enter your world</span><span className="confirm-icon" aria-hidden="true">✓</span></span>
        </Link>
      </section>

      <section id="download" className="download" aria-labelledby="download-title">
        <div className="download-heading"><div><p className="section-label">Ready to dive in?</p><h2 id="download-title" className="section-title">Choose your world.</h2></div><span className="release-tag">SAO Menu <b>v{RELEASE.version}</b></span></div>
        <div className="download-window">
          <div className="window-title"><span>Download</span><span>Current release · {RELEASE.version}</span></div>
          <ul className="download-list">
            {BUILDS.map(build => <li key={build.detail}><a className="download-row" href={build.href}><span className="download-icon"><Icon name="download" size={21} /></span><strong>{build.name}</strong><span className="build-detail">{build.detail}</span><span className="build-format">{build.format}</span><span className="download-arrow" aria-hidden="true"><Icon name="arrow" size={20} /></span></a></li>)}
          </ul>
          <div className="download-window-footer"><span>Free. Open source. Yours to explore.</span><a href={RELEASE.notes}>Release notes <Icon name="arrow" size={16} /></a></div>
        </div>
        <ul className="download-facts">
          <li>Mac builds are not notarized; the Windows installer is unsigned. <a href={RELEASE.notes}>Read the installation notes.</a></li>
          <li>Camera gestures are opt-in. Global mouse gestures require macOS and Input Monitoring permission.</li>
        </ul>
      </section>

      <footer className="site-footer">
        <div><p>An unofficial fan project. Not affiliated with the creators of Sword Art Online or the original SAO Utils.</p><p className="art-credit">SAO interface artwork & font by <a href="https://www.deviantart.com/darkblackswords/art/Sword-Art-Online-Vector-Icons-434245957">darkblackswords</a>.</p></div>
        <p><a href={RELEASE.source}>GitHub</a><Link href="/support">Report a bug</Link></p>
      </footer>
    </div>
  );
}
