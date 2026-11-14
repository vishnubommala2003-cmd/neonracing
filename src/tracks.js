import * as THREE from 'three';

export const ROAD_HALF_WIDTH = 13.5;
export const RUNOFF_OUTER = 17.0;
const LUT_SAMPLES = 1200;

export const TRACKS = {
  city: {
    id: 'city',
    name: 'Neon City',
    subtitle: 'MIDNIGHT / STREET CIRCUIT',
    mood: 'MIDNIGHT',
    index: '01',
    difficulty: 'PRO',
    elevationLabel: 'FLAT SPEEDWAY',
    sky: 0x091018,
    ground: 0x0e151a,
    road: 0x1a212b,
    curbColor1: 0xe02434,
    curbColor2: 0xf5f7f5,
    centerlineType: 'dashed-white',
    accent: 0x38f5c2,
    secondaryAccent: 0xff4b7d,
    ambient: 0xa8c8dc,
    sun: 0x7cfce0,
    fogNear: 240,
    fogFar: 780,
    targetLap: 14.5,
    points: [
      [0, 0, -110],
      [95, 0, -108],
      [150, 0, -62],
      [136, 0, 12],
      [68, 0, 36],
      [42, 0, 88],
      [96, 0, 134],
      [18, 0, 154],
      [-76, 0, 124],
      [-126, 0, 58],
      [-88, 0, -8],
      [-130, 0, -68],
      [-78, 0, -108],
    ],
    banks: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    boostCount: 0,
    orbCount: 0,
  },
  desert: {
    id: 'desert',
    name: 'Redline Canyon',
    subtitle: 'GOLDEN HOUR / CANYON SPEEDWAY',
    mood: 'GOLDEN HOUR',
    index: '02',
    difficulty: 'PRO',
    elevationLabel: 'FLAT CANYON',
    sky: 0x42222a,
    ground: 0x7c462e,
    road: 0x382c26,
    curbColor1: 0xe02434,
    curbColor2: 0xffbb22,
    centerlineType: 'double-yellow',
    accent: 0xffb454,
    secondaryAccent: 0xff5a36,
    ambient: 0xffd9b5,
    sun: 0xffad6b,
    fogNear: 250,
    fogFar: 820,
    targetLap: 15.8,
    points: [
      [0, 0, -120],
      [110, 0, -116],
      [172, 0, -56],
      [152, 0, 24],
      [82, 0, 62],
      [112, 0, 128],
      [42, 0, 166],
      [-55, 0, 146],
      [-125, 0, 96],
      [-164, 0, 14],
      [-122, 0, -58],
      [-82, 0, -108],
    ],
    banks: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    boostCount: 0,
    orbCount: 0,
  },
  coastal: {
    id: 'coastal',
    name: 'Coastal Run',
    subtitle: 'BLUE HOUR / OCEAN BOULEVARD',
    mood: 'BLUE HOUR',
    index: '03',
    difficulty: 'ROOKIE',
    elevationLabel: 'FLAT OCEAN DRIVE',
    sky: 0x163445,
    ground: 0x1b433c,
    road: 0x24303c,
    curbColor1: 0x0088ff,
    curbColor2: 0xf5f7f5,
    centerlineType: 'dashed-white',
    accent: 0x68d5ff,
    secondaryAccent: 0x38f5c2,
    ambient: 0xc4e5f5,
    sun: 0xb5f2ef,
    fogNear: 260,
    fogFar: 850,
    targetLap: 13.8,
    points: [
      [0, 0, -106],
      [98, 0, -102],
      [156, 0, -45],
      [148, 0, 42],
      [88, 0, 108],
      [-6, 0, 122],
      [-92, 0, 104],
      [-148, 0, 42],
      [-136, 0, -42],
      [-76, 0, -98],
    ],
    banks: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    boostCount: 0,
    orbCount: 0,
  },
  orbital: {
    id: 'orbital',
    name: 'Hyperion Orbital',
    subtitle: 'DEEP SPACE / CIRCUIT RING',
    mood: 'HYPERION',
    index: '04',
    difficulty: 'APEX',
    elevationLabel: 'FLAT RING',
    sky: 0x05060f,
    ground: 0x090c1a,
    road: 0x161a32,
    curbColor1: 0x9a58ff,
    curbColor2: 0x38f5c2,
    centerlineType: 'neon-purple',
    accent: 0xb16eff,
    secondaryAccent: 0x38f5c2,
    ambient: 0xb0b8ff,
    sun: 0xd89aff,
    fogNear: 260,
    fogFar: 880,
    targetLap: 16.5,
    points: [
      [0, 0, -130],
      [118, 0, -124],
      [182, 0, -64],
      [165, 0, 22],
      [84, 0, 56],
      [126, 0, 130],
      [44, 0, 172],
      [-58, 0, 152],
      [-146, 0, 92],
      [-172, 0, -10],
      [-118, 0, -84],
      [-66, 0, -122],
    ],
    banks: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    boostCount: 0,
    orbCount: 0,
  },
  london: {
    id: 'london',
    name: 'London Streets',
    subtitle: 'DAYLIGHT GRAND PRIX / BIG BEN & THAMES',
    mood: 'SUNNY DAY',
    index: '05',
    difficulty: 'APEX',
    elevationLabel: 'CITY CIRCUIT',
    sky: 0x3aa8ec,
    ground: 0x323a40,
    road: 0x2c333a,
    curbColor1: 0xe02434,
    curbColor2: 0xf5f7f5,
    centerlineType: 'dashed-white',
    accent: 0x00f0ff,
    secondaryAccent: 0x22ff66,
    ambient: 0xe0f2fe,
    sun: 0xfff7e8,
    fogNear: 320,
    fogFar: 950,
    targetLap: 15.2,
    points: [
      [0, 0, -125],
      [110, 0, -120],
      [168, 0, -60],
      [150, 0, 30],
      [75, 0, 70],
      [105, 0, 138],
      [30, 0, 172],
      [-70, 0, 145],
      [-135, 0, 80],
      [-160, 0, -15],
      [-110, 0, -75],
      [-65, 0, -118],
    ],
    banks: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    boostCount: 0,
    orbCount: 0,
  },
  tokyo: {
    id: 'tokyo',
    name: 'Tokyo Shuto',
    subtitle: 'NIGHT EXPRESSWAY / HIGH SPEED HIGHWAY',
    mood: 'NEON NIGHT',
    index: '06',
    difficulty: 'MASTER',
    elevationLabel: 'EXPRESSWAY',
    sky: 0x0c152a,
    ground: 0x121927,
    road: 0x192130,
    curbColor1: 0xff2a85,
    curbColor2: 0x00f0ff,
    centerlineType: 'dashed-orange',
    accent: 0xff2a85,
    secondaryAccent: 0x00f0ff,
    ambient: 0xa8b8e0,
    sun: 0x4be6ff,
    fogNear: 280,
    fogFar: 850,
    targetLap: 14.8,
    points: [
      [0, 0, -115],
      [102, 0, -110],
      [160, 0, -50],
      [142, 0, 35],
      [80, 0, 95],
      [10, 0, 145],
      [-85, 0, 130],
      [-145, 0, 65],
      [-155, 0, -25],
      [-95, 0, -85],
    ],
    banks: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    boostCount: 0,
    orbCount: 0,
  },
  alpine: {
    id: 'alpine',
    name: 'Alpine Ridge',
    subtitle: 'SNOW PEAKS / MOUNTAIN PASS',
    mood: 'MORNING MIST',
    index: '07',
    difficulty: 'ELITE',
    elevationLabel: 'MOUNTAIN PASS',
    sky: 0x4a6d8c,
    ground: 0x222a30,
    road: 0x2e353d,
    curbColor1: 0x222428,
    curbColor2: 0xffcc00,
    centerlineType: 'double-yellow',
    accent: 0xffd038,
    secondaryAccent: 0x7ce0ff,
    ambient: 0xcde4f5,
    sun: 0xfff4db,
    fogNear: 280,
    fogFar: 900,
    targetLap: 15.6,
    points: [
      [0, 0, -135],
      [90, 0, -125],
      [140, 0, -75],
      [95, 0, -15],
      [165, 0, 45],
      [120, 0, 115],
      [35, 0, 160],
      [-45, 0, 140],
      [-115, 0, 165],
      [-160, 0, 95],
      [-110, 0, 30],
      [-155, 0, -40],
      [-125, 0, -100],
      [-60, 0, -130],
    ],
    banks: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    boostCount: 0,
    orbCount: 0,
  },
  cyber: {
    id: 'cyber',
    name: 'Neo Megacity',
    subtitle: 'SYNTHWAVE / CYBER HIGHWAY',
    mood: 'SYNTHWAVE',
    index: '08',
    difficulty: 'MASTER',
    elevationLabel: 'CYBER HIGHWAY',
    sky: 0x090616,
    ground: 0x0d091a,
    road: 0x141624,
    curbColor1: 0xd400ff,
    curbColor2: 0x00f0ff,
    centerlineType: 'neon-cyan',
    accent: 0x00f0ff,
    secondaryAccent: 0xff0077,
    ambient: 0x8a70d6,
    sun: 0xff3b9b,
    fogNear: 270,
    fogFar: 880,
    targetLap: 15.0,
    points: [
      [0, 0, -120],
      [105, 0, -115],
      [165, 0, -55],
      [130, 0, 15],
      [168, 0, 85],
      [85, 0, 135],
      [15, 0, 165],
      [-75, 0, 135],
      [-130, 0, 155],
      [-165, 0, 75],
      [-120, 0, 0],
      [-155, 0, -65],
      [-85, 0, -110],
    ],
    banks: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    boostCount: 0,
    orbCount: 0,
  },
};

