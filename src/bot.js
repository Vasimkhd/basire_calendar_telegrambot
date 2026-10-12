const crypto = require('crypto');
const { Markup } = require('telegraf');
const { formatUserName } = require('./models');
const { parseWizardCallback, parseMyCallback, callbackData } = require('./callbacks');

function createBot({ bot, config, flow, store, access, copy }) {
  const sessions = new Map();
  const seenGroups = new Set();

  bot.use(async (ctx, next) => {
    try {
      rememberGroup(ctx.chat);
      if (ctx.message?.migrate_to_chat_id && ctx.chat && access.isTargetGroup(ctx.chat)) {
        store.setGroup({ chatId: ctx.message.migrate_to_chat_id, title: ctx.chat.title });
        console.log(`Group migrated to ${ctx.message.migrate_to_chat_id}`);
      }
    } catch (error) {
      console.error(error);
    }
    return next();
  });

  bot.on('my_chat_member', async (ctx) => {
    const previous = ctx.myChatMember?.old_chat_member?.status;
    const nextStatus = ctx.myChatMember?.new_chat_member?.status;
    if (!ctx.chat) return;
    if (nextStatus === 'left' || nextStatus === 'kicked') {
      const linkedId = store.getGroup().chatId;
      if ((ctx.chat.type === 'group' || ctx.chat.type === 'supergroup')
        && linkedId != null
        && String(linkedId) === String(ctx.chat.id)) {
        store.clearGroup(ctx.chat.id);
        console.log(`Unlinked group ${ctx.chat.id}`);
      }
      return;
    }
    if (!access.isTargetGroup(ctx.chat)) return;
    const joined = (previous === 'left' || previous === 'kicked' || !previous)
      && (nextStatus === 'member' || nextStatus === 'administrator' || nextStatus === 'creator');
    if (!joined) return;
    try {
      await ctx.reply(copy.linked);
    } catch (error) {
      console.error(error?.response?.description || error.message);
    }
  });

  bot.start(async (ctx) => {
    if (inGroup(ctx)) return replyInGroup(ctx, ctx.startPayload === 'my' ? 'my' : 'book');
    if (!isPrivate(ctx)) return;
    const profile = await requireUser(ctx);
    if (!profile) return;
    if (ctx.startPayload === 'book') {
      await show(ctx, beginSession(ctx.from.id), 'reply');
      return;
    }
    if (ctx.startPayload === 'my') {
      await sendMy(ctx, profile, null, 'reply');
      return;
    }
    await ctx.reply(copy.welcome(ctx.from.first_name), Markup.inlineKeyboard([
      [Markup.button.callback(copy.bookButton, 'startbook')],
    ]));
  });

  bot.command('book', async (ctx) => {
    if (inGroup(ctx)) return replyInGroup(ctx, 'book');
    if (!isPrivate(ctx)) return;
    const profile = await requireUser(ctx);
    if (!profile) return;
    await show(ctx, beginSession(ctx.from.id), 'reply');
  });

  bot.command('my', async (ctx) => {
    if (inGroup(ctx)) return replyInGroup(ctx, 'my');
    if (!isPrivate(ctx)) return;
    const profile = await requireUser(ctx);
    if (!profile) return;
    await sendMy(ctx, profile, null, 'reply');
  });

  bot.command('calendar', async (ctx) => {
    if (inGroup(ctx)) {
      if (!access.isTargetGroup(ctx.chat)) {
        await ctx.reply(copy.wrongGroup(config.groupTitle));
        return;
      }
      await sendCalendar(ctx);
      return;
    }
    if (!isPrivate(ctx)) return;
    const profile = await requireUser(ctx);
    if (!profile) return;
    await sendCalendar(ctx);
  });

  bot.command('chatid', async (ctx) => {
    if (!inGroup(ctx)) {
      await ctx.reply(copy.chatIdPrivate);
      return;
    }
    await ctx.reply(`id: ${ctx.chat.id}\ntitle: ${ctx.chat.title || ''}`);
  });

  bot.action('startbook', async (ctx) => {
    if (!isPrivate(ctx)) return ack(ctx);
    const profile = await requireUser(ctx);
    if (!profile) return;
    await ack(ctx);
    await show(ctx, beginSession(ctx.from.id), 'edit');
  });

  bot.action(/^b:/, async (ctx) => {
    const parsed = parseWizardCallback(ctx.callbackQuery?.data);
    if (!parsed || !isPrivate(ctx)) return ack(ctx);
    const session = sessions.get(ctx.from?.id);
    if (!session || session.token !== parsed.token) {
      return ack(ctx, copy.expired, { show_alert: true });
    }
    if (session.busy) return ack(ctx);
    session.busy = true;
    try {
      await runWizard(ctx, session, parsed);
    } finally {
      session.busy = false;
    }
  });

  bot.action(/^m:/, async (ctx) => {
    const parsed = parseMyCallback(ctx.callbackQuery?.data);
    if (!parsed || !isPrivate(ctx)) return ack(ctx);
    const profile = await requireUser(ctx);
    if (!profile) return;
    await runMyAction(ctx, profile, parsed);
  });

  bot.on('text', async (ctx) => {
    if (!isPrivate(ctx) || ctx.message.text.startsWith('/')) return;
    const session = sessions.get(ctx.from.id);
    if (session?.state?.step === 'topic') {
      if (session.busy) return;
      session.busy = true;
      try {
        await submitTopic(ctx, session);
      } finally {
        session.busy = false;
      }
      return;
    }
    const profile = await requireUser(ctx);
    if (!profile) return;
    await ctx.reply(copy.help);
  });

  bot.catch(async (error, ctx) => {
    console.error('Bot error', error);
    if (ctx?.callbackQuery) await ack(ctx);
  });

  return bot;

  function beginSession(userId) {
    const session = {
      token: crypto.randomBytes(3).toString('hex'),
      state: flow.initialState(),
      busy: false,
    };
    sessions.set(userId, session);
    return session;
  }

  async function runWizard(ctx, session, parsed) {
    const profile = await requireUser(ctx);
    if (!profile) return;

    if (session.state.step === 'done') {
      await ack(ctx, copy.expired, { show_alert: true });
      return;
    }

    const action = toAction(parsed);
    if (!action) {
      await ack(ctx);
      return;
    }

    const result = flow.reduce(session.state, action);
    session.state = result.state;
    if (result.intent?.type === 'book') {
      await confirmBooking(ctx, session, profile, result.intent);
      return;
    }
    await ack(ctx);
    await show(ctx, session, 'edit');
  }

  async function confirmBooking(ctx, session, profile, intent) {
    const rooms = store.readRooms();
    const room = rooms.find((item) => item.id === intent.roomId);
    const clock = { today: flow.today(), nowMinutes: flow.nowMinutes() };
    if (!room) {
      session.state = flow.backToTime(session.state, copy.slotGone);
      await ack(ctx, copy.failed);
      await show(ctx, session, 'edit');
      return;
    }

    const result = store.tryBook({
      roomId: room.id,
      userId: profile.id,
      userName: formatUserName(profile) || copy.someone,
      date: intent.date,
      start: intent.start,
      end: intent.end,
      topic: intent.topic,
    }, clock);

    if (!result.ok && result.reason === 'conflict') {
      session.state = flow.backToTime({ ...session.state, roomId: room.id }, copy.busy({
        roomName: room.name,
        clashes: result.clashes,
        userId: profile.id,
        someone: copy.someone,
      }));
      await ack(ctx, copy.occupiedToast);
      await show(ctx, session, 'edit');
      return;
    }

    if (!result.ok) {
      session.state = flow.backToTime(session.state, copy.slotGone);
      await ack(ctx, copy.failed);
      await show(ctx, session, 'edit');
      return;
    }

    session.state = { step: 'done' };
    const text = copy.success({
      roomName: room.name,
      dateLabel: flow.longDate(intent.date),
      start: intent.start,
      end: intent.end,
      topic: intent.topic,
    });
    const extra = Markup.inlineKeyboard([]);
    if (ctx.callbackQuery) {
      await ack(ctx);
      await safeEdit(ctx, text, extra);
    } else {
      await editPrompt(ctx, session, text, extra);
    }
    console.log(`Booked ${room.id} ${intent.date} ${intent.start}-${intent.end} for ${profile.id}`);
  }

  async function submitTopic(ctx, session) {
    const profile = await requireUser(ctx);
    if (!profile) return;
    const result = flow.applyTopic(session.state, ctx.message.text);
    if (!result.intent) {
      await ctx.reply(copy.topicEmpty);
      return;
    }
    session.state = result.state;
    await confirmBooking(ctx, session, profile, result.intent);
  }

  async function runMyAction(ctx, profile, parsed) {
    if (parsed.type === 'no') {
      await ack(ctx);
      await sendMy(ctx, profile, null, 'edit');
      return;
    }

    const booking = store.getBooking(parsed.id);
    const clock = { today: flow.today(), nowMinutes: flow.nowMinutes() };
    const owns = booking && Number(booking.userId) === Number(profile.id) && booking.status === 'active';
    if (!owns) {
      await ack(ctx, copy.cannotCancel, { show_alert: true });
      await sendMy(ctx, profile, null, 'edit');
      return;
    }

    if (parsed.type === 'ask') {
      const rooms = store.readRooms();
      const room = rooms.find((item) => item.id === booking.roomId);
      await ack(ctx);
      await safeEdit(ctx, copy.cancelAsk({
        roomName: room ? room.name : booking.roomId,
        dateLabel: flow.longDate(booking.date),
        start: booking.start,
        end: booking.end,
        topic: booking.topic,
      }), Markup.inlineKeyboard([[
        Markup.button.callback(copy.yes, `m:yes:${booking.id}`),
        Markup.button.callback(copy.no, 'm:no'),
      ]]));
      return;
    }

    const result = store.cancelBooking(booking.id, profile.id, clock);
    await ack(ctx, result.ok ? copy.cancelledToast : copy.cannotCancel);
    await sendMy(ctx, profile, result.ok ? copy.cancelled : null, 'edit');
  }

  async function show(ctx, session, mode) {
    const view = flow.render(session.state, { rooms: store.readRooms() });
    const extra = Markup.inlineKeyboard(view.buttons.map((row) => row.map((button) => (
      Markup.button.callback(button.label, callbackData(session.token, button.action))
    ))));
    if (mode === 'edit' && ctx.callbackQuery?.message) {
      session.promptMessageId = ctx.callbackQuery.message.message_id;
      await safeEdit(ctx, view.text, extra);
      return;
    }
    if (mode === 'edit' && session.promptMessageId) {
      await editPrompt(ctx, session, view.text, extra);
      return;
    }
    const sent = await ctx.reply(view.text, extra);
    session.promptMessageId = sent?.message_id;
  }

  async function editPrompt(ctx, session, text, extra) {
    if (!session.promptMessageId) {
      await ctx.reply(text, extra);
      return;
    }
    try {
      await ctx.telegram.editMessageText(ctx.chat.id, session.promptMessageId, undefined, text, extra);
    } catch (error) {
      const message = error?.response?.description || error?.description || error?.message || '';
      if (message.includes('message is not modified')) return;
      await ctx.reply(text, extra);
    }
  }

  async function sendMy(ctx, profile, notice, mode) {
    const rooms = store.readRooms();
    const bookings = store.listUpcoming(profile.id, flow.today(), flow.nowMinutes());
    const lines = bookings.map((booking) => {
      const room = rooms.find((item) => item.id === booking.roomId);
      const name = room ? room.name : booking.roomId;
      const about = booking.topic ? `\n${booking.topic}` : '';
      return `${flow.shortDate(booking.date)}\n${booking.start}–${booking.end} · ${name}${about}`;
    });
    let text = bookings.length === 0 ? copy.myEmpty : `${copy.myTitle}\n\n${lines.join('\n\n')}`;
    if (notice) text = `${notice}\n\n${text}`;
    const rows = bookings.map((booking) => {
      const room = rooms.find((item) => item.id === booking.roomId);
      const name = room ? room.name : booking.roomId;
      return [Markup.button.callback(
        fitLabel(`${copy.cancel} · ${flow.shortDate(booking.date)} ${booking.start} · ${name}`),
        `m:ask:${booking.id}`,
      )];
    });
    const extra = Markup.inlineKeyboard(rows);
    if (mode === 'edit') await safeEdit(ctx, text, extra);
    else await ctx.reply(text, extra);
  }

  async function sendCalendar(ctx) {
    await ctx.reply(copy.calendar(config.webUrl), Markup.inlineKeyboard([
      [Markup.button.url(copy.calendarButton, config.webUrl)],
    ]));
  }

  async function replyInGroup(ctx, payload) {
    if (!access.isTargetGroup(ctx.chat)) {
      await ctx.reply(copy.wrongGroup(config.groupTitle));
      return;
    }
    const username = ctx.botInfo?.username;
    const extra = username
      ? Markup.inlineKeyboard([[
        Markup.button.url(copy.openBot, `https://t.me/${username}?start=${payload}`),
      ]])
      : undefined;
    if (extra) await ctx.reply(copy.groupBookPrompt, extra);
    else await ctx.reply(copy.groupBookPrompt);
  }

  async function requireUser(ctx) {
    if (!ctx.from) {
      if (ctx.callbackQuery) await ack(ctx);
      return null;
    }
    const auth = await access.authorize(ctx.telegram, ctx.from);
    if (!auth.ok) {
      const text = access.messageFor(auth.reason);
      if (ctx.callbackQuery) await ack(ctx, text, { show_alert: true });
      else await ctx.reply(text);
      return null;
    }
    return store.upsertUser(auth.profile);
  }

  function rememberGroup(chat) {
    if (!chat || (chat.type !== 'group' && chat.type !== 'supergroup')) return;
    const key = String(chat.id);
    if (!access.isTargetGroup(chat)) {
      if (!seenGroups.has(key)) {
        seenGroups.add(key);
        console.log(`Ignored group "${oneLine(chat.title)}" (${chat.id}). Expected "${config.groupTitle}".`);
      }
      return;
    }
    store.setGroup({ chatId: chat.id, title: chat.title });
    if (!seenGroups.has(`ok:${key}`)) {
      seenGroups.add(`ok:${key}`);
      console.log(`Linked group "${oneLine(chat.title)}" (${chat.id})`);
    }
  }
}

