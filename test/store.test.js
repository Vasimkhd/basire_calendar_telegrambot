const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createStore } = require('../src/store');
const { weekDates } = require('../src/dates');

function tempStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'basire-'));
  fs.writeFileSync(path.join(dir, 'rooms.json'), JSON.stringify({
    rooms: [
      { id: 'room-1', name: 'Conference 1' },
      { id: 'room-2', name: 'Conference 2' },
    ],
  }));
  return { dir, store: createStore(dir) };
}

const clock = { today: '2026-10-14', nowMinutes: 8 * 60 };

function booking(overrides) {
  return {
    roomId: 'room-1',
    userId: 7,
    userName: 'Ann',
    date: '2026-10-14',
    start: '13:00',
    end: '14:00',
    ...overrides,
  };
}

test('overlapping bookings block one room and leave the other free', () => {
  const { dir, store } = tempStore();
  try {
    const first = store.tryBook(booking(), clock);
    assert.equal(first.ok, true);
    assert.equal(first.booking.topic, '');
    assert.equal(store.tryBook(booking({ topic: '  Budget with Ann  ' }), clock).reason, 'conflict');
    const noted = store.tryBook(booking({
      start: '15:00',
      end: '16:00',
      topic: '  Budget with Ann  ',
    }), clock);
    assert.equal(noted.ok, true);
    assert.equal(noted.booking.topic, 'Budget with Ann');

    const overlap = store.tryBook(booking({ start: '13:30', end: '15:00', userId: 8, userName: 'Boris' }), clock);
    assert.equal(overlap.ok, false);
    assert.equal(overlap.reason, 'conflict');
    assert.equal(overlap.clashes[0].userName, 'Ann');

    const touching = store.tryBook(booking({ start: '14:00', end: '15:00', userId: 8, userName: 'Boris' }), clock);
    assert.equal(touching.ok, true);

    const otherRoom = store.tryBook(booking({ roomId: 'room-2', userId: 9, userName: 'Cara' }), clock);
    assert.equal(otherRoom.ok, true);

    assert.equal(store.tryBook(booking({ start: '07:30', end: '08:00' }), clock).reason, 'invalid');
    assert.equal(store.tryBook(booking({ date: '2027-01-01' }), clock).reason, 'invalid');
    assert.equal(store.tryBook(booking({ roomId: 'room-9' }), clock).reason, 'invalid');

    const nextWeek = weekDates('2026-10-14', 'next')[0];
    assert.equal(store.tryBook(booking({ date: nextWeek, start: '09:00', end: '09:30' }), clock).ok, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('cancelling frees the slot and another person cannot cancel it', () => {
  const { dir, store } = tempStore();
  try {
    const first = store.tryBook(booking(), clock);
    assert.equal(store.cancelBooking(first.booking.id, 8, clock).ok, false);
    assert.equal(store.cancelBooking(first.booking.id, 7, { today: '2026-10-14', nowMinutes: 14 * 60 }).ok, false);
    assert.equal(store.getBooking(first.booking.id).status, 'active');

    assert.equal(store.listUpcoming(7, '2026-10-14', 13 * 60).length, 1);
    assert.equal(store.listUpcoming(7, '2026-10-14', 14 * 60).length, 0);

    assert.equal(store.cancelBooking(first.booking.id, 7, clock).ok, true);
    assert.equal(store.getBooking(first.booking.id).status, 'cancelled');
    assert.equal(store.tryBook(booking({ start: '13:00', end: '13:30' }), clock).ok, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('refreshing a user keeps extra fields and createdAt', () => {
  const { dir, store } = tempStore();
  try {
    fs.writeFileSync(path.join(dir, 'users.json'), JSON.stringify({
      users: [{
        id: 5,
        employeeId: 'E-1',
        createdAt: '2020-01-01T00:00:00.000Z',
      }],
    }));
    const again = createStore(dir);
    const user = again.upsertUser({ id: 5, firstName: 'Ann', groupStatus: 'member' });
    assert.equal(user.employeeId, 'E-1');
    assert.equal(user.createdAt, '2020-01-01T00:00:00.000Z');
    assert.equal(user.firstName, 'Ann');
    assert.equal(again.readUsers().users.length, 1);

    again.upsertUser({ id: 5, firstName: 'Anne', groupStatus: 'administrator' });
    assert.equal(again.readUsers().users.length, 1);
    assert.equal(again.readUsers().users[0].firstName, 'Anne');
    assert.equal(again.readUsers().users[0].employeeId, 'E-1');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
