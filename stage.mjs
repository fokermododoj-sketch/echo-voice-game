const TAU = Math.PI * 2;
const palette = {
  floor: '#20352f', tile: '#2c4940', line: '#34584d', night: '#101e1a',
  rubber: '#192a24', steel: '#3d5c4e', glass: '#0c1715',
  lime: '#c8fa75', leaf: '#75bc48', pale: '#e9ffb3',
  orange: '#ffa477', rust: '#ba6144', cream: '#ffe0ab',
  ink: '#111d18', white: '#f7ffe3', tongue: '#f18f8c'
};

function rgb(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [value >> 16, (value >> 8) & 255, value & 255].map(channel => channel / 255);
}

const colors = Object.fromEntries(Object.entries(palette).map(([name, hex]) => [name, rgb(hex)]));

function cuboid() {
  const faces = [
    [[0, 0, 1], [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]],
    [[0, 0, -1], [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]]],
    [[1, 0, 0], [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]]],
    [[-1, 0, 0], [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]]],
    [[0, 1, 0], [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]]],
    [[0, -1, 0], [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]]]
  ];
  return faces.flatMap(([normal, corners]) => [0, 1, 2, 0, 2, 3].flatMap(index => [...corners[index], ...normal]));
}

function surface(rows, columns, vertex) {
  const data = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const a = vertex(row / rows, column / columns);
      const b = vertex(row / rows, (column + 1) / columns);
      const c = vertex((row + 1) / rows, (column + 1) / columns);
      const d = vertex((row + 1) / rows, column / columns);
      data.push(...a, ...b, ...c, ...a, ...c, ...d);
    }
  }
  return data;
}

function ellipsoid(squareness = 1) {
  const power = (value, exponent) => Math.sign(value) * Math.pow(Math.abs(value), exponent);
  return surface(12, 20, (u, v) => {
    const latitude = (u - .5) * Math.PI;
    const radial = Math.cos(latitude);
    const unit = [radial * Math.sin(v * TAU), Math.sin(latitude), radial * Math.cos(v * TAU)];
    return [
      ...unit.map(value => power(value, squareness)),
      ...unit.map(value => power(value, 2 - squareness))
    ];
  });
}

function cylinder(columns) {
  const side = surface(1, columns, (u, v) => {
    const x = Math.cos(v * TAU);
    const z = Math.sin(v * TAU);
    return [x, u * 2 - 1, z, x, 0, z];
  });
  for (const y of [-1, 1]) {
    for (let i = 0; i < columns; i++) {
      const a = i * TAU / columns;
      const b = (i + 1) * TAU / columns;
      side.push(0, y, 0, 0, y, 0, Math.cos(a), y, Math.sin(a), 0, y, 0, Math.cos(b), y, Math.sin(b), 0, y, 0);
    }
  }
  return side;
}

const bandMesh = surface(6, 22, (u, v) => {
  const angle = Math.PI * v;
  const cross = u * TAU;
  const radius = 1 + .068 * Math.cos(cross);
  const x = Math.cos(angle);
  const y = Math.sin(angle);
  return [radius * x, radius * y, .13 * Math.sin(cross), x * Math.cos(cross), y * Math.cos(cross), Math.sin(cross)];
});

const vertexShader = `
  attribute vec3 position;
  attribute vec3 normal;
  uniform vec3 center;
  uniform vec3 size;
  uniform vec2 extent;
  uniform mat3 rotation;
  varying vec3 worldNormal;
  varying vec3 worldPosition;
  void main() {
    vec3 world = rotation * (position * size) + center;
    worldNormal = rotation * (normal / size);
    worldPosition = world;
    float side = .996 * world.x - .087 * world.z;
    float depth = .087 * world.x + .996 * world.z;
    float y = world.y - 1.78;
    gl_Position = vec4(side / extent.x, (.96 * y - .28 * depth) / extent.y, (-.96 * depth - .28 * y) * .055, 1.0);
  }
`;