export const LEVELS = [
  {
    level: 1,
    id: 'level-1',
    trackId: 'city',
    name: 'Neon Speedway',
    roadName: 'Midnight Neon City Circuit',
    subtitle: 'LEVEL 1 • ROOKIE CHALLENGE',
    laps: 2,
    targetPosition: 3,
    reward: 1500,
    aiSpeedScale: 0.88,
    description: 'Learn the racing line on the smooth asphalt of Neon City at midnight.',
    badge: 'ROOKIE',
    curbTheme: 'Classic FIA Red & White Curbs',
    roadTheme: 'Midnight Navy Asphalt • Dashed White Lines',
  },
  {
    level: 2,
    id: 'level-2',
    trackId: 'london',
    name: 'London Grand Prix',
    roadName: 'London Thames Riverfront Road',
    subtitle: 'LEVEL 2 • EUROPEAN SPRINT',
    laps: 2,
    targetPosition: 3,
    reward: 2000,
    aiSpeedScale: 0.93,
    description: 'Race past Big Ben on wide, smooth European street asphalt with grand prix curbs.',
    badge: 'AMATEUR',
    curbTheme: 'FIA Red & White Grand Prix Curbs',
    roadTheme: 'British Slate Asphalt • Thames Riverside',
  },
  {
    level: 3,
    id: 'level-3',
    trackId: 'desert',
    name: 'Canyon Redline',
    roadName: 'Red Rock Canyon Speedway',
    subtitle: 'LEVEL 3 • DESERT HEAT',
    laps: 2,
    targetPosition: 3,
    reward: 2500,
    aiSpeedScale: 0.97,
    description: 'Drift high-speed curves carved through giant desert red rock mesas at golden hour.',
    badge: 'PRO',
    curbTheme: 'Red & Sun-Gold Desert Curbs',
    roadTheme: 'Warm Sun-Baked Asphalt • Double Yellow Lines',
  },
  {
    level: 4,
    id: 'level-4',
    trackId: 'tokyo',
    name: 'Tokyo Shuto Battle',
    roadName: 'Tokyo Elevated Night Expressway',
    subtitle: 'LEVEL 4 • MIDNIGHT EXPRESSWAY',
    laps: 3,
    targetPosition: 3,
    reward: 3200,
    aiSpeedScale: 1.02,
    description: 'Full-throttle high-speed battle on the elevated Tokyo Shuto expressway.',
    badge: 'EXPERT',
    curbTheme: 'Neon Pink & Cyan Expressway Curbs',
    roadTheme: 'Night Expressway Tarmac • Orange Dashes',
  },
  {
    level: 5,
    id: 'level-5',
    trackId: 'coastal',
    name: 'Ocean Sunset Drive',
    roadName: 'Pacific Ocean Coastal Boulevard',
    subtitle: 'LEVEL 5 • BLUE HOUR CRUISE',
    laps: 3,
    targetPosition: 3,
    reward: 3800,
    aiSpeedScale: 1.05,
    description: 'Sweeping coastal turns along the ocean cliffs under twilight skies.',
    badge: 'CLUB',
    curbTheme: 'Ocean Blue & White Seaside Curbs',
    roadTheme: 'Coastal Breeze Charcoal Tarmac • White Dashes',
  },
  {
    level: 6,
    id: 'level-6',
    trackId: 'alpine',
    name: 'Alpine Mountain Pass',
    roadName: 'Snow Peak Switchback Highway',
    subtitle: 'LEVEL 6 • MOUNTAIN DRIFT',
    laps: 3,
    targetPosition: 3,
    reward: 4500,
    aiSpeedScale: 1.08,
    description: 'Tight technical turns and steep chicanes through misty alpine mountain peaks.',
    badge: 'ELITE',
    curbTheme: 'Black & Caution Yellow Mountain Curbs',
    roadTheme: 'Granite Mountain Road • Double Yellow Centerlines',
  },
  {
    level: 7,
    id: 'level-7',
    trackId: 'cyber',
    name: 'Cyberpunk Neo Highway',
    roadName: 'Neo Megacity Grid Expressway',
    subtitle: 'LEVEL 7 • SYNTHWAVE RUSH',
    laps: 3,
    targetPosition: 3,
    reward: 5500,
    aiSpeedScale: 1.12,
    description: 'Blazing speed through a towering cyberpunk metropolis with glowing neon grids.',
    badge: 'MASTER',
    curbTheme: 'Electric Magenta & Cyan Cyber Curbs',
    roadTheme: 'Synthwave Dark Road • Glowing Cyan Grid Lines',
  },
  {
    level: 8,
    id: 'level-8',
    trackId: 'orbital',
    name: 'Hyperion World Championship',
    roadName: 'Orbital Stratosphere Speedway',
    subtitle: 'LEVEL 8 • THE GRAND FINALE',
    laps: 3,
    targetPosition: 1,
    reward: 10000,
    aiSpeedScale: 1.18,
    description: 'The ultimate world championship race beneath the stars. Win 1st place to become legend!',
    badge: 'CHAMPION',
    curbTheme: 'Deep Space Purple & Emerald Curbs',
    roadTheme: 'Luminescent Cosmic Championship Speedway',
  },
];

