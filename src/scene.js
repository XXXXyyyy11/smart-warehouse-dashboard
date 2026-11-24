import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// 库区配置：名称、中心位置、货架排数
export const ZONES = [
  { name: 'A 区 · 电子产品', x: -30, z: -14, rows: 4, color: 0x1677ff },
  { name: 'B 区 · 日用百货', x: 0, z: -14, rows: 4, color: 0x2f8cff },
  { name: 'C 区 · 食品饮料', x: 30, z: -14, rows: 4, color: 0x36cfff },
  { name: 'D 区 · 服装鞋帽', x: -15, z: 14, rows: 3, color: 0x4fa3ff },
  { name: 'E 区 · 大件家电', x: 15, z: 14, rows: 3, color: 0x69b1ff },
];

const VIEWS = {
  overview: { pos: [0, 62, 82], target: [0, 0, 0] },
  top: { pos: [0, 110, 0.1], target: [0, 0, 0] },
  dock: { pos: [0, 18, 62], target: [0, 4, 32] },
};

export function initScene(canvas, tooltip) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe6f1ff);
  scene.fog = new THREE.Fog(0xe6f1ff, 120, 260);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  camera.position.set(...VIEWS.overview.pos);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2.1;
  controls.minDistance = 20;
  controls.maxDistance = 180;

  // 灯光：环境光 + 主光源（带阴影）
  scene.add(new THREE.HemisphereLight(0xffffff, 0xbcd8ff, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(40, 80, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80 });
  scene.add(sun);

  buildFloor(scene);
  const racks = buildRacks(scene);
  const agvs = buildAgvs(scene);
  const conveyor = buildConveyor(scene);
  buildDocks(scene);
  const rings = buildRings(scene);

  // ---- 交互：鼠标悬停货架显示信息 ----
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let hovered = null;
  canvas.addEventListener('pointermove', (e) => {
    mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    raycaster.setFromCamera(mouse, camera);
    const hit = raycaster.intersectObjects(racks, false)[0];
    if (hovered && hovered !== hit?.object) hovered.material.emissive.setHex(0x000000);
    hovered = hit?.object || null;
    if (hovered) {
      hovered.material.emissive.setHex(0x1f5fbf);
      const d = hovered.userData;
      tooltip.innerHTML = `<b>${d.zone}</b><br>货架编号：${d.id}<br>层数：${d.levels} 层<br>利用率：${d.rate}%`;
      tooltip.style.display = 'block';
      tooltip.style.left = e.clientX + 16 + 'px';
      tooltip.style.top = e.clientY + 16 + 'px';
    } else {
      tooltip.style.display = 'none';
    }
  });

  // ---- 视角切换（平滑过渡） ----
  let tween = null;
  function setView(name) {
    const v = VIEWS[name];
    if (!v) return;
    tween = {
      fromPos: camera.position.clone(), toPos: new THREE.Vector3(...v.pos),
      fromTarget: controls.target.clone(), toTarget: new THREE.Vector3(...v.target),
      t: 0,
    };
  }
  function setAutoRotate(on) {
    controls.autoRotate = on;
    controls.autoRotateSpeed = 0.8;
  }

  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  resize();

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = clock.getDelta();
    const time = clock.elapsedTime;
    if (tween) {
      tween.t = Math.min(tween.t + dt / 1.2, 1);
      const k = 1 - Math.pow(1 - tween.t, 3);
      camera.position.lerpVectors(tween.fromPos, tween.toPos, k);
      controls.target.lerpVectors(tween.fromTarget, tween.toTarget, k);
      if (tween.t === 1) tween = null;
    }
    agvs.forEach((a) => a.update(time));
    conveyor.update(dt);
    rings.forEach((r, i) => {
      const s = ((time * 0.6 + i * 0.33) % 1);
      r.scale.setScalar(1 + s * 3);
      r.material.opacity = 0.6 * (1 - s);
    });
    controls.update();
    renderer.render(scene, camera);
  });

  return { setView, setAutoRotate };
}

