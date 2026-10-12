const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createStore } = require('../src/store');
const { createWebServer } = require('../src/web');

function tempStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'basire-web-'));
  fs.writeFileSync(path.join(dir, 'rooms.json'), JSON.stringify({
    rooms: [
      { id: 'room-1', name: 'Room One' },
      { id: 'room-2', name: 'Room Two' },
    ],
  }));
  const store = createStore(dir);
  store.tryBook({
    roomId: 'room-2',
    userId: 7,
    userName: 'Ann',
    date: '2026-10-14',
    start: '10:00',
    end: '11:00',
    topic: 'With the client',
  }, { today: '2026-10-14', nowMinutes: 8 * 60 });
  store.upsertUser({ id: 7, username: 'ann', firstName: 'Ann', groupStatus: 'member' });
  return { dir, store };
}

test('the page is a read-only week calendar of the bookings', async () => {
  const { dir, store } = tempStore();
  const server = createWebServer({ store, language: 'en', timeZone: 'Asia/Tashkent' });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    const page = await fetch(`http://127.0.0.1:${port}/`);
    const html = await page.text();
    assert.equal(page.status, 200);
    assert.match(html, /id="calendar"/);
    assert.doesNotMatch(html, /<form/);
    assert.doesNotMatch(html, /method="post"/i);

    const boardResponse = await fetch(`http://127.0.0.1:${port}/api/board`);
    const board = await boardResponse.json();
    assert.equal(board.bookings.length, 1);
    assert.equal(board.bookings[0].roomId, 'room-2');
    assert.equal(board.bookings[0].room, 'Room Two');
    assert.equal(board.bookings[0].userName, 'Ann');
    assert.equal(board.bookings[0].topic, 'With the client');
    assert.equal(board.openMinutes, 7 * 60);
    assert.equal(board.closeMinutes, 18 * 60);
    assert.match(board.today, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(board.rooms[0].name, 'Room One');
    assert.equal(board.users[0].username, '@ann');

    const missing = await fetch(`http://127.0.0.1:${port}/edit`, { method: 'POST' });
    assert.equal(missing.status, 405);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
