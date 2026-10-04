import Link from 'next/link';
import { LinkStartHero } from './components/link-start-hero';
import { Icon } from './components/icons';
import { RELEASE } from '@/lib/release';
import './landing.css';

const FEATURES = [
  { icon: 'ring', title: 'The ring menu', text: 'Option+S on Mac or Alt+S on Windows and Linux. On Mac, hold both mouse buttons and swipe down. Kirito, Party, Message, Navigation and Settings open where you expect them.' },
  { icon: 'bolt', title: 'Link Start, live', text: 'The anime’s startup redrawn every frame at your display’s refresh rate, with the original Japanese voice.' },
  { icon: 'browser', title: 'Curved browser and media', text: 'Web pages, images, GIFs and video float on a curved pane that tilts with your cursor.' },
  { icon: 'hand', title: 'Hand gestures', text: 'Opt in to the webcam: two-finger swipe to open, point to aim, push to select. Video stays on your computer.' },
  { icon: 'friends', title: 'Friends and messages', text: 'One account in the app and on this site: friend requests, presence and direct messages.' },
] as const;

export default function Home() {
  return (
    <>
      <LinkStartHero>
        <p className="section-label">Unofficial fan port · macOS · Windows · Linux</p>
        <h1 id="hero-title" className="hero-title">Link Start.</h1>
        <p className="hero-lede">The Sword Art Online ring-menu launcher, rebuilt for your desktop.</p>
        <div className="hero-actions">
          <a className="menu-button primary" href={RELEASE.dmg}><span className="disc"><Icon name="download" /></span><span>Download for Mac<small>Apple Silicon · v{RELEASE.version}</small></span></a>
          <a className="menu-button" href={RELEASE.windows}><span className="disc"><Icon name="download" /></span><span>Download for Windows<small>64-bit installer</small></span></a>
          <a className="menu-button" href={RELEASE.linux}><span className="disc"><Icon name="download" /></span><span>Download for Linux<small>64-bit AppImage</small></span></a>
          <Link className="menu-button" href="/register"><span className="disc"><Icon name="arrow" /></span><span>Create an account<small>For friends and messages</small></span></Link>
        </div>
      </LinkStartHero>

      <section className="features" aria-labelledby="features-title">
        <div className="features-intro">
          <p className="section-label">Menu</p>
          <h2 id="features-title" className="section-title">Everything from the ring, on your desktop.</h2>
        </div>
        <ul className="item-list">
          {FEATURES.map(feature => (
            <li key={feature.title} className="item-row">
              <span className="item-disc"><Icon name={feature.icon} size={22} /></span>
              <span><strong>{feature.title}</strong><span>{feature.text}</span></span>
            </li>
          ))}
        </ul>
      </section>

      <section className="account-band" aria-labelledby="account-title">
        <div>
          <p className="section-label">Account</p>
          <h2 id="account-title" className="section-title">One player name, everywhere.</h2>
          <p className="band-text">Sign in from the app’s Link Start card or here. Your friends list and messages follow you between both. Passwords are hashed with scrypt; the app encrypts your session using the operating system’s credential storage when available.</p>
        </div>
        <Link href="/login" className="mini-card" aria-label="Sign in on the web">
          <span className="mini-title">Log in_::</span>
          <span className="mini-field"><em>:account</em><i /></span>
          <span className="mini-field"><em>:password</em><i /></span>
        </Link>
      </section>

      <section id="download" className="download" aria-labelledby="download-title">
        <p className="section-label">Download</p>
        <h2 id="download-title" className="section-title">SAO Menu {RELEASE.version}</h2>
        <ul className="download-facts">
          <li>macOS on Apple Silicon or Intel; 64-bit Windows and Linux.</li>
          <li>The Mac builds are not notarized and the Windows installer is unsigned. See the release notes for installation details.</li>
          <li>Camera hand gestures are opt-in. Global mouse gestures currently require macOS and Input Monitoring permission.</li>
        </ul>
        <div className="hero-actions">
          <a className="menu-button primary" href={RELEASE.dmg}><span className="disc"><Icon name="download" /></span><span>Mac · Apple Silicon<small>.dmg · v{RELEASE.version}</small></span></a>
          <a className="menu-button" href={RELEASE.macIntel}><span className="disc"><Icon name="download" /></span><span>Mac · Intel<small>.dmg · v{RELEASE.version}</small></span></a>
          <a className="menu-button" href={RELEASE.windows}><span className="disc"><Icon name="download" /></span><span>Windows<small>.exe · x64</small></span></a>
          <a className="menu-button" href={RELEASE.linux}><span className="disc"><Icon name="download" /></span><span>Linux<small>.AppImage · x64</small></span></a>
          <a className="menu-button" href={RELEASE.linuxDeb}><span className="disc"><Icon name="download" /></span><span>Debian / Ubuntu<small>.deb · x64</small></span></a>
          <a className="menu-button" href={RELEASE.notes}><span className="disc"><Icon name="arrow" /></span><span>Release notes<small>GitHub</small></span></a>
        </div>
      </section>

      <footer className="site-footer">
        <p>An unofficial fan project, not affiliated with or endorsed by the creators of Sword Art Online or the original SAO Utils.</p>
        <p><a href={RELEASE.source}>Source on GitHub</a> · <Link href="/support">Report a bug</Link></p>
      </footer>
    </>
  );
}