const fragmentShader = `
  precision mediump float;
  uniform vec3 tint;
  uniform float glow;
  varying vec3 worldNormal;
  varying vec3 worldPosition;
  void main() {
    vec3 normal = normalize(worldNormal);
    vec3 light = normalize(vec3(-.48, .86, .52));
    float key = max(0.0, dot(normal, light));
    float bounce = max(0.0, dot(normal, normalize(vec3(.67, .15, -.61))));
    float rim = pow(1.0 - max(0.0, dot(normal, normalize(vec3(.09, .28, .96)))), 3.0);
    float specular = pow(max(0.0, dot(normal, normalize(light + vec3(.09, .28, .96)))), 28.0);
    vec3 color = tint * (.48 + .53 * key + .13 * bounce) + specular * vec3(.11, .13, .08);
    color += rim * vec3(.085, .11, .09) * (.3 + .7 * bounce);
    color = mix(color, tint, glow);
    float distanceFade = smoothstep(2.1, 7.4, length(worldPosition.xz));
    color *= 1.0 - .33 * distanceFade;
    gl_FragColor = vec4(color, 1.0);
  }
`;

function setUp(canvas) {
  const gl = canvas.getContext('webgl', { alpha: true, antialias: true, powerPreference: 'low-power' });
  if (!gl) return null;
  const program = gl.createProgram();
  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  };
  compile(gl.VERTEX_SHADER, vertexShader);
  compile(gl.FRAGMENT_SHADER, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  const position = gl.getAttribLocation(program, 'position');
  const normal = gl.getAttribLocation(program, 'normal');
  gl.enableVertexAttribArray(position);
  gl.enableVertexAttribArray(normal);
  gl.enable(gl.DEPTH_TEST);

  const meshes = Object.fromEntries(Object.entries({
    box: cuboid(), ball: ellipsoid(), round: ellipsoid(.54), drum: cylinder(32), band: bandMesh
  }).map(([name, vertices]) => {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    return [name, { buffer, count: vertices.length / 6 }];
  }));
  const uniforms = Object.fromEntries(
    ['center', 'size', 'extent', 'rotation', 'tint', 'glow'].map(name => [name, gl.getUniformLocation(program, name)])
  );
  const rotation = new Float32Array(9);
  let lastMesh;
  function draw(name, color, x, y, z, sx, sy, sz, { tilt = 0, tip = 0, glow = 0 } = {}) {
    const { buffer, count } = meshes[name];
    if (lastMesh !== buffer) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 24, 0);
      gl.vertexAttribPointer(normal, 3, gl.FLOAT, false, 24, 12);
      lastMesh = buffer;
    }
    const c = Math.cos(tilt);
    const s = Math.sin(tilt);
    const p = Math.cos(tip);
    const q = Math.sin(tip);
    rotation.set([c, s, 0, -s * p, c * p, q, s * q, -c * q, p]);
    gl.uniformMatrix3fv(uniforms.rotation, false, rotation);
    gl.uniform3f(uniforms.center, x, y, z);
    gl.uniform3f(uniforms.size, sx, sy, sz);
    gl.uniform3fv(uniforms.tint, colors[color]);
    gl.uniform1f(uniforms.glow, glow);
    gl.drawArrays(gl.TRIANGLES, 0, count);
  }
  return {
    gl,
    draw,
    setExtent: (x, y) => gl.uniform2f(uniforms.extent, x, y),
    release() {
      for (const { buffer } of Object.values(meshes)) gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    }
  };
}

function speakerStack(draw, x) {
  draw('round', 'steel', x, 1.31, -1.41, .64, 1.06, .39);
  draw('round', 'rubber', x, 1.30, -1.04, .63, 1.05, .11);
  const tip = Math.PI / 2;
  for (const [y, r] of [[.86, .37], [1.63, .27]]) {
    draw('drum', 'steel', x, y, -.91, r, .043, r, { tip });
    draw('drum', 'glass', x, y, -.865, r * .86, .025, r * .86, { tip });
    draw('ball', 'rubber', x, y, -.826, r * .71, r * .71, .034);
    draw('ball', 'steel', x, y, -.797, r * .30, r * .30, .055);
  }
  draw('box', 'leaf', x, 2.1, -.89, .13, .021, .025, { glow: .8 });
}

