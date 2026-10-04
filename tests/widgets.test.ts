import test from 'node:test';
import assert from 'node:assert/strict';
import { clockAngles, clockText, unreadMessages, widgetPositions, CLOCK_SIZE, MESSAGE_BUTTON_SIZE } from '../src/shared/widgets';
import type { SocialSnapshot } from '../src/shared/social';

test('clock hands follow the original 12-hour and 60-minute meters', () => {
  assert.deepEqual(clockAngles(new Date(2026, 9, 4, 15, 30)), { hour: 105, minute: 180 });
  assert.deepEqual(clockAngles(new Date(2026, 9, 4, 0, 0)), { hour: 0, minute: 0 });
});

test('digital time uses the original %H:%M format', () => {
  assert.equal(clockText(new Date(2026, 9, 4, 7, 5)), '07:05');
  assert.equal(clockText(new Date(2026, 9, 4, 23, 59)), '23:59');
});

test('counts unread direct messages across conversations', () => {
  const conversation = (unread: number) => ({ unread } as SocialSnapshot['conversations'][number]);
  assert.equal(unreadMessages(null), 0);
  assert.equal(unreadMessages({ conversations: [conversation(2), conversation(0), conversation(3)] } as SocialSnapshot), 5);
});

test('places the message button below the HP display and the clock at the top right', () => {
  const positions = widgetPositions({ x: 0, y: 25, width: 1440, height: 875 });
  assert.deepEqual(positions.messageButton, { x: 52, y: 177 });
  assert.deepEqual(positions.clock, { x: 1440 - 24 - CLOCK_SIZE.width, y: 49 });
  assert.equal(MESSAGE_BUTTON_SIZE, 56);
});