// ---------- 地面：白色地坪 + 蓝色网格 + 库区底板 ----------
function buildFloor(scene) {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 90),
    new THREE.MeshStandardMaterial({ color: 0xf7fbff, roughness: 0.9 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(120, 60, 0x1677ff, 0xa9cdfa);
  grid.position.y = 0.02;
  grid.material.transparent = true;
  grid.material.opacity = 0.35;
  scene.add(grid);

  // 仓库外墙轮廓（半透明玻璃感）
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(110, 14, 80),
    new THREE.MeshPhysicalMaterial({ color: 0xbfdcff, transparent: true, opacity: 0.08, side: THREE.BackSide })
  );
  wall.position.y = 7;
  scene.add(wall);
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(wall.geometry),
    new THREE.LineBasicMaterial({ color: 0x1677ff, transparent: true, opacity: 0.6 })
  );
  edges.position.copy(wall.position);
  scene.add(edges);

  ZONES.forEach((z) => {
    const w = 24, d = z.rows * 4 + 2;
    const pad = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshBasicMaterial({ color: z.color, transparent: true, opacity: 0.1 })
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(z.x, 0.04, z.z);
    scene.add(pad);
    const border = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.PlaneGeometry(w, d)),
      new THREE.LineBasicMaterial({ color: z.color })
    );
    border.rotation.x = -Math.PI / 2;
    border.position.set(z.x, 0.06, z.z);
    scene.add(border);
    scene.add(makeLabel(z.name, z.x, 0.1, z.z + d / 2 + 1.5));
  });
}

// 用 canvas 生成文字贴图做 3D 标签
function makeLabel(text, x, y, z) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 96;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(22,119,255,0.9)';
  ctx.beginPath();
  ctx.roundRect(4, 8, 504, 80, 16);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 44px Microsoft YaHei, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 50);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 1.9),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  return mesh;
}

// ---------- 货架 + 货物 ----------
function buildRacks(scene) {
  const racks = [];
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x2f6fd6, metalness: 0.6, roughness: 0.4 });
  const boxColors = [0xffffff, 0xdbeaff, 0xa9cdfa, 0x69b1ff];
  const boxGeo = new THREE.BoxGeometry(1.5, 1.2, 1.5);
  ZONES.forEach((z, zi) => {
    for (let r = 0; r < z.rows; r++) {
      const rz = z.z - (z.rows * 4) / 2 + 2 + r * 4;
      const levels = 4;
      const rack = new THREE.Mesh(
        new THREE.BoxGeometry(20, levels * 1.8, 2),
        new THREE.MeshStandardMaterial({ color: 0xe9f3ff, transparent: true, opacity: 0.35, emissive: 0x000000 })
      );
      rack.position.set(z.x, (levels * 1.8) / 2, rz);
      rack.userData = {
        zone: z.name,
        id: `${'ABCDE'[zi]}-${String(r + 1).padStart(2, '0')}`,
        levels,
        rate: 0,
      };
      scene.add(rack);
      racks.push(rack);

      // 立柱与层板
      for (let i = 0; i <= 5; i++) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, levels * 1.8, 2), frameMat);
        post.position.set(z.x - 10 + i * 4, (levels * 1.8) / 2, rz);
        post.castShadow = true;
        scene.add(post);
      }
      for (let l = 0; l <= levels; l++) {
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(20, 0.12, 2), frameMat);
        shelf.position.set(z.x, l * 1.8, rz);
        scene.add(shelf);
      }

      // 随机摆放货物，统计利用率
      let filled = 0;
      for (let l = 0; l < levels; l++) {
        for (let s = 0; s < 10; s++) {
          if (Math.random() < 0.28) continue;
          filled++;
          const box = new THREE.Mesh(
            boxGeo,
            new THREE.MeshStandardMaterial({ color: boxColors[(s + l + r) % 4], roughness: 0.7 })
          );
          box.position.set(z.x - 9 + s * 2, l * 1.8 + 0.66, rz);
          box.castShadow = true;
          scene.add(box);
        }
      }
      rack.userData.rate = Math.round((filled / (levels * 10)) * 100);
    }
  });
  return racks;
}