function podium(draw, x, color, active) {
  draw('drum', 'night', x, .098, .15, 1.23, .096, 1.03);
  draw('drum', 'steel', x, .184, .15, 1.20, .041, 1);
  draw('drum', color, x, .218, .15, 1.165, .021, .966, { glow: active ? .8 : .04 });
  draw('drum', 'floor', x, .272, .15, 1.14, .061, .946);
  draw('ball', 'night', x, .339, .26, .92, .016, .62);
  draw('box', color, x, .217, 1.105, .28, .022, .025, { glow: active ? .95 : .3 });
}

function microphone(draw, x, side, active) {
  const pos = x + side * 1.06;
  draw('drum', 'rubber', pos, .39, .94, .185, .032, .145);
  draw('drum', 'steel', pos, .89, .94, .032, .49, .032);
  draw('ball', 'rubber', pos - side * .11, 1.40, .94, .16, .055, .054, { tilt: -side * .23 });
  draw('round', 'rubber', pos - side * .22, 1.43, .95, .117, .198, .09, { tilt: side * -.28 });
  draw('round', 'steel', pos - side * .23, 1.47, 1.017, .088, .136, .04, { tilt: side * -.28 });
  for (let i = 0; i < 3; i++) draw('box', 'ink', pos - side * (.245 - .012 * i), 1.41 + i * .042, 1.055, .054, .008, .008);
  draw('ball', active ? 'orange' : 'leaf', pos - side * .20, 1.31, 1.04, .025, .025, .013, { glow: .7 });
}

function mascot(draw, x, other, time, effort, phase) {
  const main = other ? 'orange' : 'lime';
  const secondary = other ? 'rust' : 'leaf';
  const cream = other ? 'cream' : 'pale';
  const offset = other ? 1.7 : 0;
  const breathe = .045 * Math.sin(time * 2.2 + offset);
  const nod = Math.sin(time * 11 + offset) * effort;
  const cheer = phase === 'result' ? .09 * Math.max(0, Math.sin(time * 7 + offset)) : 0;
  const bob = breathe + cheer + .11 * Math.abs(nod);
  const shape = other ? 'round' : 'ball';

  for (const side of [-1, 1]) {
    draw('round', 'rubber', x + side * .28, .446, .49, .245, .118, .307);
    draw('round', secondary, x + side * .28, .512, .54, .185, .103, .263);
    draw('ball', secondary, x + side * .56, 1.15 + bob + nod * side * .11, .12, .208, .37, .19, { tilt: side * (.37 + effort * .26) });
    draw('ball', main, x + side * .69, .975 + bob + nod * side * .16, .24, .145, .154, .146);
  }
  draw(shape, main, x, 1.16 + bob, .065, .586, .62, .442);
  draw('ball', secondary, x, 1.10 + bob, .411, .305, .317, .104);
  draw('box', 'rubber', x, 1.13 + bob, .510, .195, .080, .023);
  for (let i = -2; i <= 2; i++) {
    const signal = .018 + .035 * (1 - Math.abs(i) / 3) * (.65 + effort * Math.abs(Math.sin(time * 8 + i)));
    draw('box', cream, x + i * .054, 1.13 + bob, .535, .012, signal, .007, { glow: .85 });
  }
  const headTilt = .045 * Math.sin(time * 2 + offset) + nod * .09;
  const headY = 2.056 + bob + .06 * nod;
  draw(shape, main, x, headY, .12, other ? .655 : .68, .598, .544, { tilt: headTilt });
  if (other) {
    for (const side of [-1, 1]) {
      draw('round', main, x + side * .485, headY + .455, .13, .235, .36, .216, { tilt: -side * .48 + headTilt });
      draw('ball', secondary, x + side * .51, headY + .49, .30, .129, .225, .091, { tilt: -side * .48 + headTilt });
      draw('ball', cream, x + side * .238, headY - .19, .559, .308, .206, .126);
    }
  } else {
    draw('band', 'rubber', x, headY + .12, .061, .725, .559, 1.15, { tilt: headTilt });
    for (const side of [-1, 1]) {
      draw('round', 'rubber', x + side * .667, headY + .022, .13, .139, .258, .231, { tilt: headTilt });
      draw('ball', secondary, x + side * .776, headY + .024, .15, .085, .176, .169);
      draw('ball', cream, x + side * .819, headY + .024, .20, .044, .079, .092);
      draw('ball', secondary, x + side * .38, headY - .134, .572, .091, .043, .021);
    }
  }
  const blink = Math.pow(Math.max(0, Math.cos(time * 1.8 + offset)), 68) * .92;
  for (const side of [-1, 1]) {
    const eyeX = x + side * .241;
    const eyeY = headY + .107 + side * headTilt * .30;
    draw('ball', 'ink', eyeX, eyeY, other ? .647 : .619, .102, .135 * (1 - blink), .062);
    if (blink < .5) draw('ball', 'white', eyeX - .031, eyeY + .043, other ? .706 : .680, .032, .035, .014, { glow: .35 });
  }
  const mouth = .031 + effort * .113 * (.68 + .32 * Math.abs(nod));
  draw('ball', 'ink', x, headY - .191 - mouth * .31, .67, .103 + .018 * effort, mouth, .035);
  if (effort > .22) draw('ball', 'tongue', x, headY - .21 - mouth * .62, .703, .063, mouth * .32, .012);
}

