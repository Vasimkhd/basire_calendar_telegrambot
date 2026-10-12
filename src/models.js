const crypto = require('crypto');

function formatUserName(user) {
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  if (full) return full.slice(0, 80);
  if (user.username) return `@${String(user.username).replace(/^@/, '')}`.slice(0, 80);
  return '';
}

function createUser(input, existing) {
  const id = Number(input.id);
  if (!Number.isSafeInteger(id)) throw new Error('User id must be an integer');
  const now = new Date().toISOString();
  return {
    ...(existing || {}),
    id,
    username: input.username || null,
    firstName: input.firstName || '',
    lastName: input.lastName || '',
    languageCode: input.languageCode || null,
    groupStatus: input.groupStatus || existing?.groupStatus || 'member',
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
}

function cleanTopic(value) {
  const cleaned = String(value || '')
    .replace(/[\u0000-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return Array.from(cleaned).slice(0, 200).join('');
}

function createBooking(input) {
  const userId = Number(input.userId);
  if (!Number.isSafeInteger(userId)) throw new Error('Booking user id must be an integer');
  return {
    id: crypto.randomUUID(),
    roomId: input.roomId,
    userId,
    userName: input.userName || '',
    date: input.date,
    start: input.start,
    end: input.end,
    topic: cleanTopic(input.topic),
    status: 'active',
    createdAt: new Date().toISOString(),
  };
}

module.exports = {
  formatUserName,
  cleanTopic,
  createUser,
  createBooking,
};
