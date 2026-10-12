const MEMBER_STATUSES = new Set(['creator', 'administrator', 'member', 'restricted']);

function normalizeTitle(title) {
  return String(title || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function isGroupMemberStatus(status) {
  return MEMBER_STATUSES.has(status);
}

// Who counts as "our user" beyond the Telegram group.
// Right now anyone still in the group is allowed, and their profile is stored in data/users.json.
// When the employee rule is defined, return false here for people who should not book.
function matchesOfficeUser(_profile) {
  return true;
}

function createAccess({ store, config, copy }) {
  function resolveChatId() {
    if (config.groupChatId) return String(config.groupChatId);
    const saved = store.getGroup();
    if (saved.chatId == null || saved.chatId === '') return '';
    return String(saved.chatId);
  }

  function isTargetGroup(chat) {
    if (!chat || (chat.type !== 'group' && chat.type !== 'supergroup')) return false;
    if (config.groupChatId && String(chat.id) === String(config.groupChatId)) return true;
    return normalizeTitle(chat.title) === normalizeTitle(config.groupTitle);
  }

  function messageFor(reason) {
    if (reason === 'setup') return copy.setup(config.groupTitle);
    if (reason === 'unknown-user') return copy.unknownUser;
    return copy.denied(config.groupTitle);
  }

  async function authorize(telegram, from, overrideChatId, depth = 0) {
    if (!from?.id) return { ok: false, reason: 'denied' };
    const chatId = overrideChatId || resolveChatId();
    if (!chatId) return { ok: false, reason: 'setup' };

    try {
      const member = await telegram.getChatMember(chatId, from.id);
      if (!isGroupMemberStatus(member.status)) return { ok: false, reason: 'denied' };
      const profile = {
        id: from.id,
        username: from.username,
        firstName: from.first_name || '',
        lastName: from.last_name || '',
        languageCode: from.language_code || null,
        groupStatus: member.status,
      };
      if (!matchesOfficeUser(profile)) return { ok: false, reason: 'unknown-user' };
      return { ok: true, profile };
    } catch (error) {
      const description = errorText(error);
      const migrated = migrateTarget(error);
      if (migrated && depth < 1 && String(migrated) !== String(chatId)) {
        store.setGroup({
          chatId: migrated,
          title: store.getGroup().title || config.groupTitle,
        });
        console.log(`Telegram migrated the group to ${migrated}. Update GROUP_CHAT_ID if it is set in .env.`);
        return authorize(telegram, from, String(migrated), depth + 1);
      }
      if (/bot is not a member|bot was kicked|chat not found|PEER_ID_INVALID/i.test(description)) {
        console.error(`Group check failed: ${description}`);
        return { ok: false, reason: 'setup' };
      }
      return { ok: false, reason: 'denied' };
    }
  }

  return { authorize, isTargetGroup, resolveChatId, messageFor };
}

function errorText(error) {
  return error?.response?.description || error?.description || error?.message || '';
}

function migrateTarget(error) {
  return error?.parameters?.migrate_to_chat_id
    || error?.response?.parameters?.migrate_to_chat_id
    || null;
}

module.exports = {
  createAccess,
  isGroupMemberStatus,
  normalizeTitle,
  matchesOfficeUser,
};
