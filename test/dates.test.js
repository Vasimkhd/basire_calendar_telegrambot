const test = require('node:test');
const assert = require('node:assert/strict');
const {
  weekdayIndex,
  addDays,
  startOfWeek,
  weekDates,
  isIsoDate,
  isOfferedDate,
  rangesOverlap,
  endSlots,
  availableDurations,
  currentDate,
  currentMinutes,
  isBookableEnd,
} = require('../src/dates');

test('weeks start on Monday and keep only the remaining days', () => {
  let monday = '2026-10-12';
  while (weekdayIndex(monday) !== 1) monday = addDays(monday, 1);
  assert.equal(startOfWeek(monday), monday);
  assert.equal(startOfWeek(addDays(monday, 6)), monday);

  const wednesday = addDays(monday, 2);
  assert.deepEqual(weekDates(wednesday, 'current'), [
    wednesday,
    addDays(wednesday, 1),
    addDays(wednesday, 2),
    addDays(wednesday, 3),
    addDays(wednesday, 4),
  ]);
  assert.equal(weekDates(wednesday, 'next').length, 7);
  assert.equal(weekDates(wednesday, 'next')[0], addDays(monday, 7));
});

test('Sunday offers only that day plus a full next week', () => {
  let sunday = '2026-10-12';
  while (weekdayIndex(sunday) !== 0) sunday = addDays(sunday, 1);
  assert.deepEqual(weekDates(sunday, 'current'), [sunday]);
  assert.equal(weekDates(sunday, 'next').length, 7);
});

test('rejects impossible dates and dates outside the two offered weeks', () => {
  assert.equal(isIsoDate('2026-02-31'), false);
  assert.equal(isIsoDate('2026-10-14'), true);
  assert.equal(isOfferedDate('2026-10-14', '2026-10-14'), true);
  assert.equal(isOfferedDate('2027-01-01', '2026-10-14'), false);
});

test('30-minute ranges touch at the boundary without overlapping', () => {
  assert.equal(rangesOverlap('10:00', '11:00', '11:00', '12:00'), false);
  assert.equal(rangesOverlap('10:00', '11:30', '11:00', '12:00'), true);
  assert.equal(rangesOverlap('09:00', '18:00', '17:30', '18:00'), true);
  assert.equal(rangesOverlap('07:00', '08:00', '08:00', '09:00'), false);
});

test('end times stay inside one part of the day', () => {
  assert.ok(endSlots('morning', '10:00').includes('11:00'));
  assert.ok(!endSlots('afternoon', '10:00').includes('11:00'));
  assert.ok(endSlots('afternoon', '10:00').includes('15:00'));
  assert.ok(!endSlots('evening', '10:00').includes('15:00'));
  assert.deepEqual(endSlots('evening', '17:30'), ['18:00']);
});

test('uses the office timezone for today and the current minute', () => {
  assert.equal(currentDate('Asia/Tashkent', new Date('2026-10-12T20:30:00Z')), '2026-10-13');
  assert.equal(currentMinutes('Asia/Tashkent', new Date('2026-10-12T20:30:00Z')), 90);
  assert.equal(currentDate('Asia/Tashkent', new Date('2026-10-12T19:00:00Z')), '2026-10-13');
  assert.equal(currentMinutes('Asia/Tashkent', new Date('2026-10-12T19:00:00Z')), 0);
});

test('durations are 30 minutes, 1 hour, 1.5 hours, and 2 hours, and they stop at 18:00', () => {
  assert.deepEqual(availableDurations('09:00').map((item) => item.end), ['09:30', '10:00', '10:30', '11:00']);
  assert.deepEqual(availableDurations('16:30').map((item) => item.minutes), [30, 60, 90]);
  assert.deepEqual(availableDurations('17:30'), [{ minutes: 30, end: '18:00' }]);
});

test('a start in the past is not bookable, a later grid time is', () => {
  const today = '2026-10-14';
  const now = 8 * 60;
  assert.equal(isBookableEnd(today, '07:30', '08:00', today, now), false);
  assert.equal(isBookableEnd(today, '09:00', '10:00', today, now), true);
  assert.equal(isBookableEnd(today, '09:00', '10:15', today, now), false);
});
