// Escena three.js del deck: "tokens que fluyen y se ensamblan en UI".
// UN solo renderer WebGL para todo el deck: el canvas se MUEVE al slide activo
// (reutilizamos el nodo en vez de crear contextos nuevos: la misma idea de la charla).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export type StageMode = 'stream' | 'calm' | 'orbit' | 'logo';

const LIGHT = [0x4285f4, 0xea4335, 0xf9ab00, 0x34a853];
const DARK = [0x57caff, 0xff7daf, 0xffd427, 0x5cdb6d]; // halftones de Google: brillan sobre Black 02
const COUNT = 1400; // en 'logo' se usan todas; en los demás modos, las primeras 520
const SMALL = 520;

export class ThreeStage {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  private tokens: THREE.InstancedMesh;
  private panels: THREE.Group = new THREE.Group();
  private panelMats: THREE.LineBasicMaterial[] = [];
  private data: { t: number; speed: number; lane: number; target: THREE.Vector3; y0: number; z0: number }[] = [];
  private slot: HTMLElement | null = null;
  private mode: StageMode = 'stream';
  private clock = new THREE.Clock();
  private dummy = new THREE.Object3D();
  private ro: ResizeObserver;
  private running = false;
  private pointer = new THREE.Vector2();
  private dark = false;
  private cover = false;
  /** el logo se ensambla desde cero cada vez que entramos al slide */
  private logoStart = 0;
  /** Puntos del logo < > de Google Developers (muestreados del SVG) con su color. */
  private logo: { p: THREE.Vector3; color: number }[] = [];

  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.domElement.className = 'three-canvas';
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    this.camera.position.set(0, 0.4, 11);

    // Paneles de UI (cuadrícula de "cards" a la derecha) con contorno, estilo DevFest.
    const cells = [
      [2.2, 2.0, 3.4, 1.3],
      [2.2, 0.35, 3.4, 1.6],
      [1.35, -1.5, 1.7, 1.7],
      [3.05, -1.5, 1.7, 1.7],
    ];
    for (const [x, y, w, h] of cells) {
      const geo = new THREE.EdgesGeometry(new RoundedBoxGeometry(w, h, 0.05, 4, 0.18));
      const mat = new THREE.LineBasicMaterial({ color: 0x1e1e1e, transparent: true, opacity: 0.9 });
      this.panelMats.push(mat);
      const line = new THREE.LineSegments(geo, mat);
      line.position.set(x, y, 0);
      line.userData = { w, h, x, y };
      this.panels.add(line);
    }
    this.scene.add(this.panels);

    const geo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    const mat = new THREE.MeshBasicMaterial({ vertexColors: false });
    this.tokens = new THREE.InstancedMesh(geo, mat, COUNT);
    const color = new THREE.Color();
    for (let i = 0; i < COUNT; i++) {
      const panel = this.panels.children[i % this.panels.children.length];
      const { w, h, x, y } = panel.userData as { w: number; h: number; x: number; y: number };
      this.data.push({
        t: Math.random(),
        speed: 0.08 + Math.random() * 0.12,
        lane: Math.random() * Math.PI * 2,
        target: new THREE.Vector3(x + (Math.random() - 0.5) * (w - 0.3), y + (Math.random() - 0.5) * (h - 0.3), 0),
        y0: (Math.random() - 0.5) * 3.2,
        z0: (Math.random() - 0.5) * 2,
      });
      this.tokens.setColorAt(i, color.setHex(LIGHT[i % 4]));
    }
    this.scene.add(this.tokens);

