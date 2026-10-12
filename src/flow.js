const { createCopy } = require('./i18n');
const { cleanTopic } = require('./models');
const {
  weekdayIndex,
  weekDates,
  bookableStartSlots,
  periodsWithStarts,
  availableDurations,
  formatLongDate,
  currentDate,
  currentMinutes,
} = require('./dates');

const ROOM_ID = /^[A-Za-z0-9_-]{1,20}$/;

function createFlow({ timeZone, language = 'ru', now = () => new Date() } = {}) {
  if (!timeZone) throw new Error('timeZone is required');
  const copy = createCopy(language);
  const today = () => currentDate(timeZone, now());
  const nowMinutes = () => currentMinutes(timeZone, now());

  function initialState() {
    return {
      step: 'day',
      week: 'current',
      date: null,
      period: null,
      startPeriod: null,
      start: null,
      end: null,
      roomId: null,
      topic: null,
      notice: null,
    };
  }

  function reduce(state, action) {
    if (!action || typeof action.type !== 'string') return stay(state);
    if (action.type === 'clear-room') return { state: { ...state, roomId: null }, intent: null };
    if (action.type === 'back') return reduceBack(state);
    switch (state.step) {
      case 'day':
        return reduceDay(state, action);
      case 'start-period':
        return reduceStartPeriod(state, action);
      case 'start-time':
        return reduceStartTime(state, action);
      case 'duration':
        return reduceDuration(state, action);
      case 'room':
        return reduceRoom(state, action);
      case 'topic':
        return reduceTopic(state, action);
      default:
        return stay(state);
    }
  }

  function reduceDay(state, action) {
    if (action.type === 'week' && (action.week === 'current' || action.week === 'next')) {
      return { state: { ...initialState(), week: action.week }, intent: null };
    }
    if (action.type === 'day') return chooseDay(state, action.date);
    return stay(state);
  }

  function reduceStartPeriod(state, action) {
    if (action.type !== 'period') return stay(state);
    const periods = periodsWithStarts(state.date, today(), nowMinutes());
    if (!periods.includes(action.period)) return stay(state);
    return {
      state: {
        ...state,
        step: 'start-time',
        period: action.period,
        startPeriod: action.period,
      },
      intent: null,
    };
  }

  function reduceStartTime(state, action) {
    if (action.type !== 'start') return stay(state);
    const slots = bookableStartSlots(state.period, state.date, today(), nowMinutes());
    if (!slots.includes(action.time)) return stay(state);
    return chooseStart(state, action.time);
  }

  function reduceDuration(state, action) {
    if (action.type !== 'duration') return stay(state);
    const match = availableDurations(state.start).find((item) => item.minutes === action.minutes);
    if (!match) return stay(state);
    const next = { ...state, end: match.end, topic: null, notice: null };
    if (state.roomId && ROOM_ID.test(state.roomId)) {
      return { state: { ...next, step: 'topic' }, intent: null };
    }
    return { state: { ...next, step: 'room' }, intent: null };
  }

  function reduceRoom(state, action) {
    if (action.type !== 'room' || !ROOM_ID.test(action.roomId || '')) return stay(state);
    return {
      state: { ...state, step: 'topic', roomId: action.roomId, topic: null, notice: null },
      intent: null,
    };
  }

  function reduceTopic(state, action) {
    if (action.type !== 'skip') return stay(state);
    return finishBooking(state, '');
  }

  function applyTopic(state, text) {
    if (state.step !== 'topic') return stay(state);
    const topic = cleanTopic(text);
    if (!topic) return stay(state);
    return finishBooking(state, topic);
  }

  function finishBooking(state, topic) {
    return {
      state: { ...state, topic },
      intent: {
        type: 'book',
        date: state.date,
        start: state.start,
        end: state.end,
        roomId: state.roomId,
        topic,
      },
    };
  }

  function reduceBack(state) {
    if (state.step === 'start-period') {
      return { state: { ...initialState(), week: state.week }, intent: null };
    }
    if (state.step === 'start-time') {
      const periods = periodsWithStarts(state.date, today(), nowMinutes());
      if (periods.length <= 1) return { state: { ...initialState(), week: state.week }, intent: null };
      return {
        state: { ...state, step: 'start-period', period: null, start: null, end: null, notice: null },
        intent: null,
      };
    }
    if (state.step === 'duration') {
      return {
        state: {
          ...state,
          step: 'start-time',
          period: state.startPeriod,
          start: null,
          end: null,
          notice: null,
        },
        intent: null,
      };
    }
    if (state.step === 'room') {
      return { state: { ...state, step: 'duration', topic: null, notice: null }, intent: null };
    }
    if (state.step === 'topic') {
      return { state: { ...state, step: 'room', topic: null, notice: null }, intent: null };
    }
    return stay(state);
  }

  function chooseDay(state, date) {
    if (!weekDates(today(), state.week).includes(date)) return stay(state);
    const periods = periodsWithStarts(date, today(), nowMinutes());
    if (periods.length === 0) {
      return { state: { ...state, notice: copy.noSlots }, intent: null };
    }
    const shared = {
      ...state,
      date,
      start: null,
      end: null,
      topic: null,
      notice: null,
    };
    if (periods.length === 1) {
      return {
        state: { ...shared, step: 'start-time', period: periods[0], startPeriod: periods[0] },
        intent: null,
      };
    }
    return {
      state: { ...shared, step: 'start-period', period: null, startPeriod: null },
      intent: null,
    };
  }

  function chooseStart(state, start) {
    if (availableDurations(start).length === 0) {
      return { state: { ...state, notice: copy.slotGone }, intent: null };
    }
    return {
      state: {
        ...state,
        step: 'duration',
        start,
        startPeriod: state.period,
        end: null,
        notice: null,
      },
      intent: null,
    };
  }

  function backToTime(state, notice) {
    const week = weekOf(state.date);
    if (!week) return { ...initialState(), notice };
    const next = chooseDay({ ...initialState(), week, roomId: state.roomId || null }, state.date);
    if (next.state.step === 'day') return { ...next.state, roomId: null };
    return { ...next.state, notice, roomId: state.roomId || null };
  }

  function weekOf(date) {
    if (weekDates(today(), 'current').includes(date)) return 'current';
    if (weekDates(today(), 'next').includes(date)) return 'next';
    return null;
  }

  function render(state, options = {}) {
    const rooms = Array.isArray(options.rooms) ? options.rooms : [];
    switch (state.step) {
      case 'start-period':
        return periodScreen(state, rooms);
      case 'start-time':
        return timeScreen(state, rooms);
      case 'duration':
        return durationScreen(state, rooms);
      case 'room':
        return roomScreen(state, rooms);
      case 'topic':
        return topicScreen(state, rooms);
      case 'day':
      default:
        return dayScreen(state);
    }
  }

  function dayScreen(state) {
    const dates = weekDates(today(), state.week);
    const rows = columns(dates.map((date) => ({
      label: date === today() ? `• ${shortDate(date)}` : shortDate(date),
      action: `day:${date}`,
    })), 3);
    rows.push([state.week === 'next'
      ? { label: copy.thisWeek, action: 'week:current' }
      : { label: copy.nextWeek, action: 'week:next' }]);
    const title = state.week === 'next' ? copy.weekNext : copy.weekCurrent;
    return {
      text: withNotice(state.notice, `${title}\n${copy.pickDay}`),
      buttons: rows,
    };
  }

  function periodScreen(state, rooms) {
    const ids = periodsWithStarts(state.date, today(), nowMinutes());
    const rows = [];
    for (const id of ids) {
      const slots = bookableStartSlots(id, state.date, today(), nowMinutes());
      if (slots.length === 0) continue;
      rows.push([{
        label: `${copy.periodName(id)} · ${slots[0]}–${slots[slots.length - 1]}`,
        action: `period:${id}`,
      }]);
    }
    pushTail(rows, state);
    return { text: withNotice(state.notice, timeHeading(state, rooms)), buttons: rows };
  }

  function timeScreen(state, rooms) {
    const slots = bookableStartSlots(state.period, state.date, today(), nowMinutes());
    if (slots.length === 0) {
      const rows = [];
      pushTail(rows, state);
      return {
        text: withNotice(state.notice, `${longDate(state.date)}\n${copy.slotGone}`),
        buttons: rows,
      };
    }
    const rows = columns(slots.map((slot) => ({
      label: slot,
      action: `start:${slot}`,
    })), 4);
    pushTail(rows, state);
    return { text: withNotice(state.notice, timeHeading(state, rooms)), buttons: rows };
  }

  function durationScreen(state, rooms) {
    const rows = columns(availableDurations(state.start).map((option) => ({
      label: copy.durationLabel(option.minutes),
      action: `dur:${option.minutes}`,
    })), 2);
    pushTail(rows, state);
    const room = heldRoom(state, rooms);
    const roomLine = room ? `\n${room.name}` : '';
    const text = `${longDate(state.date)}${roomLine}\n${copy.startLabel}: ${state.start}\n${copy.pickDuration}`;
    return { text: withNotice(state.notice, text), buttons: rows };
  }

  function timeHeading(state, rooms) {
    const room = heldRoom(state, rooms);
    const roomLine = room ? `\n${room.name}` : '';
    return `${longDate(state.date)}${roomLine}\n${copy.pickStart}`;
  }

  function heldRoom(state, rooms) {
    if (!state.roomId) return null;
    return rooms.find((room) => room.id === state.roomId) || null;
  }

  function pushTail(rows, state) {
    if (state.roomId) rows.push([{ label: copy.changeRoom, action: 'clear-room' }]);
    rows.push([backAction(state)]);
  }

  function roomScreen(state, rooms) {
    const rows = rooms
      .filter((room) => ROOM_ID.test(room.id))
      .map((room) => [{
        label: Array.from(room.name).slice(0, 60).join(''),
        action: `room:${room.id}`,
      }]);
    if (rows.length === 0) {
      return {
        text: copy.noRooms,
        buttons: [[backAction(state)]],
      };
    }
    rows.push([backAction(state)]);
    return {
      text: withNotice(state.notice, `${longDate(state.date)}\n${state.start}–${state.end}\n${copy.pickRoom}`),
      buttons: rows,
    };
  }

  function topicScreen(state, rooms) {
    const room = heldRoom(state, rooms);
    const roomLine = room ? `\n${room.name}` : '';
    return {
      text: withNotice(
        state.notice,
        `${longDate(state.date)}${roomLine}\n${state.start}–${state.end}\n\n${copy.askTopic}`,
      ),
      buttons: [
        [{ label: copy.skipTopic, action: 'skip' }],
        [{ label: copy.backRoom, action: 'back' }],
      ],
    };
  }

  function backAction(state) {
    const startPeriods = state.date ? periodsWithStarts(state.date, today(), nowMinutes()) : [];
    if (state.step === 'start-period' || (state.step === 'start-time' && startPeriods.length <= 1)) {
      return { label: copy.backDays, action: 'back' };
    }
    if (state.step === 'room') return { label: copy.backDuration, action: 'back' };
    return { label: copy.back, action: 'back' };
  }

  function longDate(iso) {
    return capitalize(formatLongDate(iso, copy.intlLocale), copy.intlLocale);
  }

  function shortDate(iso) {
    const [, month, day] = iso.split('-');
    return `${copy.weekday(weekdayIndex(iso))} ${day}.${month}`;
  }

  return {
    initialState,
    reduce,
    render,
    backToTime,
    applyTopic,
    today,
    nowMinutes,
    longDate,
    shortDate,
    copy,
  };
}

function stay(state) {
  return { state, intent: null };
}

function withNotice(notice, body) {
  return notice ? `${notice}\n\n${body}` : body;
}

function columns(items, size) {
  const rows = [];
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }
  return rows;
}

function capitalize(value, locale) {
  if (!value) return value;
  return value.charAt(0).toLocaleUpperCase(locale) + value.slice(1);
}

module.exports = { createFlow };
