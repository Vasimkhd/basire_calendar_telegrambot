function parseWizardCallback(data) {
  if (typeof data !== 'string' || !data.startsWith('b:')) return null;
  const parts = data.split(':');
  if (parts.length < 3 || !parts[1] || !parts[2]) return null;
  return {
    token: parts[1],
    kind: parts[2],
    value: parts.slice(3).join(':'),
  };
}

function parseMyCallback(data) {
  if (typeof data !== 'string' || !data.startsWith('m:')) return null;
  const parts = data.split(':');
  if (parts[1] === 'no') return { type: 'no' };
  if ((parts[1] === 'ask' || parts[1] === 'yes') && parts[2]) {
    return { type: parts[1], id: parts.slice(2).join(':') };
  }
  return null;
}

function callbackData(token, action) {
  const data = `b:${token}:${action}`;
  if (Buffer.byteLength(data) > 64) throw new Error(`Callback too long: ${data}`);
  return data;
}

module.exports = {
  parseWizardCallback,
  parseMyCallback,
  callbackData,
};
