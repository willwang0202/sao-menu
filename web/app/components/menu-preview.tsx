'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Icon } from './icons';

const MENUS = [
  { name: 'Player', icon: 'player', entries: [
    { name: 'Items', icon: 'items', title: 'Your everyday inventory', text: 'Keep apps, folders and favorite links in one floating menu. Your desktop, a little closer to Aincrad.' },
    { name: 'Skills', icon: 'skills', title: 'The ring menu', text: 'Press Option + S on Mac, or Alt + S on Windows and Linux. A familiar menu appears, right where you need it.' },
    { name: 'Equipment', icon: 'equipment', title: 'Make it your own', text: 'Equip the menu with your favorite apps and shortcuts. Arrange them to fit the way you use your desktop.' },
  ] },
  { name: 'Party', icon: 'party', entries: [
    { name: 'Friends', icon: 'friend', title: 'Find your party', text: 'Add friends by their player name. Your friends list follows you between the desktop app and this website.' },
    { name: 'Party', icon: 'invite', title: 'Adventure together', text: 'Send a party invitation and keep your friends close with a shared party HP display.' },
    { name: 'Presence', icon: 'player', title: 'See who is online', text: 'See when your friends are around. Sign in with the same account in the app and on the web.' },
  ] },
  { name: 'Messages', icon: 'message', entries: [
    { name: 'Inbox', icon: 'quest', title: 'A message from your party', text: 'Keep in touch with direct messages. Your conversations are available in the desktop app and on this website.' },
    { name: 'Friends', icon: 'friend', title: 'Stay connected', text: 'Open a conversation with a friend from your friends list. One player name, wherever you sign in.' },
    { name: 'Account', icon: 'player', title: 'Choose your player name', text: 'Create an account to unlock friends, party invitations and messages. The launcher itself works without an account.' },
  ] },
  { name: 'Navigation', icon: 'navigation', entries: [
    { name: 'Browser', icon: 'navigation', title: 'A window into your world', text: 'Open web pages in a floating, curved pane. Move your cursor and watch the surface tilt with you.' },
    { name: 'Media', icon: 'items', title: 'Beyond the browser', text: 'Bring images, GIFs and videos into the same curved viewing space. Keep a favorite world within reach.' },
    { name: 'Shortcuts', icon: 'equipment', title: 'Take the familiar route', text: 'Put your favorite apps, folders and websites in the ring menu and launch them from one place.' },
  ] },
  { name: 'Settings', icon: 'settings', entries: [
    { name: 'Gestures', icon: 'option', title: 'Summon the menu', text: 'Opt in to camera hand gestures: swipe with two fingers, point to aim and push to select. Video stays on your computer.' },
    { name: 'Appearance', icon: 'skills', title: 'Your menu, your space', text: 'Adjust the menu and HP display to fit your desktop. Keep the familiar SAO interface close at hand.' },
    { name: 'Link Start', icon: 'quest', title: 'Enter the virtual world', text: 'The anime’s startup is redrawn at your display’s refresh rate, with the original Japanese voice in the desktop app.' },
  ] },
] as const;

/** A website demo: selections explain app features without launching desktop actions. */
export function MenuPreview() {
  const [category, setCategory] = useState(0);
  const [selection, setSelection] = useState(1);
  const menu = MENUS[category];
  const entry = menu.entries[selection];

  return (
    <div className="menu-preview" role="region" aria-label="Interactive SAO menu preview">
      <div className="player-hud" aria-label="Demo player Kirito, level 96, full HP">
        <span className="hud-name">Kirito</span>
        <span className="hud-gauge"><i /></span>
        <span className="hud-numbers">18500 / 18500 <b>Lv. 96</b></span>
      </div>

      <div className="preview-layout">
        <div className="preview-profile">
          <div className="profile-heading"><span>Kirito</span><span className="profile-status">Player</span></div>
          <svg className="equipment-avatar" viewBox="0 0 250 245" fill="none" aria-hidden="true">
            <image href="/sao/avatar.svg" x="89" y="39" width="72" height="166" />
            <g stroke="#939393" strokeWidth="1.3">
              <path d="M125 31V15M106 90 66 53H34M102 111H57L22 94M100 137H24M105 158 65 176H34M114 180 68 212H46M144 90 184 53H216M148 111H193L228 94M150 137H226M145 158 185 176H216M136 180 182 212H204M125 209V231" />
              {[ [125,15], [34,53], [22,94], [24,137], [34,176], [46,212], [216,53], [228,94], [226,137], [216,176], [204,212], [125,231] ].map(([cx,cy],index) => <g key={index}><circle cx={cx} cy={cy} r="7" fill="#fafafa" /><circle cx={cx} cy={cy} r="4.5" fill={index === 6 ? '#eba601' : '#777'} stroke="none" /></g>)}
            </g>
          </svg>
          <div className="preview-description" aria-live="polite" aria-atomic="true">
            <h3>{entry.title}</h3>
            <p>{entry.text}</p>
          </div>
          <Link href="/register" className="preview-account">Create account <Icon name="arrow" size={16} /></Link>
        </div>

        <div className="preview-categories" role="group" aria-label="Menu categories">
          {MENUS.map((item, index) => (
            <button type="button" key={item.name} aria-label={item.name} aria-pressed={category === index} className="preview-category" onClick={() => { setCategory(index); setSelection(index === 0 ? 1 : 0); }}>
              <img src={`/sao/${item.icon}.svg`} className="category-idle" width="64" height="64" alt="" />
              <img src={`/sao/${item.icon}-active.svg`} className="category-active" width="64" height="64" alt="" />
              <span className="category-tooltip">{item.name}</span>
            </button>
          ))}
        </div>

        <div className="preview-submenu" role="group" aria-label={`${menu.name} menu`}>
          <div className="submenu-caption">{menu.name}</div>
          {menu.entries.map((item, index) => (
            <button type="button" key={item.name} aria-pressed={selection === index} className="preview-entry" onClick={() => setSelection(index)}>
              <span className="submenu-icon"><img className="submenu-icon-idle" src={`/sao/${item.icon}.svg`} width="27" height="27" alt="" /><img className="submenu-icon-active" src={`/sao/${item.icon}-active.svg`} width="27" height="27" alt="" /></span>
              <span>{item.name}</span>
              <span className="entry-pointer" aria-hidden="true" />
            </button>
          ))}
          <div className="submenu-hint">Select an icon.<br />Explore the menu.</div>
        </div>
      </div>
      <p className="preview-caption"><span className="preview-dot" /> Interactive preview <span>SAO Menu</span></p>
    </div>
  );
}