    this.ro = new ResizeObserver(() => this.resize());
    addEventListener('pointermove', (e) => {
      this.pointer.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
    });
    document.addEventListener('visibilitychange', () => (document.hidden ? this.stop() : this.slot && this.start()));
    void this.loadLogo('/brand/logo-icon.svg');
  }

  /** Rasteriza el SVG y toma puntos dentro de cada barra de color (ignora el contorno negro). */
  private async loadLogo(url: string) {
    const img = new Image();
    img.src = url;
    await img.decode().catch(() => undefined);
    if (!img.naturalWidth) return;
    const W = 360;
    const H = 200;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.drawImage(img, 0, 0, W, H);
    const px = g.getImageData(0, 0, W, H).data;
    const candidates: { x: number; y: number; color: number }[] = [];
    for (let y = 0; y < H; y += 2) {
      for (let x = 0; x < W; x += 2) {
        const i = (y * W + x) * 4;
        const [r, gg, b, a] = [px[i], px[i + 1], px[i + 2], px[i + 3]];
        if (a < 200 || Math.max(r, gg, b) < 90) continue; // transparente o contorno
        candidates.push({ x, y, color: (r << 16) | (gg << 8) | b });
      }
    }
    const scale = 5.0 / W; // ancho del logo en unidades del mundo
    for (let i = 0; i < COUNT; i++) {
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      this.logo.push({ p: new THREE.Vector3((pick.x - W / 2) * scale, -(pick.y - H / 2) * scale, (Math.random() - 0.5) * 0.25), color: pick.color });
    }
    if (this.mode === 'logo') this.applyLogoColors();
  }

  private applyLogoColors() {
    const color = new THREE.Color();
    const palette = this.dark ? DARK : LIGHT;
    for (let i = 0; i < COUNT; i++) {
      if (this.mode === 'logo' && this.logo[i]) color.setHex(this.logo[i].color);
      else color.setHex(palette[i % 4]);
      this.tokens.setColorAt(i, color);
    }
    this.tokens.instanceColor!.needsUpdate = true;
  }

  setTheme(dark: boolean) {
    this.dark = dark;
    this.applyLogoColors();
    for (const m of this.panelMats) m.color.setHex(dark ? 0xf0f0f0 : 0x1e1e1e);
    this.renderOnce();
  }

  /** Mueve el canvas al slot del slide activo (o lo saca si no hay slot). */
  attach(slot: HTMLElement | null, mode: StageMode = 'stream') {
    if (this.slot) this.ro.unobserve(this.slot);
    this.slot = slot;
    this.mode = mode;
    if (!slot) {
      this.renderer.domElement.remove();
      this.stop();
      return;
    }
    slot.append(this.renderer.domElement);
    this.ro.observe(slot);
    this.resize();
    this.cover = !!slot.closest('.cover');
    this.logoStart = this.clock.elapsedTime;
    this.tokens.count = mode === 'logo' ? COUNT : SMALL;
    this.panels.visible = mode !== 'logo';
    this.applyLogoColors();
    this.panels.position.x = mode === 'orbit' ? -2.2 : mode === 'calm' ? -0.4 : this.cover ? 2.3 : 0;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) this.renderOnce(1.2);
    else this.start();
  }

  private resize() {
    if (!this.slot) return;
    const { width, height } = this.slot.getBoundingClientRect();
    // deck-stage escala con transform: usamos el tamaño de diseño del slot.
    const w = this.slot.offsetWidth || width;
    const h = this.slot.offsetHeight || height;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderOnce();
  }

  private start() {
    if (this.running) return;
    this.running = true;
    this.clock.getDelta();
    this.renderer.setAnimationLoop(() => this.tick());
  }

  private stop() {
    this.running = false;
    this.renderer.setAnimationLoop(null);
  }

  private renderOnce(at = 0) {
    this.update(at, true);
    this.renderer.render(this.scene, this.camera);
  }

  private tick() {
    this.update(Math.min(this.clock.getDelta(), 0.05));
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Portada: los tokens suben, se ensamblan en el logo < > de Google Developers,
   * "respiran", se dispersan y vuelven a formarse (ciclo de 10 s).
   */
  private updateLogo(time: number, settle: boolean) {
    const CYCLE = 10;
    // A la derecha del título: el texto ocupa ~55% izquierdo de la portada.
    const offset = new THREE.Vector3(this.cover ? 4.0 : 0, 0.5, 0);
    const p = new THREE.Vector3();
    const from = new THREE.Vector3();
    for (let i = 0; i < COUNT; i++) {
      const d = this.data[i];
      const target = this.logo[i].p;
      // cada partícula llega con un pequeño retraso propio
      const local = settle ? 4 : (time - this.logoStart + d.lane * 0.25) % CYCLE;
      from.set(target.x * 0.6 + d.y0 * 1.6, -6.5 - d.z0 * 2, d.z0 * 3);
      let e: number;
      if (local < 3.2) e = 1 - Math.pow(1 - local / 3.2, 3); // ensamblar
      else if (local < 8.2) e = 1; // mostrar el logo
      else e = 1 - (local - 8.2) / 1.8; // dispersar
      if (local >= 8.2) from.set(target.x * 3 + d.y0 * 2, target.y * 3 + d.y0, 4 + d.z0 * 3);
      p.lerpVectors(from, target, Math.max(0, Math.min(1, e)));
      if (e === 1) {
        p.x += Math.sin(time * 1.6 + d.lane) * 0.015;
        p.y += Math.cos(time * 1.3 + d.lane) * 0.015;
      }
      p.add(offset);
      this.dummy.position.copy(p);
      this.dummy.scale.setScalar(e === 1 ? 0.62 : 0.5 + 0.4 * e);
      this.dummy.rotation.set(time * 0.6 + d.lane, d.lane, 0);
      this.dummy.updateMatrix();
      this.tokens.setMatrixAt(i, this.dummy.matrix);
    }
    this.tokens.instanceMatrix.needsUpdate = true;
    this.camera.position.x += (this.pointer.x * 0.25 - this.camera.position.x) * 0.03;
    this.camera.position.y += (0.2 - this.pointer.y * 0.2 - this.camera.position.y) * 0.03;
    this.camera.lookAt(0, 0, 0);
  }

  private update(dt: number, settle = false) {
    const time = this.clock.elapsedTime;
    const start = new THREE.Vector3();
    const p = new THREE.Vector3();
    if (this.mode === 'logo' && this.logo.length) return this.updateLogo(time, settle);
    for (let i = 0; i < SMALL; i++) {
      const d = this.data[i];
      d.t = settle ? (i / COUNT) % 1 : (d.t + dt * d.speed * (this.mode === 'calm' ? 0.4 : 1)) % 1;
      if (this.mode === 'orbit') {
        const a = d.lane + time * 0.25 * d.speed * 4;
        p.set(1.8 + Math.cos(a) * (3 + d.y0 * 0.4), Math.sin(a * 1.3) * 1.2 + d.y0 * 0.5, Math.sin(a) * 2 + d.z0);
      } else {
        // Del "prompt" (izquierda) a su lugar en un panel (derecha): ease-out + ondulación.
        // En la portada suben desde abajo (no cruzan el título); en las secciones vienen de la izquierda.
        if (this.cover) start.set(3.2 + d.y0 * 0.9, -6, d.z0);
        else start.set(-6.5, d.y0, d.z0);
        const e = 1 - Math.pow(1 - Math.min(1, d.t * 1.25), 3);
        p.lerpVectors(start, d.target, e);
        p.x += this.panels.position.x * e;
        p.y += Math.sin(d.t * Math.PI * 2 + d.lane) * 0.45 * (1 - e);
      }
      this.dummy.position.copy(p);
      const s = this.mode === 'orbit' ? 0.9 : 0.6 + 0.6 * Math.sin(Math.min(1, d.t * 1.25) * Math.PI);
      this.dummy.scale.setScalar(s);
      this.dummy.rotation.set(d.t * 6 + d.lane, d.t * 4, 0);
      this.dummy.updateMatrix();
      this.tokens.setMatrixAt(i, this.dummy.matrix);
    }
    this.tokens.instanceMatrix.needsUpdate = true;
    this.panels.children.forEach((panel, i) => {
      panel.position.z = Math.sin(time * 0.8 + i) * 0.15;
      panel.rotation.y = Math.sin(time * 0.4 + i) * 0.04;
    });
    this.camera.position.x += (this.pointer.x * 0.6 - this.camera.position.x) * 0.03;
    this.camera.position.y += (0.4 - this.pointer.y * 0.4 - this.camera.position.y) * 0.03;
    this.camera.lookAt(0.6, 0, 0);
    void this.dark;
  }
}
