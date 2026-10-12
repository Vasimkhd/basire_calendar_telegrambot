const test = require('node:test');
const assert = require('node:assert/strict');
const { parseWizardCallback, parseMyCallback, callbackData } = require('../src/callbacks');
const { createAccess, isGroupMemberStatus, normalizeTitle } = require('../src/access');

test('wizard callbacks keep the minutes after the token', () => {
  assert.deepEqual(parseWizardCallback('b:ab12cd:start:09:00'), {
    token: 'ab12cd',
    kind: 'start',
    value: '09:00',
  });
  assert.deepEqual(parseWizardCallback('b:ab12cd:back'), {
    token: 'ab12cd',
    kind: 'back',
    value: '',
  });
  assert.equal(parseWizardCallback('startbook'), null);
  assert.equal(callbackData('ab12cd', 'start:09:00'), 'b:ab12cd:start:09:00');
  assert.throws(() => callbackData('ab12cd', `room:${'x'.repeat(80)}`));
});

test('my-booking callbacks carry the booking id', () => {
  assert.deepEqual(parseMyCallback('m:no'), { type: 'no' });
  assert.deepEqual(parseMyCallback('m:yes:6f1d1c9e-1b7a-4e3a-9c2d-0a1b2c3d4e5f'), {
    type: 'yes',
    id: '6f1d1c9e-1b7a-4e3a-9c2d-0a1b2c3d4e5f',
  });
  assert.equal(parseMyCallback('b:abc:day:2026-10-14'), null);
});

test('group membership and the Basire title are the access checks', () => {
  assert.equal(isGroupMemberStatus('member'), true);
  assert.equal(isGroupMemberStatus('restricted'), true);
  assert.equal(isGroupMemberStatus('left'), false);
  assert.equal(isGroupMemberStatus('kicked'), false);
  assert.equal(normalizeTitle('  Basire   общий   чат '), 'basire общий чат');

  const access = createAccess({
    store: { getGroup: () => ({ chatId: null }), setGroup() {} },
    config: { groupChatId: '', groupTitle: 'Basire общий чат' },
    copy: { setup: () => 'setup', denied: () => 'denied', unknownUser: 'unknown' },
  });
  assert.equal(access.isTargetGroup({ type: 'supergroup', id: -100, title: 'Basire Общий чат' }), true);
  assert.equal(access.isTargetGroup({ type: 'group', id: 2, title: 'Other chat' }), false);
  assert.equal(access.isTargetGroup({ type: 'private', id: 3, title: 'Basire общий чат' }), false);
});
