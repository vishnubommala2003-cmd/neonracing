import * as THREE from 'three';
import { TRACKS, TrackSpline, generateTrackFeatures, ROAD_HALF_WIDTH } from './tracks.js';
import { ParticleSystem } from './particles.js';

export const CAR_DATA = [
  {
    id: 'triumph',
    name: 'Apex GT',
    tagline: 'Hybrid twin-turbo race hypercar. Teardrop canopy, active aero, 330+ km/h.',
    category: 'EXOTIC SPORT',
    color: 0xf2540f, // Papaya race orange
    underglow: 0xff6a1a,
    speed: 94,
    handling: 96,
    acceleration: 93,
    nitroPower: 90,
    shape: 0,
    price: 0,
  },
  {
    id: 'pulse',
    name: 'Pulse R',
    tagline: 'Featherweight apex hunter. Unmatched drift control.',
    color: 0x38f5c2,
    underglow: 0x38f5c2,
    speed: 80,
    handling: 96,
    acceleration: 85,
    nitroPower: 82,
    shape: 1,
    price: 2500,
  },
  {
    id: 'nightfall',
    name: 'Nightfall',
    tagline: 'Brutal twin-turbo muscle. Built for straight-line velocity.',
    color: 0x8265ff,
    underglow: 0xb16eff,
    speed: 98,
    handling: 70,
    acceleration: 78,
    nitroPower: 86,
    shape: 2,
    price: 5000,
  },
  {
    id: 'solstice',
    name: 'Solstice E-GT',
    tagline: 'Instant dual-motor torque. Electric acceleration.',
    color: 0xffb834,
    underglow: 0xffa020,
    speed: 84,
    handling: 85,
    acceleration: 97,
    nitroPower: 90,
    shape: 3,
    price: 8500,
  },
  {
    id: 'raptor',
    name: 'Raptor X Prototype',
    tagline: 'Hypercar aerodynamics. Uncompromising race craft.',
    color: 0x4be66a,
    underglow: 0x38f5c2,
    speed: 94,
    handling: 91,
    acceleration: 92,
    nitroPower: 95,
    shape: 4,
    price: 15000,
  },
];

const AI_RACERS = [
  { name: 'TITAN', color: 0xffa014, baseSpeed: 0.95, personality: 'blocker', lanePref: -3.2 },
  { name: 'VIPER', color: 0x1cdb54, baseSpeed: 0.96, personality: 'aggressive', lanePref: 3.2 },
  { name: 'SHADOW', color: 0xa855f7, baseSpeed: 0.97, personality: 'apex', lanePref: 0.0 },
  { name: 'PHANTOM', color: 0x06b6d4, baseSpeed: 0.93, personality: 'smooth', lanePref: -2.8 },
  { name: 'GHOST', color: 0xf43f5e, baseSpeed: 0.98, personality: 'apex', lanePref: 2.4 },
  { name: 'BLAZE', color: 0xf97316, baseSpeed: 0.94, personality: 'aggressive', lanePref: -4.0 },
  { name: 'STORM', color: 0x38bdf8, baseSpeed: 0.95, personality: 'smooth', lanePref: 3.8 },
];

const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;

function createOpponentNameTag(name, colorHex) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 72;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'rgba(8, 14, 24, 0.90)';
  ctx.beginPath();
  ctx.roundRect(8, 8, 240, 56, 14);
  ctx.fill();

  const colorStr = `#${colorHex.toString(16).padStart(6, '0')}`;
  ctx.strokeStyle = colorStr;
  ctx.lineWidth = 4;
  ctx.stroke();

  // Corner neon accent dot
  ctx.fillStyle = colorStr;
  ctx.beginPath();
  ctx.arc(32, 36, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, 140, 36);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: texture, depthTest: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(4.2, 1.2, 1);
  sprite.position.set(0, 2.35, 0);
  return sprite;
}

function createCarShell(stations, material, bottomY) {
  const positions = [];
  const indices = [];
  const ringSize = 8;
  for (const station of stations) {
    const { z, width, topWidth, sideY, topY } = station;
    for (const [x, y] of [
      [0, topY],
      [topWidth, topY - 0.035],
      [width, sideY],
      [width * 0.92, bottomY],
      [0, bottomY],
      [-width * 0.92, bottomY],
      [-width, sideY],
      [-topWidth, topY - 0.035],
    ]) positions.push(x, y, z);
  }
  for (let section = 0; section < stations.length - 1; section++) {
    const current = section * ringSize;
    const next = (section + 1) * ringSize;
    for (let edge = 0; edge < ringSize; edge++) {
      const a = current + edge;
      const b = current + (edge + 1) % ringSize;
      const c = next + edge;
      const d = next + (edge + 1) % ringSize;
      indices.push(a, c, b, b, c, d);
    }
  }
  const frontCenter = positions.length / 3;
  positions.push(0, (stations[0].topY + bottomY) / 2, stations[0].z);
  const rearCenter = positions.length / 3;
  positions.push(0, (stations.at(-1).topY + bottomY) / 2, stations.at(-1).z);
  for (let edge = 0; edge < ringSize; edge++) {
    indices.push(frontCenter, edge, (edge + 1) % ringSize);
    const rear = (stations.length - 1) * ringSize;
    indices.push(rearCenter, rear + (edge + 1) % ringSize, rear + edge);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, material);
}

function disposeObject(object) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  object.traverse((part) => {
    if (part.geometry) geometries.add(part.geometry);
    if (Array.isArray(part.material)) {
      part.material.forEach((mat) => {
        materials.add(mat);
        if (mat.map) textures.add(mat.map);
        if (mat.emissiveMap) textures.add(mat.emissiveMap);
      });
    } else if (part.material) {
      materials.add(part.material);
      if (part.material.map) textures.add(part.material.map);
      if (part.material.emissiveMap) textures.add(part.material.emissiveMap);
    }
  });
  textures.forEach((t) => t.dispose());
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
}

export class RacingGame {
  constructor(container, callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;
    this.trackKey = 'city';
    this.quality = 'high';
    this.running = false;
    this.raceStarted = false;
    this.finished = false;
    this.elapsed = 0;
    this.countdown = 0;
    this.lapsToWin = 3;
    this.keys = new Set();
    this.touch = new Set();
    this.analogSteer = 0;
    this.vehicles = [];
    this.cameraMode = 0; // 0: Chase, 1: Cockpit/Hood, 2: Close Bumper
    this.cameraShake = 0;

    // Drift Scoring
    this.driftScore = 0;
    this.driftCombo = 1;
    this.isDrifting = false;
    this.driftDuration = 0;

    // Dash Slow-Motion Takedown & Elevated Camera
    this.dashSlowMoActive = false;
    this.dashSlowMoTimer = 0;
    this.dashSlowMoDuration = 1.35;
    this.dashTargetCar = null;
    this.dashImpactDir = 1;
    this.dashCooldown = 0;
    this.timeScale = 1.0;

    // Side barrier collision & 3-blink recovery state
    this.wallRecovery = false;
    this.wallBlinkTimer = 0;
    this.wallBlinkTotal = 1.08;

    this.garagePreview = null;
    this.garagePreviewLights = [];
    this.victoryBayActive = false;
    this.victoryBayGroup = null;
    this.victoryBayLights = [];
    this.victoryCar = null;
    this.clock = new THREE.Clock();

    this._resize = this.resize.bind(this);
    this._frame = this.frame.bind(this);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    container.appendChild(this.renderer.domElement);

    // Scene
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(54, window.innerWidth / window.innerHeight, 0.1, 950);
    this.camera.position.set(0, 9, 20);

    // Lights
    this.ambient = new THREE.HemisphereLight(0xb9d7e6, 0x181c20, 2.4);
    this.scene.add(this.ambient);
    this.keyLight = new THREE.DirectionalLight(0xffebd2, 3.2);
    this.keyLight.position.set(-60, 95, 45);
    this.scene.add(this.keyLight);
    this.fillLight = new THREE.PointLight(0x38f5c2, 28, 180);
    this.fillLight.position.set(70, 24, -30);
    this.scene.add(this.fillLight);

    // Track hierarchy
    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.trackObjects = new THREE.Group();
    this.world.add(this.trackObjects);

    // Particle System
    this.particles = new ParticleSystem(this.scene);
    this.asphaltTexture = this.createAsphaltTexture();
    this.paused = false;
    this.menuOrbitAngle = 0;

    // Build initial track
    this.applyTrack('city');

    window.addEventListener('resize', this._resize, { passive: true });
    window.addEventListener('orientationchange', this._resize, { passive: true });
    document.addEventListener('fullscreenchange', this._resize, { passive: true });
    document.addEventListener('webkitfullscreenchange', this._resize, { passive: true });
    this.clock.start();
    this.renderer.setAnimationLoop(this._frame);
  }

  applyTrack(trackKey) {
    this.trackKey = TRACKS[trackKey] ? trackKey : 'city';
    const config = TRACKS[this.trackKey];

    // Spline & Features
    this.trackSpline = new TrackSpline(config);
    this.trackLength = this.trackSpline.totalLength;
    this.features = generateTrackFeatures(this.trackSpline, config);

    // Scene ambiance
    this.scene.background = new THREE.Color(config.sky);
    this.scene.fog = new THREE.Fog(config.sky, config.fogNear || 120, config.fogFar || 420);
    this.ambient.color.setHex(config.ambient);
    this.keyLight.color.setHex(config.sun);
    this.fillLight.color.setHex(config.accent);

    // Clear old track geometry
    while (this.trackObjects.children.length > 0) {
      const child = this.trackObjects.children[0];
      this.trackObjects.remove(child);
      disposeObject(child);
    }

    this._buildTrackGeometry(config);
    this._buildDecorations(config);
    this._buildInteractiveTrackItems(config);
  }

  _buildTrackGeometry(config) {
    const SEGMENTS = 520;
    const roadVertices = [];
    const roadIndices = [];
    const roadUvs = [];
    const runoffVertices = [];
    const runoffIndices = [];
    const laneVertices = [];
    const laneIndices = [];

    for (let i = 0; i <= SEGMENTS; i++) {
      const progress = (i / SEGMENTS) * this.trackLength;
      const { center, normal } = this.trackSpline.sampleAtProgress(progress);

      const left = center.clone().addScaledVector(normal, ROAD_HALF_WIDTH);
      const right = center.clone().addScaledVector(normal, -ROAD_HALF_WIDTH);
      const leftOuter = center.clone().addScaledVector(normal, ROAD_HALF_WIDTH + 3.0);
      const rightOuter = center.clone().addScaledVector(normal, -(ROAD_HALF_WIDTH + 3.0));

      // Plain flat road tarmac
      roadVertices.push(left.x, 0.04, left.z, right.x, 0.04, right.z);
      roadUvs.push(0, (i / SEGMENTS) * 56, 1, (i / SEGMENTS) * 56);

      // Runoff shoulder verge (left & right)
      runoffVertices.push(
        left.x, 0.02, left.z,
        leftOuter.x, 0.02, leftOuter.z,
        right.x, 0.02, right.z,
        rightOuter.x, 0.02, rightOuter.z,
      );

      // High-visibility Solid White Outer Edge Stripes
      const laneL = center.clone().addScaledVector(normal, ROAD_HALF_WIDTH - 0.85);
      const laneR = center.clone().addScaledVector(normal, -(ROAD_HALF_WIDTH - 0.85));
      laneVertices.push(
        laneL.x - normal.x * 0.22, 0.055, laneL.z - normal.z * 0.22,
        laneL.x + normal.x * 0.22, 0.055, laneL.z + normal.z * 0.22,
        laneR.x - normal.x * 0.22, 0.055, laneR.z - normal.z * 0.22,
        laneR.x + normal.x * 0.22, 0.055, laneR.z + normal.z * 0.22,
      );

      if (i < SEGMENTS) {
        const idx = i * 2;
        roadIndices.push(idx, idx + 2, idx + 1, idx + 1, idx + 2, idx + 3);
        const rIdx = i * 4;
        runoffIndices.push(
          rIdx, rIdx + 4, rIdx + 1, rIdx + 1, rIdx + 4, rIdx + 5,
          rIdx + 2, rIdx + 3, rIdx + 6, rIdx + 3, rIdx + 7, rIdx + 6,
        );
        laneIndices.push(
          rIdx, rIdx + 4, rIdx + 1, rIdx + 1, rIdx + 4, rIdx + 5,
          rIdx + 2, rIdx + 6, rIdx + 3, rIdx + 3, rIdx + 6, rIdx + 7,
        );
      }
    }

    // Crisp Asphalt Road Surface - uniquely styled per track & level
    const roadMat = new THREE.MeshStandardMaterial({
      color: config.road || 0x22272e,
      map: this.asphaltTexture,
      roughness: 0.65,
      metalness: 0.18,
      side: THREE.DoubleSide,
    });
    this.trackObjects.add(this.createCustomMesh(roadVertices, roadIndices, roadUvs, roadMat));

    // Road Center Markings (flat decal stripes painted flush on road at y = 0.052)
    const centerType = config.centerlineType || 'dashed-white';
    const centerVerts = [];
    const centerIndices = [];
    let cVertIdx = 0;

    if (centerType === 'double-yellow') {
      // Iconic American Canyon & Mountain double solid yellow centerlines
      for (let i = 0; i <= SEGMENTS; i++) {
        const progress = (i / SEGMENTS) * this.trackLength;
        const { center, normal } = this.trackSpline.sampleAtProgress(progress);
        const yl1 = center.clone().addScaledVector(normal, 0.35);
        const yl2 = center.clone().addScaledVector(normal, -0.35);
        centerVerts.push(
          yl1.x - normal.x * 0.09, 0.052, yl1.z - normal.z * 0.09,
          yl1.x + normal.x * 0.09, 0.052, yl1.z + normal.z * 0.09,
          yl2.x - normal.x * 0.09, 0.052, yl2.z - normal.z * 0.09,
          yl2.x + normal.x * 0.09, 0.052, yl2.z + normal.z * 0.09,
        );
        if (i < SEGMENTS) {
          const idx = i * 4;
          centerIndices.push(idx, idx + 1, idx + 4, idx + 1, idx + 5, idx + 4);
          centerIndices.push(idx + 2, idx + 3, idx + 6, idx + 3, idx + 7, idx + 6);
        }
      }
      const yellowMat = new THREE.MeshBasicMaterial({ color: 0xffbb22, toneMapped: false });
      this.trackObjects.add(this.createCustomMesh(centerVerts, centerIndices, null, yellowMat));
    } else {
      // Dashed centerline (e.g. dashed-white, dashed-orange, neon-cyan, neon-purple)
      const dashColor = centerType === 'dashed-orange' ? 0xff7711
        : centerType === 'neon-cyan' ? 0x00f0ff
        : centerType === 'neon-purple' ? 0xb066ff
        : 0xffffff;
      for (let i = 0; i < SEGMENTS; i += 6) {
        // Draw 3 segments dash, 3 segments gap
        for (let j = 0; j < 3 && (i + j + 1) <= SEGMENTS; j++) {
          const p1 = ((i + j) / SEGMENTS) * this.trackLength;
          const p2 = ((i + j + 1) / SEGMENTS) * this.trackLength;
          const s1 = this.trackSpline.sampleAtProgress(p1);
          const s2 = this.trackSpline.sampleAtProgress(p2);
          const vIdx = centerVerts.length / 3;
          centerVerts.push(
            s1.center.x - s1.normal.x * 0.16, 0.052, s1.center.z - s1.normal.z * 0.16,
            s1.center.x + s1.normal.x * 0.16, 0.052, s1.center.z + s1.normal.z * 0.16,
            s2.center.x - s2.normal.x * 0.16, 0.052, s2.center.z - s2.normal.z * 0.16,
            s2.center.x + s2.normal.x * 0.16, 0.052, s2.center.z + s2.normal.z * 0.16,
          );
          centerIndices.push(vIdx, vIdx + 1, vIdx + 2, vIdx + 1, vIdx + 3, vIdx + 2);
        }
      }
      if (centerVerts.length > 0) {
        const dashMat = new THREE.MeshBasicMaterial({ color: dashColor, toneMapped: false });
        this.trackObjects.add(this.createCustomMesh(centerVerts, centerIndices, null, dashMat));
      }
    }

    // Shoulder / Runoff Concrete Verge
    const runoffMat = new THREE.MeshStandardMaterial({
      color: 0x545b63,
      roughness: 0.9,
      side: THREE.DoubleSide,
    });
    this.trackObjects.add(this.createCustomMesh(runoffVertices, runoffIndices, null, runoffMat));

    // Solid White Outer Edge Stripes
    const laneMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    this.trackObjects.add(this.createCustomMesh(laneVertices, laneIndices, null, laneMat));

    // Ground plane
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(750, 48),
      new THREE.MeshStandardMaterial({ color: config.ground, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    this.trackObjects.add(ground);

    // 3D Curbs, Safety Barriers, Streetlights & Curve Chevrons
    this._buildCurbsAndBarriers(config);
    this._buildStreetlights(config);
    this._buildCurveChevrons(config);
    this._createStartFinishGate(config);
  }

  _buildCurbsAndBarriers(config) {
    // 1. 3D Alternating Color Curbs (matched to track theme)
    const curbCount = Math.floor(this.trackLength / 2.6);
    const curbGeo = new THREE.BoxGeometry(1.45, 0.22, 2.45);
    const c1 = config.curbColor1 || 0xe02434;
    const c2 = config.curbColor2 || 0xf5f7f5;
    const mat1 = new THREE.MeshStandardMaterial({ color: c1, roughness: 0.65, emissive: c1, emissiveIntensity: 0.25 });
    const mat2 = new THREE.MeshStandardMaterial({ color: c2, roughness: 0.6, emissive: c2 === 0x00f0ff ? 0x00f0ff : c2, emissiveIntensity: 0.2 });

    const curbs1 = new THREE.InstancedMesh(curbGeo, mat1, curbCount * 2);
    const curbs2 = new THREE.InstancedMesh(curbGeo, mat2, curbCount * 2);
    const dummy = new THREE.Object3D();
    const basis = new THREE.Matrix4();
    let idx1 = 0;
    let idx2 = 0;

    for (let i = 0; i < curbCount; i++) {
      const { center, tangent, normal, up } = this.trackSpline.sampleAtProgress((i / curbCount) * this.trackLength);
      basis.makeBasis(normal, up, tangent.clone().negate());
      for (const side of [-1, 1]) {
        dummy.position.copy(center).addScaledVector(normal, side * (ROAD_HALF_WIDTH + 0.72)).addScaledVector(up, 0.1);
        dummy.quaternion.setFromRotationMatrix(basis);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        if ((i + (side === 1 ? 0 : 1)) % 2 === 0) {
          curbs1.setMatrixAt(idx1++, dummy.matrix);
        } else {
          curbs2.setMatrixAt(idx2++, dummy.matrix);
        }
      }
    }
    curbs1.count = idx1;
    curbs2.count = idx2;
    curbs1.instanceMatrix.needsUpdate = true;
    curbs2.instanceMatrix.needsUpdate = true;
    this.trackObjects.add(curbs1, curbs2);

    // 2. Continuous Outer Safety Barriers (Guardrail Posts + Steel Rails + Neon Guide Markers)
    const postCount = Math.floor(this.trackLength / 6.5);
    const postGeo = new THREE.BoxGeometry(0.22, 1.35, 0.26);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x9aa4a8, metalness: 0.75, roughness: 0.3 });
    const reflectorGeo = new THREE.BoxGeometry(0.18, 0.14, 0.45);
    const reflectorMat = new THREE.MeshBasicMaterial({ color: config.accent, toneMapped: false });

    const posts = new THREE.InstancedMesh(postGeo, postMat, postCount * 2);
    const reflectors = new THREE.InstancedMesh(reflectorGeo, reflectorMat, postCount * 2);

    for (let i = 0; i < postCount; i++) {
      const { center, tangent, normal, up } = this.trackSpline.sampleAtProgress((i / postCount) * this.trackLength);
      basis.makeBasis(normal, up, tangent.clone().negate());
      for (let s = 0; s < 2; s++) {
        const side = s === 0 ? -1 : 1;
        const idx = i * 2 + s;
        dummy.position.copy(center).addScaledVector(normal, side * (ROAD_HALF_WIDTH + 2.75)).addScaledVector(up, 0.68);
        dummy.quaternion.setFromRotationMatrix(basis);
        dummy.updateMatrix();
        posts.setMatrixAt(idx, dummy.matrix);

        dummy.position.copy(center).addScaledVector(normal, side * (ROAD_HALF_WIDTH + 2.6)).addScaledVector(up, 1.05);
        dummy.updateMatrix();
        reflectors.setMatrixAt(idx, dummy.matrix);
      }
    }
    posts.instanceMatrix.needsUpdate = true;
    reflectors.instanceMatrix.needsUpdate = true;
    this.trackObjects.add(posts, reflectors);

    // Continuous Steel Guardrail Tubes on both sides
    const railMat = new THREE.MeshStandardMaterial({ color: 0xbcc4c7, metalness: 0.82, roughness: 0.25 });
    for (const side of [-1, 1]) {
      for (const railHeight of [0.55, 1.0]) {
        const railPoints = [];
        for (let i = 0; i <= 260; i++) {
          const { center, normal, up } = this.trackSpline.sampleAtProgress((i / 260) * this.trackLength);
          railPoints.push(center.clone().addScaledVector(normal, side * (ROAD_HALF_WIDTH + 2.65)).addScaledVector(up, railHeight));
        }
        const railCurve = new THREE.CatmullRomCurve3(railPoints, true);
        const railGeo = new THREE.TubeGeometry(railCurve, 320, 0.085, 6, true);
        this.trackObjects.add(new THREE.Mesh(railGeo, railMat));
      }
    }
  }