export class TrackSpline {
  constructor(trackConfig) {
    this.config = trackConfig;
    const vectors = trackConfig.points.map(([x, y, z]) => new THREE.Vector3(x, y, z));
    this.curve = new THREE.CatmullRomCurve3(vectors, true, 'catmullrom', 0.5);
    this.totalLength = this.curve.getLength();
    this.samples = [];
    this.minimapPoints = [];
    this._buildLUT(trackConfig.banks || []);
  }

  _buildLUT(banks) {
    const rawPositions = [];
    const arcLengths = [0];
    let total = 0;

    for (let i = 0; i <= LUT_SAMPLES; i++) {
      const u = i / LUT_SAMPLES;
      const p = this.curve.getPointAt(u);
      rawPositions.push(p);
      if (i > 0) {
        total += p.distanceTo(rawPositions[i - 1]);
        arcLengths.push(total);
      }
    }
    this.totalLength = total;

    const worldUp = new THREE.Vector3(0, 1, 0);
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    for (let i = 0; i <= LUT_SAMPLES; i++) {
      const u = i / LUT_SAMPLES;
      const pos = rawPositions[i];
      const next = rawPositions[(i + 1) % LUT_SAMPLES];
      const prev = rawPositions[(i - 1 + LUT_SAMPLES) % LUT_SAMPLES];
      const tangent = next.clone().sub(prev).normalize();
      // Horizontal right-hand normal on XZ plane
      const flatTangent = new THREE.Vector3(tangent.x, 0, tangent.z).normalize();
      const flatNormal = new THREE.Vector3(flatTangent.z, 0, -flatTangent.x).normalize();

      // Smooth bank interpolation from control banks
      const bankIdx = u * banks.length;
      const b0 = banks[Math.floor(bankIdx) % banks.length] || 0;
      const b1 = banks[(Math.floor(bankIdx) + 1) % banks.length] || 0;
      const bf = bankIdx - Math.floor(bankIdx);
      const bank = THREE.MathUtils.lerp(b0, b1, bf);

      const normal = flatNormal.clone().applyAxisAngle(tangent, bank).normalize();
      const up = new THREE.Vector3().crossVectors(normal, tangent).normalize();
      if (up.y < 0) up.negate();

      // Curvature estimate for AI braking and drift cues
      const tPrev = rawPositions[i].clone().sub(prev).normalize();
      const tNext = next.clone().sub(rawPositions[i]).normalize();
      const curvature = tPrev.distanceTo(tNext) * LUT_SAMPLES * 0.08;

      this.samples.push({
        u,
        s: arcLengths[i],
        pos,
        tangent,
        normal,
        up,
        bank,
        curvature,
      });

      if (pos.x < minX) minX = pos.x;
      if (pos.x > maxX) maxX = pos.x;
      if (pos.z < minZ) minZ = pos.z;
      if (pos.z > maxZ) maxZ = pos.z;
    }

    // Build normalized 2D minimap points (around 90 points)
    const span = Math.max(maxX - minX, maxZ - minZ) || 1;
    const cx = (minX + maxX) * 0.5;
    const cz = (minZ + maxZ) * 0.5;
    for (let i = 0; i < LUT_SAMPLES; i += 12) {
      const p = this.samples[i].pos;
      this.minimapPoints.push({
        x: (p.x - cx) / span,
        y: (p.z - cz) / span,
      });
    }
    this.minimapBounds = { cx, cz, span };
  }

