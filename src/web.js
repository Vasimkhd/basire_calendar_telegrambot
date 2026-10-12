const fs = require('fs');
const http = require('http');
const path = require('path');
const { OPEN, CLOSE, currentDate, currentMinutes } = require('./dates');

const pagePath = path.join(__dirname, '..', 'public', 'index.html');

function buildBoard(store, timeZone = 'Asia/Tashkent') {
  const rooms = store.readRooms().map((room) => ({
    id: room.id,
    name: room.name,
  }));
  const roomName = new Map(rooms.map((room) => [room.id, room.name]));
  const bookings = store.readBookings().bookings
    .map((booking) => ({
      date: booking.date || '',
      start: booking.start || '',
      end: booking.end || '',
      roomId: booking.roomId || '',
      room: roomName.get(booking.roomId) || booking.roomId || '',
      userName: booking.userName || '',
      topic: booking.topic || '',
      status: booking.status || '',
    }))
    .sort((left, right) => left.date.localeCompare(right.date) || left.start.localeCompare(right.start));
  const users = store.readUsers().users
    .map((user) => ({
      name: [user.firstName, user.lastName].filter(Boolean).join(' '),
      username: user.username ? `@${user.username}` : '',
      groupStatus: user.groupStatus || '',
    }))
    .sort((left, right) => left.name.localeCompare(right.name, 'ru'));
  return {
    rooms,
    bookings,
    users,
    today: currentDate(timeZone),
    nowMinutes: currentMinutes(timeZone),
    openMinutes: OPEN,
    closeMinutes: CLOSE,
  };
}

function createWebServer({ store, language = 'ru', timeZone = 'Asia/Tashkent' }) {
  const html = fs.readFileSync(pagePath, 'utf8').replaceAll('__LANG__', language === 'en' ? 'en' : 'ru');
  return http.createServer((request, response) => {
    const url = new URL(request.url || '/', 'http://127.0.0.1');
    if (request.method !== 'GET') {
      response.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Method not allowed');
      return;
    }
    if (url.pathname === '/api/board') {
      try {
        const body = JSON.stringify(buildBoard(store, timeZone));
        response.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        });
        response.end(body);
      } catch (error) {
        response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end(error.message);
      }
      return;
    }
    if (url.pathname === '/' || url.pathname === '/index.html') {
      response.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      response.end(html);
      return;
    }
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  });
}

function startWeb({ store, port, language, timeZone }) {
  const server = createWebServer({ store, language, timeZone });
  return new Promise((resolve, reject) => {
    const fail = (error) => reject(error);
    server.once('error', fail);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', fail);
      resolve(server);
    });
  });
}

module.exports = {
  buildBoard,
  createWebServer,
  startWeb,
};
