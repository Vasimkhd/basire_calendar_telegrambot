const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const language = process.env.LANGUAGE === 'en' ? 'en' : 'ru';

module.exports = {
  token: (process.env.BOT_TOKEN || '').trim(),
  groupTitle: (process.env.GROUP_TITLE || 'Basire общий чат').trim(),
  groupChatId: (process.env.GROUP_CHAT_ID || '').trim(),
  timezone: (process.env.TIMEZONE || 'Asia/Tashkent').trim(),
  language,
  webPort: Number(process.env.WEB_PORT) || 3000,
  dataDir: path.join(__dirname, '..', 'data'),
};
