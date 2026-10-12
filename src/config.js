const path = require('path');
const { scheduleUrl } = require('./web');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const language = process.env.LANGUAGE === 'en' ? 'en' : 'ru';
const webPort = Number(process.env.WEB_PORT) || 3000;

module.exports = {
  token: (process.env.BOT_TOKEN || '').trim(),
  groupTitle: (process.env.GROUP_TITLE || 'Basire общий чат').trim(),
  groupChatId: (process.env.GROUP_CHAT_ID || '').trim(),
  timezone: (process.env.TIMEZONE || 'Asia/Tashkent').trim(),
  language,
  webPort,
  webUrl: scheduleUrl({ host: process.env.WEB_HOST, port: webPort }),
  dataDir: path.join(__dirname, '..', 'data'),
};