// ---------- AGV 小车：沿矩形路径循环行驶 ----------
function buildAgvs(scene) {
  // 主通道路径（库区之间的环形道路）
  const path = new THREE.CurvePath();
  const pts = [[-48, -2], [48, -2], [48, 28], [-48, 28]].map(([x, z]) => new THREE.Vector3(x, 0, z));
  for (let i = 0; i < pts.length; i++) path.add(new THREE.LineCurve3(pts[i], pts[(i + 1) % pts.length]));

  // 路径地标线
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(path.getSpacedPoints(200).map((p) => p.clone().setY(0.08))),
    new THREE.LineDashedMaterial({ color: 0x1677ff, dashSize: 1, gapSize: 0.6 })
  );
  line.computeLineDistances();
  scene.add(line);

  const agvs = [];
  for (let i = 0; i < 5; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.7, 1.6),
      new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.3, roughness: 0.4 })
    );
    body.position.y = 0.45;
    body.castShadow = true;
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(2.45, 0.15, 1.65),
      new THREE.MeshStandardMaterial({ color: 0x1677ff, emissive: 0x1677ff, emissiveIntensity: 0.8 })
    );
    stripe.position.y = 0.55;
    const cargo = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 1, 1.2),
      new THREE.MeshStandardMaterial({ color: 0xa9cdfa })
    );
    cargo.position.y = 1.3;
    cargo.visible = i % 2 === 0;
    g.add(body, stripe, cargo);
    scene.add(g);
    const offset = i / 5;
    agvs.push({
      update(t) {
        const u = (t * 0.025 + offset) % 1;
        const p = path.getPointAt(u);
        const tan = path.getTangentAt(u);
        g.position.copy(p);
        g.rotation.y = Math.atan2(-tan.z, tan.x);
      },
    });
  }
  return agvs;
}

// ---------- 传送带：货箱沿传送带移动 ----------
function buildConveyor(scene) {
  const belt = new THREE.Mesh(
    new THREE.BoxGeometry(60, 0.4, 2.4),
    new THREE.MeshStandardMaterial({ color: 0x5a7a9a, metalness: 0.5, roughness: 0.5 })
  );
  belt.position.set(0, 1.2, 34);
  belt.receiveShadow = true;
  scene.add(belt);
  for (let i = 0; i < 13; i++) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1, 2.2), new THREE.MeshStandardMaterial({ color: 0x2f6fd6 }));
    leg.position.set(-30 + i * 5, 0.5, 34);
    scene.add(leg);
  }
  const boxes = [];
  for (let i = 0; i < 10; i++) {
    const b = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 1, 1.4),
      new THREE.MeshStandardMaterial({ color: i % 2 ? 0xffffff : 0x69b1ff })
    );
    b.position.set(-30 + i * 6, 1.9, 34);
    b.castShadow = true;
    scene.add(b);
    boxes.push(b);
  }
  return {
    update(dt) {
      boxes.forEach((b) => {
        b.position.x += dt * 4;
        if (b.position.x > 30) b.position.x -= 60;
      });
    },
  };
}

// ---------- 月台（装卸口）+ 货车 ----------
function buildDocks(scene) {
  for (let i = 0; i < 4; i++) {
    const x = -36 + i * 24;
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(6, 6, 0.3),
      new THREE.MeshStandardMaterial({ color: 0xdbeaff, emissive: 0x1677ff, emissiveIntensity: 0.15 })
    );
    door.position.set(x, 3, 40);
    scene.add(door);
    const truck = new THREE.Group();
    const cab = new THREE.Mesh(new THREE.BoxGeometry(4, 3.5, 3), new THREE.MeshStandardMaterial({ color: 0x1677ff }));
    cab.position.set(0, 2, 7);
    const box = new THREE.Mesh(new THREE.BoxGeometry(4.4, 4.6, 9), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    box.position.set(0, 2.6, 0.5);
    cab.castShadow = box.castShadow = true;
    truck.add(cab, box);
    truck.position.set(x, 0, 46);
    if (i !== 2) scene.add(truck);
  }
}

// ---------- 库区中心的扩散光圈 ----------
function buildRings(scene) {
  const rings = [];
  ZONES.forEach((z) => {
    for (let k = 0; k < 3; k++) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.6, 1.9, 48),
        new THREE.MeshBasicMaterial({ color: 0x36cfff, transparent: true, side: THREE.DoubleSide, depthWrite: false })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(z.x + 13, 0.1, z.z);
      scene.add(ring);
      rings.push(ring);
    }
  });
  return rings;
}
