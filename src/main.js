import * as THREE from 'three/webgpu';
import {
  step, normalWorldGeometry, output, texture, vec3, vec4,
  normalize, positionWorld, bumpMap, cameraPosition, color,
  uniform, mix, uv, max
} from 'three/tsl';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

class EarthVisualization {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.globe = null;
    this.atmosphere = null;
    this.stars = null;
    this.markerGroup = null;

    this.isAutoRotating = true;
    this.autoRotationSpeed = 0.002;

    this.isUserInteracting = false;
    this.mouse = new THREE.Vector2();

    this.initialState = {
      cameraPos: new THREE.Vector3(0, 0, 4),
      target: new THREE.Vector3(0, 0, 0),
      zoomLevel: 1.0
    };

    this.currentZoomLevel = 1.0;
    this.initialDistance = 5.0;

    this.isResetting = false;
    this.resetStartTime = 0;
    this.resetDuration = 800;
    this.resetFrom = {};
    this.resetTo = {};

    this.sunDirection = new THREE.Vector3(1, 0.2, 1).normalize();

    this.init();
    this.addEventListeners();
  }

  async init() {
    const container = document.getElementById('earth-container');

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    this.camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      2000
    );
    this.camera.position.copy(this.initialState.cameraPos);

    // ─── WebGPU 渲染器 ──────────────────────────
    this.renderer = new THREE.WebGPURenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    // WebGPU 必须异步初始化
    await this.renderer.init();

    // ─── 光照 ───────────────────────────────────
    const sun = new THREE.DirectionalLight('#ffffff', 2);
    sun.position.copy(this.sunDirection.clone().multiplyScalar(3));
    this.sunLight = sun;
    this.scene.add(sun);

    // ─── TSL 地球 ──────────────────────────────
    this.createEarthTSL(sun);

    // ─── 大气层 ─────────────────────────────────
    this.createAtmosphereTSL(sun);

    // ─── 星空粒子 ──────────────────────────────
    this.createStars();

    // ─── 城市标记 ──────────────────────────────
    this.createMarkers();

    // ─── OrbitControls ─────────────────────────
    this.setupControls();

    this.saveInitialState();
    this.animate();
  }

  saveInitialState() {
    this.initialState.cameraPos.copy(this.camera.position);
    this.initialState.target.copy(this.controls.target);
    this.initialState.zoomLevel =
      this.camera.position.length() / this.initialDistance;
    this.currentZoomLevel = this.initialState.zoomLevel;
  }

  // ═══════════════════════════════════════════════
  //  TSL 地球主体
  // ═══════════════════════════════════════════════

  createEarthTSL(sun) {
    const geometry = new THREE.SphereGeometry(1, 128, 128);
    const loader = new THREE.TextureLoader();

    // 纹理
    const dayTexture = loader.load('/textures/planets/earth_day_4096.jpg');
    dayTexture.colorSpace = THREE.SRGBColorSpace;
    dayTexture.anisotropy = 8;

    const nightTexture = loader.load('/textures/planets/earth_night_4096.jpg');
    nightTexture.colorSpace = THREE.SRGBColorSpace;
    nightTexture.anisotropy = 8;

    const brcTexture = loader.load(
      '/textures/planets/earth_bump_roughness_clouds_4096.jpg'
    );
    brcTexture.anisotropy = 8;

    // —— uniform ——
    const atmosphereDayColor = uniform(color('#4db2ff'));
    const atmosphereTwilightColor = uniform(color('#0b58bc'));
    const roughnessLow = uniform(0.25);
    const roughnessHigh = uniform(0.35);

    // —— 视线方向 & Fresnel ——
    const viewDirection = positionWorld.sub(cameraPosition).normalize();
    const fresnel = viewDirection
      .dot(normalWorldGeometry)
      .abs()
      .oneMinus()
      .toVar();

    // —— 太阳朝向 ——
    const sunOrientation = normalWorldGeometry
      .dot(normalize(sun.position))
      .toVar();

    // —— 大气颜色 ——
    const atmosphereColorNode = mix(
      atmosphereTwilightColor,
      atmosphereDayColor,
      sunOrientation.smoothstep(-0.25, 0.75)
    );

    // —— 地球材质 ——
    const globeMaterial = new THREE.MeshStandardNodeMaterial();

    // 云层强度
    const cloudsStrength = texture(brcTexture, uv())
      .b.smoothstep(0.2, 1);

    // 颜色
    globeMaterial.colorNode = mix(
      texture(dayTexture),
      vec3(1),
      cloudsStrength.mul(2)
    );

    // 粗糙度
    const roughness = max(
      texture(brcTexture).g,
      step(0.01, cloudsStrength)
    );
    globeMaterial.roughnessNode = roughness.remap(0, 1, roughnessLow, roughnessHigh);

    // 昼夜混合 + 大气
    const night = texture(nightTexture);
    const dayStrength = sunOrientation.smoothstep(-0.25, 0.5);

    const atmosphereDayStrength = sunOrientation.smoothstep(-0.5, 1);
    const atmosphereMix = atmosphereDayStrength
      .mul(fresnel.pow(2))
      .clamp(0, 1);

    let finalOutput = mix(night.rgb, output.rgb, dayStrength);
    finalOutput = mix(finalOutput, atmosphereColorNode, atmosphereMix);

    globeMaterial.outputNode = vec4(finalOutput, output.a);

    // 法线凹凸
    const bumpElevation = max(
      texture(brcTexture).r,
      cloudsStrength
    );
    globeMaterial.normalNode = bumpMap(bumpElevation);

    this.globe = new THREE.Mesh(geometry, globeMaterial);
    this.scene.add(this.globe);
  }

  // ═══════════════════════════════════════════════
  //  TSL 大气光晕（Fresnel BackSide）
  // ═══════════════════════════════════════════════

  createAtmosphereTSL(sun) {
    const geometry = new THREE.SphereGeometry(1, 128, 128);

    const atmosphereDayColor = uniform(color('#4db2ff'));
    const atmosphereTwilightColor = uniform(color('#bc490b'));

    const viewDirection = positionWorld.sub(cameraPosition).normalize();
    const fresnel = viewDirection
      .dot(normalWorldGeometry)
      .abs()
      .oneMinus()
      .toVar();

    const sunOrientation = normalWorldGeometry
      .dot(normalize(sun.position))
      .toVar();

    const atmosphereColorNode = mix(
      atmosphereTwilightColor,
      atmosphereDayColor,
      sunOrientation.smoothstep(-0.25, 0.75)
    );

    const atmosphereMaterial = new THREE.MeshBasicNodeMaterial({
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });

    let alpha = fresnel.remap(0.73, 1, 1, 0).pow(3);
    alpha = alpha.mul(sunOrientation.smoothstep(-0.5, 1));

    atmosphereMaterial.outputNode = vec4(atmosphereColorNode, alpha);

    this.atmosphere = new THREE.Mesh(geometry, atmosphereMaterial);
    this.atmosphere.scale.setScalar(1.04);
    this.scene.add(this.atmosphere);
  }

  // ═══════════════════════════════════════════════
  //  星空粒子背景（PointsMaterial，兼容 WebGPU）
  // ═══════════════════════════════════════════════

  createStars() {
    const PARTICLE_COUNT = 10000;
    const MIN_RADIUS = 600;
    const MAX_RADIUS = 1200;

    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const sizes = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const r = MIN_RADIUS + Math.random() * (MAX_RADIUS - MIN_RADIUS);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      sizes[i] = Math.random() * 2 + 0.5;
    }

    // Canvas 生成圆点纹理
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.arc(16, 16, 14, 0, Math.PI * 2);
    ctx.fillStyle = 'white';
    ctx.fill();

    const sprite = new THREE.CanvasTexture(canvas);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(positions, 3)
    );
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
      size: 1.5,
      map: sprite,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.7,
    });

    this.stars = new THREE.Points(geometry, material);
    this.scene.add(this.stars);
  }

  // ═══════════════════════════════════════════════
  //  城市标记点（保留原实现）
  // ═══════════════════════════════════════════════

  createMarkers() {
    this.markerGroup = new THREE.Group();

    const markerPositions = [
      { lat: 31.2304, lng: 121.4737, name: 'Shanghai', color: 0x00d4ff },
      { lat: 35.6762, lng: 139.6503, name: 'Tokyo', color: 0x00d4ff },
      { lat: 52.52, lng: 13.405, name: 'Berlin', color: 0x00d4ff },
      { lat: 40.7128, lng: -74.006, name: 'New York', color: 0x00d4ff },
      { lat: -33.9249, lng: 18.4241, name: 'Cape Town', color: 0x00d4ff },
      { lat: -23.5505, lng: -46.6333, name: 'Sao Paulo', color: 0x00d4ff },
    ];

    markerPositions.forEach((pos) => {
      const phi = (90 - pos.lat) * (Math.PI / 180);
      const theta = (pos.lng + 180) * (Math.PI / 180);

      const x = -(1.01 * Math.sin(phi) * Math.cos(theta));
      const y = 1.01 * Math.cos(phi);
      const z = 1.01 * Math.sin(phi) * Math.sin(theta);

      const markerGeom = new THREE.SphereGeometry(0.015, 8, 8);
      const markerMat = new THREE.MeshBasicMaterial({ color: pos.color });
      const marker = new THREE.Mesh(markerGeom, markerMat);
      marker.position.set(x, y, z);
      this.markerGroup.add(marker);

      const ringGeom = new THREE.RingGeometry(0.025, 0.035, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: pos.color,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      ring.position.set(x, y, z);
      ring.lookAt(0, 0, 0);
      this.markerGroup.add(ring);
    });

    this.scene.add(this.markerGroup);
  }

  // ═══════════════════════════════════════════════
  //  OrbitControls（保留原配置）
  // ═══════════════════════════════════════════════

  setupControls() {
    this.controls = new OrbitControls(
      this.camera,
      this.renderer.domElement
    );

    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 8;
    this.controls.autoRotate = false;
    this.controls.autoRotateSpeed = 2.0;

    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };

    this.controls.addEventListener('start', () => {
      this.isUserInteracting = true;
    });
    this.controls.addEventListener('end', () => {
      this.isUserInteracting = false;
    });

    window.addEventListener('mousemove', (e) => {
      const container = document.getElementById('earth-container');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    });
  }

  // ═══════════════════════════════════════════════
  //  以鼠标指针为中心的缩放
  // ═══════════════════════════════════════════════

  zoomToCursor(zoomIn) {
    const step = zoomIn ? -0.5 : 0.5;
    const currentDist = this.camera.position.length();
    const newDist = THREE.MathUtils.clamp(
      currentDist + step,
      this.controls.minDistance,
      this.controls.maxDistance
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(this.mouse, this.camera);

    const sphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1);
    const intersection = new THREE.Vector3();
    const hit = raycaster.ray.intersectSphere(sphere, intersection);

    if (hit) {
      const direction = this.camera.position
        .clone()
        .sub(intersection)
        .normalize();
      this.controls.target.copy(intersection);
      this.camera.position.copy(
        intersection.clone().add(direction.multiplyScalar(newDist))
      );
    } else {
      const direction = this.camera.position.clone().normalize();
      this.camera.position.copy(direction.multiplyScalar(newDist));
    }
  }

  // ═══════════════════════════════════════════════
  //  平滑重置动画
  // ═══════════════════════════════════════════════

  resetToInitialView() {
    if (this.isResetting) return;

    this.isResetting = true;
    this.resetStartTime = performance.now();

    this.resetFrom = {
      pos: this.camera.position.clone(),
      target: this.controls.target.clone(),
    };

    this.resetTo = {
      pos: this.initialState.cameraPos.clone(),
      target: this.initialState.target.clone(),
    };
  }

  easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  updateResetAnimation(now) {
    if (!this.isResetting) return;

    const elapsed = now - this.resetStartTime;
    const progress = Math.min(elapsed / this.resetDuration, 1);
    const eased = this.easeInOutCubic(progress);

    this.camera.position.lerpVectors(
      this.resetFrom.pos,
      this.resetTo.pos,
      eased
    );
    this.controls.target.lerpVectors(
      this.resetFrom.target,
      this.resetTo.target,
      eased
    );

    if (progress >= 1) {
      this.isResetting = false;
      this.camera.position.copy(this.resetTo.pos);
      this.controls.target.copy(this.resetTo.target);
    }
  }

  // ═══════════════════════════════════════════════
  //  缩放显示更新
  // ═══════════════════════════════════════════════

  updateZoomDisplay() {
    const dist = this.camera.position.length();
    this.currentZoomLevel = dist / this.initialDistance;

    const zoomInEl = document.getElementById('zoom-in-value');
    const zoomOutEl = document.getElementById('zoom-out-value');

    if (zoomInEl) {
      zoomInEl.textContent = `${(this.currentZoomLevel * 1.2).toFixed(1)}x`;
    }
    if (zoomOutEl) {
      zoomOutEl.textContent = `${(this.currentZoomLevel * 0.8).toFixed(1)}x`;
    }
  }

  // ═══════════════════════════════════════════════
  //  渲染循环
  // ═══════════════════════════════════════════════

  animate() {
    requestAnimationFrame(() => this.animate());

    const now = performance.now();

    // 自动旋转（仅用户未交互时）
    if (this.isAutoRotating && !this.isUserInteracting && !this.isResetting) {
      if (this.globe) this.globe.rotation.y += this.autoRotationSpeed;
      if (this.atmosphere)
        this.atmosphere.rotation.y += this.autoRotationSpeed;
      if (this.markerGroup)
        this.markerGroup.rotation.y += this.autoRotationSpeed;
    }

    // 星空缓慢旋转
    if (this.stars) {
      this.stars.rotation.y += 0.00005;
    }

    // 平滑重置动画
    this.updateResetAnimation(now);

    this.controls.update();
    this.renderer.render(this.scene, this.camera);

    // 实时更新缩放显示
    this.updateZoomDisplay();
  }

  // ═══════════════════════════════════════════════
  //  UI 按钮事件
  // ═══════════════════════════════════════════════

  zoomIn() {
    this.zoomToCursor(true);
  }

  zoomOut() {
    this.zoomToCursor(false);
  }

  resetZoom() {
    this.resetToInitialView();
  }

  toggleView(view) {
    if (view === '2d') {
      this.controls.enableRotate = false;
      this.controls.maxPolarAngle = Math.PI / 2;
      this.controls.minPolarAngle = Math.PI / 2;
    } else {
      this.controls.enableRotate = true;
      this.controls.maxPolarAngle = Math.PI;
      this.controls.minPolarAngle = 0;
    }
  }

  addEventListeners() {
    window.addEventListener('resize', () => this.onWindowResize());

    // 左侧菜单栏图标切换
    const menuBtns = document.querySelectorAll('.menu-items .menu-btn');
    menuBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        menuBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // 黑夜/白天模式切换
    const themeBtns = document.querySelectorAll('.theme-btn');
    themeBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        themeBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        const isDay = btn.getAttribute('aria-label') === 'Day mode';
        if (isDay) {
          document.body.classList.add('light-mode');
          this.scene.background = new THREE.Color(0xffffff);
        } else {
          document.body.classList.remove('light-mode');
          this.scene.background = new THREE.Color(0x000000);
        }
      });
    });

    // 缩放按钮
    const zoomInBtn = document.querySelector(
      '.zoom-btn[data-action="in"]'
    );
    const zoomOutBtn = document.querySelector(
      '.zoom-btn[data-action="out"]'
    );
    const zoomResetBtn = document.querySelector(
      '.zoom-btn[data-action="reset"]'
    );

    zoomInBtn?.addEventListener('click', () => this.zoomIn());
    zoomOutBtn?.addEventListener('click', () => this.zoomOut());
    zoomResetBtn?.addEventListener('click', () => this.resetZoom());

    // 视图切换
    const viewBtns = document.querySelectorAll('.view-btn');
    viewBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        viewBtns.forEach((b) => b.classList.remove('active'));
        e.target.classList.add('active');
        this.toggleView(e.target.dataset.view);
      });
    });
  }

  onWindowResize() {
    const container = document.getElementById('earth-container');
    if (!container) return;
    this.camera.aspect = container.clientWidth / container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(container.clientWidth, container.clientHeight);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new EarthVisualization();
});
