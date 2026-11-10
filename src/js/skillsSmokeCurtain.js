import { NOISE, buildProgram, webglContext } from './gl.js';

const REDUCE = '(prefers-reduced-motion: reduce)';
const COMPACT = '(max-width: 970px), (max-height: 700px)';

// One coherent, domain-warped field shapes both the curtain and its warm edge.
// The time offsets are intentionally restrained: the plume keeps breathing
// while paused without reading as a repeating wave or a moving screen overlay.
const FRAGMENT = `
precision highp float;
uniform vec2 u_res;
uniform vec2 u_view;
uniform vec2 u_pointer;
uniform vec4 u_introRect;
uniform float u_time;
uniform float u_reveal;
uniform float u_pointerActive;
${NOISE}

float plumeField(vec2 p, float t) {
  vec2 broad = vec2(
    fbm(p * vec2(0.52, 0.86) + vec2(2.4, 6.1) + vec2(t * 0.12, -t * 0.035)),
    fbm(p * vec2(0.61, 0.74) + vec2(8.3, 1.2) + vec2(-t * 0.045, t * 0.09))
  );
  vec2 warp = vec2(
    fbm(p * vec2(0.92, 1.12) + broad * 1.05 + vec2(1.7, 9.2) - vec2(t * 0.09, t * 0.035)),
    fbm(p * vec2(0.78, 1.24) + broad.yx * 1.12 + vec2(5.4, 2.8) + vec2(t * 0.045, -t * 0.075))
  );
  float body = fbm(p * vec2(1.22, 1.46) + warp * 1.22 + vec2(3.6, 4.7));
  float detail = fbm(p * vec2(2.8, 2.25) + warp * 1.65 + vec2(7.1, 2.3) + vec2(-t * 0.13, t * 0.07));
  return body * 0.78 + detail * 0.22;
}

float edgeShape(float y, float t) {
  vec2 p = vec2(y, t);
  float broad = fbm(vec2(y * 2.25, t * 0.13) + vec2(2.7, 5.1));
  float middle = fbm(vec2(y * 5.4, t * 0.24) + vec2(4.9, 8.3));
  float fine = fbm(vec2(y * 11.0, t * 0.4) + vec2(7.4, 1.8));
  // Large, uneven billows carry the silhouette; smaller scales break their
  // outline without introducing evenly spaced scallops.
  return (broad - 0.5) * 0.48 + (middle - 0.5) * 0.19 + (fine - 0.5) * 0.075;
}

void main() {
  vec2 vp = vec2(gl_FragCoord.x / u_res.x, 1.0 - gl_FragCoord.y / u_res.y) * u_view;
  float h = max(u_view.y, 1.0);
  float progress = clamp(u_reveal, 0.0, 1.0);
  float t = u_time * 0.1;

  // The curtain and its smoke start outside the right edge. Scroll only moves
  // this front across the viewport; no global opacity fade switches smoke on.
  float start = u_view.x + h * 0.38;
  float finish = -h * 0.42;
  float front = mix(start, finish, progress);
  float y = vp.y / h;
  float shape = edgeShape(y, t);

  vec2 pointerDelta = vp - u_pointer;
  float pointerRadius = h * 0.3;
  float pointerInfluence = exp(-dot(pointerDelta, pointerDelta) / max(pointerRadius * pointerRadius, 1.0))
                         * u_pointerActive;
  float pointerNearFront = exp(-pow((u_pointer.x - front) / (h * 0.3), 2.0));
  float pointerWarp = clamp((u_pointer.x - front) / h, -0.3, 0.3)
                    * pointerInfluence * pointerNearFront * 0.08;
  float deformedFront = front + (shape + pointerWarp) * h * 0.62;

  float signedEdge = (vp.x - deformedFront) / h;
  float coveredSide = 1.0 - smoothstep(-0.075, 0.055, signedEdge);
  float exposedSide = smoothstep(-0.035, 0.11, signedEdge);
  float cover = 1.0 - smoothstep(-0.035, 0.025, signedEdge);

  // The noise coordinates are attached to the moving front, so the smoke is
  // already alive offscreen and is carried into view by the lateral reveal.
  vec2 p = vec2(signedEdge * 2.2, (y - 0.5) * 4.1);
  float density = plumeField(p, t);
  float edgeProximity = exp(-abs(signedEdge) * 5.2);
  float dissolved = smoothstep(0.49, 0.68, density) * edgeProximity
                  * coveredSide * (1.0 - 0.86 * smoothstep(0.0, 0.12, abs(signedEdge)));

  // Keep a generous, hard-safe backing behind the intro copy: the irregular
  // front cannot punch coral-colored gaps into “Skills” or its scroll hint.
  vec2 safeMargin = vec2(h * 0.12);
  float titleGuard = step(u_introRect.x - safeMargin.x, vp.x)
                   * step(vp.x, u_introRect.z + safeMargin.x)
                   * step(u_introRect.y - safeMargin.y, vp.y)
                   * step(vp.y, u_introRect.w + safeMargin.y);
  dissolved *= 1.0 - titleGuard;
  float blackAlpha = cover * (1.0 - dissolved * 0.88);

  float plumeEnvelope = exp(-pow(max(signedEdge, 0.0) / 0.48, 2.0))
                      * exp(-pow(max(-signedEdge, 0.0) / 0.2, 2.0));
  float body = smoothstep(0.46, 0.7, density);
  float filaments = smoothstep(0.4, 0.59, density)
                  * (1.0 - smoothstep(0.69, 0.82, density));
  float smokeAlpha = (body * 0.22 + filaments * 0.1) * plumeEnvelope
                   * exposedSide * (1.0 - titleGuard);
  smokeAlpha *= 1.0 - smoothstep(0.78, 0.94, progress);
  smokeAlpha = clamp(smokeAlpha, 0.0, 0.28);

  vec3 smokeColor = mix(vec3(1.0, 0.42, 0.39), vec3(1.0, 0.75, 0.63),
                        clamp((density - 0.42) * 2.1, 0.0, 1.0));
  float alpha = blackAlpha + smokeAlpha * (1.0 - blackAlpha);
  vec3 premultiplied = smokeColor * smokeAlpha * (1.0 - blackAlpha);
  gl_FragColor = vec4(premultiplied, alpha);
}
`;

