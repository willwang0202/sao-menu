import { useEffect, useState } from 'react';
import { invitationText, type Invitation, type InvitationAnswer } from '../shared/invitations';
import { themeSound, type ThemeId } from '../shared/themes';
import { ACCEPT_BUTTON, DECLINE_BUTTON, TITLE_PATHS, WINDOW_ART, type ArtShape } from './sao-window-art';
import './invitation.css';
const SOUND = './sao-original/Sounds/';
const SOUND_VOLUME = .3;
/** White 6.5px frame around the artwork. */
const FRAME_PATH = 'M1298.5 6.5v919h-1292v-919h1292m6.5-6.5h-1305v932h1305v-932z';
const BUTTON_CENTRE_Y = 755;
const BUTTON_RADIUS = 90;
const BUTTON_CENTRE_X: Record<InvitationAnswer, number> = { accept: 354.25, decline: 950.75 };

function Shape({ shape }: { shape: ArtShape }) {
  return shape.circle ? <circle {...shape.circle} fill={shape.fill} /> : <path d={shape.d} fill={shape.fill} opacity={shape.opacity} />;
}

function AnswerButton({ answer, label, disabled, onAnswer }: { answer: InvitationAnswer; label: string; disabled: boolean; onAnswer: (answer: InvitationAnswer) => void }) {
  const x = BUTTON_CENTRE_X[answer];
  return <button type="button" className={`invitation-answer ${answer}`} aria-label={label} title={label} disabled={disabled} onClick={() => onAnswer(answer)}>
    <svg viewBox={`${x - BUTTON_RADIUS} ${BUTTON_CENTRE_Y - BUTTON_RADIUS} ${BUTTON_RADIUS * 2} ${BUTTON_RADIUS * 2}`} aria-hidden="true">
      {(answer === 'accept' ? ACCEPT_BUTTON : DECLINE_BUTTON).map((shape, index) => <Shape key={index} shape={shape} />)}
    </svg>
  </button>;
}

/** SAO alert window (darkblackswords' SAO_UI-Window) asking to join a party or accept a friend request. */
export function InvitationWindow({ invitation, reducedMotion, sound, theme }: { invitation: Invitation | null; reducedMotion: boolean; sound: boolean; theme: ThemeId }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    setBusy(false); setError('');
    if (!invitation || !sound) return;
    const track = new Audio(SOUND + themeSound(theme, 'invitation'));
    track.volume = SOUND_VOLUME;
    void track.play().catch(() => { /* The window still opens when audio is unavailable. */ });
  }, [invitation?.id]); // Once per invitation.
  if (!invitation) return null;
  const subject = invitation.kind === 'party' ? 'party' : 'friend request';
  const answer = (choice: InvitationAnswer) => {
    setBusy(true); setError('');
    window.saoWidget?.answerInvitation(invitation.id, choice).catch(() => { setBusy(false); setError('Could not reach the account service. Try again.'); });
  };
  const { width, height } = WINDOW_ART;
  return <div key={invitation.id} className={`sao-invitation ${reducedMotion ? 'reduced' : ''}`} role="alertdialog" aria-labelledby="invitation-title" aria-describedby="invitation-message">
    <svg className="invitation-art" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <defs>
        <linearGradient id="invitation-title-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#E4E4E4" /><stop offset="1" stopColor="#F9F9F9" /></linearGradient>
        <linearGradient id="invitation-shade" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#040404" stopOpacity=".2" /><stop offset="1" stopColor="#040404" stopOpacity="0" /></linearGradient>
      </defs>
      <rect fill="#D8D8D8" width={width} height={height} />
      <rect y="233.5" fill="url(#invitation-shade)" width={width} height="42.5" />
      <rect y="533.5" fill="url(#invitation-shade)" width={width} height="42.5" transform="rotate(180 652.5 554.75)" />
      <rect y={WINDOW_ART.footerTop} fill="#fff" width={width} height={height - WINDOW_ART.footerTop} />
      <rect fill="url(#invitation-title-fill)" width={width} height={WINDOW_ART.titleHeight} />
      <path fill="#fff" d={FRAME_PATH} />
      <path fill="#4D4D4D" d={TITLE_PATHS.invite} />
    </svg>
    <h1 id="invitation-title" className="visually-hidden">Invite</h1>
    <div className="invitation-panel">
      <p id="invitation-message">{invitationText(invitation)}</p>
      {error && <p className="invitation-error" role="alert">{error}</p>}
    </div>
    <AnswerButton answer="accept" label={invitation.kind === 'party' ? 'Join party' : 'Accept friend request'} disabled={busy} onAnswer={answer} />
    <AnswerButton answer="decline" label={`Decline ${subject}`} disabled={busy} onAnswer={answer} />
  </div>;
}
