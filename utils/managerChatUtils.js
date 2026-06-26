const transferWords = [
  'transfer', 'transferencia', 'traspaso', 'traspasos', 'oferta', 'ofertas',
  'comprar', 'vender', 'ceder', 'prestamo', 'prestamo', 'swap', 'intercambio',
  'negociar', 'negociacion', 'negociacion', 'clausula', 'clausula',
];

export function normalizeChatText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function getMentionHandle(teamName) {
  return normalizeChatText(teamName)
    .replace(/[^a-z0-9\s_-]/g, '')
    .trim()
    .split(/\s+/)[0] || '';
}

export function getTeamMentionOptions(allTeams, userId) {
  const used = new Map();
  return Object.entries(allTeams || {})
    .map(([id, team]) => {
      const baseHandle = getMentionHandle(team?.teamName);
      if (!baseHandle) return null;
      const count = used.get(baseHandle) || 0;
      used.set(baseHandle, count + 1);
      const handle = count === 0 ? baseHandle : `${baseHandle}${count + 1}`;
      return { id, teamName: team?.teamName, logoUrl: team?.logoUrl, handle };
    })
    .filter(team => team && team.id !== userId && team.teamName)
    .sort((a, b) => a.teamName.localeCompare(b.teamName));
}

export function getMentionedTeamIds(text, allTeams, currentUserId = null) {
  const normalized = normalizeChatText(text);
  const mentions = normalized.match(/@[a-z0-9_-]+/g) || [];
  return getTeamMentionOptions(allTeams, currentUserId)
    .filter(team => {
      const teamName = normalizeChatText(team.teamName);
      return mentions.includes(`@${team.handle}`) || normalized.includes(`@${teamName}`);
    })
    .map(team => team.id);
}

export function hasTransferIntent(text) {
  const normalized = normalizeChatText(text);
  return transferWords.some(word => normalized.includes(word));
}
