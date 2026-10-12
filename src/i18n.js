function createCopy(language) {
  const ru = language !== 'en';
  const periodNames = ru
    ? { morning: 'Утро', afternoon: 'День', evening: 'Вечер' }
    : { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' };

  return {
    intlLocale: ru ? 'ru-RU' : 'en-GB',
    weekday(index) {
      const names = ru
        ? ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
        : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return names[index] || '';
    },
    periodName(id) {
      return periodNames[id] || id;
    },
    weekCurrent: ru ? 'Эта неделя' : 'This week',
    weekNext: ru ? 'Следующая неделя' : 'Next week',
    pickDay: ru ? 'Выберите день' : 'Choose a day',
    nextWeek: ru ? 'Следующая неделя →' : 'Next week →',
    thisWeek: ru ? '← Текущая неделя' : '← This week',
    pickStart: ru ? 'Выберите время начала' : 'Choose a start time',
    pickDuration: ru ? 'Выберите длительность' : 'Choose a duration',
    pickRoom: ru ? 'Выберите переговорную' : 'Choose a room',
    durationLabel(minutes) {
      const labels = ru
        ? { 30: '30 минут', 60: '1 час', 90: '1 ч 30 мин', 120: '2 часа' }
        : { 30: '30 minutes', 60: '1 hour', 90: '1.5 hours', 120: '2 hours' };
      return labels[minutes] || String(minutes);
    },
    backDuration: ru ? '← Длительность' : '← Duration',
    backRoom: ru ? '← Переговорная' : '← Room',
    askTopic: ru
      ? 'Напишите, о чём встреча или с кем она.\nМожно пропустить.'
      : 'Write what this meeting is about, or who it is with.\nYou can skip this.',
    skipTopic: ru ? 'Пропустить' : 'Skip',
    topicEmpty: ru
      ? 'Напишите пару слов или нажмите «Пропустить».'
      : 'Write a short note, or tap Skip.',
    startLabel: ru ? 'Начало' : 'Start',
    backDays: ru ? '← Дни' : '← Days',
    back: ru ? '← Назад' : '← Back',
    noSlots: ru
      ? 'На сегодня свободного времени уже нет. Выберите другой день.'
      : 'No times left today. Choose another day.',
    slotGone: ru
      ? 'Это время уже недоступно. Выберите другое.'
      : 'That time is no longer available. Choose another.',
    noRooms: ru
      ? 'В data/rooms.json нет переговорных.'
      : 'There are no rooms in data/rooms.json.',
    someone: ru ? 'участник' : 'someone',
    hours: ru
      ? 'Часы брони: 7:00–18:00. Длительность: 30 минут, 1 час, 1,5 часа или 2 часа.'
      : 'Booking hours: 7:00–18:00. Duration: 30 minutes, 1 hour, 1.5 hours, or 2 hours.',
    welcome(name) {
      const hello = ru
        ? `Здравствуйте${name ? `, ${name}` : ''}.`
        : `Hello${name ? ` ${name}` : ''}.`;
      const body = ru
        ? 'Я бронирую две переговорные.\n\n/book — забронировать\n/my — мои брони'
        : 'I book the two conference rooms.\n\n/book — book a room\n/my — my bookings';
      return `${hello}\n${body}\n\n${this.hours}`;
    },
    help: ru
      ? 'Команды:\n/book — забронировать переговорную\n/my — мои брони'
      : 'Commands:\n/book — book a room\n/my — my bookings',
    bookButton: ru ? 'Забронировать' : 'Book a room',
    changeRoom: ru ? 'Другая переговорная' : 'Different room',
    openBot: ru ? 'Открыть бота' : 'Open the bot',
    groupBookPrompt: ru
      ? 'Бронируйте переговорную в личном чате, чтобы кнопки не мешали общему чату.'
      : 'Book a room in a private chat so the buttons stay between you and the bot.',
    wrongGroup(title) {
      return ru
        ? `Этот бот работает только для группы «${title}».`
        : `This bot is only for the group "${title}".`;
    },
    linked: ru
      ? 'Я на связи. Бронировать переговорную можно в личном чате: /book'
      : 'I am here. Book a room in a private chat with /book.',
    setup(title) {
      return ru
        ? `Бот ещё не привязан к группе «${title}». Добавьте его в группу и отправьте там /start.`
        : `The bot is not linked to "${title}" yet. Add it to that group and send /start there.`;
    },
    denied(title) {
      return ru
        ? `Бронировать могут только участники группы «${title}».`
        : `Only members of "${title}" can book a room.`;
    },
    unknownUser: ru
      ? 'Этот аккаунт пока нельзя использовать для брони. Напишите администратору.'
      : 'This account cannot book yet. Please contact an admin.',
    chatIdPrivate: ru
      ? 'Отправьте /chatid в группе, чтобы узнать её id.'
      : 'Send /chatid in the group to see its id.',
    cmdBook: ru ? 'Бронь переговорной' : 'Book a room',
    cmdMy: ru ? 'Мои брони' : 'My bookings',
    myTitle: ru ? 'Мои брони' : 'My bookings',
    myEmpty: ru ? 'Предстоящих броней нет.' : 'You have no upcoming bookings.',
    cancel: ru ? 'Отменить' : 'Cancel',
    yes: ru ? 'Да, отменить' : 'Yes, cancel',
    no: ru ? 'Нет' : 'No',
    cancelled: ru ? 'Бронь отменена.' : 'Booking cancelled.',
    cancelledToast: ru ? 'Отменено' : 'Cancelled',
    cannotCancel: ru ? 'Эту бронь уже нельзя отменить.' : 'That booking can no longer be cancelled.',
    expired: ru ? 'Меню устарело. Отправьте /book ещё раз.' : 'This menu expired. Send /book again.',
    occupiedToast: ru ? 'Это время занято' : 'That time is taken',
    failed: ru ? 'Не получилось забронировать.' : 'Could not book that slot.',
    cancelAsk({ roomName, dateLabel, start, end, topic }) {
      const title = ru ? 'Отменить эту бронь?' : 'Cancel this booking?';
      const about = topic ? `\n${topic}` : '';
      return `${title}\n\n${roomName}\n${dateLabel}\n${start}–${end}${about}`;
    },
    success({ roomName, dateLabel, start, end, topic }) {
      const title = ru ? 'Готово.' : 'Booked.';
      const about = topic ? `\n${topic}` : '';
      const hint = ru ? 'Отменить бронь: /my' : 'Cancel it with /my';
      return `${title}\n\n${roomName}\n${dateLabel}\n${start}–${end}${about}\n\n${hint}`;
    },
    busy({ roomName, clashes, userId, someone }) {
      const list = clashes
        .map((clash) => {
          const who = clash.userName || someone;
          const about = clash.topic ? ` — ${clash.topic}` : '';
          return `${clash.start}–${clash.end} (${who}${about})`;
        })
        .join(', ');
      const own = clashes.length > 0 && clashes.every((clash) => Number(clash.userId) === Number(userId));
      if (ru && own) {
        return `У вас уже есть бронь в «${roomName}»: ${list}.\nОтмените её через /my или выберите другое время.`;
      }
      if (own) {
        return `You already have ${roomName} booked: ${list}.\nCancel it with /my or choose another time.`;
      }
      if (ru) return `«${roomName}» занята: ${list}.\nВыберите другое время.`;
      return `${roomName} is busy: ${list}.\nChoose another time.`;
    },
  };
}

module.exports = { createCopy };
