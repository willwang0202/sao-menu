import Link from 'next/link';
import { LinkStartHero } from './components/link-start-hero';
import { Icon } from './components/icons';
import { RELEASE } from '@/lib/release';
import './landing.css';

const FEATURES = [
  { icon: 'ring', title: 'The ring menu', text: 'Option+S, or hold both mouse buttons and swipe down. Kirito, Party, Message, Navigation and Settings open where you expect them.' },
  { icon: 'bolt', title: 'Link Start, live', text: 'The anime’s startup redrawn every frame at your display’s refresh rate, with the original Japanese voice.' },
  { icon: 'browser', title: 'Curved browser and media', text: 'Web pages, images, GIFs and video float on a curved pane that tilts with your cursor.' },
  { icon: 'hand', title: 'Hand gestures', text: 'Opt in to the webcam: two-finger swipe to open, point to aim, push to select. Video never leaves your Mac.' },
  { icon: 'friends', title: 'Friends and messages', text: 'One account in the app and on this site: friend requests, presence and direct messages.' },
] as const;

export default function Home() {
  return (
    <>
      <LinkStartHero>
        <p className="section-label">Unofficial fan port · macOS</p>
        <h1 id="hero-title" className="hero-title">Link Start.</h1>
        <p className="hero-lede">The Sword Art Online ring-menu launcher, rebuilt for the Mac.</p>
        <div className="hero-actions">
          <a className="menu-button primary" href={RELEASE.dmg}><span className="disc"><Icon name="download" /></span><span>Download for Mac<small>Apple Silicon · v{RELEASE.version}</small></span></a>
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
          <p className="band-text">Sign in from the app’s Link Start card or here. Your friends list and messages follow you between both. Passwords are hashed with scrypt; the app stores your session in the macOS keychain.</p>
        </div>
        <Link href="/login" className="mini-card" aria-label="Sign in on the web">
          <span className="mini-title">Log in_::</span>
          <span className="mini-field"><em>:account</em><i /></span>
          <span className="mini-field"><em>:password</em><i /></span>
        </Link>
      </section>

      <section id="download" className="download" aria-labelledby="download-title">
        <p className="section-label">Download</p>
        <h2 id="download-title" className="section-title">SAO Utils {RELEASE.version} for macOS</h2>
        <ul className="download-facts">
          <li>Apple Silicon Mac</li>
          <li>Signed with a Developer ID, not yet notarized. If macOS blocks the first launch, Control-click the app and choose Open.</li>
          <li>Hand gestures and global mouse gestures ask for Camera and Input Monitoring permission only when you turn them on.</li>
        </ul>
        <div className="hero-actions">
          <a className="menu-button primary" href={RELEASE.dmg}><span className="disc"><Icon name="download" /></span><span>Download .dmg<small>v{RELEASE.version}</small></span></a>
          <a className="menu-button" href={RELEASE.notes}><span className="disc"><Icon name="arrow" /></span><span>Release notes<small>GitHub</small></span></a>
        </div>
      </section>

      <footer className="site-footer">
        <p>An unofficial fan project, not affiliated with or endorsed by the creators of Sword Art Online or the original SAO Utils.</p>
        <p><a href={RELEASE.source}>Source on GitHub</a></p>
      </footer>
    </>
  );
}