  _buildStreetlights(config) {
    const count = 28;
    const poleGeo = new THREE.CylinderGeometry(0.14, 0.22, 9.0, 8);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x343e44, metalness: 0.7, roughness: 0.35 });
    const lampGeo = new THREE.BoxGeometry(1.4, 0.18, 0.45);
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff5de, toneMapped: false });

    const poles = new THREE.InstancedMesh(poleGeo, poleMat, count);
    const lamps = new THREE.InstancedMesh(lampGeo, lampMat, count);
    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
      const { center, tangent, normal, up } = this.trackSpline.sampleAtProgress((i / count) * this.trackLength);
      const side = i % 2 === 0 ? 1 : -1;
      const yaw = Math.atan2(tangent.x, tangent.z);

      // Poles placed safely behind barriers (ROAD_HALF_WIDTH + 4.8) - never near or over the road
      const basePos = center.clone().addScaledVector(normal, side * (ROAD_HALF_WIDTH + 4.8));
      dummy.position.copy(basePos).addScaledVector(up, 4.5);
      dummy.rotation.set(0, yaw, 0);
      dummy.updateMatrix();
      poles.setMatrixAt(i, dummy.matrix);

      // Lamp fixture sits directly on top of the pole facing downwards without hanging over the road
      dummy.position.copy(basePos).addScaledVector(up, 9.0);
      dummy.rotation.set(0, yaw, 0);
      dummy.updateMatrix();
      lamps.setMatrixAt(i, dummy.matrix);
    }
    poles.instanceMatrix.needsUpdate = true;
    lamps.instanceMatrix.needsUpdate = true;
    this.trackObjects.add(poles, lamps);
  }

  _buildCurveChevrons(config) {
    // Create glowing directional chevron texture (" >>> ")
    const createChevronTexture = (dir) => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#111619';
      ctx.fillRect(0, 0, 256, 128);
      ctx.strokeStyle = '#ffbb33';
      ctx.lineWidth = 5;
      ctx.strokeRect(4, 4, 248, 120);
      ctx.fillStyle = '#ffbb33';
      ctx.font = '900 76px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(dir > 0 ? '>>>' : '<<<', 128, 66);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    };

    const rightTex = createChevronTexture(1);
    const leftTex = createChevronTexture(-1);
    const signGeo = new THREE.PlaneGeometry(4.4, 2.2);
    const rightMat = new THREE.MeshBasicMaterial({ map: rightTex, side: THREE.DoubleSide, toneMapped: false });
    const leftMat = new THREE.MeshBasicMaterial({ map: leftTex, side: THREE.DoubleSide, toneMapped: false });

    const steps = 48;
    for (let i = 0; i < steps; i++) {
      const prog = (i / steps) * this.trackLength;
      const curr = this.trackSpline.sampleAtProgress(prog);
      const ahead = this.trackSpline.sampleAtProgress(prog + 16);
      const crossY = curr.tangent.x * ahead.tangent.z - curr.tangent.z * ahead.tangent.x;

      // Only place warning chevron signs on sharp turns, safely outside the road and barrier
      if (Math.abs(crossY) > 0.16) {
        const turnSide = crossY > 0 ? 1 : -1;
        const sign = new THREE.Mesh(signGeo, crossY > 0 ? leftMat : rightMat);
        const pos = curr.center.clone()
          .addScaledVector(curr.normal, turnSide * (ROAD_HALF_WIDTH + 4.2))
          .addScaledVector(curr.up, 2.3);
        sign.position.copy(pos);
        sign.lookAt(curr.center.clone().addScaledVector(curr.tangent, -24).addScaledVector(curr.up, 2.0));
        this.trackObjects.add(sign);
      }
    }
  }

  _createStartFinishGate(config) {
    // 100% Plain Flat Checkered Start/Finish Line painted on the road (NO overhead walls, posts, or beams)
    const { center, tangent, normal, up } = this.trackSpline.sampleAtProgress(0);
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const cols = 16;
    const rows = 4;
    const cellW = canvas.width / cols;
    const cellH = canvas.height / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? '#ffffff' : '#14171a';
        ctx.fillRect(c * cellW, r * cellH, cellW, cellH);
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const finishLine = new THREE.Mesh(
      new THREE.PlaneGeometry(ROAD_HALF_WIDTH * 2, 2.6),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, depthWrite: false })
    );
    finishLine.rotation.x = -Math.PI / 2;
    finishLine.rotation.z = -Math.atan2(tangent.x, tangent.z);
    finishLine.position.copy(center).addScaledVector(up, 0.055);
    this.trackObjects.add(finishLine);
  }

  _createWindowCanvas(theme, isNight) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    if (theme === 'london') {
      // Classic London Georgian / Victorian Red Brick Facade with Sash Windows
      ctx.fillStyle = '#683428';
      ctx.fillRect(0, 0, 512, 512);

      // Brick mortar lines
      ctx.fillStyle = 'rgba(190, 170, 155, 0.4)';
      for (let y = 0; y < 512; y += 8) {
        ctx.fillRect(0, y, 512, 1);
      }
      for (let y = 0; y < 512; y += 8) {
        const offset = (y % 16 === 0) ? 0 : 9;
        for (let x = offset; x < 512; x += 18) {
          ctx.fillRect(x, y, 1, 8);
        }
      }

      // Limestone horizontal floor bandings
      ctx.fillStyle = '#d4ccbd';
      ctx.fillRect(0, 124, 512, 8);
      ctx.fillRect(0, 252, 512, 8);
      ctx.fillRect(0, 380, 512, 8);

      // Georgian 6-pane sash windows with crisp white stone surrounds
      const cols = 6;
      const rows = 4;
      const colStep = 512 / cols;
      const rowStep = 512 / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const wx = c * colStep + 16;
          const wy = r * rowStep + 20;
          const ww = colStep - 32;
          const wh = rowStep - 46;

          ctx.fillStyle = '#ede9e1';
          ctx.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);

          const isLit = (c + r * 3) % 2 === 0;
          ctx.fillStyle = isLit ? '#ffecc2' : '#222b35';
          ctx.fillRect(wx, wy, ww, wh);

          // White sash window mullions (2 vertical x 3 horizontal)
          ctx.fillStyle = '#ede9e1';
          ctx.fillRect(wx + ww / 2 - 1, wy, 2, wh);
          ctx.fillRect(wx, wy + wh / 3 - 1, ww, 2);
          ctx.fillRect(wx, wy + (wh * 2) / 3 - 1, ww, 2);
        }
      }
    } else if (theme === 'coastal') {
      // Coastal Riviera White Stucco & Aqua Glass Balconies
      ctx.fillStyle = '#eef3f6';
      ctx.fillRect(0, 0, 512, 512);

      ctx.fillStyle = '#d5dfe5';
      for (let y = 0; y < 512; y += 64) {
        ctx.fillRect(0, y, 512, 2);
      }

      const cols = 5;
      const rows = 4;
      const colStep = 512 / cols;
      const rowStep = 512 / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const wx = c * colStep + 12;
          const wy = r * rowStep + 14;
          const ww = colStep - 24;
          const wh = rowStep - 36;

          ctx.fillStyle = '#2d3748';
          ctx.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);

          ctx.fillStyle = (c + r) % 3 === 0 ? '#b2e8f7' : '#5796b3';
          ctx.fillRect(wx, wy, ww, wh);

          ctx.fillStyle = 'rgba(78, 178, 209, 0.7)';
          ctx.fillRect(wx, wy + wh - 12, ww, 12);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(wx, wy + wh - 13, ww, 2);
        }
      }
    } else if (theme === 'desert') {
      // Desert Terracotta & Bronze Glass Facade
      ctx.fillStyle = '#6e3d2a';
      ctx.fillRect(0, 0, 512, 512);

      ctx.fillStyle = '#4e2a1c';
      for (let y = 0; y < 512; y += 85) {
        ctx.fillRect(0, y, 512, 6);
      }

      const cols = 5;
      const rows = 4;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const wx = c * 102 + 16;
          const wy = r * 128 + 24;
          ctx.fillStyle = '#26150f';
          ctx.fillRect(wx - 2, wy - 2, 74, 84);
          ctx.fillStyle = (c + r * 2) % 2 === 0 ? '#ffb973' : '#45281e';
          ctx.fillRect(wx, wy, 70, 80);
          ctx.fillStyle = 'rgba(255, 200, 120, 0.3)';
          ctx.fillRect(wx, wy + 26, 70, 2);
        }
      }
    } else if (theme === 'alpine') {
      // Alpine Timber Chalet & Warm Glowing Windows
      ctx.fillStyle = '#322822';
      ctx.fillRect(0, 0, 512, 512);

      ctx.fillStyle = '#241b16';
      for (let y = 0; y < 512; y += 16) {
        ctx.fillRect(0, y, 512, 2);
      }
      ctx.fillStyle = '#1c1511';
      for (let x = 0; x < 512; x += 128) {
        ctx.fillRect(x, 0, 8, 512);
      }

      const cols = 4;
      const rows = 4;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const wx = c * 128 + 26;
          const wy = r * 128 + 28;
          ctx.fillStyle = '#18120e';
          ctx.fillRect(wx - 3, wy - 3, 82, 76);
          ctx.fillStyle = '#ffb74d';
          ctx.fillRect(wx, wy, 76, 70);
          ctx.fillStyle = '#2d2018';
          ctx.fillRect(wx + 37, wy, 3, 70);
          ctx.fillRect(wx, wy + 34, 76, 3);
        }
      }
    } else {
      // Modern City / Tokyo / Cyberpunk High-Rise Glass Curtain Facade
      ctx.fillStyle = '#11151f';
      ctx.fillRect(0, 0, 512, 512);

      ctx.fillStyle = '#1a202e';
      for (let y = 0; y < 512; y += 32) {
        ctx.fillRect(0, y, 512, 3);
      }
      ctx.fillStyle = '#0d111a';
      for (let x = 0; x < 512; x += 32) {
        ctx.fillRect(x, 0, 3, 512);
      }

      const cols = 16;
      const rows = 16;
      const litColors = ['#fff3cc', '#7ce0ff', '#ffffff', '#ffd06b', '#62ffc8'];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const wx = c * 32 + 5;
          const wy = r * 32 + 5;
          const ww = 22;
          const wh = 22;

          const rand = ((c * 37 + r * 73) % 100);
          if (rand < 42) {
            const colorIdx = (c + r * 2) % litColors.length;
            ctx.fillStyle = litColors[colorIdx];
            ctx.fillRect(wx, wy, ww, wh);
            ctx.fillStyle = 'rgba(0,0,0,0.22)';
            ctx.fillRect(wx, wy, ww, 4);
          } else {
            ctx.fillStyle = '#171d28';
            ctx.fillRect(wx, wy, ww, wh);
          }
        }
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _createStorefrontCanvas(theme, trackKey) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#141822';
    ctx.fillRect(0, 0, 512, 256);

    let shopTitles = ['APEX MOTORS', 'CYBER CAFE 24H', 'TURBO RACING'];
    if (trackKey === 'tokyo') {
      shopTitles = ['東京 RACING', 'RAMEN 24H 渋谷', 'JDM TUNING LAB'];
    } else if (trackKey === 'london') {
      shopTitles = ['THE CROWN PUB', 'UNDERGROUND METRO', 'ROYAL MOTORS'];
    } else if (trackKey === 'coastal') {
      shopTitles = ['OCEAN DRIVE CAFE', 'GRAND AZUR CLUB', 'RIVIERA YACHTS'];
    } else if (trackKey === 'desert') {
      shopTitles = ['REDLINE SPEED SHOP', 'CANYON MOTEL', 'DYNO RACING LAB'];
    } else if (trackKey === 'alpine') {
      shopTitles = ['ALPINE SKI LODGE', 'SUMMIT CHALET', 'ST. MORITZ BAR'];
    } else if (trackKey === 'cyber') {
      shopTitles = ['SYNTHWAVE BAR', 'CYBER MATRIX 24H', 'NEXUS MOTORS'];
    }

    const bayW = 244;
    for (let b = 0; b < 2; b++) {
      const bx = b * 256 + 6;
      const title = shopTitles[b % shopTitles.length];

      ctx.fillStyle = '#0c0f16';
      ctx.fillRect(bx, 10, bayW, 236);

      const signGlow = (b === 0) ? '#38f5c2' : (trackKey === 'tokyo' ? '#ff2a85' : '#ffb834');
      ctx.fillStyle = '#151b26';
      ctx.fillRect(bx + 8, 18, bayW - 16, 46);
      ctx.strokeStyle = signGlow;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(bx + 8, 18, bayW - 16, 46);

      ctx.fillStyle = signGlow;
      ctx.font = '900 17px "Arial Black", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(title, bx + bayW / 2, 41);

      const winW = (bayW - 24) / 2;
      ctx.fillStyle = '#1c2432';
      ctx.fillRect(bx + 8, 72, winW, 166);
      ctx.fillStyle = 'rgba(255, 240, 200, 0.28)';
      ctx.fillRect(bx + 12, 76, winW - 8, 158);

      ctx.fillStyle = signGlow;
      ctx.fillRect(bx + 20, 195, winW - 24, 6);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('OPEN 24/7', bx + 12 + (winW - 8) / 2, 92);

      const dx = bx + 8 + winW + 8;
      ctx.fillStyle = '#1a212d';
      ctx.fillRect(dx, 72, winW, 166);
      ctx.strokeStyle = '#384659';
      ctx.lineWidth = 2;
      ctx.strokeRect(dx + 2, 74, winW - 4, 162);
      ctx.fillStyle = '#c7d2e0';
      ctx.fillRect(dx + 8, 140, 4, 28);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _createBillboardCanvas(trackKey, accentHex, secAccentHex) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#0a0d14';
    ctx.fillRect(0, 0, 512, 256);

    const borderCol = '#' + (accentHex || 0x38f5c2).toString(16).padStart(6, '0');
    const secCol = '#' + (secAccentHex || 0xff0077).toString(16).padStart(6, '0');

    ctx.strokeStyle = borderCol;
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, 496, 240);

    ctx.fillStyle = secCol;
    ctx.fillRect(4, 4, 28, 6);
    ctx.fillRect(4, 4, 6, 28);
    ctx.fillRect(512 - 32, 4, 28, 6);
    ctx.fillRect(512 - 10, 4, 6, 28);
    ctx.fillRect(4, 256 - 10, 28, 6);
    ctx.fillRect(4, 256 - 32, 6, 28);
    ctx.fillRect(512 - 32, 256 - 10, 28, 6);
    ctx.fillRect(512 - 10, 256 - 32, 6, 28);

    let title = 'NITRO OVERDRIVE';
    let tag = 'UNLEASH PEAK VELOCITY';
    if (trackKey === 'tokyo') {
      title = 'TOKYO MIDNIGHT';
      tag = 'SHIBUYA STREET RACING // APEX';
    } else if (trackKey === 'london') {
      title = 'LONDON GRAND PRIX';
      tag = 'THE ULTIMATE CITY CIRCUIT';
    } else if (trackKey === 'cyber') {
      title = 'NEO MEGACITY';
      tag = 'CYBERNETIC RACING LEAGUE';
    } else if (trackKey === 'desert') {
      title = 'REDLINE CANYON';
      tag = 'MAXIMUM OCTANE // 200 MPH';
    } else if (trackKey === 'coastal') {
      title = 'COASTAL GRAND PRIX';
      tag = 'PACIFIC SPEEDWAY // BLUE HOUR';
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    for (let x = 30; x < 500; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 18);
      ctx.lineTo(x + 24, 18);
      ctx.lineTo(x - 12, 238);
      ctx.lineTo(x - 36, 238);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = borderCol;
    ctx.font = '900 38px "Arial Black", Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, 256, 105);

    ctx.fillStyle = secCol;
    ctx.font = 'bold 18px Arial, sans-serif';
    ctx.fillText(tag, 256, 158);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('SPEED // DRIFT // NITRO // APEX RUSH', 256, 212);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _createTokyoSignCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#080a12';
    ctx.fillRect(0, 0, 128, 512);

    ctx.strokeStyle = '#ff2a85';
    ctx.lineWidth = 4;
    ctx.strokeRect(6, 6, 116, 500);

    ctx.font = '900 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const chars = ['東', '京', '超', '速', '競', '走'];
    for (let i = 0; i < chars.length; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#ff2a85' : '#00f0ff';
      ctx.fillText(chars[i], 64, 55 + i * 72);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _createSidewalkCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#505864';
    ctx.fillRect(0, 0, 256, 256);

    ctx.strokeStyle = '#383e47';
    ctx.lineWidth = 3;
    for (let x = 0; x <= 256; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 256);
      ctx.stroke();
    }
    for (let y = 0; y <= 256; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    for (let i = 0; i < 350; i++) {
      const rx = Math.random() * 256;
      const ry = Math.random() * 256;
      ctx.fillRect(rx, ry, 2, 2);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _isClearOfRoad(pos, halfExtent, currentProgress, trackLength) {
    const checkSteps = 140;
    const minSafeDist = ROAD_HALF_WIDTH + halfExtent + 4.5;
    for (let s = 0; s < checkSteps; s++) {
      const prog = (s / checkSteps) * trackLength;
      const splineDist = Math.min(Math.abs(prog - currentProgress), trackLength - Math.abs(prog - currentProgress));
      if (splineDist < 38.0) continue;

      const roadPoint = this.trackSpline.sampleAtProgress(prog).center;
      const d = Math.hypot(pos.x - roadPoint.x, pos.z - roadPoint.z);
      if (d < minSafeDist) {
        return false;
      }
    }
    return true;
  }

  _buildRoadsideBuildings(config) {
    if (!this.trackSpline || !this.trackLength) return;

    const isNight = ['city', 'tokyo', 'cyber', 'orbital'].includes(this.trackKey);
    const theme = this.trackKey;

    // 1. Generate Procedural Textures for Roadside Architecture
    const windowTex = this._createWindowCanvas(theme, isNight);
    const storefrontTex = this._createStorefrontCanvas(theme, config.id);
    const billboardTex = this._createBillboardCanvas(config.id, config.accent, config.secondaryAccent);
    const tokyoSignTex = (config.id === 'tokyo' || config.id === 'cyber') ? this._createTokyoSignCanvas() : null;
    const sidewalkTex = this._createSidewalkCanvas();

    // 2. Build Continuous Sidewalk Ribbons on both sides (outside guardrails, leading to buildings)
    const walkSegments = 260;
    const walkVerts = [];
    const walkIndices = [];
    const walkUvs = [];

    for (let s = 0; s <= walkSegments; s++) {
      const p = (s / walkSegments) * this.trackLength;
      const { center, normal } = this.trackSpline.sampleAtProgress(p);

      let leftOffset = ROAD_HALF_WIDTH + 8.5;
      let rightOffset = ROAD_HALF_WIDTH + 8.5;

      for (let chk = 0; chk < this.trackLength; chk += 15) {
        const sDist = Math.min(Math.abs(chk - p), this.trackLength - Math.abs(chk - p));
        if (sDist < 40) continue;
        const otherCenter = this.trackSpline.sampleAtProgress(chk).center;

        const testL = center.clone().addScaledVector(normal, leftOffset);
        const dL = Math.hypot(testL.x - otherCenter.x, testL.z - otherCenter.z);
        if (dL < ROAD_HALF_WIDTH + 2.0) {
          leftOffset = ROAD_HALF_WIDTH + 2.0;
        }

        const testR = center.clone().addScaledVector(normal, -rightOffset);
        const dR = Math.hypot(testR.x - otherCenter.x, testR.z - otherCenter.z);
        if (dR < ROAD_HALF_WIDTH + 2.0) {
          rightOffset = ROAD_HALF_WIDTH + 2.0;
        }
      }

      const pL1 = center.clone().addScaledVector(normal, ROAD_HALF_WIDTH + 2.0);
      const pL2 = center.clone().addScaledVector(normal, leftOffset);
      const pR1 = center.clone().addScaledVector(normal, -(ROAD_HALF_WIDTH + 2.0));
      const pR2 = center.clone().addScaledVector(normal, -rightOffset);

      walkVerts.push(
        pL1.x, 0.08, pL1.z,
        pL2.x, 0.08, pL2.z,
        pR1.x, 0.08, pR1.z,
        pR2.x, 0.08, pR2.z,
      );

      const u = (s / walkSegments) * 50;
      walkUvs.push(0, u, 1, u, 0, u, 1, u);

      if (s < walkSegments) {
        const base = s * 4;
        walkIndices.push(base, base + 4, base + 1, base + 1, base + 4, base + 5);
        walkIndices.push(base + 2, base + 3, base + 6, base + 3, base + 7, base + 6);
      }
    }

    const walkGeo = new THREE.BufferGeometry();
    walkGeo.setAttribute('position', new THREE.Float32BufferAttribute(walkVerts, 3));
    walkGeo.setAttribute('uv', new THREE.Float32BufferAttribute(walkUvs, 2));
    walkGeo.setIndex(walkIndices);
    walkGeo.computeVertexNormals();

    const walkMat = new THREE.MeshStandardMaterial({
      map: sidewalkTex,
      color: 0x5a636e,
      roughness: 0.85,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });
    this.trackObjects.add(new THREE.Mesh(walkGeo, walkMat));

    // 3. Materials for Roadside Buildings
    const frontMat = new THREE.MeshStandardMaterial({
      map: windowTex,
      roughness: 0.35,
      metalness: 0.4,
      emissive: isNight ? 0xffffff : 0x000000,
      emissiveMap: isNight ? windowTex : null,
      emissiveIntensity: isNight ? 0.75 : 0.0,
    });

    const storefrontMat = new THREE.MeshStandardMaterial({
      map: storefrontTex,
      roughness: 0.3,
      metalness: 0.35,
      emissive: isNight ? 0xffffff : 0x000000,
      emissiveMap: isNight ? storefrontTex : null,
      emissiveIntensity: isNight ? 0.85 : 0.0,
    });

    const wallColor = theme === 'london' ? 0x643226 : (theme === 'desert' ? 0x6e3d2a : (theme === 'alpine' ? 0x322822 : 0x151a24));
    const sideWallMat = new THREE.MeshStandardMaterial({
      color: wallColor,
      roughness: 0.85,
      metalness: 0.2,
    });

    const roofMat = new THREE.MeshStandardMaterial({
      color: 0x12161f,
      roughness: 0.9,
      metalness: 0.15,
    });

    const groundFloorMat = new THREE.MeshStandardMaterial({
      color: 0x0c0f16,
      roughness: 0.95,
    });

    const neonAccentMat = new THREE.MeshBasicMaterial({
      color: config.accent || 0x38f5c2,
      toneMapped: false,
    });

    const neonSecMat = new THREE.MeshBasicMaterial({
      color: config.secondaryAccent || 0xff0077,
      toneMapped: false,
    });

    const beaconRedMat = new THREE.MeshBasicMaterial({
      color: 0xff1515,
      toneMapped: false,
    });

    const billboardMat = new THREE.MeshBasicMaterial({
      map: billboardTex,
      toneMapped: false,
    });

    const darkMetalMat = new THREE.MeshStandardMaterial({
      color: 0x1a212b,
      metalness: 0.8,
      roughness: 0.3,
    });

    // Reusable child geometries
    const acGeo = new THREE.BoxGeometry(2.4, 1.4, 2.4);
    const antennaGeo = new THREE.CylinderGeometry(0.08, 0.16, 8.5, 6);
    const beaconGeo = new THREE.SphereGeometry(0.35, 6, 6);
    const bbGeo = new THREE.BoxGeometry(9.6, 4.8, 0.3);
    const bbArmGeo = new THREE.BoxGeometry(0.2, 0.2, 1.4);

    // 4. Sample Track Spline & Build Flanking Roadside Buildings
    const stepDist = 22.0;
    const totalSteps = Math.max(28, Math.floor(this.trackLength / stepDist));

    for (let i = 0; i < totalSteps; i++) {
      const progress = (i / totalSteps) * this.trackLength;
      const { center, normal } = this.trackSpline.sampleAtProgress(progress);

      for (const side of [-1, 1]) {
        // Natural cross-street / alleyway gap every 4-5 buildings
        if ((i + (side > 0 ? 1 : 0)) % 5 === 0) {
          continue;
        }

        const seed = Math.abs((i * 47 + (side > 0 ? 83 : 29)) % 1000);
        const archType = seed % 4; // 0: Retail Block, 1: Step-Back Tower, 2: Billboard Building, 3: Tall Tower

        const bw = 15.0 + (seed % 6); // 15m to 20m along road
        const bd = 16.0 + ((seed * 3) % 8); // 16m to 23m deep

        let bh;
        if (archType === 1) {
          bh = 38.0 + (seed % 26); // 38m to 64m
        } else if (archType === 2) {
          bh = 26.0 + (seed % 18); // 26m to 44m
        } else {
          bh = 20.0 + (seed % 20); // 20m to 40m
        }

        // Safe placement: front face starts at ROAD_HALF_WIDTH + 8.5m
        const distFront = ROAD_HALF_WIDTH + 8.5;
        const distCenter = distFront + bd / 2;
        const buildingPos = center.clone().addScaledVector(normal, side * distCenter);

        // Discard any building that intersects or sits on any other part of the track
        const buildingRadius = Math.hypot(bw / 2, bd / 2);
        if (!this._isClearOfRoad(buildingPos, buildingRadius, progress, this.trackLength)) {
          continue;
        }

        // Building Group for compound architecture
        const buildingGroup = new THREE.Group();
        buildingGroup.position.copy(buildingPos);
        buildingGroup.lookAt(center.x, buildingPos.y, center.z);

        if (archType === 0) {
          // --- ARCHETYPE 0: Ground-Floor Retail Storefront + Upper Window Floors ---
          const podiumH = 5.4;
          const podiumMesh = new THREE.Mesh(new THREE.BoxGeometry(bw, podiumH, bd), [
            sideWallMat,
            sideWallMat,
            roofMat,
            groundFloorMat,
            storefrontMat, // Front face (+Z) facing road
            sideWallMat,
          ]);
          podiumMesh.position.y = podiumH / 2 - 0.2;
          buildingGroup.add(podiumMesh);

          const upperH = Math.max(12, bh - podiumH);
          const upperMesh = new THREE.Mesh(new THREE.BoxGeometry(bw, upperH, bd), [
            sideWallMat,
            sideWallMat,
            roofMat,
            groundFloorMat,
            frontMat, // Front face (+Z) facing road
            sideWallMat,
          ]);
          upperMesh.position.y = podiumH + upperH / 2 - 0.2;
          buildingGroup.add(upperMesh);

          // Glowing neon roofline edge
          if (isNight || config.id === 'city' || config.id === 'tokyo' || config.id === 'cyber') {
            const trim = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.2, 0.4, 0.4), neonAccentMat);
            trim.position.set(0, podiumH + upperH, bd / 2);
            buildingGroup.add(trim);
          }

          // Rooftop AC unit
          const ac = new THREE.Mesh(acGeo, darkMetalMat);
          ac.position.set((seed % 4) - 2, podiumH + upperH + 0.7, 0);
          buildingGroup.add(ac);

        } else if (archType === 1) {
          // --- ARCHETYPE 1: Two-Tier Stepped Skyscraper with Antenna Spire ---
          const lowerH = bh * 0.55;
          const lowerMesh = new THREE.Mesh(new THREE.BoxGeometry(bw, lowerH, bd), [
            sideWallMat,
            sideWallMat,
            roofMat,
            groundFloorMat,
            frontMat,
            sideWallMat,
          ]);
          lowerMesh.position.y = lowerH / 2 - 0.2;
          buildingGroup.add(lowerMesh);

          const towerW = bw * 0.72;
          const towerD = bd * 0.72;
          const towerH = bh * 0.55;
          const towerMesh = new THREE.Mesh(new THREE.BoxGeometry(towerW, towerH, towerD), [
            sideWallMat,
            sideWallMat,
            roofMat,
            groundFloorMat,
            frontMat,
            sideWallMat,
          ]);
          towerMesh.position.set(0, lowerH + towerH / 2 - 0.2, -bd * 0.08);
          buildingGroup.add(towerMesh);

          // Rooftop Antenna Mast with Glowing Red Aviation Warning Beacon
          const antenna = new THREE.Mesh(antennaGeo, darkMetalMat);
          antenna.position.set(towerW * 0.25, lowerH + towerH + 4.25, -bd * 0.08);
          const beacon = new THREE.Mesh(beaconGeo, beaconRedMat);
          beacon.position.set(0, 4.25, 0);
          antenna.add(beacon);
          buildingGroup.add(antenna);

          // Glowing Neon Trim on Tower Crown
          if (isNight || config.id === 'city' || config.id === 'tokyo' || config.id === 'cyber') {
            const crownTrim = new THREE.Mesh(new THREE.BoxGeometry(towerW + 0.2, 0.45, towerD + 0.2), neonSecMat);
            crownTrim.position.set(0, lowerH + towerH, -bd * 0.08);
            buildingGroup.add(crownTrim);
          }

        } else if (archType === 2) {
          // --- ARCHETYPE 2: Roadside Building with Cantilevered 3D Neon Billboard ---
          const mainMesh = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), [
            sideWallMat,
            sideWallMat,
            roofMat,
            groundFloorMat,
            frontMat,
            sideWallMat,
          ]);
          mainMesh.position.y = bh / 2 - 0.2;
          buildingGroup.add(mainMesh);

          // 3D Neon Billboard mounted on front facade facing oncoming racers
          const billboardMesh = new THREE.Mesh(bbGeo, [
            neonAccentMat,
            neonAccentMat,
            neonAccentMat,
            neonAccentMat,
            billboardMat, // Front
            darkMetalMat, // Back
          ]);
          const bbY = Math.min(bh - 3.5, 14.5);
          billboardMesh.position.set(0, bbY, bd / 2 + 0.8);
          billboardMesh.rotation.y = side > 0 ? 0.09 : -0.09;
          buildingGroup.add(billboardMesh);

          const arm1 = new THREE.Mesh(bbArmGeo, darkMetalMat);
          arm1.position.set(-3.6, bbY, bd / 2 + 0.4);
          const arm2 = new THREE.Mesh(bbArmGeo, darkMetalMat);
          arm2.position.set(3.6, bbY, bd / 2 + 0.4);
          buildingGroup.add(arm1, arm2);

          // Rooftop AC unit
          const ac = new THREE.Mesh(acGeo, darkMetalMat);
          ac.position.set(0, bh + 0.7, 0);
          buildingGroup.add(ac);

        } else {
          // --- ARCHETYPE 3: Sleek Office Tower with Neon Parapet & Beacon ---
          const mainMesh = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), [
            sideWallMat,
            sideWallMat,
            roofMat,
            groundFloorMat,
            frontMat,
            sideWallMat,
          ]);
          mainMesh.position.y = bh / 2 - 0.2;
          buildingGroup.add(mainMesh);

          // Front-edge Neon Strip
          if (isNight || config.id === 'city' || config.id === 'tokyo' || config.id === 'cyber') {
            const edgeStrip = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.2, 0.4, 0.4), neonAccentMat);
            edgeStrip.position.set(0, bh, bd / 2);
            buildingGroup.add(edgeStrip);
          }

          // Antenna & Beacon on roof corner
          const antenna = new THREE.Mesh(antennaGeo, darkMetalMat);
          antenna.position.set(bw * 0.32, bh + 4.25, 0);
          const beacon = new THREE.Mesh(beaconGeo, beaconRedMat);
          beacon.position.set(0, 4.25, 0);
          antenna.add(beacon);
          buildingGroup.add(antenna);
        }

        // Tokyo & Cyber Special: Vertical Japanese Kanji Neon Blade on Corner
        if ((config.id === 'tokyo' || config.id === 'cyber') && tokyoSignTex && (seed % 3 === 0)) {
          const vSignMesh = new THREE.Mesh(new THREE.BoxGeometry(1.4, 11.0, 0.25), [
            neonSecMat,
            neonSecMat,
            neonSecMat,
            neonSecMat,
            new THREE.MeshBasicMaterial({ map: tokyoSignTex, toneMapped: false }),
            new THREE.MeshBasicMaterial({ map: tokyoSignTex, toneMapped: false }),
          ]);
          vSignMesh.position.set(bw / 2 - 0.2, 11.5, bd / 2 + 0.7);
          buildingGroup.add(vSignMesh);
        }

        this.trackObjects.add(buildingGroup);

        // --- London Special: Iconic Red Telephone Box on Sidewalk ---
        if (config.id === 'london' && (i % 3 === 0)) {
          const boothPos = center.clone().addScaledVector(normal, side * (ROAD_HALF_WIDTH + 4.5));
          if (this._isClearOfRoad(boothPos, 1.5, progress, this.trackLength)) {
            const boothMesh = new THREE.Mesh(
              new THREE.BoxGeometry(1.25, 2.7, 1.25),
              new THREE.MeshStandardMaterial({ color: 0xd4111e, roughness: 0.35, metalness: 0.2 })
            );
            boothPos.y = 1.35;
            boothMesh.position.copy(boothPos);
            boothMesh.lookAt(center.x, 1.35, center.z);
            this.trackObjects.add(boothMesh);
          }
        }

        // =========================================================================
        // TIER 2: TOWERING BACKGROUND SKYSCRAPERS & MEGASTRUCTURES (Behind Tier 1)
        // =========================================================================
        if (i % 2 === 0) {
          const seed2 = Math.abs((i * 71 + (side > 0 ? 59 : 97)) % 1000);
          const bw2 = 24.0 + (seed2 % 12); // 24m to 35m wide
          const bd2 = 22.0 + ((seed2 * 2) % 12); // 22m to 33m deep
          const bh2 = 70.0 + (seed2 % 65); // 70m to 135m tall!

          const distCenter2 = ROAD_HALF_WIDTH + 27.0 + bd2 / 2;
          const bgPos = center.clone().addScaledVector(normal, side * distCenter2);

          // Discard any background skyscraper that would overlap or sit on any part of the track
          const bgRadius = Math.hypot(bw2 / 2, bd2 / 2);
          if (!this._isClearOfRoad(bgPos, bgRadius, progress, this.trackLength)) {
            continue;
          }

          bgPos.y = bh2 / 2 - 0.5;

          const bgMesh = new THREE.Mesh(new THREE.BoxGeometry(bw2, bh2, bd2), [
            sideWallMat,
            sideWallMat,
            roofMat,
            groundFloorMat,
            frontMat,
            sideWallMat,
          ]);
          bgMesh.position.copy(bgPos);
          bgMesh.lookAt(center.x, bgPos.y, center.z);

          // Pulsing red aviation warning beacon on peak
          const bgBeacon = new THREE.Mesh(beaconGeo, beaconRedMat);
          bgBeacon.position.set(0, bh2 / 2 + 1.2, 0);
          bgMesh.add(bgBeacon);

          // Glowing neon crown on skyscraper roof
          if (isNight || config.id === 'city' || config.id === 'tokyo' || config.id === 'cyber') {
            const crownGeo = new THREE.BoxGeometry(bw2 * 0.85, 1.2, bd2 * 0.85);
            const crownMesh = new THREE.Mesh(crownGeo, neonSecMat);
            crownMesh.position.set(0, bh2 / 2 + 0.6, 0);
            bgMesh.add(crownMesh);
          }

          this.trackObjects.add(bgMesh);
        }
      }
    }
  }

  _buildDecorations(config) {
    // 1. Build roadside buildings & towering skyscrapers directly lining both sides of the track
    this._buildRoadsideBuildings(config);

    // 2. Distant horizon landmarks
    if (this.trackKey === 'city') {
      this._buildCitySkyline(config);
    } else if (this.trackKey === 'desert') {
      this._buildCanyonMesas(config);
    } else if (this.trackKey === 'coastal') {
      this._buildCoastlineOcean(config);
    } else if (this.trackKey === 'orbital') {
      this._buildOrbitalRings(config);
    } else if (this.trackKey === 'london') {
      this._buildLondonDecorations(config);
    } else if (this.trackKey === 'tokyo') {
      this._buildTokyoDecorations(config);
    } else if (this.trackKey === 'alpine') {
      this._buildAlpineDecorations(config);
    } else if (this.trackKey === 'cyber') {
      this._buildCyberDecorations(config);
    }
  }

  _buildAlpineDecorations() {
    // Distant snow-capped mountain peaks on far horizon (360m+ away)
    const count = 32;
    const mountainGeo = new THREE.ConeGeometry(38, 120, 5);
    const mountainMat = new THREE.MeshStandardMaterial({ color: 0x3d4750, roughness: 0.9 });
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xf0f5ff, roughness: 0.6 });
    const inst = new THREE.InstancedMesh(mountainGeo, mountainMat, count);
    const snowInst = new THREE.InstancedMesh(new THREE.ConeGeometry(16, 42, 5), snowMat, count);
    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const radius = 370 + ((i * 49) % 160);
      const height = 90 + ((i * 31) % 80);
      dummy.position.set(Math.cos(angle) * radius, height / 2, Math.sin(angle) * radius);
      dummy.scale.set(1.4 + (i % 3) * 0.4, height / 100, 1.4 + (i % 3) * 0.4);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);

      dummy.position.set(Math.cos(angle) * radius, height - 16, Math.sin(angle) * radius);
      dummy.scale.set(1.2, height / 100, 1.2);
      dummy.updateMatrix();
      snowInst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    snowInst.instanceMatrix.needsUpdate = true;
    this.trackObjects.add(inst, snowInst);
  }

  _buildCyberDecorations() {
    // Distant cyber megacity skyscrapers with neon beacons (380m+ away)
    const count = 64;
    const bGeo = new THREE.BoxGeometry(1, 1, 1);
    const bMat = new THREE.MeshStandardMaterial({ color: 0x111322, roughness: 0.85, metalness: 0.3 });
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, toneMapped: false });
    const inst = new THREE.InstancedMesh(bGeo, bMat, count);
    const beacons = new THREE.InstancedMesh(new THREE.BoxGeometry(4, 2, 4), beaconMat, count);
    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const radius = 380 + ((i * 43) % 160);
      const height = 55 + ((i * 37) % 140);
      dummy.position.set(Math.cos(angle) * radius, height / 2, Math.sin(angle) * radius);
      dummy.scale.set(18 + (i % 4) * 5, height, 18 + (i % 4) * 5);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);

      dummy.position.set(Math.cos(angle) * radius, height + 1, Math.sin(angle) * radius);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      beacons.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    beacons.instanceMatrix.needsUpdate = true;
    this.trackObjects.add(inst, beacons);
  }

  _buildCitySkyline(config) {
    // Distant perimeter skyline strictly beyond 380m radius - NEVER on or near the track
    const count = 72;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x1d2730,
      roughness: 0.9,
      metalness: 0.2,
      emissive: 0x0f171e,
      emissiveIntensity: 0.35,
    });
    const inst = new THREE.InstancedMesh(geo, mat, count);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const radius = 380 + ((i * 47) % 160); // 380m to 540m far perimeter
      const height = 45 + ((i * 29) % 110);
      dummy.position.set(Math.cos(angle) * radius, height / 2, Math.sin(angle) * radius);
      dummy.scale.set(22 + (i % 5) * 4, height, 22 + (i % 4) * 4);
      dummy.rotation.y = angle + 0.2;
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    this.trackObjects.add(inst);
  }

  _buildCanyonMesas() {
    // Distant mesa silhouettes on the far horizon (400m+ away)
    const count = 28;
    const geo = new THREE.CylinderGeometry(25, 45, 65, 7);
    const mat = new THREE.MeshStandardMaterial({ color: 0x6e3825, roughness: 0.95 });
    const inst = new THREE.InstancedMesh(geo, mat, count);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const radius = 400 + ((i * 53) % 150);
      dummy.position.set(Math.cos(angle) * radius, 32, Math.sin(angle) * radius);
      dummy.scale.set(1.5, 1, 1.5);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    this.trackObjects.add(inst);
  }

  _buildCoastlineOcean() {
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(1600, 1200),
      new THREE.MeshStandardMaterial({ color: 0x143c4f, roughness: 0.35, metalness: 0.2 }),
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(60, -0.2, 30);
    this.trackObjects.add(sea);
  }

  _buildOrbitalRings() {
    // High sky solar orbital ring, placed 240m up in space (never intersects ground or track)
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x9a58ff,
      emissive: 0x7635ff,
      emissiveIntensity: 1.8,
      metalness: 0.8,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(320, 3.5, 12, 64), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 240, 0);
    this.trackObjects.add(ring);
  }

  _buildLondonDecorations(config) {
    // 1. Big Ben Clock Tower (Iconic London landmark looming on the distant horizon)
    const towerGroup = new THREE.Group();
    towerGroup.position.set(160, 0, 220);

    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8a7f72, roughness: 0.85 });
    const clockFaceMat = new THREE.MeshBasicMaterial({ color: 0xfff3c4 });
    const spireMat = new THREE.MeshStandardMaterial({ color: 0x336156, roughness: 0.45, metalness: 0.5 });
    const goldTrimMat = new THREE.MeshStandardMaterial({ color: 0xd4a024, metalness: 0.8, roughness: 0.3 });

    // Tower Shaft
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(16, 120, 16), stoneMat);
    shaft.position.y = 60;
    towerGroup.add(shaft);

    // Decorative ledge
    const ledge = new THREE.Mesh(new THREE.BoxGeometry(18.5, 3.5, 18.5), goldTrimMat);
    ledge.position.y = 120;
    towerGroup.add(ledge);

    // Clock Belfry Room
    const belfry = new THREE.Mesh(new THREE.BoxGeometry(17.5, 24, 17.5), stoneMat);
    belfry.position.y = 132;
    towerGroup.add(belfry);

    // 4 Glowing Clock Dials
    for (const [rotY, pos] of [
      [0, [0, 132, 8.85]],
      [Math.PI, [0, 132, -8.85]],
      [Math.PI / 2, [8.85, 132, 0]],
      [-Math.PI / 2, [-8.85, 132, 0]],
    ]) {
      const dial = new THREE.Mesh(new THREE.CircleGeometry(5.2, 24), clockFaceMat);
      dial.position.set(...pos);
      dial.rotation.y = rotY;
      towerGroup.add(dial);
      const rim = new THREE.Mesh(new THREE.RingGeometry(5.0, 5.6, 24), goldTrimMat);
      rim.position.set(...pos);
      rim.rotation.y = rotY;
      towerGroup.add(rim);
    }

    // Upper Roof Spire
    const spire = new THREE.Mesh(new THREE.ConeGeometry(9.2, 48, 4), spireMat);
    spire.position.y = 168;
    spire.rotation.y = Math.PI / 4;
    towerGroup.add(spire);

    // Golden Cross / Finial on peak
    const finial = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 12, 8), goldTrimMat);
    finial.position.y = 194;
    towerGroup.add(finial);

    this.trackObjects.add(towerGroup);

    // 2. Classic European London City Buildings (along distant perimeter - 290m+ away)
    const count = 48;
    const bGeo = new THREE.BoxGeometry(1, 1, 1);
    const bMatRed = new THREE.MeshStandardMaterial({ color: 0x76392c, roughness: 0.85 });
    const bMatStone = new THREE.MeshStandardMaterial({ color: 0xc4bcad, roughness: 0.8 });
    const redInst = new THREE.InstancedMesh(bGeo, bMatRed, count / 2);
    const stoneInst = new THREE.InstancedMesh(bGeo, bMatStone, count / 2);
    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const radius = 290 + ((i * 37) % 110);
      const height = 35 + ((i * 17) % 45);
      dummy.position.set(Math.cos(angle) * radius, height / 2, Math.sin(angle) * radius);
      dummy.scale.set(24 + (i % 4) * 6, height, 20 + (i % 3) * 6);
      dummy.rotation.y = angle + 0.15;
      dummy.updateMatrix();
      if (i % 2 === 0) redInst.setMatrixAt(i / 2, dummy.matrix);
      else stoneInst.setMatrixAt(Math.floor(i / 2), dummy.matrix);
    }
    redInst.instanceMatrix.needsUpdate = true;
    stoneInst.instanceMatrix.needsUpdate = true;
    this.trackObjects.add(redInst, stoneInst);
  }

  _buildTokyoDecorations(config) {
    const towerGroup = new THREE.Group();
    towerGroup.position.set(-180, 0, 240);
    const redMat = new THREE.MeshStandardMaterial({ color: 0xff3020, metalness: 0.6, roughness: 0.3 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });

    const base = new THREE.Mesh(new THREE.ConeGeometry(24, 90, 4), redMat);
    base.position.y = 45;
    const mid = new THREE.Mesh(new THREE.ConeGeometry(14, 60, 4), whiteMat);
    mid.position.y = 110;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.6, 50, 8), redMat);
    top.position.y = 160;
    towerGroup.add(base, mid, top);
    this.trackObjects.add(towerGroup);

    this._buildCitySkyline(config);
  }

  _buildInteractiveTrackItems() {
    // Plain road requested: no boost pads, orbs, or cones in the middle of the road
    this.boostMeshes = [];
    this.orbMeshes = [];
  }

  createCustomMesh(vertices, indices, uvs, material) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    if (uvs) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return new THREE.Mesh(geometry, material);
  }

  createAsphaltTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    // Dark clean tarmac base for high-contrast road markings
    ctx.fillStyle = '#22262a';
    ctx.fillRect(0, 0, 1024, 1024);
    let seed = 9183;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 22000; i++) {
      const shade = Math.floor(45 + rnd() * 65);
      ctx.fillStyle = `rgba(${shade},${shade},${shade},${0.18 + rnd() * 0.28})`;
      ctx.fillRect(rnd() * 1024, rnd() * 1024, 1 + rnd() * 2, 1 + rnd() * 2);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 16;
    return tex;
  }

  createCar(data, isPlayer, customOptions = {}) {
    const group = new THREE.Group();
    const carColor = customOptions.color || data.color;
    const underglowColor = customOptions.underglow || data.underglow;

    // Race Hypercar Finishes (glossy papaya-orange paint, gloss-black aero, smoked glass)
    const bodyMaterial = new THREE.MeshPhysicalMaterial({
      color: carColor,
      metalness: 0.35,
      roughness: 0.2,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      emissive: carColor,
      emissiveIntensity: 0.06,
    });
    const archMaterial = bodyMaterial.clone();
    archMaterial.side = THREE.DoubleSide;
    const carbonMaterial = new THREE.MeshStandardMaterial({
      color: 0x0b0c0e,
      metalness: 0.6,
      roughness: 0.32,
    });
    const intakeMaterial = new THREE.MeshStandardMaterial({
      color: 0x030304,
      metalness: 0.2,
      roughness: 0.85,
    });
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x05080c,
      metalness: 0.7,
      roughness: 0.05,
      transparent: true,
      opacity: 0.95,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
    });
    const headlightMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xeaf6ff,
      emissiveIntensity: 4.2,
    });
    const taillightMaterial = new THREE.MeshStandardMaterial({
      color: 0xff1024,
      emissive: 0xff0814,
      emissiveIntensity: 3.5,
    });
    const exhaustChrome = new THREE.MeshStandardMaterial({
      color: 0x9aa3ab,
      metalness: 0.95,
      roughness: 0.18,
    });
    const caliperMat = new THREE.MeshStandardMaterial({
      color: 0xd9a21b,
      roughness: 0.3,
      metalness: 0.4,
    });
    const brakeDiscMat = new THREE.MeshStandardMaterial({
      color: 0x6f767d,
      metalness: 0.9,
      roughness: 0.25,
    });
    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x111214,
      roughness: 0.92,
      metalness: 0.04,
    });
    const rimLipMat = new THREE.MeshStandardMaterial({
      color: 0x1a1612,
      metalness: 0.85,
      roughness: 0.3,
    });
    const spokeMat = new THREE.MeshStandardMaterial({
      color: 0x3b3027, // dark bronze forged alloy
      metalness: 0.9,
      roughness: 0.28,
    });

    // 1. Low, rounded teardrop body (wide low nose rising to a smooth haunch)
    const body = createCarShell([
      { z: -4.00, width: 0.95, topWidth: 0.60, sideY: 0.40, topY: 0.46 }, // Wide low nose lip
      { z: -3.60, width: 1.30, topWidth: 1.00, sideY: 0.46, topY: 0.60 }, // Nose / front bumper
      { z: -3.00, width: 1.28, topWidth: 1.08, sideY: 0.52, topY: 0.72 }, // Front hood with channels
      { z: -2.15, width: 1.24, topWidth: 1.06, sideY: 0.55, topY: 0.80 }, // Front axle (arches over wheels)
      { z: -1.30, width: 1.42, topWidth: 1.22, sideY: 0.58, topY: 0.90 }, // Cowl / windscreen base
      { z: 0.00,  width: 1.50, topWidth: 1.28, sideY: 0.60, topY: 0.94 }, // Door / side scoop
      { z: 1.20,  width: 1.46, topWidth: 1.26, sideY: 0.62, topY: 0.96 }, // Engine cover
      { z: 2.15,  width: 1.26, topWidth: 1.10, sideY: 0.60, topY: 0.94 }, // Rear axle
      { z: 3.05,  width: 1.40, topWidth: 1.14, sideY: 0.62, topY: 0.90 }, // Tail deck
      { z: 3.55,  width: 1.10, topWidth: 0.80, sideY: 0.62, topY: 0.84 }, // Tail end
    ], bodyMaterial, 0.30);
    group.add(body);

    // 2. Teardrop bubble canopy (smoked glass) with a painted roof panel
    const canopy = createCarShell([
      { z: -1.95, width: 0.78, topWidth: 0.60, sideY: 0.86, topY: 0.90 },
      { z: -1.20, width: 1.04, topWidth: 0.82, sideY: 0.92, topY: 1.32 },
      { z: -0.40, width: 1.08, topWidth: 0.86, sideY: 0.94, topY: 1.46 },
      { z: 0.45,  width: 1.04, topWidth: 0.82, sideY: 0.94, topY: 1.44 },
      { z: 1.30,  width: 0.88, topWidth: 0.66, sideY: 0.94, topY: 1.24 },
      { z: 2.35,  width: 0.56, topWidth: 0.36, sideY: 0.94, topY: 0.98 },
    ], glassMaterial, 0.86);
    group.add(canopy);

    const roofPanel = createCarShell([
      { z: -0.95, width: 0.34, topWidth: 0.28, sideY: 1.38, topY: 1.43 },
      { z: -0.40, width: 0.52, topWidth: 0.44, sideY: 1.44, topY: 1.49 },
      { z: 0.45,  width: 0.50, topWidth: 0.42, sideY: 1.42, topY: 1.47 },
      { z: 1.20,  width: 0.30, topWidth: 0.22, sideY: 1.27, topY: 1.31 },
    ], bodyMaterial, 1.36);
    group.add(roofPanel);

    // Engine-cover fin flowing back from the canopy
    const spineFin = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.16, 1.5), bodyMaterial);
    spineFin.position.set(0, 1.02, 2.25);
    spineFin.rotation.x = 0.1;
    group.add(spineFin);

    // 3. Sculpted wheel arches: open-bottom painted fenders wrapping the top of each wheel
    // Cylinder rotated so its axis lies along X; theta 0.08π..0.92π sweeps over the top.
    const archGeo = new THREE.CylinderGeometry(0.68, 0.68, 0.50, 24, 1, true, Math.PI * 0.08, Math.PI * 0.84);
    const archCapGeo = new THREE.RingGeometry(0.58, 0.70, 24, 1, Math.PI * 0.08, Math.PI * 0.84);
    for (const side of [-1, 1]) {
      for (const z of [-2.15, 2.15]) {
        const arch = new THREE.Mesh(archGeo, archMaterial);
        arch.rotation.z = Math.PI / 2;
        arch.position.set(side * 1.58, 0.56, z);
        group.add(arch);

        const cap = new THREE.Mesh(archCapGeo, archMaterial);
        cap.rotation.y = Math.PI / 2;
        cap.position.set(side * 1.83, 0.56, z);
        group.add(cap);
      }

      // Smooth fender bulges blending arches into the body
      const frontBulge = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), bodyMaterial);
      frontBulge.scale.set(0.40, 0.24, 0.85);
      frontBulge.position.set(side * 1.40, 0.86, -2.2);
      group.add(frontBulge);

      const rearBulge = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), bodyMaterial);
      rearBulge.scale.set(0.42, 0.24, 1.25);
      rearBulge.position.set(side * 1.40, 0.90, 2.05);
      group.add(rearBulge);

      // Big black side scoop (dihedral-door air intake)
      const scoop = createCarShell([
        { z: -0.55, width: 0.05, topWidth: 0.04, sideY: 0.66, topY: 0.92 },
        { z: 0.20,  width: 0.16, topWidth: 0.12, sideY: 0.62, topY: 0.98 },
        { z: 1.15,  width: 0.20, topWidth: 0.16, sideY: 0.60, topY: 1.00 },
        { z: 1.45,  width: 0.10, topWidth: 0.08, sideY: 0.62, topY: 0.96 },
      ], intakeMaterial, 0.42);
      scoop.position.x = side * 1.44;
      group.add(scoop);

      // Painted blade sweeping over the scoop (door shoulder line)
      const doorBlade = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 2.1), bodyMaterial);
      doorBlade.position.set(side * 1.56, 1.02, 0.35);
      doorBlade.rotation.x = -0.06;
      doorBlade.rotation.y = side * 0.05;
      group.add(doorBlade);

      // Gloss-black side sill
      const sill = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 2.6), carbonMaterial);
      sill.position.set(side * 1.5, 0.36, 0.0);
      group.add(sill);

      // Teardrop painted mirror on a slim stalk
      const mirror = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), bodyMaterial);
      mirror.scale.set(0.2, 0.1, 0.16);
      mirror.position.set(side * 1.34, 1.14, -1.05);
      group.add(mirror);
      const mirrorStem = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.26, 6), carbonMaterial);
      mirrorStem.position.set(side * 1.2, 1.06, -1.05);
      mirrorStem.rotation.z = side * -0.9;
      group.add(mirrorStem);
    }

    // 4. Front: gloss-black aero nose, corner intakes and splitter
    const splitter = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.05, 0.45), carbonMaterial);
    splitter.position.set(0, 0.31, -3.8);
    group.add(splitter);

    const lowerFascia = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.18, 0.3), intakeMaterial);
    lowerFascia.position.set(0, 0.42, -3.86);
    group.add(lowerFascia);

    for (const side of [-1, 1]) {
      // Big black corner intakes ahead of the front wheels
      const cornerIntake = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.22, 0.42), intakeMaterial);
      cornerIntake.position.set(side * 1.1, 0.44, -3.5);
      cornerIntake.rotation.y = side * 0.35;
      group.add(cornerIntake);

      // Painted blade separating nose and intake
      const beak = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.9), bodyMaterial);
      beak.position.set(side * 0.78, 0.58, -3.5);
      beak.rotation.y = side * 0.25;
      group.add(beak);

      // Twin black hood channels
      const hoodVent = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.03, 0.8), intakeMaterial);
      hoodVent.position.set(side * 0.42, 0.78, -2.55);
      hoodVent.rotation.x = -0.14;
      group.add(hoodVent);

      // 5. Swept boomerang LED headlights (two-stroke blade + projector)
      const hlUpper = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.05, 0.1), headlightMaterial);
      hlUpper.position.set(side * 0.98, 0.69, -3.3);
      hlUpper.rotation.y = side * -0.55;
      group.add(hlUpper);

      const hlLower = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.045, 0.08), headlightMaterial);
      hlLower.position.set(side * 0.74, 0.61, -3.44);
      hlLower.rotation.y = side * 0.5;
      group.add(hlLower);

      const hlLens = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), headlightMaterial);
      hlLens.position.set(side * 0.9, 0.66, -3.38);
      group.add(hlLens);
    }

    const dashCluster = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.1, 0.04),
      new THREE.MeshBasicMaterial({ color: 0xff8a3d, toneMapped: false })
    );
    dashCluster.position.set(0, 1.0, -1.15);
    group.add(dashCluster);

    const steeringWheel = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.026, 8, 16), carbonMaterial);
    steeringWheel.position.set(0, 1.0, -1.05);
    steeringWheel.rotation.x = Math.PI / 3;
    group.add(steeringWheel);

    // 6. Rear: thin wraparound taillight, black mesh fascia, diffuser
    const rearMesh = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.36, 0.12), intakeMaterial);
    rearMesh.position.set(0, 0.62, 3.58);
    group.add(rearMesh);

    const tailLightbar = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.05, 0.08), taillightMaterial);
    tailLightbar.position.set(0, 0.84, 3.58);
    group.add(tailLightbar);

    for (const side of [-1, 1]) {
      const tailHook = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.08), taillightMaterial);
      tailHook.position.set(side * 1.24, 0.71, 3.56);
      group.add(tailHook);
    }

    const diffuser = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.2, 0.7), carbonMaterial);
    diffuser.position.set(0, 0.38, 3.35);
    group.add(diffuser);
    for (const x of [-0.75, -0.25, 0.25, 0.75]) {
      const strake = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.28, 0.72), carbonMaterial);
      strake.position.set(x, 0.38, 3.38);
      group.add(strake);
    }

    // Single large centre-exit race exhaust
    const exhausts = [];
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.4, 14), exhaustChrome);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(0, 0.92, 3.5);
    group.add(pipe);
    const flameGlow = new THREE.Mesh(
      new THREE.CircleGeometry(0.11, 12),
      new THREE.MeshBasicMaterial({ color: 0xff7a1a, toneMapped: false })
    );
    flameGlow.position.set(0, 0.92, 3.71);
    group.add(flameGlow);
    for (const side of [-1, 1]) {
      const exMarker = new THREE.Object3D();
      exMarker.position.set(side * 0.06, 0.92, 3.75);
      group.add(exMarker);
      exhausts.push(exMarker);
    }

    // 7. Low integrated rear wing (flush with the tail, painted endplates)
    const wingBlade = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.06, 0.5), carbonMaterial);
    wingBlade.position.set(0, 1.16, 3.2);
    wingBlade.rotation.x = -0.12;
    group.add(wingBlade);
    for (const side of [-1, 1]) {
      const endplate = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.24, 0.6), bodyMaterial);
      endplate.position.set(side * 1.25, 1.06, 3.18);
      group.add(endplate);
    }

    // 8. Articulated 2-Stage Wheel Rig (Zero-Wobble Steer Pivot + Roll Hub + Brembo Calipers)
    const wheels = [];
    const wheelConfigs = [
      { x: -1.64, z: -2.15, isFront: true,  side: -1 },
      { x:  1.64, z: -2.15, isFront: true,  side:  1 },
      { x: -1.66, z:  2.15, isFront: false, side: -1 },
      { x:  1.66, z:  2.15, isFront: false, side:  1 },
    ];

    wheelConfigs.forEach(({ x, z, isFront, side }) => {
      // Base mount positioned at wheel axle center (with -1.5° negative camber for GT race stance)
      const wheelMount = new THREE.Group();
      wheelMount.position.set(x, 0.56, z);
      wheelMount.rotation.z = side * 0.026; // -1.5 deg negative camber

      // 1. STEERING PIVOT NODE (Rotates ONLY on Y axis for steering. NEVER rolls on X!)
      const steerPivot = new THREE.Group();
      wheelMount.add(steerPivot);

      // Fixed Red Racing Brembo Brake Caliper (turns with steering, stays in upper quadrant, does NOT spin with tire)
      const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.16), caliperMat);
      caliper.position.set(side * -0.06, 0.16, 0.12);
      steerPivot.add(caliper);

      // 2. ROLLING HUB NODE (Child of steerPivot, spins ONLY on local X axis!)
      const rollHub = new THREE.Group();
      steerPivot.add(rollHub);

      // High-Performance Racing Slick Tire
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.38, 28), tireMat);
      tire.rotation.z = Math.PI / 2;
      rollHub.add(tire);

      // Satin Anthracite Rim Lip
      const rimLip = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.40, 24), rimLipMat);
      rimLip.rotation.z = Math.PI / 2;
      rollHub.add(rimLip);

      // Polished Billet Center Hub
      const hubCenter = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.42, 16), spokeMat);
      hubCenter.rotation.z = Math.PI / 2;
      rollHub.add(hubCenter);

      // 10-Spoke Forged Racing Alloy Rim
      for (let s = 0; s < 5; s++) {
        // Each bar spans the full rim diameter -> 10 thin spoke arms
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.80, 0.045), spokeMat);
        spoke.rotation.x = (s / 5) * Math.PI;
        spoke.position.x = side * 0.19;
        rollHub.add(spoke);
      }

      // Cross-Drilled Steel Brake Rotor Disc
      const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.06, 20), brakeDiscMat);
      rotor.rotation.z = Math.PI / 2;
      rotor.position.x = side * -0.04;
      rollHub.add(rotor);

      group.add(wheelMount);

      wheels.push({
        mount: wheelMount,
        steerPivot,
        rollHub,
        isFront,
        side,
      });
    });

    // 9. Forward High-Beam Spotlight for the Player
    if (isPlayer) {
      const headSpot = new THREE.SpotLight(0xfff8ee, 35, 80, Math.PI / 4.2, 0.45, 1.2);
      headSpot.position.set(0, 1.2, -2.8);
      const spotTarget = new THREE.Object3D();
      spotTarget.position.set(0, 0, -32);
      group.add(spotTarget);
      headSpot.target = spotTarget;
      group.add(headSpot);
    }

    // 10. Underglow Neon Lighting
    if (underglowColor && underglowColor !== 'off') {
      const underglow = new THREE.PointLight(underglowColor, 8.5, 9.5);
      underglow.position.set(0, 0.30, 0);
      group.add(underglow);
      group.userData.underglow = underglow;
    }

    group.userData.wheels = wheels;
    group.userData.body = body;
    group.userData.exhausts = exhausts;
    return group;
  }

  showGaragePreview(carIndex, customOptions = {}) {
    this.clearVictoryBay();
    this.clearGaragePreview();
    this.clearRaceVehicles();
    const car = CAR_DATA[carIndex] || CAR_DATA[0];
    this.garagePreview = this.createCar(car, false, customOptions);
    this.garagePreview.position.set(0, 0, 0);
    this.world.add(this.garagePreview);

    const key = new THREE.PointLight(0xffdfb8, 65, 55);
    key.position.set(-8, 7, -8);
    const fill = new THREE.PointLight(0x42f5c8, 38, 45);
    fill.position.set(9, 4, 8);
    this.garagePreviewLights = [key, fill];
    this.garagePreviewLights.forEach((l) => this.world.add(l));

    this.camera.position.set(7.5, 3.2, 8.5);
    this.camera.lookAt(0, 0.9, 0);
  }

  clearGaragePreview() {
    if (this.garagePreview) {
      this.world.remove(this.garagePreview);
      disposeObject(this.garagePreview);
      this.garagePreview = null;
    }
    this.garagePreviewLights.forEach((l) => {
      this.world.remove(l);
      l.dispose();
    });
    this.garagePreviewLights = [];
  }

  showVictoryBay(carIndex = 0, customOptions = {}) {
    this.clearVictoryBay();
    this.clearGaragePreview();
    this.clearRaceVehicles();

    this.victoryBayActive = true;
    this.victoryBayGroup = new THREE.Group();

    // 1. Bright sunny sky atmosphere
    this._prevBackground = this.scene.background;
    this._prevFog = this.scene.fog;
    this.scene.background = new THREE.Color(0x3da8eb);
    this.scene.fog = new THREE.FogExp2(0x3da8eb, 0.005);

    // 2. High-noon sunny pit lighting
    const sun = new THREE.DirectionalLight(0xfffae8, 2.6);
    sun.position.set(-10, 18, 12);
    const hemi = new THREE.HemisphereLight(0x5ec4ff, 0x1d2938, 1.8);
    const fill = new THREE.PointLight(0x7fcfff, 2.0, 30);
    fill.position.set(5, 4, 3);
    const carKey = new THREE.PointLight(0xffffff, 2.2, 25);
    carKey.position.set(-5, 5, 5);

    this.victoryBayLights = [sun, hemi, fill, carKey];
    this.victoryBayLights.forEach((l) => this.world.add(l));

    // 3. Asphalt Pit Lane Ground Plane
    const groundGeo = new THREE.PlaneGeometry(80, 80);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x464f56,
      roughness: 0.88,
      metalness: 0.12,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    this.victoryBayGroup.add(ground);

    // White foreground road border stripe
    const roadLineGeo = new THREE.PlaneGeometry(0.35, 40);
    const roadLineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const roadLine = new THREE.Mesh(roadLineGeo, roadLineMat);
    roadLine.rotation.x = -Math.PI / 2;
    roadLine.position.set(0, 0.015, 3.8);
    this.victoryBayGroup.add(roadLine);

    // 4. Yellow Parking Box Markings (exact match to Race Master 3D screenshot)
    const yellowMat = new THREE.MeshBasicMaterial({ color: 0xf5bd02 });
    const yLeft = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 6.4), yellowMat);
    yLeft.position.set(-2.55, 0.012, 0.1);
    const yRight = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 6.4), yellowMat);
    yRight.position.set(2.55, 0.012, 0.1);
    const yRear = new THREE.Mesh(new THREE.BoxGeometry(5.24, 0.02, 0.14), yellowMat);
    yRear.position.set(0, 0.012, 3.25);
    const yFrontL = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.02, 0.14), yellowMat);
    yFrontL.position.set(-2.0, 0.012, -3.05);
    const yFrontR = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.02, 0.14), yellowMat);
    yFrontR.position.set(2.0, 0.012, -3.05);
    this.victoryBayGroup.add(yLeft, yRight, yRear, yFrontL, yFrontR);

    // 5. K-Rail Concrete Highway Barrier (foreground right)
    const barrierMat = new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.65 });
    const barrierBase = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.65, 0.85), barrierMat);
    barrierBase.position.set(4.2, 0.32, 4.4);
    barrierBase.rotation.y = -0.12;
    const barrierTop = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.55, 0.35), barrierMat);
    barrierTop.position.set(4.2, 0.78, 4.4);
    barrierTop.rotation.y = -0.12;
    this.victoryBayGroup.add(barrierBase, barrierTop);

    // 6. Stack of 3 Racing Tires on the left
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x16181b, roughness: 0.88 });
    const tireGeo = new THREE.CylinderGeometry(0.72, 0.72, 0.38, 20);
    const tireStackPos = new THREE.Vector3(-4.4, 0, 0.4);
    for (let i = 0; i < 3; i++) {
      const tire = new THREE.Mesh(tireGeo, tireMat);
      tire.position.set(tireStackPos.x, 0.19 + i * 0.38, tireStackPos.z);
      this.victoryBayGroup.add(tire);
    }

    // 7. Blue & White Striped Oil Drums (behind the tire stack)
    const barrelGeo = new THREE.CylinderGeometry(0.52, 0.52, 1.45, 18);
    const blueMat = new THREE.MeshStandardMaterial({ color: 0x0f56d4, roughness: 0.35 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf0f3f6, roughness: 0.4 });
    const drumPositions = [
      [-4.6, 0.72, -1.6],
      [-3.6, 0.72, -2.2],
    ];
    drumPositions.forEach(([bx, by, bz]) => {
      const drum = new THREE.Mesh(barrelGeo, blueMat);
      drum.position.set(bx, by, bz);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.53, 0.53, 0.42, 18), whiteMat);
      band.position.set(bx, by, bz);
      this.victoryBayGroup.add(drum, band);
    });

    // 8. Pit Crew Mechanics (Red suits, white helmets with black visors)
    const createMechanic = (sitting = false) => {
      const mech = new THREE.Group();
      const suitMat = new THREE.MeshStandardMaterial({ color: 0xd6222b, roughness: 0.55 });
      const whiteClothMat = new THREE.MeshStandardMaterial({ color: 0xf5f8fc, roughness: 0.45 });
      const bootMat = new THREE.MeshStandardMaterial({ color: 0x141618, roughness: 0.85 });
      const helmetMat = new THREE.MeshStandardMaterial({ color: 0xf2f6f9, roughness: 0.25 });
      const visorMat = new THREE.MeshStandardMaterial({ color: 0x0a0c10, metalness: 0.85, roughness: 0.15 });

      if (sitting) {
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.65, 0.32), suitMat);
        torso.position.set(0, 0.55, 0);
        mech.add(torso);
        const harness = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.18, 0.34), whiteClothMat);
        harness.position.set(0, 0.68, 0);
        mech.add(harness);
        const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 14), helmetMat);
        helmet.position.set(0, 1.05, 0);
        mech.add(helmet);
        const visor = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.10, 0.18), visorMat);
        visor.position.set(0.12, 1.05, 0.12);
        mech.add(visor);
        const thighL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.48), suitMat);
        thighL.position.set(-0.14, 0.28, 0.22);
        const thighR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.48), suitMat);
        thighR.position.set(0.14, 0.28, 0.22);
        mech.add(thighL, thighR);
        const shinL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.42, 0.16), bootMat);
        shinL.position.set(-0.14, 0.05, 0.44);
        const shinR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.42, 0.16), bootMat);
        shinR.position.set(0.14, 0.05, 0.44);
        mech.add(shinL, shinR);
        const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.48, 0.14), suitMat);
        armL.position.set(-0.30, 0.42, 0.20);
        armL.rotation.x = -0.4;
        const armR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.48, 0.14), suitMat);
        armR.position.set(0.30, 0.42, 0.20);
        armR.rotation.x = -0.4;
        mech.add(armL, armR);
      } else {
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.72, 0.32), suitMat);
        torso.position.set(0, 1.05, 0);
        mech.add(torso);
        const harness = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.22, 0.34), whiteClothMat);
        harness.position.set(0, 1.20, 0);
        mech.add(harness);
        const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 14), helmetMat);
        helmet.position.set(0, 1.58, 0);
        mech.add(helmet);
        const visor = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.10, 0.16), visorMat);
        visor.position.set(0, 1.58, 0.16);
        mech.add(visor);
        const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.72, 0.20), suitMat);
        legL.position.set(-0.16, 0.36, 0);
        const legR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.72, 0.20), suitMat);
        legR.position.set(0.16, 0.36, 0);
        mech.add(legL, legR);
        const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.58, 0.14), suitMat);
        armL.position.set(-0.35, 1.05, 0.15);
        armL.rotation.x = -0.6;
        const armR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.58, 0.14), suitMat);
        armR.position.set(0.35, 1.05, 0.15);
        armR.rotation.x = -0.6;
        mech.add(armL, armR);
      }
      return mech;
    };

    // Mechanic 1: Sitting on tire stack
    const mechSitting = createMechanic(true);
    mechSitting.position.set(tireStackPos.x + 0.1, 1.14, tireStackPos.z);
    mechSitting.rotation.y = 0.55;
    this.victoryBayGroup.add(mechSitting);

    // Mechanic 2: Standing behind car left
    const mechStanding1 = createMechanic(false);
    mechStanding1.position.set(-1.6, 0, -2.4);
    mechStanding1.rotation.y = 0.25;
    this.victoryBayGroup.add(mechStanding1);

    // Mechanic 3: Standing behind car right
    const mechStanding2 = createMechanic(false);
    mechStanding2.position.set(1.7, 0, -2.4);
    mechStanding2.rotation.y = -0.32;
    this.victoryBayGroup.add(mechStanding2);

    // 9. "RACE MASTER" Illuminated Billboard
    const billboardCanvas = document.createElement('canvas');
    billboardCanvas.width = 512;
    billboardCanvas.height = 700;
    const bCtx = billboardCanvas.getContext('2d');
    const bGrad = bCtx.createLinearGradient(0, 0, 0, 700);
    bGrad.addColorStop(0, '#56b8f8');
    bGrad.addColorStop(1, '#90dbff');
    bCtx.fillStyle = bGrad;
    bCtx.fillRect(0, 0, 512, 700);

    bCtx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    bCtx.beginPath();
    bCtx.moveTo(0, 0);
    bCtx.lineTo(260, 0);
    bCtx.lineTo(90, 700);
    bCtx.lineTo(0, 700);
    bCtx.closePath();
    bCtx.fill();

    bCtx.fillStyle = '#ffffff';
    bCtx.font = 'italic 900 84px sans-serif';
    bCtx.textAlign = 'center';
    bCtx.textBaseline = 'middle';
    bCtx.shadowColor = 'rgba(12, 58, 110, 0.45)';
    bCtx.shadowBlur = 12;
    bCtx.shadowOffsetX = 3;
    bCtx.shadowOffsetY = 4;
    bCtx.fillText('RACE', 256, 270);
    bCtx.fillText('MASTER', 256, 375);

    const bbTex = new THREE.CanvasTexture(billboardCanvas);
    bbTex.colorSpace = THREE.SRGBColorSpace;

    const bbFrameMat = new THREE.MeshStandardMaterial({ color: 0xe5ebee, metalness: 0.6, roughness: 0.3 });
    const bbSignMat = new THREE.MeshBasicMaterial({ map: bbTex });

    const bbGroup = new THREE.Group();
    bbGroup.position.set(2.8, 4.4, -3.2);
    bbGroup.rotation.y = -0.15;

    const bbFrame = new THREE.Mesh(new THREE.BoxGeometry(4.6, 6.2, 0.28), bbFrameMat);
    bbGroup.add(bbFrame);
    const bbFace = new THREE.Mesh(new THREE.PlaneGeometry(4.3, 5.8), bbSignMat);
    bbFace.position.z = 0.15;
    bbGroup.add(bbFace);

    const bbLeg1 = new THREE.Mesh(new THREE.BoxGeometry(0.32, 2.5, 0.32), bbFrameMat);
    bbLeg1.position.set(-1.8, -3.8, 0);
    const bbLeg2 = new THREE.Mesh(new THREE.BoxGeometry(0.32, 2.5, 0.32), bbFrameMat);
    bbLeg2.position.set(1.8, -3.8, 0);
    bbGroup.add(bbLeg1, bbLeg2);

    this.victoryBayGroup.add(bbGroup);

    // 10. Garage Overhead Fascia & Awning Structure
    const fasciaMat = new THREE.MeshStandardMaterial({ color: 0x1f262d, roughness: 0.5 });
    const fasciaStripeMat = new THREE.MeshBasicMaterial({ color: 0xe62e38 });
    const awning = new THREE.Mesh(new THREE.BoxGeometry(18, 1.4, 1.8), fasciaMat);
    awning.position.set(-2.5, 7.2, -4.6);
    const awningStripe = new THREE.Mesh(new THREE.BoxGeometry(18.05, 0.22, 1.85), fasciaStripeMat);
    awningStripe.position.set(-2.5, 7.8, -4.6);
    this.victoryBayGroup.add(awning, awningStripe);

    const colMat = new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.5 });
    for (const cx of [-9, -2.5, 4.2]) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.55, 7.2, 0.55), colMat);
      col.position.set(cx, 3.6, -4.6);
      this.victoryBayGroup.add(col);
    }

    // 11. The Car ("Triumph")
    const car = CAR_DATA[carIndex] || CAR_DATA[0];
    const opts = { ...customOptions, color: customOptions.color || car.color || 0x1856e8 };
    this.victoryCar = this.createCar(car, false, opts);
    this.victoryCar.position.set(0, 0, 0);
    this.victoryCar.rotation.y = -0.38;
    this.victoryBayGroup.add(this.victoryCar);

    this.world.add(this.victoryBayGroup);

    // 12. Frame Camera
    this.camera.position.set(-5.4, 2.1, 4.6);
    this.camera.lookAt(0.2, 0.85, 0);
  }

  clearVictoryBay() {
    this.victoryBayActive = false;
    if (this.victoryBayGroup) {
      this.world.remove(this.victoryBayGroup);
      disposeObject(this.victoryBayGroup);
      this.victoryBayGroup = null;
    }
    if (this.victoryBayLights) {
      this.victoryBayLights.forEach((l) => {
        this.world.remove(l);
        l.dispose();
      });
      this.victoryBayLights = [];
    }
    this.victoryCar = null;
    if (this._prevBackground !== undefined) {
      this.scene.background = this._prevBackground;
      this.scene.fog = this._prevFog;
      this._prevBackground = undefined;
      this._prevFog = undefined;
    }
  }

  clearRaceVehicles() {
    this.running = false;
    this.vehicles.forEach((v) => {
      this.world.remove(v.object);
      disposeObject(v.object);
    });
    this.vehicles = [];
    this.particles.clear();
  }

  startRace(carIndex = 0, trackKey = this.trackKey, upgrades = {}, customOptions = {}, raceOptions = {}) {
    this.clearVictoryBay();
    this.clearGaragePreview();
    this.clearRaceVehicles();
    this.applyTrack(trackKey);

    this.lapsToWin = raceOptions.laps || 3;
    const aiSpeedScale = raceOptions.aiSpeedScale || 1.0;

    const baseData = CAR_DATA[carIndex] || CAR_DATA[0];
    const speedBonus = (upgrades.speed || 0) * 4;
    const handlingBonus = (upgrades.handling || 0) * 4;
    const accelBonus = (upgrades.accel || 0) * 4;
    const nitroBonus = (upgrades.nitro || 0) * 5;

    const playerData = {
      ...baseData,
      isPlayer: true,
      lane: 0,
      progress: 0,
      speedStat: baseData.speed + speedBonus,
      handlingStat: baseData.handling + handlingBonus,
      accelStat: baseData.acceleration + accelBonus,
      nitroStat: baseData.nitroPower + nitroBonus,
    };

    const playerObj = this.createCar(playerData, true, customOptions);
    this.world.add(playerObj);

    this.vehicles = [
      {
        ...playerData,
        object: playerObj,
        speed: 0,
        lane: 0,
        progress: 0,
        verticalOffset: 0,
        verticalVelocity: 0,
        headingAngle: 0,
        slipAngle: 0,
        rollAngle: 0,
        pitchAngle: 0,
        nitro: 1.0,
        nitroActive: false,
        boostPadTimer: 0,
        lap: 1,
        finishedAt: null,
      },
    ];

    // Spawn AI Racers (7 Rivals = 8 Racers Total)
    AI_RACERS.forEach((ai, idx) => {
      const aiObj = this.createCar(ai, false);
      const nameTag = createOpponentNameTag(ai.name, ai.color);
      aiObj.add(nameTag);
      this.world.add(aiObj);
      this.vehicles.push({
        ...ai,
        isPlayer: false,
        object: aiObj,
        nameTag,
        speed: 0,
        lane: idx % 2 === 0 ? -3.2 : 3.2,
        progress: -(idx + 1) * 9.5,
        targetSpeedMultiplier: ai.baseSpeed * aiSpeedScale,
        verticalOffset: 0,
        verticalVelocity: 0,
        headingAngle: 0,
        nitro: 0.5,
        nitroActive: false,
        boostPadTimer: 0,
        lap: 1,
        finishedAt: null,
      });
    });

    this.elapsed = 0;
    this.finished = false;
    this.raceStarted = false;
    this.countdown = 3.0;
    this.totalCountdown = 3.0;
    this._lastCountEmitted = 3;
    this.elapsedCountdown = 0;
    this.wallRecovery = false;
    this.wallBlinkTimer = 0;
    this.wallBlinkTotal = 1.08;
    this.running = true;
    this.driftScore = 0;
    this.driftDistance = 0;
    this.driftCombo = 1;
    this.isDrifting = false;
    this.driftDuration = 0;
    this.keys.clear();
    this.touch.clear();
    this.analogSteer = 0;

    if (this.vehicles[0]?.object) {
      this.vehicles[0].object.visible = true;
    }

    // Position cars on grid and initialize cinematic 3D showcase camera
    this.updateCarPositions(0);
    this._updateCinematicCountdownCamera(0, this.vehicles[0]);

    this.callbacks.onRaceStart?.(TRACKS[this.trackKey]);
    this.callbacks.onCountdown?.(3);
  }

  setKey(key, pressed) {
    if (pressed) this.keys.add(key.toLowerCase());
    else this.keys.delete(key.toLowerCase());
  }

  setTouch(control, pressed) {
    if (pressed) this.touch.add(control);
    else this.touch.delete(control);
  }

  setAnalogSteer(val) {
    this.analogSteer = clamp(val, -1.0, 1.0);
  }

  toggleCamera() {
    this.cameraMode = (this.cameraMode + 1) % 3;
  }

  setQuality(quality) {
    this.quality = quality;
    const pixelRatio = quality === 'low' ? 1.0 : Math.min(window.devicePixelRatio || 1, 1.65);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  _pollGamepad() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of gamepads) {
      if (!gp) continue;
      const deadzone = 0.18;
      const stickX = Math.abs(gp.axes[0]) > deadzone ? gp.axes[0] : 0;
      if (stickX < -0.3) this.keys.add('a'); else this.keys.delete('a');
      if (stickX > 0.3) this.keys.add('d'); else this.keys.delete('d');

      const triggerRT = gp.buttons[7]?.value || (gp.buttons[0]?.pressed ? 1 : 0);
      const triggerLT = gp.buttons[6]?.value || (gp.buttons[2]?.pressed ? 1 : 0);
      const buttonB = gp.buttons[1]?.pressed; // handbrake / drift
      const buttonLB = gp.buttons[4]?.pressed || gp.buttons[3]?.pressed; // nitro

      if (triggerRT > 0.2) this.keys.add('w'); else this.keys.delete('w');
      if (triggerLT > 0.2) this.keys.add('s'); else this.keys.delete('s');
      if (buttonB) this.keys.add(' '); else this.keys.delete(' ');
      if (buttonLB) this.keys.add('shift'); else this.keys.delete('shift');
      break;
    }
  }

  update(dt) {
    if (!this.running || this.finished) return;
    this._pollGamepad();

    if (!this.raceStarted) {
      this.elapsedCountdown = (this.elapsedCountdown || 0) + dt;
      this.countdown -= dt;

      const currentCount = Math.max(0, Math.ceil(this.countdown));
      if (currentCount > 0 && currentCount !== this._lastCountEmitted) {
        this._lastCountEmitted = currentCount;
        this.callbacks.onCountdown?.(currentCount);
      }

      const player = this.vehicles[0];

      // Update vehicle positions on flat road first
      this.updateCarPositions(dt);

      // Add realistic engine idle rumble/vibration to player & AI cars on grid
      if (player && player.object) {
        player.object.position.y = Math.sin(this.elapsedCountdown * 36) * 0.012;
      }
      for (let i = 1; i < this.vehicles.length; i++) {
        const ai = this.vehicles[i];
        if (ai && ai.object) {
          ai.object.position.y = Math.sin(this.elapsedCountdown * 28 + i * 1.3) * 0.008;
        }
      }

      // Smooth cinematic camera showcase orbiting and presenting the 3D car
      this._updateCinematicCountdownCamera(dt, player);

      if (this.countdown <= 0) {
        this.raceStarted = true;
        this.countdown = 0;
        this._lastCountEmitted = 0;
        this.callbacks.onCountdown?.(0);
      }
      return;
    }

    if (this.dashCooldown > 0) this.dashCooldown -= dt;
    if (this.collisionCooldown > 0) this.collisionCooldown -= dt;

    // Slow-Motion Dash Takedown Time Dilation
    if (this.dashSlowMoActive) {
      this.dashSlowMoTimer -= dt;
      if (this.dashSlowMoTimer <= 0) {
        this.dashSlowMoActive = false;
        this.timeScale = 1.0;
        this.callbacks.onDashEnd?.();
      } else {
        this.timeScale = 0.22;
      }
    } else {
      this.timeScale = 1.0;
    }

    const simDt = dt * this.timeScale;

    this.elapsed += simDt;
    this.particles.update(simDt);

    const player = this.vehicles[0];

    // Nitro exhaust flame sparks
    if (player.nitroActive) {
      player.object.userData.exhausts?.forEach((ex) => {
        const wp = new THREE.Vector3();
        ex.getWorldPosition(wp);
        this.particles.spawnSparks(wp, 2, 0x38f5c2);
      });
    }
    const accelerate = this.keys.has('w') || this.keys.has('arrowup') || this.touch.has('accelerate');
    const brake = this.keys.has('s') || this.keys.has('arrowdown') || this.touch.has('brake');
    const steerLeft = this.keys.has('a') || this.keys.has('arrowleft') || this.touch.has('left');
    const steerRight = this.keys.has('d') || this.keys.has('arrowright') || this.touch.has('right');
    const handbrake = this.keys.has(' ') || this.touch.has('drift');
    const nitroPressed = (this.keys.has('shift') || this.touch.has('nitro')) && player.nitro > 0.02 && accelerate;

    // Race-spec hypercar performance: ~330 km/h top speed, ~430 km/h on nitro
    const baseTopSpeed = 70 + player.speedStat * 0.36;
    const accelRate = 30 + player.accelStat * 0.24;
    const turnStrength = 13.5 + player.handlingStat * 0.055;

    // Boost Pad Surge
    if (player.boostPadTimer > 0) {
      player.boostPadTimer -= simDt;
      player.speed = THREE.MathUtils.lerp(player.speed, baseTopSpeed * 1.48, 4.5 * simDt);
    }

    // Acceleration & Braking
    if (accelerate) {
      const recoveryBoost = this.wallRecovery ? 1.45 : 1.0;
      player.speed += accelRate * recoveryBoost * simDt;
    } else {
      player.speed -= 6.5 * simDt; // natural roll deceleration
    }

    if (brake) {
      player.speed -= 35.0 * simDt;
    }

    // Nitro boost
    if (nitroPressed) {
      player.speed += 46 * simDt;
      player.nitro = Math.max(0, player.nitro - 0.32 * simDt);
      player.nitroActive = true;
    } else {
      player.nitro = Math.min(1.0, player.nitro + 0.045 * simDt);
      player.nitroActive = false;
    }

    const topSpeedLimit = baseTopSpeed * (player.nitroActive ? 1.35 : 1.0);
    player.speed = clamp(player.speed, 0, topSpeedLimit);

    // STEERING & DRIFT MECHANICS (Corrected orientation: Left goes Left, Right goes Right)
    let rawSteering = (steerLeft ? 1 : 0) - (steerRight ? 1 : 0);
    if (Math.abs(this.analogSteer) > 0.03) {
      rawSteering = clamp(rawSteering + this.analogSteer, -1.0, 1.0);
    }
    player.visualSteer = lerp(player.visualSteer || 0, rawSteering, 10.0 * simDt);
    const wantsDrift = (handbrake || (brake && Math.abs(rawSteering) > 0.5)) && player.speed > 25;

    if (wantsDrift) {
      this.isDrifting = true;
      this.driftDuration += simDt;
      this.driftDistance = (this.driftDistance || 0) + (player.speed * simDt * 1.35);
      player.slipAngle = lerp(player.slipAngle, rawSteering * 0.38, 6.0 * simDt);
      const pointsGain = Math.round(Math.abs(player.slipAngle) * player.speed * simDt * 80);
      this.driftScore += pointsGain;
      this.driftCombo = Math.min(4, Math.floor(this.driftDuration / 1.0) + 1);

      // Drift recharges nitro
      player.nitro = Math.min(1.0, player.nitro + 0.12 * simDt);

      // Dual Rear Tire Smoke & Friction Sparks
      const carPos = player.object.position;
      const leftTirePos = carPos.clone().add(new THREE.Vector3(-1.1, 0.2, 1.8));
      const rightTirePos = carPos.clone().add(new THREE.Vector3(1.1, 0.2, 1.8));
      this.particles.spawnSmoke(leftTirePos, new THREE.Vector3(rawSteering * 2.5, 0.5, -player.speed * 0.15));
      this.particles.spawnSmoke(rightTirePos, new THREE.Vector3(rawSteering * 2.5, 0.5, -player.speed * 0.15));
      if (Math.abs(player.slipAngle) > 0.15) {
        this.particles.spawnSparks(leftTirePos, 3, 0xffa020);
        this.particles.spawnSparks(rightTirePos, 3, 0xffbb20);
      }
    } else {
      if (this.isDrifting) {
        const dist = Math.round(this.driftDistance || 0);
        if (dist > 15) {
          this.callbacks.onDriftComplete?.(dist);
        }
      }
      this.isDrifting = false;
      this.driftDuration = 0;
      this.driftDistance = 0;
      this.driftCombo = 1;
      player.slipAngle = lerp(player.slipAngle, 0, 8.0 * simDt);
    }

    // 100% USER-CONTROLLED MANUAL STEERING
    const steerSpeedFactor = clamp(player.speed / 16.0, 0.0, 1.0);
    const userTurnIntent = rawSteering * turnStrength * steerSpeedFactor;

    player.lane += userTurnIntent * simDt;

    const maxRoadLane = ROAD_HALF_WIDTH - 2.2;

    // Detect when car touches the side barrier
    if (!this.wallRecovery && Math.abs(player.lane) >= maxRoadLane) {
      const hitSide = Math.sign(player.lane) || 1;

      // 1. Immediately stop the car's speed
      player.speed = 0;
      player.nitroActive = false;

      // Reset drift on collision
      this.isDrifting = false;
      this.driftDuration = 0;
      this.driftDistance = 0;
      player.slipAngle = 0;

      // 2. Reposition car slightly inward from that place onwards
      player.lane = hitSide * (maxRoadLane - 0.45);

      // 3. Initiate 3-blink recovery sequence
      this.wallRecovery = true;
      this.wallBlinkTimer = 1.08;
      this.wallBlinkTotal = 1.08;

      // Screen shake and barrier impact sparks
      this.cameraShake = 0.55;
      const hitSparksPos = player.object.position.clone();
      this.particles.spawnSparks(hitSparksPos, 22, 0xff9922);

      // Trigger audio & toast callbacks
      this.callbacks.onWallHit?.(hitSide > 0 ? 'right' : 'left');
    }

    // Clamp lane boundary
    player.lane = clamp(player.lane, -maxRoadLane, maxRoadLane);

    // Update 3-blink recovery sequence
    if (this.wallRecovery) {
      this.wallBlinkTimer -= dt;
      const progress = 1.0 - Math.max(0, this.wallBlinkTimer / (this.wallBlinkTotal || 1.08));
      const phase = Math.floor(progress * 6);

      player.object.visible = (phase % 2 === 1);

      if (this.wallBlinkTimer <= 0) {
        this.wallRecovery = false;
        this.wallBlinkTimer = 0;
        player.object.visible = true;
      }
    } else {
      player.object.visible = true;
    }

    // Progress continues from that place onwards
    player.progress += player.speed * simDt;

    // AI Racers simulation (in slow motion during dash)
    this._simulateAI(simDt);

    // Interactive Items check
    this._checkTrackItems(player, simDt);

    // Collisions
    this.resolveCollisions();

    // 3D placement, suspension roll & pitch
    this.updateCarPositions(simDt);

    // Camera follow & shake (smooth 60fps tracking using real unscaled dt)
    this._updateCamera(dt, player);

    // Lap & State callbacks
    const currentLap = Math.min(this.lapsToWin, Math.floor(player.progress / this.trackLength) + 1);
    if (currentLap > player.lap && currentLap <= this.lapsToWin) {
      player.lap = currentLap;
      this.callbacks.onLap?.(currentLap);
    }

    const pos = this.getPosition(player);
    const speedKmh = Math.round(player.speed * 3.2);

    this.callbacks.onUpdate?.({
      time: this.elapsed,
      lap: currentLap,
      totalLaps: this.lapsToWin,
      position: pos,
      speed: speedKmh,
      nitro: player.nitro,
      nitroActive: player.nitroActive,
      isDrifting: this.isDrifting,
      driftScore: this.driftScore,
      driftDistance: Math.round(this.driftDistance || 0),
      driftCombo: this.driftCombo,
      cameraMode: this.cameraMode,
      isSlowMo: this.dashSlowMoActive,
      minimapPlayer: this.trackSpline.toMinimapCoord(player.object.position),
      minimapAI: this.vehicles.slice(1).map((ai) => ({
        coord: this.trackSpline.toMinimapCoord(ai.object.position),
        color: ai.color,
      })),
      trackMinimapPoints: this.trackSpline.minimapPoints,
    });

    if (player.progress >= this.trackLength * this.lapsToWin) {
      this.finishRace();
    }
  }

  _simulateAI(dt) {
    const len = this.trackLength;
    this.vehicles.slice(1).forEach((ai, i) => {
      const sample = this.trackSpline.sampleAtProgress(ai.progress);
      // AI slows slightly around heavy curves
      const curveSlowdown = 1.0 - clamp(sample.curvature * 0.12, 0, 0.35);
      const targetSpeed = (92 + i * 2.8) * ai.targetSpeedMultiplier * curveSlowdown;

      ai.speed = lerp(ai.speed, targetSpeed, 2.2 * dt);
      ai.progress += ai.speed * dt;

      // Smart lane wandering / racing line
      const targetLane = ai.personality === 'apex' ? -sample.bank * 18 : ai.lanePref;
      ai.lane = lerp(ai.lane, targetLane + Math.sin(this.elapsed * 0.8 + i) * 1.5, 1.2 * dt);
      ai.lane = clamp(ai.lane, -(ROAD_HALF_WIDTH - 2.8), (ROAD_HALF_WIDTH - 2.8));
    });
  }

  _checkTrackItems() {
    // Plain clean road: no obstacles or pickups in the middle of the road
  }

  resolveCollisions() {
    const player = this.vehicles[0];
    this.vehicles.slice(1).forEach((ai) => {
      let sep = ai.progress - player.progress;
      while (sep > this.trackLength / 2) sep -= this.trackLength;
      while (sep < -this.trackLength / 2) sep += this.trackLength;

      const laneGap = Math.abs(ai.lane - player.lane);
      if (Math.abs(sep) < 4.8 && laneGap < 3.4) {
        const dir = player.lane <= ai.lane ? -1 : 1;

        // CINEMATIC DASH TAKEDOWN TRIGGER:
        // When player rams/sideswipes an AI racer at speed
        if ((!this.dashCooldown || this.dashCooldown <= 0) && player.speed > 16) {
          this.triggerDashTakedown(player, ai, dir);
        } else {
          player.lane = clamp(player.lane + dir * 2.4, -(ROAD_HALF_WIDTH - 2.2), (ROAD_HALF_WIDTH - 2.2));
          ai.lane = clamp(ai.lane - dir * 1.8, -(ROAD_HALF_WIDTH - 2.2), (ROAD_HALF_WIDTH - 2.2));
          player.speed = Math.max(12, player.speed * 0.76);
          this.cameraShake = 0.35;
          this.particles.spawnSparks(player.object.position, 8, 0xffbb40);
          if (!this.collisionCooldown || this.collisionCooldown <= 0) {
            this.collisionCooldown = 0.55;
            this.callbacks.onCollision?.('car');
          }
        }
      }
    });
  }

  // CINEMATIC SLOW-MOTION DASH TAKEDOWN SCENE
  triggerDashTakedown(player, ai, dir) {
    this.dashSlowMoActive = true;
    this.dashSlowMoDuration = 1.35;
    this.dashSlowMoTimer = 1.35;
    this.dashTargetCar = ai;
    this.dashImpactDir = dir;
    this.dashCooldown = 2.8;
    this.timeScale = 0.22;
    this.cameraShake = 0.65;

    // Player reward & adrenaline surge boost
    player.nitro = 1.0;
    player.nitroActive = true;
    player.speed = Math.max(player.speed, 92);
    player.lane = clamp(player.lane + dir * 1.6, -(ROAD_HALF_WIDTH - 2.2), (ROAD_HALF_WIDTH - 2.2));

    // Opponent knocked outward, tilts onto 2 wheels and spins out 360°
    ai.spinVelocity = -dir * 11.0;
    ai.tiltAngle = dir * 0.45;
    ai.speed = Math.max(8, ai.speed * 0.35);
    ai.lane = clamp(ai.lane - dir * 4.2, -(ROAD_HALF_WIDTH - 2.0), (ROAD_HALF_WIDTH - 2.0));

    // Massive spark shower & debris at contact point
    const contactPos = player.object.position.clone().add(ai.object.position).multiplyScalar(0.5);
    contactPos.y = 0.5;
    this.particles.spawnSparks(contactPos, 28, 0xffdf40);
    this.particles.spawnSparks(contactPos, 16, 0xff3838);
    this.particles.spawnSmoke(contactPos, new THREE.Vector3(dir * 2.5, 0.8, -player.speed * 0.1));

    // Trigger HUD and slow-motion takedown sound
    this.callbacks.onDashTakedown?.({
      target: ai.name || 'RIVAL',
      coins: 250,
    });
  }

  getPosition(player) {
    return 1 + this.vehicles.slice(1).filter((v) => v.progress > player.progress).length;
  }

  updateCarPositions(dt) {
    this.vehicles.forEach((v) => {
      const { center, tangent, normal } = this.trackSpline.sampleAtProgress(v.progress);
      const pos = center.clone().addScaledVector(normal, v.lane);

      const yaw = Math.atan2(tangent.x, tangent.z) + Math.PI;
      const userSteerAngle = v.isPlayer ? ((v.visualSteer || 0) * 0.24 - (v.slipAngle || 0) * 0.45) : 0;
      const steerRoll = v.isPlayer ? ((v.visualSteer || 0) * 0.04 + (v.slipAngle || 0) * 0.20) : 0;

      // Spinout & two-wheel tilt physics for takedowns
      if (v.spinVelocity) {
        v.spinAngle = (v.spinAngle || 0) + v.spinVelocity * dt;
        v.spinVelocity = lerp(v.spinVelocity, 0, 1.8 * dt);
        if (Math.abs(v.spinVelocity) < 0.05) v.spinVelocity = 0;
      }
      if (v.tiltAngle) {
        v.tiltAngle = lerp(v.tiltAngle, 0, 2.2 * dt);
        if (Math.abs(v.tiltAngle) < 0.01) v.tiltAngle = 0;
      }

      const roll = v.isPlayer ? steerRoll : (v.tiltAngle || 0);
      const totalYaw = yaw + userSteerAngle + (v.spinAngle || 0);

      // Lift slightly if tilted onto two wheels
      const liftY = Math.abs(v.tiltAngle || 0) * 0.55;
      v.object.position.set(pos.x, liftY, pos.z);
      v.object.rotation.set(0, totalYaw, roll);

      // High-precision articulated wheel kinematics (Zero wobble, pure steer + roll)
      if (v.object.userData.wheels) {
        v.object.userData.wheels.forEach((w) => {
          // 1. Steering rotation on vertical Y axis (ONLY for front steerPivot)
          if (w.steerPivot && w.isFront) {
            const steerTarget = v.isPlayer ? (v.visualSteer || 0) * 0.40 : 0;
            w.steerPivot.rotation.y = lerp(w.steerPivot.rotation.y, steerTarget, 18.0 * dt);
          }
          // 2. Pure forward rolling rotation on local X axis (ONLY on rollHub)
          if (w.rollHub) {
            w.rollHub.rotation.x += v.speed * dt * 0.38;
          }
        });
      }
    });
  }

  _updateCinematicCountdownCamera(dt, player) {
    if (!player || !player.object || !this.trackSpline) return;

    const { tangent } = this.trackSpline.sampleAtProgress(player.progress);
    const carPos = player.object.position;

    // Countdown runs from 3.0 down to 0.0
    const total = this.totalCountdown || 3.0;
    const t = Math.max(0, Math.min(total, total - this.countdown));
    const p = Math.max(0, Math.min(1, t / total)); // 0.0 to 1.0

    // Smoothstep interpolation (0.0 to 1.0)
    const s = p * p * (3 - 2 * p);

    // Starting Grid Countdown Animation:
    // Centered directly behind the car, perfectly aligned with the road ahead.
    // Starts at an elevated starting grid crane view (y = 6.2, back = 16.5)
    // Smoothly descends along the centerline into the race chase view (y = 4.8, back = 13.5)
    // Zero lateral swing to the left or right! Perfectly aligned for race launch.
    const camBack = lerp(16.5, 13.5, s);
    const camY = lerp(6.2, 4.8, s);

    const targetCamPos = carPos.clone().addScaledVector(tangent, -camBack);
    targetCamPos.y = camY;

    const targetLookAt = carPos.clone().addScaledVector(tangent, 12.0);
    targetLookAt.y = lerp(1.0, 1.2, s);

    this.camera.position.copy(targetCamPos);
    this.camera.lookAt(targetLookAt);

    // Smoothly blend FOV from 62° down to standard chase 54°
    this.camera.fov = lerp(62, 54, s);
    this.camera.updateProjectionMatrix();
  }

  _updateCamera(dt, player) {
    const { tangent, normal } = this.trackSpline.sampleAtProgress(player.progress);
    const carPos = player.object.position;

    // CINEMATIC ELEVATED DASH TAKEDOWN CAMERA ("slow motion like an elevation")
    if (this.dashSlowMoActive) {
      const p = Math.max(0, Math.min(1, 1.0 - (this.dashSlowMoTimer / this.dashSlowMoDuration)));
      // Smooth bell curve elevation peak (rises up high, holds, and returns gracefully)
      const elevationPeak = Math.sin(p * Math.PI);

      // Elevated spectator crane shot: rises from 4.8m up to 8.8m in the air!
      const camY = lerp(4.8, 8.8, elevationPeak);
      // Lateral swing out sideways to frame both cars dynamically
      const lateralSwing = this.dashImpactDir * lerp(0, 5.2, elevationPeak);
      // Camera distance slightly pulls back and angles down
      const camBack = lerp(13.5, 11.5, elevationPeak);

      const targetCamPos = carPos.clone()
        .addScaledVector(tangent, -camBack)
        .addScaledVector(normal, lateralSwing);
      targetCamPos.y = camY;

      // Smooth cinematic camera tracking (unscaled dt for 60fps butter smoothness)
      this.camera.position.lerp(targetCamPos, 1 - Math.exp(-dt * 6.5));

      // Dynamic screen shake on initial hit
      if (this.cameraShake > 0) {
        this.camera.position.x += (Math.random() - 0.5) * this.cameraShake;
        this.camera.position.y += (Math.random() - 0.5) * this.cameraShake;
        this.cameraShake = Math.max(0, this.cameraShake - 1.8 * dt);
      }

      // Look down at the dramatic collision focal point between player and dashed rival
      let focusPoint = carPos.clone();
      if (this.dashTargetCar && this.dashTargetCar.object) {
        focusPoint.lerp(this.dashTargetCar.object.position, 0.45);
      }
      focusPoint.y = 1.0;
      this.camera.lookAt(focusPoint);

      // Cinematic FOV zoom (compresses the slow-mo action)
      this.camera.fov = lerp(54, 46, elevationPeak);
      this.camera.updateProjectionMatrix();
      return;
    }

    // FOV expands dynamically when boosting
    const targetFov = (player.nitroActive ? 70 : 54) + clamp(player.speed / 110, 0, 1) * 6;
    this.camera.fov = lerp(this.camera.fov, targetFov, 5.0 * dt);
    this.camera.updateProjectionMatrix();

    if (this.cameraMode === 0) {
      // Dynamic Chase Cam on plain flat road
      const lagBack = 13.5 + (player.speed / 90) * 3.5;
      const camTarget = carPos.clone().addScaledVector(tangent, -lagBack);
      camTarget.y = 4.8;

      this.camera.position.lerp(camTarget, 1 - Math.exp(-dt * 4.2));

      // Screen shake
      if (this.cameraShake > 0) {
        this.camera.position.x += (Math.random() - 0.5) * this.cameraShake;
        this.camera.position.y += (Math.random() - 0.5) * this.cameraShake;
        this.cameraShake = Math.max(0, this.cameraShake - 1.8 * dt);
      }

      const lookTarget = carPos.clone().addScaledVector(tangent, 12);
      lookTarget.y = 1.2;
      this.camera.lookAt(lookTarget);
    } else if (this.cameraMode === 1) {
      // Hood / Cockpit Cam
      const hoodPos = carPos.clone().addScaledVector(tangent, 1.8);
      hoodPos.y = 1.45;
      this.camera.position.copy(hoodPos);
      const lookTarget = carPos.clone().addScaledVector(tangent, 28);
      lookTarget.y = 1.0;
      this.camera.lookAt(lookTarget);
    } else {
      // Bumper Cam (Low pavement view)
      const bumperPos = carPos.clone().addScaledVector(tangent, 3.2);
      bumperPos.y = 0.65;
      this.camera.position.copy(bumperPos);
      const lookTarget = carPos.clone().addScaledVector(tangent, 32);
      lookTarget.y = 0.5;
      this.camera.lookAt(lookTarget);
    }
  }

  finishRace() {
    this.finished = true;
    this.running = false;
    this.wallRecovery = false;
    this.wallBlinkTimer = 0;
    if (this.vehicles[0]?.object) {
      this.vehicles[0].object.visible = true;
    }
    const standings = [...this.vehicles].sort((a, b) => b.progress - a.progress)
      .map((v, i) => ({
        name: v.name,
        isPlayer: v.isPlayer,
        position: i + 1,
        score: [150, 120, 95, 75, 55, 40, 25, 10][i] || 10,
        credits: [2500, 1800, 1200, 800, 500, 350, 250, 150][i] || 100,
      }));

    this.callbacks.onFinish?.({
      time: this.elapsed,
      standings,
      winner: standings[0].name,
      won: standings[0].isPlayer,
      driftBonus: Math.round(this.driftScore * 0.5),
    });
  }

  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.04);
    if (this.running) {
      this.update(dt);
    } else if (this.victoryBayActive) {
      // Gentle cinematic breathing camera sway in Race Master victory bay
      const t = this.clock.getElapsedTime();
      this.camera.position.set(
        -5.4 + Math.sin(t * 0.75) * 0.08,
        2.1 + Math.cos(t * 0.55) * 0.04,
        4.6 + Math.cos(t * 0.75) * 0.06
      );
      this.camera.lookAt(0.2, 0.85, 0);
    } else if (this.garagePreview) {
      // Smooth car turntable rotation in Garage
      this.garagePreview.rotation.y += 0.55 * dt;
    } else if (this.trackSpline) {
      // Cinematic camera orbit over track when on main menu
      this.menuOrbitAngle = (this.menuOrbitAngle || 0) + 0.16 * dt;
      const { center } = this.trackSpline.sampleAtProgress(this.trackLength * 0.08);
      this.camera.position.set(
        center.x + Math.sin(this.menuOrbitAngle) * 42,
        center.y + 16 + Math.sin(this.menuOrbitAngle * 0.5) * 3,
        center.z + Math.cos(this.menuOrbitAngle) * 42,
      );
      this.camera.lookAt(center.x, center.y + 2, center.z);
    }
    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    const width = (this.container && this.container.clientWidth > 0) ? this.container.clientWidth : window.innerWidth;
    const height = (this.container && this.container.clientHeight > 0) ? this.container.clientHeight : window.innerHeight;
    this.camera.aspect = width / (height || 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  dispose() {
    this.clearVictoryBay();
    this.renderer.setAnimationLoop(null);
    this.renderer.dispose();
    this.particles.dispose();
    window.removeEventListener('resize', this._resize);
    window.removeEventListener('orientationchange', this._resize);
    document.removeEventListener('fullscreenchange', this._resize);
    document.removeEventListener('webkitfullscreenchange', this._resize);
  }
}