export class SkillsSmokeCurtain {
  constructor(canvas, introContent) {
    this.canvas = canvas;
    this.introContent = introContent;
    this.compact = window.matchMedia(COMPACT);
    this.reveal = 0;
    this.time = 0;
    this.pointer = { x: -10000, y: -10000, active: 0 };
    this.pointerTarget = { x: -10000, y: -10000, active: 0 };
    this.visible = false;
    this.started = false;
    this.lost = false;
    this.raf = 0;
    this.last = 0;
    this.loop = this.loop.bind(this);

    this.ready = this.setup();
    if (this.ready) this.observe();
  }

  setup() {
    const gl = webglContext(this.canvas);
    if (!gl) return false;
    const program = buildProgram(gl, FRAGMENT);
    if (!program) return false;

    this.gl = gl;
    this.program = program;
    this.u = {
      res: gl.getUniformLocation(program, 'u_res'),
      view: gl.getUniformLocation(program, 'u_view'),
      pointer: gl.getUniformLocation(program, 'u_pointer'),
      introRect: gl.getUniformLocation(program, 'u_introRect'),
      time: gl.getUniformLocation(program, 'u_time'),
      reveal: gl.getUniformLocation(program, 'u_reveal'),
      pointerActive: gl.getUniformLocation(program, 'u_pointerActive'),
    };
    gl.clearColor(0, 0, 0, 0);
    gl.disable(gl.BLEND);
    this.canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      this.lost = true;
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.canvas.classList.remove('is-active');
    });
    return this.resize();
  }

  observe() {
    if (!('IntersectionObserver' in window)) {
      this.visible = true;
      return;
    }
    this.observer = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      if (!this.visible) return;
      if (this.started) this.startLoop();
      else this.start();
    }, { rootMargin: '100% 0px' });
    this.observer.observe(this.canvas);
  }

  start() {
    if (this.started) return;
    this.started = true;
    if (!window.matchMedia(REDUCE).matches) this.startLoop();
    else this.render();
  }

  resize() {
    const gl = this.gl;
    if (!gl) return false;
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    const scale = this.compact.matches ? 0.32 : 0.48;
    this.canvas.width = Math.max(1, Math.round(width * scale));
    this.canvas.height = Math.max(1, Math.round(height * scale));
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.program);
    gl.uniform2f(this.u.res, this.canvas.width, this.canvas.height);
    gl.uniform2f(this.u.view, width, height);
    this.render();
    return true;
  }

  setPointer(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointerTarget.x = event.clientX - rect.left;
    this.pointerTarget.y = event.clientY - rect.top;
    this.pointerTarget.active = 1;
  }

  clearPointer() {
    this.pointerTarget.active = 0;
  }

  startLoop() {
    if (
      !this.raf && this.started && this.visible && !document.hidden
      && (this.canvas.classList.contains('is-active') || this.reveal < 0.999)
    ) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.loop);
    }
  }

  loop(now) {
    this.raf = 0;
    if (
      !this.started || !this.visible || document.hidden
      || (!this.canvas.classList.contains('is-active') && this.reveal >= 0.999)
    ) return;
    const dt = Math.min((now - this.last) / 1000, 1 / 30);
    this.last = now;
    this.time += dt;
    const ease = 1 - Math.exp(-dt * 5.5);
    this.pointer.x += (this.pointerTarget.x - this.pointer.x) * ease;
    this.pointer.y += (this.pointerTarget.y - this.pointer.y) * ease;
    this.pointer.active += (this.pointerTarget.active - this.pointer.active) * ease;
    this.render();
    this.raf = requestAnimationFrame(this.loop);
  }

  render() {
    const gl = this.gl;
    if (!gl) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    if (this.reveal >= 0.999) {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return;
    }

    gl.useProgram(this.program);
    gl.uniform1f(this.u.time, this.time);
    gl.uniform1f(this.u.reveal, this.reveal);
    gl.uniform1f(this.u.pointerActive, this.pointer.active);
    gl.uniform2f(this.u.pointer, this.pointer.x, this.pointer.y);
    const canvasRect = this.canvas.getBoundingClientRect();
    const introRect = this.introContent?.getBoundingClientRect();
    if (introRect) {
      gl.uniform4f(
        this.u.introRect,
        introRect.left - canvasRect.left,
        introRect.top - canvasRect.top,
        introRect.right - canvasRect.left,
        introRect.bottom - canvasRect.top,
      );
    } else {
      gl.uniform4f(this.u.introRect, -1, -1, -1, -1);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
