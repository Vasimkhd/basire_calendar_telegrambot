const { Telegraf } = require("telegraf");
const config = require("./config");
const { createCopy } = require("./i18n");
const { createStore } = require("./store");
const { createAccess } = require("./access");
const { createFlow } = require("./flow");
const { createBot } = require("./bot");
const { startWeb } = require("./web");

const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor < 18) {
  console.error("Node.js 18 or newer is required.");
  process.exit(1);
}

if (!config.token) {
  console.error(
    "Missing BOT_TOKEN. Copy .env.example to .env and paste the token from @BotFather.",
  );
  process.exit(1);
}

const copy = createCopy(config.language);
const store = createStore(config.dataDir);
const access = createAccess({ store, config, copy });
const flow = createFlow({
  timeZone: config.timezone,
  language: config.language,
});
const bot = createBot({
  bot: new Telegraf(config.token),
  config,
  flow,
  store,
  access,
  copy,
});

async function main() {
  const rooms = store.readRooms();
  console.log(`Rooms: ${rooms.map((room) => room.name).join(", ")}`);
  const linked = config.groupChatId || store.getGroup().chatId;
  if (linked) console.log(`Group chat id: ${linked}`);
  else
    console.log(
      `Waiting for group "${config.groupTitle}". Add the bot and send /start there.`,
    );

  try {
    await bot.telegram.setMyCommands([
      { command: "book", description: copy.cmdBook },
      { command: "my", description: copy.cmdMy },
    ]);
  } catch (error) {
    console.error(
      "Could not register commands:",
      error?.response?.description || error.message,
    );
  }

  const me = await bot.telegram.getMe();
  console.log(
    `Basire calendar bot @${me.username} is running (${config.timezone}, ${config.language}).`,
  );
  try {
    const web = await startWeb({
      store,
      port: config.webPort,
      language: config.language,
      timeZone: config.timezone,
    });
    console.log(`Schedule page: http://0.0.0.0:${config.webPort}`);
    const closeWeb = () => web.close();
    process.once("SIGINT", closeWeb);
    process.once("SIGTERM", closeWeb);
  } catch (error) {
    console.error(`Could not open the schedule page: ${error.message}`);
  }
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
  // launch() stays open for as long as the bot is polling.
  await bot.launch({
    allowedUpdates: ["message", "callback_query", "my_chat_member"],
  });
}

main().catch((error) => {
  console.error(
    "Failed to start the bot:",
    error?.response?.description || error.message || error,
  );
  process.exit(1);
});
