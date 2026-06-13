import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

class EarthVisualization {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.earth = null;
    this.atmosphere = null;
    this.markerGroup = null;
    this.isAutoRotating = true;
    this.autoRotationSpeed = 0.002;
    
    this.init();
    this.addEventListeners();
  }

  createEarthTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    
    const oceanGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    oceanGradient.addColorStop(0, '#0a1628');
    oceanGradient.addColorStop(0.3, '#0d2847');
    oceanGradient.addColorStop(0.5, '#0f3460');
    oceanGradient.addColorStop(0.7, '#0d2847');
    oceanGradient.addColorStop(1, '#0a1628');
    ctx.fillStyle = oceanGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < 500; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const radius = Math.random() * 20 + 5;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.1})`;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    
    this.drawContinent(ctx, 'North America', [
      { x: 0.12, y: 0.25, radius: 0.08 },
      { x: 0.18, y: 0.32, radius: 0.1 },
      { x: 0.25, y: 0.28, radius: 0.06 },
      { x: 0.15, y: 0.4, radius: 0.05 }
    ]);
    
    this.drawContinent(ctx, 'South America', [
      { x: 0.28, y: 0.55, radius: 0.07 },
      { x: 0.32, y: 0.7, radius: 0.08 },
      { x: 0.29, y: 0.8, radius: 0.04 }
    ]);
    
    this.drawContinent(ctx, 'Europe', [
      { x: 0.55, y: 0.22, radius: 0.05 },
      { x: 0.58, y: 0.28, radius: 0.06 },
      { x: 0.52, y: 0.25, radius: 0.04 }
    ]);
    
    this.drawContinent(ctx, 'Africa', [
      { x: 0.55, y: 0.45, radius: 0.09 },
      { x: 0.6, y: 0.55, radius: 0.07 },
      { x: 0.52, y: 0.5, radius: 0.05 }
    ]);
    
    this.drawContinent(ctx, 'Asia', [
      { x: 0.75, y: 0.25, radius: 0.12 },
      { x: 0.85, y: 0.3, radius: 0.08 },
      { x: 0.65, y: 0.35, radius: 0.06 },
      { x: 0.9, y: 0.4, radius: 0.04 }
    ]);
    
    this.drawContinent(ctx, 'Australia', [
      { x: 0.88, y: 0.65, radius: 0.06 },
      { x: 0.92, y: 0.7, radius: 0.04 }
    ]);
    
    ctx.globalAlpha = 0.15;
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const width = Math.random() * 100 + 50;
      const height = Math.random() * 30 + 10;
      ctx.beginPath();
      ctx.ellipse(x, y, width, height, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  drawContinent(ctx, name, regions) {
    const colors = {
      'North America': ['#2d5a3d', '#3d7a4d', '#4d9a5d'],
      'South America': ['#2d4a3d', '#3d6a4d', '#4d8a5d'],
      'Europe': ['#5a4d3d', '#7a6d5d', '#9a8d7d'],
      'Africa': ['#6a5a3d', '#8a7a5d', '#a09070'],
      'Asia': ['#3d5a4d', '#5d7a6d', '#7d9a8d'],
      'Australia': ['#4d6a3d', '#6d8a5d', '#8daa7d']
    };
    
    const continentColors = colors[name] || ['#4a6a4a', '#5a7a5a', '#6a8a6a'];
    
    regions.forEach((region, i) => {
      const centerX = region.x * ctx.canvas.width;
      const centerY = region.y * ctx.canvas.height;
      const radius = region.radius * ctx.canvas.width;
      
      const gradient = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, radius
      );
      gradient.addColorStop(0, continentColors[i % continentColors.length]);
      gradient.addColorStop(0.7, continentColors[(i + 1) % continentColors.length]);
      gradient.addColorStop(1, 'rgba(45, 74, 61, 0.3)');
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
      
      for (let j = 0; j < 5; j++) {
        const offsetX = (Math.random() - 0.5) * radius * 0.5;
        const offsetY = (Math.random() - 0.5) * radius * 0.5;
        const smallRadius = Math.random() * radius * 0.2 + radius * 0.1;
        
        ctx.beginPath();
        ctx.arc(centerX + offsetX, centerY + offsetY, smallRadius, 0, Math.PI * 2);
        const darken = Math.random() * 0.3 + 0.7;
        ctx.fillStyle = `rgba(${Math.floor(45 * darken)}, ${Math.floor(90 * darken)}, ${Math.floor(60 * darken)}, 0.6)`;
        ctx.fill();
      }
    });
  }

  createBumpTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#888888');
    gradient.addColorStop(0.3, '#777777');
    gradient.addColorStop(0.5, '#888888');
    gradient.addColorStop(0.7, '#777777');
    gradient.addColorStop(1, '#888888');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    for (let i = 0; i < 3000; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const size = Math.random() * 3 + 1;
      const brightness = Math.random() * 0.3 + 0.5;
      
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${Math.floor(255 * brightness)}, ${Math.floor(255 * brightness)}, ${Math.floor(255 * brightness)}, 0.5)`;
      ctx.fill();
    }
    
    const continents = [
      { x: 0.18, y: 0.3, width: 0.15, height: 0.25 },
      { x: 0.3, y: 0.55, width: 0.08, height: 0.3 },
      { x: 0.54, y: 0.23, width: 0.08, height: 0.15 },
      { x: 0.53, y: 0.42, width: 0.1, height: 0.25 },
      { x: 0.68, y: 0.22, width: 0.25, height: 0.25 },
      { x: 0.86, y: 0.63, width: 0.08, height: 0.12 }
    ];
    
    continents.forEach(continent => {
      const x = continent.x * canvas.width;
      const y = continent.y * canvas.height;
      const w = continent.width * canvas.width;
      const h = continent.height * canvas.height;
      
      for (let i = 0; i < 500; i++) {
        const cx = x + Math.random() * w;
        const cy = y + Math.random() * h;
        const size = Math.random() * 2 + 0.5;
        const brightness = Math.random() * 0.2 + 0.85;
        
        ctx.beginPath();
        ctx.arc(cx, cy, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${Math.floor(255 * brightness)}, ${Math.floor(255 * brightness)}, ${Math.floor(255 * brightness)}, 0.8)`;
        ctx.fill();
      }
    });
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  init() {
    const container = document.getElementById('earth-container');
    
    this.scene = new THREE.Scene();
    
    this.camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.z = 4;
    
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);
    
    this.createEarth();
    this.createAtmosphere();
    this.createMarkers();
    this.setupLighting();
    this.setupControls();
    
    this.animate();
  }

  createEarth() {
    const geometry = new THREE.SphereGeometry(1, 64, 64);
    
    const earthTexture = this.createEarthTexture();
    const bumpTexture = this.createBumpTexture();
    
    const material = new THREE.MeshStandardMaterial({
      map: earthTexture,
      roughness: 0.8,
      metalness: 0.2,
      bumpMap: bumpTexture,
      bumpScale: 0.08
    });
    
    this.earth = new THREE.Mesh(geometry, material);
    this.scene.add(this.earth);
  }

  createAtmosphere() {
    const geometry = new THREE.SphereGeometry(1.02, 64, 64);
    
    const material = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
          gl_FragColor = vec4(0.0, 0.83, 1.0, 1.0) * intensity;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true
    });
    
    this.atmosphere = new THREE.Mesh(geometry, material);
    this.scene.add(this.atmosphere);
  }

  createMarkers() {
    this.markerGroup = new THREE.Group();
    
    const markerPositions = [
      { lat: 31.2304, lng: 121.4737, name: 'Shanghai', color: 0x00d4ff },
      { lat: 35.6762, lng: 139.6503, name: 'Tokyo', color: 0x00d4ff },
      { lat: 52.5200, lng: 13.4050, name: 'Berlin', color: 0x00d4ff },
      { lat: 40.7128, lng: -74.0060, name: 'New York', color: 0x00d4ff },
      { lat: -33.9249, lng: 18.4241, name: 'Cape Town', color: 0x00d4ff },
      { lat: -23.5505, lng: -46.6333, name: 'Sao Paulo', color: 0x00d4ff }
    ];
    
    markerPositions.forEach((pos) => {
      const phi = (90 - pos.lat) * (Math.PI / 180);
      const theta = (pos.lng + 180) * (Math.PI / 180);
      
      const x = -(1.01 * Math.sin(phi) * Math.cos(theta));
      const y = 1.01 * Math.cos(phi);
      const z = 1.01 * Math.sin(phi) * Math.sin(theta);
      
      const markerGeometry = new THREE.SphereGeometry(0.015, 8, 8);
      const markerMaterial = new THREE.MeshBasicMaterial({ color: pos.color });
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      
      marker.position.set(x, y, z);
      this.markerGroup.add(marker);
      
      const ringGeometry = new THREE.RingGeometry(0.025, 0.035, 32);
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: pos.color,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide
      });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      
      ring.position.set(x, y, z);
      ring.lookAt(0, 0, 0);
      this.markerGroup.add(ring);
    });
    
    this.scene.add(this.markerGroup);
  }

  setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(5, 3, 5);
    this.scene.add(directionalLight);
    
    const pointLight = new THREE.PointLight(0x00d4ff, 0.5, 10);
    pointLight.position.set(-5, -3, -5);
    this.scene.add(pointLight);
  }

  setupControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 8;
    this.controls.autoRotate = false;
    this.controls.autoRotateSpeed = 2.0;
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    
    if (this.isAutoRotating && !this.controls.hasInteracted) {
      this.earth.rotation.y += this.autoRotationSpeed;
      if (this.atmosphere) {
        this.atmosphere.rotation.y += this.autoRotationSpeed;
      }
      if (this.markerGroup) {
        this.markerGroup.rotation.y += this.autoRotationSpeed;
      }
    }
    
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  zoomIn() {
    const newDistance = Math.max(this.controls.minDistance, this.camera.position.length() - 0.5);
    this.camera.position.normalize().multiplyScalar(newDistance);
    this.controls.target.set(0, 0, 0);
  }

  zoomOut() {
    const newDistance = Math.min(this.controls.maxDistance, this.camera.position.length() + 0.5);
    this.camera.position.normalize().multiplyScalar(newDistance);
    this.controls.target.set(0, 0, 0);
  }

  resetZoom() {
    this.camera.position.set(0, 0, 4);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
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
    
    const zoomInBtn = document.querySelector('.zoom-btn[data-action="in"]');
    const zoomOutBtn = document.querySelector('.zoom-btn[data-action="out"]');
    const zoomResetBtn = document.querySelector('.zoom-btn[data-action="reset"]');
    
    zoomInBtn?.addEventListener('click', () => this.zoomIn());
    zoomOutBtn?.addEventListener('click', () => this.zoomOut());
    zoomResetBtn?.addEventListener('click', () => this.resetZoom());
    
    const viewBtns = document.querySelectorAll('.view-btn');
    viewBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        viewBtns.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.toggleView(e.target.dataset.view);
      });
    });
    
    this.renderer.domElement.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.deltaY > 0) {
        this.zoomOut();
      } else {
        this.zoomIn();
      }
    });
  }

  onWindowResize() {
    const container = document.getElementById('earth-container');
    this.camera.aspect = container.clientWidth / container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(container.clientWidth, container.clientHeight);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new EarthVisualization();
});
