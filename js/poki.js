// Thin wrapper around the Poki SDK. Falls back to a local stub so the game
// runs anywhere, and tracks gameplay state so start/stop are never doubled.

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const stub = {
  init: () => Promise.resolve(),
  gameLoadingFinished() {},
  gameplayStart() {},
  gameplayStop() {},
  commercialBreak: () => Promise.resolve(),
  // Locally there is no ad network, so simulate a short rewarded ad that pays out.
  rewardedBreak: (onStart) => {
    if (onStart) onStart();
    return wait(700).then(() => true);
  },
};

let sdk = stub;
let playing = false;
let adActive = false;

function call(name, ...args) {
  try {
    if (typeof sdk[name] === 'function') return sdk[name](...args);
  } catch (e) {
    // The SDK must never break the game.
  }
  return undefined;
}

export const Poki = {
  get adActive() {
    return adActive;
  },

  async init() {
    sdk = window.PokiSDK || stub;
    try {
      await sdk.init();
    } catch (e) {
      // Ad blockers reject init; the game keeps going either way.
    }
  },

  loadingFinished() {
    call('gameLoadingFinished');
  },

  gameplayStart() {
    if (playing || adActive) return;
    playing = true;
    call('gameplayStart');
  },

  gameplayStop() {
    if (!playing) return;
    playing = false;
    call('gameplayStop');
  },

  // Resolves when the break is over (or immediately when no ad is shown).
  commercialBreak(onStart) {
    this.gameplayStop();
    adActive = true;
    let p;
    try {
      p = Promise.resolve(sdk.commercialBreak(() => onStart && onStart()));
    } catch (e) {
      p = Promise.resolve();
    }
    return p.catch(() => {}).then(() => {
      adActive = false;
    });
  },

  // Resolves to true only when the player watched the full ad.
  rewardedBreak(onStart) {
    this.gameplayStop();
    adActive = true;
    let p;
    try {
      p = Promise.resolve(sdk.rewardedBreak(() => onStart && onStart()));
    } catch (e) {
      p = Promise.resolve(false);
    }
    return p
      .catch(() => false)
      .then((ok) => {
        adActive = false;
        return ok === true;
      });
  },
};
