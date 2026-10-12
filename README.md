# Basire conference room bot

Telegram bot for booking two conference rooms. Rooms, users, and bookings are JSON files in `data/`. There is no database.

## Setup

1. Create a bot with [@BotFather](https://t.me/BotFather) and copy the token.
2. Copy `.env.example` to `.env` and set `BOT_TOKEN`.
3. Install and start:

```bash
npm install
npm start
```

4. Add the bot to the Telegram group **Basire общий чат**.
5. If the bot is already running when you add it, it links the group by title. If it was offline, send `/start` in the group once.
6. People book in a **private chat** with the bot (`/book`). The group only gets a button that opens that chat, so two people are not pressing the same buttons.

`TIMEZONE` defaults to `Asia/Tashkent` (UTC+5). `LANGUAGE` is `ru` or `en`.

While the bot is running, a read-only week calendar is at [http://127.0.0.1:3000](http://127.0.0.1:3000). Days run across the top and hours down the side, Monday to Sunday, 07:00–18:00. Each room has its own color. The page only reads the JSON files. Change `WEB_PORT` if 3000 is taken. The page stays on this computer.

If the group title does not match, send `/chatid` in the group and set `GROUP_CHAT_ID` in `.env`.

## Booking

`/book` walks through:

1. Remaining days of this week (Monday–Sunday), including today. **Следующая неделя** replaces them with next week only.
2. Morning, afternoon, or evening — not the whole day of buttons at once.
3. A start time from 07:00 to 18:00, then a duration: 30 minutes, 1 hour, 1 hour 30 minutes, or 2 hours. A length that would run past 18:00 is hidden. A booking that ends at 11:00 leaves 11:00 free for the next one.
4. One of the rooms in `data/rooms.json`.
5. An optional note: what the meeting is about, or who it is with. Skip leaves the note empty.

If that room overlaps another active booking, the bot names the other meeting and returns to the time step for the same day. The same room stays selected, and **Другая переговорная** switches rooms.

`/my` lists upcoming bookings and can cancel one. Cancelling frees the room.

Past times on the current day are hidden.

## JSON models

`data/rooms.json` — edit the names here. Ids stay short (`room-1`, `room-2`) because they are sent in button data.

```json
{
  "rooms": [
    { "id": "room-1", "name": "Конференц-зал 1" },
    { "id": "room-2", "name": "Конференц-зал 2" }
  ]
}
```

`data/users.json` — a person is allowed when Telegram says they are still in the group (`creator`, `administrator`, `member`, or `restricted`). The bot then saves their profile. Extra fields you add on a user are kept when the profile is refreshed.

```json
{
  "id": 123456789,
  "username": "ivan",
  "firstName": "Иван",
  "lastName": "Иванов",
  "languageCode": "ru",
  "groupStatus": "member",
  "createdAt": "2026-10-12T06:00:00.000Z",
  "updatedAt": "2026-10-12T06:00:00.000Z"
}
```

The stricter employee rule is not defined yet. It belongs in `matchesOfficeUser` in `src/access.js`. Until that returns `false` for someone, every current group member can book.

`data/bookings.json`:

```json
{
  "id": "uuid",
  "roomId": "room-1",
  "userId": 123456789,
  "userName": "Иван Иванов",
  "date": "2026-10-12",
  "start": "09:00",
  "end": "10:30",
  "topic": "С Анной, бюджет",
  "status": "active",
  "createdAt": "2026-10-12T06:00:00.000Z"
}
```

Cancelled bookings stay in the file with `"status": "cancelled"` and do not block the room.

`data/group.json` stores the linked group id after the bot sees **Basire общий чат**.

## Tests

```bash
npm test
```
