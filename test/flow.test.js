const test = require('node:test');
const assert = require('node:assert/strict');
const { createFlow } = require('../src/flow');
const { startOfWeek, addDays, weekdayIndex, toMinutes } = require('../src/dates');

const rooms = [
  { id: 'room-1', name: 'Conference 1' },
  { id: 'room-2', name: 'Conference 2' },
];

function flowAt(isoTime, language = 'en') {
  return createFlow({
    timeZone: 'UTC',
    language,
    now: () => new Date(isoTime),
  });
}

test('day screen shows the rest of this week and next week last', () => {
  const flow = flowAt('2026-10-14T08:15:00Z');
  const view = flow.render(flow.initialState(), { rooms });
  const days = view.buttons.flat().filter((button) => button.action.startsWith('day:'));
  assert.equal(days[0].action, 'day:2026-10-14');
  assert.ok(days.every((button) => button.action >= 'day:2026-10-14'));
  assert.deepEqual(view.buttons.at(-1), [{ label: 'Next week →', action: 'week:next' }]);
  assert.match(view.text, /This week/);
  assert.match(view.text, /Choose a day/);
});

test('next week shifts to seven days and can shift back', () => {
  const flow = flowAt('2026-10-14T08:15:00Z');
  const next = flow.reduce(flow.initialState(), { type: 'week', week: 'next' }).state;
  const view = flow.render(next, { rooms });
  const days = view.buttons.flat().filter((button) => button.action.startsWith('day:'));
  assert.equal(days.length, 7);
  assert.equal(days[0].action, `day:${addDays(startOfWeek('2026-10-14'), 7)}`);
  assert.equal(view.buttons.at(-1)[0].action, 'week:current');

  const back = flow.reduce(next, { type: 'week', week: 'current' }).state;
  assert.equal(back.week, 'current');
  assert.equal(back.step, 'day');
});

test('Sunday shows one day and the next-week button', () => {
  let sunday = '2026-10-14';
  while (weekdayIndex(sunday) !== 0) sunday = addDays(sunday, 1);
  const flow = flowAt(`${sunday}T10:00:00Z`);
  const view = flow.render(flow.initialState(), { rooms: [] });
  const days = view.buttons.flat().filter((button) => button.action.startsWith('day:'));
  assert.deepEqual(days.map((button) => button.action), [`day:${sunday}`]);
});

test('time is chosen by part of day, then at most eight slots', () => {
  const flow = flowAt('2026-10-14T08:15:00Z');
  let state = flow.reduce(flow.initialState(), { type: 'day', date: '2026-10-14' }).state;
  assert.equal(state.step, 'start-period');
  const periods = flow.render(state, { rooms });
  assert.equal(
    periods.buttons.find((row) => row[0].action === 'period:morning')[0].label,
    'Morning · 08:30–10:30',
  );
  assert.ok(!periods.buttons.flat().some((button) => button.action.startsWith('start:')));

  state = flow.reduce(state, { type: 'period', period: 'morning' }).state;
  const slots = flow.render(state, { rooms });
  const times = slots.buttons.slice(0, -1);
  assert.ok(times.every((row) => row.length <= 4));
  assert.ok(times.flat().length <= 8);
  assert.ok(times.flat().every((button) => toMinutes(button.label) < 11 * 60));
  assert.equal(slots.buttons.at(-1)[0].action, 'back');
});

