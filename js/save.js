import { CONFIG } from './config.js';

const KEY = 'parcel-dash-save-v1';

function defaults() {
  const up = {};
  for (const u of CONFIG.upgrades) up[u.id] = 0;
  return {
    coins: 0,
    best: 0,
    upgrades: up,
    skins: ['classic'],
    skin: 'classic',
    tutorialSeen: false,
    music: true,
    sound: true,
    shifts: 0,
  };
}

export const Save = {
  data: defaults(),

  load() {
    const d = defaults();
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && typeof s === 'object') {
          if (Number.isFinite(s.coins)) d.coins = Math.max(0, Math.floor(s.coins));
          if (Number.isFinite(s.best)) d.best = Math.max(0, Math.floor(s.best));
          if (Number.isFinite(s.shifts)) d.shifts = Math.max(0, Math.floor(s.shifts));
          if (s.upgrades && typeof s.upgrades === 'object') {
            for (const u of CONFIG.upgrades) {
              const v = s.upgrades[u.id];
              if (Number.isFinite(v)) d.upgrades[u.id] = Math.max(0, Math.min(u.prices.length, Math.floor(v)));
            }
          }
          if (Array.isArray(s.skins)) {
            const valid = CONFIG.skins.map((k) => k.id);
            d.skins = s.skins.filter((id) => valid.includes(id));
            if (!d.skins.includes('classic')) d.skins.unshift('classic');
          }
          if (typeof s.skin === 'string' && d.skins.includes(s.skin)) d.skin = s.skin;
          d.tutorialSeen = !!s.tutorialSeen;
          if (typeof s.music === 'boolean') d.music = s.music;
          if (typeof s.sound === 'boolean') d.sound = s.sound;
        }
      }
    } catch (e) {
      // Storage can be unavailable (private mode, blocked cookies); play on with defaults.
    }
    this.data = d;
    return d;
  },

  write() {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch (e) {
      // Ignore quota or privacy errors; progress simply won't persist.
    }
  },
};