  sampleAtProgress(progress) {
    const wrapped = ((progress % this.totalLength) + this.totalLength) % this.totalLength;
    const exactIdx = (wrapped / this.totalLength) * LUT_SAMPLES;
    const i0 = Math.floor(exactIdx) % LUT_SAMPLES;
    const i1 = (i0 + 1) % LUT_SAMPLES;
    const alpha = exactIdx - Math.floor(exactIdx);

    const a = this.samples[i0];
    const b = this.samples[i1];

    const center = a.pos.clone().lerp(b.pos, alpha);
    const tangent = a.tangent.clone().lerp(b.tangent, alpha).normalize();
    const normal = a.normal.clone().lerp(b.normal, alpha).normalize();
    const up = a.up.clone().lerp(b.up, alpha).normalize();
    const bank = THREE.MathUtils.lerp(a.bank, b.bank, alpha);
    const curvature = THREE.MathUtils.lerp(a.curvature, b.curvature, alpha);

    return {
      t: (wrapped / this.totalLength) * Math.PI * 2,
      center,
      tangent,
      normal,
      up,
      bank,
      curvature,
    };
  }

  toMinimapCoord(worldPos) {
    const { cx, cz, span } = this.minimapBounds;
    return {
      x: (worldPos.x - cx) / span,
      y: (worldPos.z - cz) / span,
    };
  }
}

export function generateTrackFeatures(trackSpline, config) {
  // Plain clean road: no obstacles, boost pads, or orbs in the middle of the road
  return { boostPads: [], nitroOrbs: [], cones: [] };
}

