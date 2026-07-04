import { NODE_HP } from './constants.js';

const KEY = 'save';

export function buildSave(diffKey, player, world, bossDead, cleared) {
  const nodesHp = {};
  for (const n of world.nodes)
    if (n.hp !== NODE_HP) nodesHp[`${n.x},${n.y}`] = n.hp;
  return {
    v: 1,
    difficulty: diffKey,
    banked: player.banked,
    upgrades: { ...player.upgrades },
    nodesHp,
    bossDead: !!bossDead,
    cleared: !!cleared,
  };
}

export function isValidSave(s) {
  return !!s && s.v === 1 && typeof s.difficulty === 'string' &&
    typeof s.banked === 'number' &&
    typeof s.upgrades === 'object' && s.upgrades !== null &&
    typeof s.nodesHp === 'object' && s.nodesHp !== null;
}

export function applySave(save, world, player) {
  player.banked = save.banked;
  for (const k of Object.keys(player.upgrades))
    player.upgrades[k] = !!save.upgrades[k];
  if (player.upgrades.tank) player.o2 = player.o2Max();
  for (const n of world.nodes) {
    const hp = save.nodesHp[`${n.x},${n.y}`];
    if (hp !== undefined) n.hp = hp;
  }
  return { bossDead: !!save.bossDead, cleared: !!save.cleared };
}

export function storeSave(obj) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(obj));
}

export function loadSave() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    return isValidSave(s) ? s : null;
  } catch { return null; }
}

export function clearSave() {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(KEY);
}
