export const VIEW_H = 270, TILE = 16, DT = 1 / 60;
// View width adapts to the device aspect (16:9 desktop → ~21:9 phones).
// Height stays fixed; wider screens simply see more of the world.
export let VIEW_W = 480;
export function fitViewWidth(aspect) {
  VIEW_W = Math.max(480, Math.min(640, Math.round(VIEW_H * aspect / 2) * 2));
  return VIEW_W;
}

export const PLAYER = {
  W: 20, H: 10,
  ACCEL: 600, MAX_SPD: 110, DRAG: 2.2,
  BOOST_SPD: 260, BOOST_TIME: 0.18, BOOST_CD: 0.9, BOOST_O2: 1.5,
  O2_MAX: 90, O2_DRAIN: 1, O2_VENT_REFILL: 30, O2_EMPTY_HP_PERIOD: 1,
  HP_MAX: 3, INVULN: 1.5, SLOW_TIME: 0.8,
  KNOCKBACK_VX: 140, KNOCKBACK_VY: -40, RESPAWN_INVULN: 2,
  FIRE_CD: 0.35, HARPOON_SPD: 320, HARPOON_DMG: 1,
};

export const UPGRADES = {
  tank:   { cost: 8,  label: 'O2 TANK +50' },
  damage: { cost: 12, label: 'HARPOON +50' },
  lamp:   { cost: 10, label: 'LAMP +40' },
  fins:   { cost: 14, label: 'FINS SPEED' },
  suit:   { cost: 16, label: 'DIVE SUIT' },
  hull:   { cost: 24, label: 'PRESSURE HULL' },
};

export const DIFFICULTY = {
  easy:   { hp: 5, nodes: 16, vents: 8 },
  normal: { hp: 3, nodes: 12, vents: 5 },
  hard:   { hp: 2, nodes: 9,  vents: 3 },
};

export const MINERALS = {
  crystal: { value: 1, color: '#5ae0e6' },
  pearl:   { value: 3, color: '#f0dce6' },
  abyss:   { value: 5, color: '#ff8a5a' },
  magma:   { value: 8, color: '#ffb040' },
};

export const ENEMY = {
  JELLY: { HP: 2, SPD: 14, DMG: 1 },
  MORAY: { HP: 3, TRIGGER: 60, LUNGE_SPD: 220, LUNGE_TIME: 0.35, RECOVER: 1.2, DMG: 1 },
  FISH:  { HP: 1, WANDER_SPD: 30, CHASE_SPD: 95, CALM_TIME: 3, DMG: 1, PER_SCHOOL: 4 },
};

export const BOSS = {
  HP: 30, W: 110, H: 70, CONTACT_DMG: 1,
  IDLE_TIME: 1.4, TELEGRAPH: 0.7, CHARGE_SPD: 240, STUN: 1.0,
  SUMMON_COUNT: 2, PHASE2_AT: 0.5,
};

export const LIGHT = { MAX: 12, LAMP_REACH: 150, LAMP_SPREAD: 0.5 };
export const NODE_HP = 2, CRYSTALS_PER_NODE = 3;

export const HYDRO_ROW = 68; // tile row where the hydrothermal biome starts

export const STEAM = {
  IDLE: 2.5, TELEGRAPH: 0.8, ERUPT: 1.2,
  COLUMN_H: 48, COLUMN_W: 24,
};

export const CRAWLER = {
  HP: 20, W: 70, H: 40, PATROL_SPD: 40,
  LUNGE_SPD: 200, TELEGRAPH: 0.5, LUNGE_TIME: 0.8,
  STEAM_CD_MIN: 4, STEAM_CD_MAX: 6,
  CONTACT_DMG: 1, AGGRO_RANGE: 200, DROP: 12, GRAVITY: 300,
};
