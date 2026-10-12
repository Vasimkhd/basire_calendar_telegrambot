const STEP = 30;
const OPEN = 7 * 60;
const CLOSE = 18 * 60;
const DURATIONS = [30, 60, 90, 120];

const PERIODS = [
  { id: 'morning', from: 7 * 60, to: 11 * 60 },
  { id: 'afternoon', from: 11 * 60, to: 15 * 60 },
  { id: 'evening', from: 15 * 60, to: 18 * 60 },
];

function part(parts, type) {
  const found = parts.find((item) => item.type === type);
  if (!found) throw new Error(`Missing date part ${type}`);
  return found.value;
}

function currentDate(timeZone, date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  return `${part(parts, 'year')}-${part(parts, 'month')}-${part(parts, 'day')}`;
}

function currentMinutes(timeZone, date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  let hour = Number(part(parts, 'hour'));
  const minute = Number(part(parts, 'minute'));
  if (hour === 24) hour = 0;
  return hour * 60 + minute;
}

function isIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function weekdayIndex(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function addDays(iso, days) {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function startOfWeek(iso) {
  const index = weekdayIndex(iso);
  const mondayOffset = index === 0 ? -6 : 1 - index;
  return addDays(iso, mondayOffset);
}

function weekDates(today, week) {
  const start = startOfWeek(today);
  const from = week === 'next' ? addDays(start, 7) : start;
  const dates = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const date = addDays(from, offset);
    if (week !== 'next' && date < today) continue;
    dates.push(date);
  }
  return dates;
}

function isOfferedDate(date, today) {
  if (!isIsoDate(date) || !isIsoDate(today)) return false;
  return weekDates(today, 'current').includes(date) || weekDates(today, 'next').includes(date);
}

function toMinutes(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function fromMinutes(total) {
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function isValidRange(start, end) {
  const startMin = toMinutes(start);
  const endMin = toMinutes(end);
  if (startMin == null || endMin == null) return false;
  if (startMin < OPEN || endMin > CLOSE || endMin <= startMin) return false;
  return startMin % STEP === 0 && endMin % STEP === 0;
}

function rangesOverlap(startA, endA, startB, endB) {
  const a0 = toMinutes(startA);
  const a1 = toMinutes(endA);
  const b0 = toMinutes(startB);
  const b1 = toMinutes(endB);
  if ([a0, a1, b0, b1].some((value) => value == null)) return false;
  return a0 < b1 && b0 < a1;
}

function startSlots(periodId) {
  const period = PERIODS.find((item) => item.id === periodId);
  if (!period) return [];
  const slots = [];
  for (let time = period.from; time < period.to; time += STEP) {
    slots.push(fromMinutes(time));
  }
  return slots;
}

function endSlots(periodId, start) {
  const period = PERIODS.find((item) => item.id === periodId);
  const startMin = toMinutes(start);
  if (!period || startMin == null) return [];
  const slots = [];
  for (let time = period.from + STEP; time <= period.to; time += STEP) {
    if (time > startMin) slots.push(fromMinutes(time));
  }
  return slots;
}

function bookableStartSlots(periodId, date, today, nowMinutes) {
  if (!isIsoDate(date) || date < today) return [];
  return startSlots(periodId).filter((slot) => date > today || toMinutes(slot) >= nowMinutes);
}

function periodsWithStarts(date, today, nowMinutes) {
  return PERIODS
    .filter((period) => bookableStartSlots(period.id, date, today, nowMinutes).length > 0)
    .map((period) => period.id);
}

function availableDurations(start) {
  const startMin = toMinutes(start);
  if (startMin == null) return [];
  return DURATIONS
    .filter((minutes) => startMin + minutes <= CLOSE)
    .map((minutes) => ({
      minutes,
      end: fromMinutes(startMin + minutes),
    }));
}

function periodsWithEnds(start) {
  return PERIODS
    .filter((period) => endSlots(period.id, start).length > 0)
    .map((period) => period.id);
}

function isBookableStart(date, time, today, nowMinutes) {
  if (!isOfferedDate(date, today)) return false;
  return PERIODS.some((period) => bookableStartSlots(period.id, date, today, nowMinutes).includes(time));
}

function isBookableEnd(date, start, end, today, nowMinutes) {
  if (!isBookableStart(date, start, today, nowMinutes)) return false;
  if (!isValidRange(start, end)) return false;
  return PERIODS.some((period) => endSlots(period.id, start).includes(end));
}

function isUpcoming(booking, today, nowMinutes) {
  if (!booking) return false;
  if (booking.date > today) return true;
  if (booking.date < today) return false;
  const end = toMinutes(booking.end);
  return end != null && end > nowMinutes;
}

function formatLongDate(iso, locale) {
  if (!isIsoDate(iso)) throw new Error(`Bad date ${iso}`);
  const [year, month, day] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

module.exports = {
  STEP,
  OPEN,
  CLOSE,
  PERIODS,
  currentDate,
  currentMinutes,
  isIsoDate,
  weekdayIndex,
  addDays,
  startOfWeek,
  weekDates,
  isOfferedDate,
  toMinutes,
  fromMinutes,
  isValidRange,
  rangesOverlap,
  startSlots,
  endSlots,
  bookableStartSlots,
  periodsWithStarts,
  periodsWithEnds,
  availableDurations,
  DURATIONS,
  isBookableStart,
  isBookableEnd,
  isUpcoming,
  formatLongDate,
};