function board(draw, time, level, color) {
  draw('round', 'steel', 0, 1.91, -1.39, .845, .838, .18);
  draw('round', 'glass', 0, 1.94, -1.209, .749, .708, .079);
  for (const y of [1.68, 1.96, 2.24]) draw('box', 'line', 0, y, -1.121, .653, .008, .014);
  for (let i = 0; i < 13; i++) {
    const wave = Math.abs(Math.sin(time * 7 + i * .74) * Math.cos(time * 2.8 - i * .42));
    const height = .028 + .26 * (.09 + level * .91) * (.19 + .81 * wave);
    draw('box', color, (i - 6) * .10, 1.95, -1.079, .022, height, .02, { glow: .62 });
  }
  for (let i = -1; i <= 1; i++) draw('ball', i === 0 ? color : 'steel', i * .135, 1.41, -1.091, .024, .024, .018, { glow: .8 });
  draw('box', 'steel', 0, 1.024, -1.41, .145, .223, .13);
  draw('drum', 'rubber', 0, .81, -1.41, .385, .039, .275);
}

function floorScene(draw, extent, living) {
  draw('box', 'floor', 0, -.082, -.32, extent + 1, .083, 3.2);
  for (const z of [-2.7, -1.3, .14, 1.56, 2.55]) draw('box', 'line', 0, .004, z, extent + 1, .006, .014);
  for (let x = -7; x <= 7; x++) draw('box', 'line', x * 1.09, .004, -.32, .009, .006, 3.12);
  draw('box', 'night', 0, .078, -3.02, extent + 1, .119, .16);
  draw('box', 'steel', 0, .219, -3.04, extent + 1, .025, .145);
  for (const x of [-1, 1]) {
    draw('box', 'rubber', x * extent * .66, 3.50, -2.71, extent * .29, .057, .118);
    draw('box', x < 0 ? 'leaf' : 'rust', x * extent * .66, 3.50, -2.58, extent * .266, .013, .021, { glow: living ? .78 : .48 });
  }
}

