import * as THREE from 'three';
import { TRACKS, TrackSpline, generateTrackFeatures, ROAD_HALF_WIDTH } from './tracks.js';
import { ParticleSystem } from './particles.js';

export const CAR_DATA = [
  {
    id: 'triumph',
    name: 'GT 86',
    tagline: 'Toyota-style sport coupe. Balanced, lightweight, built to race.',
    category: 'SPORT',
    color: 0x0099ff, // Electric cyan-blue matching Toyota GT86
    underglow: 0x00d4ff,
    speed: 88,
    handling: 94,
    acceleration: 88,
    nitroPower: 85,
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
  object.traverse((part) => {
    if (part.geometry) geometries.add(part.geometry);
    if (Array.isArray(part.material)) part.material.forEach((mat) => materials.add(mat));
    else if (part.material) materials.add(part.material);
  });
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

  _buildDecorations(config) {
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
    const shape = data.shape || 0;

    // Premium Automotive Finishes
    const bodyMaterial = new THREE.MeshPhysicalMaterial({
      color: carColor,
      metalness: 0.72,
      roughness: 0.18,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      emissive: carColor,
      emissiveIntensity: 0.03,
    });
    const carbonMaterial = new THREE.MeshStandardMaterial({
      color: 0x101316,
      metalness: 0.7,
      roughness: 0.28,
    });
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x0c1a24,
      metalness: 0.6,
      roughness: 0.08,
      transparent: true,
      opacity: 0.94,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
    });
    const headlightMaterial = new THREE.MeshStandardMaterial({
      color: 0xe8f9ff,
      emissive: 0x9beeff,
      emissiveIntensity: 2.8,
    });
    const taillightMaterial = new THREE.MeshStandardMaterial({
      color: 0xff0d25,
      emissive: 0xff0a22,
      emissiveIntensity: 2.4,
    });
    const exhaustChrome = new THREE.MeshStandardMaterial({
      color: 0xd8e0e4,
      metalness: 0.95,
      roughness: 0.15,
    });
    const caliperMat = new THREE.MeshStandardMaterial({
      color: 0xff281e,
      roughness: 0.35,
    });
    const brakeDiscMat = new THREE.MeshStandardMaterial({
      color: 0x889296,
      metalness: 0.88,
      roughness: 0.25,
    });

    // 1. Sleek Supercar Main Monocoque Shell
    const body = createCarShell([
      { z: -3.85, width: 0.58, topWidth: 0.28, sideY: 0.52, topY: 0.68 },
      { z: -3.35, width: 1.34, topWidth: 0.85, sideY: 0.55, topY: 0.84 },
      { z: -2.35, width: 1.76, topWidth: 1.38, sideY: 0.58, topY: 1.04 },
      { z: -1.25, width: 1.88, topWidth: 1.62, sideY: 0.62, topY: 1.15 },
      { z: 0.35, width: 1.84, topWidth: 1.56, sideY: 0.62, topY: 1.20 },
      { z: 1.75, width: 1.90, topWidth: 1.60, sideY: 0.60, topY: 1.12 },
      { z: 2.75, width: 1.82, topWidth: 1.48, sideY: 0.60, topY: 1.02 },
      { z: 3.45, width: 1.42, topWidth: 1.05, sideY: 0.62, topY: 0.88 },
      { z: 3.75, width: 0.82, topWidth: 0.52, sideY: 0.64, topY: 0.78 },
    ], bodyMaterial, 0.38);
    group.add(body);

    // 2. Aerodynamic Teardrop Cockpit Canopy
    const canopy = createCarShell([
      { z: -2.25, width: 0.84, topWidth: 0.72, sideY: 0.98, topY: 1.02 },
      { z: -1.45, width: 1.04, topWidth: 0.88, sideY: 1.04, topY: 1.58 },
      { z: -0.75, width: 1.05, topWidth: 0.90, sideY: 1.06, topY: 1.82 },
      { z: 0.38, width: 1.06, topWidth: 0.92, sideY: 1.06, topY: 1.85 },
      { z: 1.25, width: 0.94, topWidth: 0.82, sideY: 1.04, topY: 1.58 },
      { z: 1.85, width: 0.74, topWidth: 0.62, sideY: 0.98, topY: 1.12 },
    ], glassMaterial, 0.98);
    group.add(canopy);

    // 3. Carbon Fiber Aerodynamics (Front Splitter, Side Blades, Rear Diffuser)
    const splitter = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.08, 0.85), carbonMaterial);
    splitter.position.set(0, 0.38, -3.55);
    group.add(splitter);

    // Corner canards/winglets on front splitter
    for (const side of [-1, 1]) {
      const canard = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.04, 0.45), carbonMaterial);
      canard.position.set(side * 1.52, 0.45, -3.35);
      canard.rotation.z = side * -0.22;
      group.add(canard);

      // Muscular Side Skirts / Air Intake Scoops
      const sideBlade = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 2.8), carbonMaterial);
      sideBlade.position.set(side * 1.86, 0.42, 0.2);
      group.add(sideBlade);

      const sideScoop = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.45, 0.85), carbonMaterial);
      sideScoop.position.set(side * 1.82, 0.82, 1.15);
      sideScoop.rotation.y = side * -0.15;
      group.add(sideScoop);

      // Sleek Racing Side Mirrors (Gloss Black Carbon matching GT86)
      const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.22), carbonMaterial);
      mirror.position.set(side * 1.48, 1.24, -0.85);
      mirror.rotation.y = side * 0.18;
      group.add(mirror);
      const mirrorStem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.24, 6), carbonMaterial);
      mirrorStem.position.set(side * 1.32, 1.14, -0.85);
      mirrorStem.rotation.z = side * -0.55;
      group.add(mirrorStem);
    }

    // Carbon Hood Extractor Louvers
    const hoodVent = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.04, 0.72), carbonMaterial);
    hoodVent.position.set(0, 0.98, -2.15);
    hoodVent.rotation.x = -0.14;
    group.add(hoodVent);

    // 4. Rear Aerodynamic Diffuser & Strakes
    const diffuser = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.26, 0.75), carbonMaterial);
    diffuser.position.set(0, 0.44, 3.42);
    group.add(diffuser);
    for (const x of [-0.85, -0.28, 0.28, 0.85]) {
      const strake = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.32, 0.78), carbonMaterial);
      strake.position.set(x, 0.44, 3.42);
      group.add(strake);
    }

    // F1-style rain/strobe center light on diffuser
    const rainLight = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.06), taillightMaterial);
    rainLight.position.set(0, 0.42, 3.82);
    group.add(rainLight);

    // 5. Rear Lighting & Badging
    if (shape === 0) {
      // Toyota GT 86 signature twin angular taillights with circular LED projectors
      for (const side of [-1, 1]) {
        // Red outer triangular housing
        const tailHousing = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.22, 0.15), taillightMaterial);
        tailHousing.position.set(side * 1.14, 0.93, 3.65);
        tailHousing.rotation.y = side * 0.18;
        tailHousing.rotation.z = side * 0.06;
        group.add(tailHousing);

        // Circular inner LED projector ring
        const innerLed = new THREE.Mesh(
          new THREE.CylinderGeometry(0.085, 0.085, 0.16, 16),
          new THREE.MeshStandardMaterial({ color: 0xff3b4d, emissive: 0xff1e32, emissiveIntensity: 3.5 })
        );
        innerLed.rotation.x = Math.PI / 2;
        innerLed.position.set(side * 1.08, 0.93, 3.67);
        group.add(innerLed);

        // White reverse/indicator pod
        const revPod = new THREE.Mesh(
          new THREE.BoxGeometry(0.18, 0.08, 0.16),
          new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xe0f7ff, emissiveIntensity: 2.2 })
        );
        revPod.position.set(side * 1.28, 0.90, 3.66);
        group.add(revPod);
      }

      // Rear white license plate stamped 'GT 86'
      const rearPlateCanvas = document.createElement('canvas');
      rearPlateCanvas.width = 256;
      rearPlateCanvas.height = 64;
      const rpctx = rearPlateCanvas.getContext('2d');
      if (rpctx) {
        rpctx.fillStyle = '#f0f3f6';
        rpctx.fillRect(0, 0, 256, 64);
        rpctx.strokeStyle = '#1b2229';
        rpctx.lineWidth = 6;
        rpctx.strokeRect(4, 4, 248, 56);
        rpctx.fillStyle = '#0a0d10';
        rpctx.font = 'bold 36px sans-serif';
        rpctx.textAlign = 'center';
        rpctx.textBaseline = 'middle';
        rpctx.fillText('GT 86', 128, 34);
        const rearPlateTex = new THREE.CanvasTexture(rearPlateCanvas);
        const rearPlateMat = new THREE.MeshBasicMaterial({ map: rearPlateTex });
        const rearPlateMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.22), rearPlateMat);
        rearPlateMesh.position.set(0, 0.78, 3.74);
        group.add(rearPlateMesh);
      }

      // Toyota chrome oval badge on trunk and nose
      const badgeMat = new THREE.MeshStandardMaterial({ color: 0xeef4f8, metalness: 0.95, roughness: 0.1 });
      const rearBadge = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 16), badgeMat);
      rearBadge.rotation.x = -Math.PI / 2.3;
      rearBadge.position.set(0, 0.96, 3.65);
      group.add(rearBadge);

      const frontBadge = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 16), badgeMat);
      frontBadge.rotation.x = Math.PI / 2.3;
      frontBadge.position.set(0, 0.74, -3.72);
      group.add(frontBadge);
    } else {
      const tailBar = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.11, 0.08), taillightMaterial);
      tailBar.position.set(0, 0.92, 3.65);
      group.add(tailBar);
    }

    // Angled Front LED Projector Headlights
    if (shape === 0) {
      // Toyota GT 86 signature styling (photo ea22983a.jpg)
      // Front lower wide trapezoid grille
      const frontGrille = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.32, 0.15), carbonMaterial);
      frontGrille.position.set(0, 0.44, -3.76);
      group.add(frontGrille);

      // Front white license plate stamped 'GT 86'
      const plateCanvas = document.createElement('canvas');
      plateCanvas.width = 256;
      plateCanvas.height = 64;
      const pctx = plateCanvas.getContext('2d');
      if (pctx) {
        pctx.fillStyle = '#f0f3f6';
        pctx.fillRect(0, 0, 256, 64);
        pctx.strokeStyle = '#1b2229';
        pctx.lineWidth = 6;
        pctx.strokeRect(4, 4, 248, 56);
        pctx.fillStyle = '#0a0d10';
        pctx.font = 'bold 36px sans-serif';
        pctx.textAlign = 'center';
        pctx.textBaseline = 'middle';
        pctx.fillText('GT 86', 128, 34);
        const plateTex = new THREE.CanvasTexture(plateCanvas);
        const plateMat = new THREE.MeshBasicMaterial({ map: plateTex });
        const plateMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.22), plateMat);
        plateMesh.position.set(0, 0.52, -3.88);
        group.add(plateMesh);
      }

      for (const side of [-1, 1]) {
        // Sweeping angular headlight housing & projector
        const hl = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.14, 1.25), headlightMaterial);
        hl.position.set(side * 1.18, 0.85, -2.85);
        hl.rotation.y = side * -0.32;
        hl.rotation.x = -0.16;
        hl.rotation.z = side * -0.14;
        group.add(hl);

        // Lower front air intake scoop
        const intake = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.22, 0.22), carbonMaterial);
        intake.position.set(side * 0.72, 0.44, -3.70);
        group.add(intake);

        const fog = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 12), headlightMaterial);
        fog.rotation.x = Math.PI / 2;
        fog.position.set(side * 1.14, 0.45, -3.58);
        group.add(fog);
      }
    } else {
      for (const side of [-1, 1]) {
        const headlight = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.12, 0.14), headlightMaterial);
        headlight.position.set(side * 1.15, 0.84, -3.25);
        headlight.rotation.y = side * -0.25;
        headlight.rotation.z = side * -0.08;
        group.add(headlight);
      }
    }

    // 6. Quad Chrome Exhaust Tips with Glowing Interior
    const exhausts = [];
    for (const side of [-1, 1]) {
      for (const offset of [0.42, 0.72]) {
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.45, 12), exhaustChrome);
        pipe.rotation.x = Math.PI / 2;
        pipe.position.set(side * offset, 0.68, 3.72);
        group.add(pipe);

        const nozzleGlow = new THREE.Mesh(new THREE.CircleGeometry(0.08, 8), taillightMaterial);
        nozzleGlow.position.set(side * offset, 0.68, 3.94);
        group.add(nozzleGlow);
      }
      const exMarker = new THREE.Object3D();
      exMarker.position.set(side * 0.58, 0.68, 3.95);
      group.add(exMarker);
      exhausts.push(exMarker);
    }

    // 7. Race GT Wing Spoiler Variants
    if (shape === 4) {
      // Raptor X Prototype: LMP Central Shark Fin + Swan-Neck Wing
      const sharkFin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.75, 2.2), carbonMaterial);
      sharkFin.position.set(0, 1.82, 1.45);
      group.add(sharkFin);

      const wingBlade = new THREE.Mesh(new THREE.BoxGeometry(3.05, 0.09, 0.52), carbonMaterial);
      wingBlade.position.set(0, 1.76, 3.15);
      group.add(wingBlade);
      for (const side of [-1, 1]) {
        const endplate = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.46, 0.65), bodyMaterial);
        endplate.position.set(side * 1.52, 1.76, 3.15);
        group.add(endplate);
        const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.65, 0.16), carbonMaterial);
        pylon.position.set(side * 0.88, 1.46, 3.12);
        group.add(pylon);
      }
    } else if (shape === 1 || shape === 2) {
      // Pulse R / Nightfall: Aggressive Dual-Element GT Wing
      const wingBlade = new THREE.Mesh(new THREE.BoxGeometry(2.75, 0.09, 0.44), carbonMaterial);
      wingBlade.position.set(0, 1.62, 3.22);
      group.add(wingBlade);
      for (const side of [-1, 1]) {
        const endplate = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.38, 0.55), bodyMaterial);
        endplate.position.set(side * 1.38, 1.62, 3.22);
        group.add(endplate);
        const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 0.14), carbonMaterial);
        pylon.position.set(side * 0.78, 1.34, 3.18);
        group.add(pylon);
      }
    } else if (shape === 3) {
      // Solstice: Integrated Active Aero Ducktail Spoiler
      const ducktail = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.16, 0.38), bodyMaterial);
      ducktail.position.set(0, 1.15, 3.32);
      ducktail.rotation.x = 0.25;
      group.add(ducktail);
    } else if (shape === 0) {
      // Toyota GT 86 Elevated Sports Wing Spoiler (exact match to photo)
      const wingBlade = new THREE.Mesh(new THREE.BoxGeometry(2.70, 0.08, 0.42), carbonMaterial);
      wingBlade.position.set(0, 1.46, 3.25);
      wingBlade.rotation.x = 0.05;
      group.add(wingBlade);

      for (const side of [-1, 1]) {
        // Aerodynamic Endplates
        const endplate = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.38, 0.52), bodyMaterial);
        endplate.position.set(side * 1.35, 1.46, 3.25);
        group.add(endplate);

        // Upright mounting pylons rising from trunk lid
        const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.44, 0.14), carbonMaterial);
        pylon.position.set(side * 0.78, 1.24, 3.22);
        pylon.rotation.x = -0.12;
        group.add(pylon);
      }

      // Subtle warm exhaust aura at rear
      const exhaustGlow = new THREE.PointLight(0xff3a18, 1.8, 3.2);
      exhaustGlow.position.set(0, 0.55, 3.88);
      group.add(exhaustGlow);
    } else {
      // Sculpted GT3 Aero Wing
      const wingBlade = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.08, 0.42), carbonMaterial);
      wingBlade.position.set(0, 1.54, 3.18);
      group.add(wingBlade);
      for (const side of [-1, 1]) {
        const endplate = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.35, 0.52), bodyMaterial);
        endplate.position.set(side * 1.33, 1.54, 3.18);
        group.add(endplate);
        const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.48, 0.12), carbonMaterial);
        pylon.position.set(side * 0.72, 1.28, 3.15);
        group.add(pylon);
      }
    }

    // 8. High-Detail Performance Sports Wheels with Red Brake Calipers
    const wheels = [];
    for (const x of [-1.75, 1.75]) {
      for (const z of [-2.15, 2.15]) {
        const wheelGroup = new THREE.Group();
        wheelGroup.position.set(x, 0.62, z);

        // Wide Racing Slick Tire
        const tire = new THREE.Mesh(
          new THREE.CylinderGeometry(0.62, 0.62, 0.48, 24),
          new THREE.MeshStandardMaterial({ color: 0x111315, roughness: 0.85 }),
        );
        tire.rotation.z = Math.PI / 2;
        wheelGroup.add(tire);

        // Outer Dark Anthracite Rim Lip
        const rimOuter = new THREE.Mesh(
          new THREE.CylinderGeometry(0.38, 0.38, 0.50, 18),
          new THREE.MeshStandardMaterial({ color: 0x22282c, metalness: 0.85, roughness: 0.25 }),
        );
        rimOuter.rotation.z = Math.PI / 2;
        wheelGroup.add(rimOuter);

        // Silver 5-Spoke Star Rim Face
        const hub = new THREE.Mesh(
          new THREE.CylinderGeometry(0.16, 0.16, 0.52, 12),
          new THREE.MeshStandardMaterial({ color: 0xdde5ea, metalness: 0.95, roughness: 0.14 }),
        );
        hub.rotation.z = Math.PI / 2;
        wheelGroup.add(hub);

        const spokeCount = shape === 0 ? 10 : 5;
        const spokeWidth = shape === 0 ? 0.035 : 0.05;
        for (let s = 0; s < spokeCount; s++) {
          const spoke = new THREE.Mesh(new THREE.BoxGeometry(spokeWidth, 0.45, 0.06), hub.material);
          spoke.rotation.x = (s / spokeCount) * Math.PI * 2;
          spoke.position.x = x < 0 ? -0.255 : 0.255;
          wheelGroup.add(spoke);
        }

        // Visible Drilled Steel Brake Rotor & Red Brake Caliper
        const rotor = new THREE.Mesh(
          new THREE.CylinderGeometry(0.32, 0.32, 0.08, 16),
          brakeDiscMat,
        );
        rotor.rotation.z = Math.PI / 2;
        rotor.position.x = x < 0 ? 0.08 : -0.08;
        wheelGroup.add(rotor);

        const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.16), caliperMat);
        caliper.position.set(x < 0 ? 0.08 : -0.08, 0.18, 0.12);
        wheelGroup.add(caliper);

        group.add(wheelGroup);
        wheels.push(wheelGroup);
      }
    }

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
      underglow.position.set(0, 0.32, 0);
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

    this.elapsed += dt;
    this.particles.update(dt);

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

    const baseTopSpeed = 48 + player.speedStat * 0.28;
    const accelRate = 22 + player.accelStat * 0.16;
    const turnStrength = 13.5 + player.handlingStat * 0.055;

    // Boost Pad Surge
    if (player.boostPadTimer > 0) {
      player.boostPadTimer -= dt;
      player.speed = THREE.MathUtils.lerp(player.speed, baseTopSpeed * 1.48, 4.5 * dt);
    }

    // Acceleration & Braking
    if (accelerate) {
      const recoveryBoost = this.wallRecovery ? 1.45 : 1.0;
      player.speed += accelRate * recoveryBoost * dt;
    } else {
      player.speed -= 6.5 * dt; // natural roll deceleration
    }

    if (brake) {
      player.speed -= 35.0 * dt;
    }

    // Nitro boost
    if (nitroPressed) {
      player.speed += 32 * dt;
      player.nitro = Math.max(0, player.nitro - 0.32 * dt);
      player.nitroActive = true;
    } else {
      player.nitro = Math.min(1.0, player.nitro + 0.045 * dt);
      player.nitroActive = false;
    }

    const topSpeedLimit = baseTopSpeed * (player.nitroActive ? 1.35 : 1.0);
    player.speed = clamp(player.speed, 0, topSpeedLimit);

    // STEERING & DRIFT MECHANICS (Corrected orientation: Left goes Left, Right goes Right)
    let rawSteering = (steerLeft ? 1 : 0) - (steerRight ? 1 : 0);
    if (Math.abs(this.analogSteer) > 0.03) {
      rawSteering = clamp(rawSteering + this.analogSteer, -1.0, 1.0);
    }
    player.visualSteer = lerp(player.visualSteer || 0, rawSteering, 10.0 * dt);
    const wantsDrift = (handbrake || (brake && Math.abs(rawSteering) > 0.5)) && player.speed > 25;

    if (wantsDrift) {
      this.isDrifting = true;
      this.driftDuration += dt;
      this.driftDistance = (this.driftDistance || 0) + (player.speed * dt * 1.35);
      player.slipAngle = lerp(player.slipAngle, rawSteering * 0.38, 6.0 * dt);
      const pointsGain = Math.round(Math.abs(player.slipAngle) * player.speed * dt * 80);
      this.driftScore += pointsGain;
      this.driftCombo = Math.min(4, Math.floor(this.driftDuration / 1.0) + 1);

      // Drift recharges nitro
      player.nitro = Math.min(1.0, player.nitro + 0.12 * dt);

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
      player.slipAngle = lerp(player.slipAngle, 0, 8.0 * dt);
    }

    // Lane positioning (Left steers Left, Right steers Right)
    const speedRatio = clamp(player.speed / baseTopSpeed, 0.2, 1.2);
    player.lane += rawSteering * turnStrength * speedRatio * dt;

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
      this.callbacks.onCollision?.('wall');
    }

    // Clamp lane boundary
    player.lane = clamp(player.lane, -maxRoadLane, maxRoadLane);

    // Update 3-blink recovery sequence (3 full cycles: OFF/ON, OFF/ON, OFF/ON)
    if (this.wallRecovery) {
      this.wallBlinkTimer -= dt;
      const progress = 1.0 - Math.max(0, this.wallBlinkTimer / (this.wallBlinkTotal || 1.08));
      const phase = Math.floor(progress * 6); // 6 half-cycles for 3 complete blinks

      // Even phase (0, 2, 4) = OFF, Odd phase (1, 3, 5) = ON
      player.object.visible = (phase % 2 === 1);

      if (this.wallBlinkTimer <= 0) {
        this.wallRecovery = false;
        this.wallBlinkTimer = 0;
        player.object.visible = true;
      }
    } else {
      player.object.visible = true;
    }

    // Progress continues from that place onwards as speed increases
    player.progress += player.speed * dt;

    // AI Racers simulation
    this._simulateAI(dt);

    // Interactive Items check
    this._checkTrackItems(player, dt);

    // Collisions
    this.resolveCollisions();

    // 3D placement, suspension roll & pitch
    this.updateCarPositions(dt);

    // Camera follow & shake
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
      const targetSpeed = (65 + i * 2) * ai.targetSpeedMultiplier * curveSlowdown;

      ai.speed = lerp(ai.speed, targetSpeed, 1.8 * dt);
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
        player.lane = clamp(player.lane + dir * 2.4, -(ROAD_HALF_WIDTH - 2.2), (ROAD_HALF_WIDTH - 2.2));
        ai.lane = clamp(ai.lane - dir * 1.8, -(ROAD_HALF_WIDTH - 2.2), (ROAD_HALF_WIDTH - 2.2));
        player.speed = Math.max(12, player.speed * 0.76);
        this.cameraShake = 0.35;
        this.particles.spawnSparks(player.object.position, 8, 0xffbb40);
        this.callbacks.onCollision?.();
      }
    });
  }

  getPosition(player) {
    return 1 + this.vehicles.slice(1).filter((v) => v.progress > player.progress).length;
  }

  updateCarPositions(dt) {
    this.vehicles.forEach((v) => {
      const { center, tangent, normal } = this.trackSpline.sampleAtProgress(v.progress);
      const pos = center.clone().addScaledVector(normal, v.lane);
      // Perfectly flat plain road placement
      v.object.position.set(pos.x, 0, pos.z);

      const yaw = Math.atan2(tangent.x, tangent.z) + Math.PI;
      const steerRoll = v.isPlayer ? (v.slipAngle * 0.22) : 0;
      v.object.rotation.set(0, yaw - (v.slipAngle || 0), steerRoll);

      // Wheel rotation
      if (v.object.userData.wheels) {
        v.object.userData.wheels.forEach((w) => { w.rotation.x += v.speed * dt * 0.35; });
      }
    });
  }

  _updateCinematicCountdownCamera(dt, player) {
    if (!player || !player.object || !this.trackSpline) return;

    const { tangent, normal } = this.trackSpline.sampleAtProgress(player.progress);
    const carPos = player.object.position;

    // Countdown runs from 3.0 down to 0.0
    const total = this.totalCountdown || 3.0;
    const t = Math.max(0, Math.min(total, total - this.countdown));
    const p = t / total; // 0.0 to 1.0

    // Smoothstep helper for continuous, silky non-linear camera motion
    const smoothstep = (min, max, val) => {
      const x = Math.max(0, Math.min(1, (val - min) / (max - min)));
      return x * x * (3 - 2 * x);
    };

    // 4 Keyframes smoothly showcasing every angle of the 3D car:
    // Keyframe 0 (t = 0.0s, count = 3): Front 3/4 beauty hero shot (grille, badge, GT 86 plate, headlights)
    const kf0Cam = carPos.clone().addScaledVector(tangent, 5.8).addScaledVector(normal, 3.4);
    kf0Cam.y = 1.35;
    const kf0Look = carPos.clone().addScaledVector(tangent, 0.8);
    kf0Look.y = 0.85;

    // Keyframe 1 (t = 1.0s, count = 2): Sweeping side profile (alloy wheels, red Brembo calipers, fastback roof)
    const kf1Cam = carPos.clone().addScaledVector(tangent, 1.2).addScaledVector(normal, -4.8);
    kf1Cam.y = 1.7;
    const kf1Look = carPos.clone().addScaledVector(tangent, 0.2);
    kf1Look.y = 0.95;

    // Keyframe 2 (t = 2.0s, count = 1): Rear 3/4 swooping up (GT sports wing, LED taillights, dual chrome exhausts)
    const kf2Cam = carPos.clone().addScaledVector(tangent, -6.5).addScaledVector(normal, -2.6);
    kf2Cam.y = 2.6;
    const kf2Look = carPos.clone().addScaledVector(tangent, 2.5);
    kf2Look.y = 1.1;

    // Keyframe 3 (t = 3.0s, count = 0 / GO!): Seamless handoff directly into standard Chase Camera!
    const kf3Cam = carPos.clone().addScaledVector(tangent, -13.5);
    kf3Cam.y = 4.8;
    const kf3Look = carPos.clone().addScaledVector(tangent, 12.0);
    kf3Look.y = 1.2;

    const targetCamPos = new THREE.Vector3();
    const targetLookAt = new THREE.Vector3();

    if (p < 0.333) {
      const s = smoothstep(0, 0.333, p);
      targetCamPos.lerpVectors(kf0Cam, kf1Cam, s);
      targetLookAt.lerpVectors(kf0Look, kf1Look, s);
    } else if (p < 0.666) {
      const s = smoothstep(0.333, 0.666, p);
      targetCamPos.lerpVectors(kf1Cam, kf2Cam, s);
      targetLookAt.lerpVectors(kf1Look, kf2Look, s);
    } else {
      const s = smoothstep(0.666, 1.0, p);
      targetCamPos.lerpVectors(kf2Cam, kf3Cam, s);
      targetLookAt.lerpVectors(kf2Look, kf3Look, s);
    }

    this.camera.position.copy(targetCamPos);
    this.camera.lookAt(targetLookAt);

    // Smoothly blend FOV from cinematic 62° down to standard chase 54°
    const targetFov = THREE.MathUtils.lerp(62, 54, p);
    this.camera.fov = targetFov;
    this.camera.updateProjectionMatrix();
  }

  _updateCamera(dt, player) {
    const { tangent } = this.trackSpline.sampleAtProgress(player.progress);
    const carPos = player.object.position;

    // FOV expands dynamically when boosting
    const targetFov = player.nitroActive ? 68 : 54;
    this.camera.fov = lerp(this.camera.fov, targetFov, 5.0 * dt);
    this.camera.updateProjectionMatrix();

    if (this.cameraMode === 0) {
      // Dynamic Chase Cam on plain flat road
      const lagBack = 13.5 + (player.speed / 60) * 3.5;
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
