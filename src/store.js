const fs = require('fs');
const path = require('path');
const { isBookableEnd, rangesOverlap, isUpcoming } = require('./dates');
const { createUser, createBooking } = require('./models');

const ROOM_ID = /^[A-Za-z0-9_-]{1,20}$/;

function createStore(dataDir) {
  const files = {
    rooms: path.join(dataDir, 'rooms.json'),
    users: path.join(dataDir, 'users.json'),
    bookings: path.join(dataDir, 'bookings.json'),
    group: path.join(dataDir, 'group.json'),
  };

  fs.mkdirSync(dataDir, { recursive: true });
  ensure(files.users, { users: [] });
  ensure(files.bookings, { bookings: [] });
  ensure(files.group, { chatId: null, title: null, updatedAt: null });

  function readUsers() {
    const data = readJson(files.users, { users: [] });
    if (!Array.isArray(data.users)) throw new Error('data/users.json must contain a users array');
    return data;
  }

  function readBookings() {
    const data = readJson(files.bookings, { bookings: [] });
    if (!Array.isArray(data.bookings)) throw new Error('data/bookings.json must contain a bookings array');
    return data;
  }

  function readRooms() {
    if (!fs.existsSync(files.rooms)) throw new Error('Missing data/rooms.json');
    const data = readJson(files.rooms);
    if (!Array.isArray(data.rooms) || data.rooms.length === 0) {
      throw new Error('data/rooms.json needs at least one room');
    }
    for (const room of data.rooms) {
      if (typeof room.name !== 'string' || !room.name.trim()) {
        throw new Error('Each room needs a name');
      }
      if (typeof room.id !== 'string' || !ROOM_ID.test(room.id)) {
        throw new Error(`Room id "${room.id}" must be 1–20 letters, numbers, "_" or "-"`);
      }
    }
    return data.rooms;
  }

  function getGroup() {
    return readJson(files.group, { chatId: null, title: null, updatedAt: null });
  }

  function setGroup(group) {
    const current = getGroup();
    if (String(current.chatId) === String(group.chatId) && current.title === group.title) return current;
    const next = {
      chatId: group.chatId,
      title: group.title || null,
      updatedAt: new Date().toISOString(),
    };
    writeJson(files.group, next);
    return next;
  }

  function clearGroup(chatId) {
    const current = getGroup();
    if (current.chatId == null || String(current.chatId) !== String(chatId)) return current;
    const next = { chatId: null, title: null, updatedAt: new Date().toISOString() };
    writeJson(files.group, next);
    return next;
  }

  function upsertUser(input) {
    const data = readUsers();
    const index = data.users.findIndex((user) => Number(user.id) === Number(input.id));
    const existing = index >= 0 ? data.users[index] : null;
    const next = createUser(input, existing);
    if (index >= 0) data.users[index] = next;
    else data.users.push(next);
    writeJson(files.users, data);
    return next;
  }

  function tryBook(input, clock) {
    const rooms = readRooms();
    if (!rooms.some((room) => room.id === input.roomId)) {
      return { ok: false, reason: 'invalid' };
    }
    if (!isBookableEnd(input.date, input.start, input.end, clock.today, clock.nowMinutes)) {
      return { ok: false, reason: 'invalid' };
    }

    const data = readBookings();
    const clashes = data.bookings
      .filter((booking) => booking.status === 'active'
        && booking.roomId === input.roomId
        && booking.date === input.date
        && rangesOverlap(booking.start, booking.end, input.start, input.end))
      .sort((left, right) => left.start.localeCompare(right.start));

    if (clashes.length > 0) return { ok: false, reason: 'conflict', clashes };

    const booking = createBooking(input);
    data.bookings.push(booking);
    writeJson(files.bookings, data);
    return { ok: true, booking };
  }

  function getBooking(id) {
    return readBookings().bookings.find((booking) => booking.id === id) || null;
  }

  function listUpcoming(userId, today, nowMinutes) {
    return readBookings().bookings
      .filter((booking) => booking.status === 'active'
        && Number(booking.userId) === Number(userId)
        && isUpcoming(booking, today, nowMinutes))
      .sort((left, right) => left.date.localeCompare(right.date) || left.start.localeCompare(right.start));
  }

  function cancelBooking(id, userId, clock) {
    const data = readBookings();
    const booking = data.bookings.find((item) => item.id === id);
    if (!booking || booking.status !== 'active' || Number(booking.userId) !== Number(userId)) {
      return { ok: false };
    }
    if (!isUpcoming(booking, clock.today, clock.nowMinutes)) return { ok: false };
    booking.status = 'cancelled';
    booking.cancelledAt = new Date().toISOString();
    writeJson(files.bookings, data);
    return { ok: true, booking };
  }

  return {
    readUsers,
    readRooms,
    readBookings,
    getGroup,
    setGroup,
    clearGroup,
    upsertUser,
    tryBook,
    getBooking,
    listUpcoming,
    cancelBooking,
  };
}

function ensure(file, fallback) {
  if (!fs.existsSync(file)) writeJson(file, fallback);
}

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return structuredClone(fallback);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`Could not read ${path.basename(file)}: ${error.message}`);
  }
}

function writeJson(file, value) {
  const directory = path.dirname(file);
  fs.mkdirSync(directory, { recursive: true });
  const tmp = path.join(directory, `.${path.basename(file)}.${process.pid}.tmp`);
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(tmp, file);
}

module.exports = { createStore };
