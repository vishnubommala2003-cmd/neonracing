import * as THREE from 'three';

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;

    // 1. Smoke particle pool (for drifting and burnouts)
    this.maxSmoke = 120;
    this.smokePool = [];
    const smokeGeo = new THREE.PlaneGeometry(0.7, 0.7);
    const smokeMat = new THREE.MeshBasicMaterial({
      color: 0xdde5e8,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    const smokeGroup = new THREE.Group();
    for (let i = 0; i < this.maxSmoke; i++) {
      const mesh = new THREE.Mesh(smokeGeo, smokeMat.clone());
      mesh.visible = false;
      mesh.rotation.x = -Math.PI / 2;
      smokeGroup.add(mesh);
      this.smokePool.push({
        mesh,
        life: 0,
        maxLife: 0.65,
        vel: new THREE.Vector3(),
        scaleSpeed: 2.2,
      });
    }
    this.scene.add(smokeGroup);
    this.smokeGroup = smokeGroup;

    // 2. Sparks pool (collisions & metal scraping)
    this.maxSparks = 80;
    this.sparksPool = [];
    const sparkGeo = new THREE.BoxGeometry(0.08, 0.08, 0.28);
    const sparkMat = new THREE.MeshBasicMaterial({
      color: 0xffd34e,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    });
    const sparksGroup = new THREE.Group();
    for (let i = 0; i < this.maxSparks; i++) {
      const mesh = new THREE.Mesh(sparkGeo, sparkMat.clone());
      mesh.visible = false;
      sparksGroup.add(mesh);
      this.sparksPool.push({
        mesh,
        life: 0,
        maxLife: 0.35,
        vel: new THREE.Vector3(),
      });
    }
    this.scene.add(sparksGroup);
    this.sparksGroup = sparksGroup;

    // 3. Exhaust Flame Burst (nitro)
    this.nitroFlames = [];
  }

  spawnSmoke(pos, vel, tint = 0xdde5e8) {
    const p = this.smokePool.find((item) => item.life <= 0);
    if (!p) return;
    p.life = p.maxLife;
    p.mesh.position.copy(pos);
    p.mesh.position.y += 0.22;
    p.mesh.scale.set(0.6, 0.6, 0.6);
    p.mesh.material.opacity = 0.42;
    p.mesh.material.color.setHex(tint);
    p.mesh.visible = true;
    p.vel.copy(vel).add(new THREE.Vector3((Math.random() - 0.5) * 1.5, 0.8 + Math.random() * 0.8, (Math.random() - 0.5) * 1.5));
  }

  spawnSparks(pos, count = 6, color = 0xffe258) {
    let spawned = 0;
    for (const p of this.sparksPool) {
      if (p.life <= 0) {
        p.life = p.maxLife;
        p.mesh.position.copy(pos);
        p.mesh.visible = true;
        p.mesh.material.color.setHex(color);
        p.mesh.material.opacity = 1;
        p.vel.set(
          (Math.random() - 0.5) * 14,
          Math.random() * 8 + 3,
          (Math.random() - 0.5) * 14,
        );
        spawned++;
        if (spawned >= count) break;
      }
    }
  }

  update(dt) {
    // Update smoke
    for (const p of this.smokePool) {
      if (p.life > 0) {
        p.life -= dt;
        if (p.life <= 0) {
          p.mesh.visible = false;
        } else {
          const ratio = p.life / p.maxLife;
          p.mesh.position.addScaledVector(p.vel, dt);
          p.mesh.scale.addScalar(p.scaleSpeed * dt);
          p.mesh.material.opacity = ratio * 0.4;
        }
      }
    }

    // Update sparks
    for (const p of this.sparksPool) {
      if (p.life > 0) {
        p.life -= dt;
        if (p.life <= 0) {
          p.mesh.visible = false;
        } else {
          p.vel.y -= 24 * dt; // gravity
          p.mesh.position.addScaledVector(p.vel, dt);
          p.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), p.vel.clone().normalize());
          p.mesh.material.opacity = (p.life / p.maxLife);
        }
      }
    }
  }

  clear() {
    this.smokePool.forEach((p) => { p.life = 0; p.mesh.visible = false; });
    this.sparksPool.forEach((p) => { p.life = 0; p.mesh.visible = false; });
  }

  dispose() {
    this.clear();
    this.scene.remove(this.smokeGroup);
    this.scene.remove(this.sparksGroup);
    this.smokePool.forEach((p) => {
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
    });
    this.sparksPool.forEach((p) => {
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
    });
  }
}