function toAction(parsed) {
  switch (parsed.kind) {
    case 'week':
      return { type: 'week', week: parsed.value };
    case 'day':
      return { type: 'day', date: parsed.value };
    case 'period':
      return { type: 'period', period: parsed.value };
    case 'start':
      return { type: 'start', time: parsed.value };
    case 'end':
      return { type: 'end', time: parsed.value };
    case 'dur':
      return { type: 'duration', minutes: Number(parsed.value) };
    case 'room':
      return { type: 'room', roomId: parsed.value };
    case 'skip':
      return { type: 'skip' };
    case 'back':
      return { type: 'back' };
    case 'clear-room':
      return { type: 'clear-room' };
    default:
      return null;
  }
}

function inGroup(ctx) {
  return ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';
}

function isPrivate(ctx) {
  return ctx.chat?.type === 'private';
}

function fitLabel(label) {
  const chars = Array.from(label);
  if (chars.length <= 64) return label;
  return `${chars.slice(0, 63).join('')}…`;
}

function oneLine(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

async function ack(ctx, text, extra) {
  try {
    if (text) await ctx.answerCbQuery(text, extra);
    else await ctx.answerCbQuery();
  } catch {
    // The button can expire if it was pressed late.
  }
}

async function safeEdit(ctx, text, extra) {
  try {
    await ctx.editMessageText(text, extra);
  } catch (error) {
    const message = error?.response?.description || error?.description || error?.message || '';
    if (message.includes('message is not modified')) return;
    await ctx.reply(text, extra);
  }
}

module.exports = { createBot };
