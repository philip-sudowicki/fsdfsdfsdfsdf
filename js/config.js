// Every gameplay tuning number lives here.

export const CONFIG = {
  tile: 128,
  maxDpr: 2,

  camera: {
    viewArea: 620000,        // world units squared visible on a typical phone
    bigScreenBoost: 1.35,    // max extra view area on large screens
    minVisibleShort: 500,    // never show less than this along the short edge
    lead: 0.3,               // seconds of velocity look-ahead
    follow: 7,               // follow smoothing rate
    speedZoomOut: 0.08,      // zoom out by this fraction at top speed
    attractSpeed: 60,        // title screen pan speed
  },

  van: {
    length: 54,
    width: 28,
    maxSpeed: 320,
    accel: 420,
    brake: 1100,
    reverseSpeed: 130,
    reverseAccel: 420,
    turnRate: 3.0,
    turnFullSpeed: 150,
    steerResponse: 12,
    grip: 9,
    driftGrip: 1.9,
    driftSteer: 0.55,
    driftMinSpeed: 0.5,
    driftYaw: 1.25,
    joystickGain: 2.4,
    joystickDeadzone: 0.2,
    joystickRadius: 60,
    restitution: 0.3,
    crashSpeedLoss: 0.35,
    crashMin: 110,
    hardCrash: 240,
    surface: { road: 1, alley: 0.96, path: 0.88, grass: 0.72 },
  },

  ui: { clearTop: 46 },      // UI units kept clear at the top centre for Poki's button

  ramp: { minSpeed: 150, airMin: 0.45, airMax: 0.95, heightMin: 14, heightMax: 34 },

  shift: {
    startTime: 60,
    maxTime: 99,
    timeBase: 3,             // seconds added per delivery at the start of a shift...
    timeBaseEnd: 1.5,        // ...shrinking to this as difficulty ramps up
    timePerUnit: 0.0048,     // plus seconds per world unit of delivery distance
    perfectTime: 2,
    lowTime: 10,
  },

  throwMeter: {
    radius: 300,
    sweepSlow: 0.85,         // bar widths per second when crawling
    sweepFast: 1.7,          // bar widths per second at top speed
    green: 0.075,            // half width of the green zone
    amber: 0.24,             // half width of green + amber
    cooldown: 0.12,
    tutorialSlow: 0.55,
    flightMin: 0.38,
    flightMax: 0.62,
  },

  tips: {
    perfect: 30,
    good: 14,
    speedBonus: 1.0,         // up to +100% at top speed
    comboStep: 0.25,
    express: 40,
    fragileIntact: 20,
    fragilePenalty: 0.25,
    nearMiss: 5,
    nearMissDist: 30,
    nearMissSpeed: 190,
    nearMissCooldown: 3,
    driftMin: 1.0,
    driftPerSec: 6,
    airMin: 0.5,
    airPerSec: 14,
    bin: 3,
    cone: 2,
  },

  specials: {
    startAfter: 2,
    chance: 0.35,
    expressBase: 9,
    expressPerUnit: 1 / 150,
    fragileImpact: 140,
    maxDamage: 4,
  },

  difficulty: {
    rampDeliveries: 14,
    minDistStart: 450,
    minDistEnd: 1400,
    bandStart: 800,
    bandEnd: 1200,
  },

  traffic: {
    countStart: 7,
    countEnd: 18,
    titleCount: 12,
    speedMin: 115,
    speedMax: 165,
    spawnMin: 900,
    spawnMax: 1700,
    despawn: 2300,
    stopTime: 0.9,
    lookAhead: 90,
  },

  depot: { loadInterval: 0.12 },

  props: { respawn: 20, knockSlow: 0.06 },

  birds: { scareDist: 150, scareSpeed: 60, returnDelay: 3.5 },

  fx: {
    slowmoScale: 0.3,
    slowmoTime: 0.45,
    hitstop: 0.07,
    shakeMax: 14,
    maxParticles: 450,
    skidLife: 6,
    maxSkids: 900,
  },

  ads: { rewardSeconds: 20 },

  upgrades: [
    { id: 'speed', name: 'Top Speed', prices: [100, 220, 420, 700, 1100], per: 0.06 },
    { id: 'handling', name: 'Handling', prices: [100, 220, 420, 700, 1100], per: 0.08 },
    { id: 'capacity', name: 'Cargo Space', prices: [150, 300, 550, 850, 1300], per: 1 },
    { id: 'green', name: 'Perfect Zone', prices: [120, 260, 480, 780, 1200], per: 0.16 },
    { id: 'time', name: 'Shift Time', prices: [120, 260, 480, 780, 1200], per: 4 },
  ],

  baseCapacity: 3,

  skins: [
    { id: 'classic', name: 'Postie', price: 0 },
    { id: 'mint', name: 'Minty', price: 300 },
    { id: 'sunny', name: 'Sunny', price: 600 },
    { id: 'grape', name: 'Grape', price: 1000 },
    { id: 'night', name: 'Night Owl', price: 1600 },
    { id: 'gold', name: 'Gold Rush', price: 2500 },
  ],
};