test('books a start and end, and a busy room returns to the time step', () => {
  const flow = flowAt('2026-10-14T08:15:00Z');
  let state = flow.initialState();
  state = flow.reduce(state, { type: 'day', date: '2026-10-14' }).state;
  state = flow.reduce(state, { type: 'period', period: 'afternoon' }).state;
  state = flow.reduce(state, { type: 'start', time: '13:00' }).state;
  assert.equal(state.step, 'duration');
  const durations = flow.render(state, { rooms });
  assert.deepEqual(
    durations.buttons.flat().filter((button) => button.action.startsWith('dur:')).map((button) => button.label),
    ['30 minutes', '1 hour', '1.5 hours', '2 hours'],
  );
  state = flow.reduce(state, { type: 'duration', minutes: 60 }).state;
  assert.equal(state.step, 'room');
  assert.equal(state.end, '14:00');

  const roomView = flow.render(state, { rooms });
  assert.deepEqual(
    roomView.buttons.slice(0, -1).map((row) => row[0].action),
    ['room:room-1', 'room:room-2'],
  );

  const backed = flow.reduce(state, { type: 'back' }).state;
  assert.equal(backed.step, 'duration');
  assert.equal(backed.start, '13:00');

  const result = flow.reduce(state, { type: 'room', roomId: 'room-1' });
  assert.equal(result.intent, null);
  assert.equal(result.state.step, 'topic');
  const topicView = flow.render(result.state, { rooms });
  assert.ok(topicView.buttons.flat().some((button) => button.action === 'skip'));
  assert.match(topicView.text, /what this meeting is about/i);

  const skipped = flow.reduce(result.state, { type: 'skip' });
  assert.deepEqual(skipped.intent, {
    type: 'book',
    date: '2026-10-14',
    start: '13:00',
    end: '14:00',
    roomId: 'room-1',
    topic: '',
  });
  assert.equal(flow.applyTopic(result.state, '  with Anna  ').intent.topic, 'with Anna');
  assert.equal(flow.applyTopic(result.state, '   ').intent, null);

  const busy = flow.backToTime(
    { ...state, roomId: 'room-1' },
    'Conference 1 is busy: 13:00–14:00 (Ann).\nChoose another time.',
  );
  assert.equal(busy.date, '2026-10-14');
  assert.equal(busy.start, null);
  assert.equal(busy.roomId, 'room-1');
  assert.equal(busy.step, 'start-period');
  const shown = flow.render(busy, { rooms });
  assert.match(shown.text, /Conference 1/);
  assert.match(shown.text, /Choose another time/);
  assert.ok(shown.buttons.flat().some((button) => button.action === 'clear-room'));

  let retry = flow.reduce(busy, { type: 'period', period: 'afternoon' }).state;
  retry = flow.reduce(retry, { type: 'start', time: '12:00' }).state;
  const again = flow.reduce(retry, { type: 'duration', minutes: 60 });
  assert.equal(again.state.step, 'topic');
  assert.equal(again.state.roomId, 'room-1');
  const booked = flow.reduce(again.state, { type: 'skip' });
  assert.equal(booked.intent.roomId, 'room-1');
  assert.equal(booked.intent.start, '12:00');
  assert.equal(booked.intent.end, '13:00');
});

test('a date outside this week and next week is ignored', () => {
  const flow = flowAt('2026-10-14T08:15:00Z');
  const result = flow.reduce(flow.initialState(), { type: 'day', date: '2027-01-01' });
  assert.equal(result.state.step, 'day');
  assert.equal(result.state.date, null);
});

test('today after 17:30 has no start times', () => {
  const flow = flowAt('2026-10-14T17:45:00Z');
  const result = flow.reduce(flow.initialState(), { type: 'day', date: '2026-10-14' });
  assert.equal(result.state.step, 'day');
  assert.match(result.state.notice, /No times left today/);
});

test('the last half hour of the day skips the period list', () => {
  const flow = flowAt('2026-10-14T17:30:00Z');
  const result = flow.reduce(flow.initialState(), { type: 'day', date: '2026-10-14' });
  assert.equal(result.state.step, 'start-time');
  assert.equal(result.state.period, 'evening');
  const view = flow.render(result.state, { rooms });
  assert.deepEqual(
    view.buttons.flat().filter((button) => button.action.startsWith('start:')).map((button) => button.label),
    ['17:30'],
  );
});

test('a late start only offers durations that finish by 18:00', () => {
  const flow = flowAt('2026-10-14T10:00:00Z');
  let state = flow.reduce(flow.initialState(), { type: 'day', date: '2026-10-14' }).state;
  state = flow.reduce(state, { type: 'period', period: 'evening' }).state;
  state = flow.reduce(state, { type: 'start', time: '17:30' }).state;
  const view = flow.render(state, { rooms });
  assert.deepEqual(
    view.buttons.flat().filter((button) => button.action.startsWith('dur:')).map((button) => button.action),
    ['dur:30'],
  );
});

test('Russian copy keeps the next-week button at the end', () => {
  const flow = flowAt('2026-10-14T08:15:00Z', 'ru');
  const view = flow.render(flow.initialState(), { rooms: [] });
  assert.equal(view.buttons.at(-1)[0].label, 'Следующая неделя →');
});
