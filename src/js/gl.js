// Helpers WebGL compartidos por el humo del hero (heroSmoke.js) y por el humo
// del finale (progressFog.js). Ambos usan el mismo programa de un triángulo que
// cubre el viewport (un solo draw call) y el mismo campo de ruido.

// Ruido y fbm: base del campo de humo de los dos módulos.
export const NOISE = `
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}
`;

// Campo de humo compartido por el hero y la tormenta de Skills. Mantener una
// sola definición conserva la misma silueta y evolución del ruido en ambos.
export const SMOKE_FIELD = `
vec2 toNoise(vec2 vp) {
  return vec2((vp.x - u_view.x * 0.5) / u_view.y, vp.y / u_view.y) * 2.2;
}

float bodyAt(float d) {
  return smoothstep(0.30, 0.85, d);
}

float macroAt(vec2 vp, float t) {
  vec2 p = toNoise(vp);
  p.y += t * 1.6;
  return noise(p * 0.42 + vec2(1.3, 4.7) + vec2(0.0, t * 0.5)) * 0.65
       + noise(p * 0.85 + vec2(7.7, 2.1) - vec2(t * 0.3, 0.0)) * 0.35;
}

float fieldAt(vec2 vp, float t) {
  vec2 p = toNoise(vp);
  p.y += t * 1.6;
  vec2 q = vec2(fbm(p), fbm(p + vec2(5.2, 1.3)));
  vec2 r = vec2(
    fbm(p + 2.0 * q + vec2(1.7, 9.2) + 0.3 * t),
    fbm(p + 2.0 * q + vec2(8.3, 2.8) - 0.2 * t)
  );
  return fbm(p + 2.5 * r);
}
`;

const VERT = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const compile = (gl, type, src) => {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
};

// Programa con un triángulo que cubre el viewport. Deja el programa en uso y el
// atributo a_pos listo, así el loop sólo setea uniforms y dibuja.
export const buildProgram = (gl, fragSrc) => {
  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragSrc);
  const program = vs && fs && gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, 'a_pos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  return program;
};

export const webglContext = (canvas) => canvas.getContext('webgl', {
  alpha: true,
  premultipliedAlpha: true,
  antialias: false,
  depth: false,
  stencil: false,
  powerPreference: 'low-power',
});