function fallback(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { setState() {}, destroy() {} };
  canvas.dataset.renderMode = 'canvas';
  let state = { phase: 'idle', speaker: 'self' };
  function paint() {
    const density = Math.min(devicePixelRatio || 1, 1.65);
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    canvas.width = Math.round(width * density);
    canvas.height = Math.round(height * density);
    ctx.scale(density, density);
    const ellipse = (px, py, rx, ry, fill) => {
      ctx.beginPath();
      ctx.ellipse(px, py, rx, ry, 0, 0, TAU);
      ctx.fillStyle = fill;
      ctx.fill();
    };
    for (const [index, accent] of [palette.lime, palette.orange].entries()) {
      const x = width * (index ? .71 : .29);
      const y = height * .54;
      const radius = Math.min(width * .13, height * .28);
      ellipse(x, y + radius * 1.1, radius * 1.24, radius * .22, palette.steel);
      ellipse(x, y + radius * .42, radius * .68, radius * .72, palette.tile);
      const gradient = ctx.createRadialGradient(x - radius * .37, y - radius * .48, 0, x, y, radius * 1.23);
      gradient.addColorStop(0, '#fff5c1');
      gradient.addColorStop(.48, accent);
      gradient.addColorStop(1, index ? palette.rust : palette.leaf);
      ellipse(x, y - radius * .19, radius * .91, radius * .78, gradient);
      for (const side of [-1, 1]) {
        ellipse(x + side * radius * .26, y - radius * .29, radius * .09, radius * .135, palette.ink);
      }
      const active = state.phase !== 'idle' && state.speaker === (index ? 'friend' : 'self');
      ellipse(x, y + radius * .05, radius * .12, radius * (active ? .15 : .045), palette.ink);
    }
  }
  const observer = new ResizeObserver(paint);
  observer.observe(canvas);
  return { setState(next) { state = { ...state, ...next }; paint(); }, destroy() { observer.disconnect(); } };
}

export function createStage(canvas) {
  let graphics;
  try {
    graphics = setUp(canvas);
  } catch (error) {
    console.warn('3D stage unavailable', error);
  }
  if (!graphics) return fallback(canvas);
  canvas.dataset.renderMode = 'webgl';
  const { gl, draw, setExtent } = graphics;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let state = { phase: 'idle', online: false, speaker: 'self', volume: 0 };
  let live = 0;
  let frame = 0;
  let lastDraw = -Infinity;
  let disposed = false;

  function resize() {
    const density = Math.min(devicePixelRatio || 1, 1.65);
    const width = Math.round(canvas.clientWidth * density);
    const height = Math.round(canvas.clientHeight * density);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
    return width / Math.max(1, height);
  }

  function render(timestamp) {
    frame = 0;
    if (disposed || gl.isContextLost()) return;
    if (!motion.matches) frame = requestAnimationFrame(render);
    if (timestamp - lastDraw < 31 && !motion.matches) return;
    lastDraw = timestamp;
    const aspect = resize();
    if (!canvas.width || !canvas.height) return;
    const yExtent = Math.max(2.16, 2.94 / aspect);
    const extent = yExtent * aspect;
    setExtent(extent, yExtent);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const time = motion.matches ? .45 : timestamp / 1000;
    const { phase, speaker, online, volume } = state;
    const moving = phase === 'demo' || phase === 'replay' || phase === 'recording';
    live += ((moving ? volume : 0) - live) * (motion.matches ? 1 : .31);
    const pulse = moving && phase !== 'recording' ? .28 + Math.abs(Math.sin(time * 7)) * .38 : 0;
    const intensity = Math.min(1, Math.max(live * 1.22, pulse));
    const left = moving && speaker === 'self';
    const right = moving && speaker === 'friend';
    const position = Math.min(2.12, extent * .53);
    floorScene(draw, extent, moving);
    if (extent > 4.1) {
      const x = Math.min(extent - .73, 5.72);
      speakerStack(draw, -x);
      speakerStack(draw, x);
    }
    board(draw, time, moving ? intensity : (online ? .16 : .04), (left && phase === 'recording') || right ? 'orange' : 'lime');
    podium(draw, -position, 'lime', left || phase === 'result');
    podium(draw, position, 'orange', right || (phase === 'result' && online));
    mascot(draw, -position, false, time, left ? intensity : 0, phase);
    mascot(draw, position, true, time, right ? intensity : 0, online ? phase : 'idle');
    microphone(draw, -position, 1, left && phase === 'recording');
    microphone(draw, position, -1, right);
  }

  const request = () => { if (!frame && !disposed) frame = requestAnimationFrame(render); };
  const observer = new ResizeObserver(request);
  observer.observe(canvas);
  motion.addEventListener('change', request);
  request();
  return {
    setState(next) {
      state = { ...state, ...next };
      state.volume = Number.isFinite(state.volume) ? Math.min(1, Math.max(0, state.volume)) : 0;
      request();
    },
    destroy() {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      motion.removeEventListener('change', request);
      graphics.release();
    }
  };
}
