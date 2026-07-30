/**
 * 必要最小限の WebGL レンダラー（three.js の代わり）。
 * ・単一シェーダー（頂点カラー＋任意テクスチャ＋半球ライト＋指数フォグ）
 * ・静的な街はひとつのバッファにまとめて 1 ドローコールで描く
 * ・看板はビルボード（常にカメラを向く板）としてシェーダー側で回す
 */

/* --------------------------------------------------------------- 行列 */

export function mat4() {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}

export function perspective(out, fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) * nf;
  out[11] = -1;
  out[14] = 2 * far * near * nf;
  return out;
}

export function lookAt(out, eye, center, up) {
  let zx = eye[0] - center[0];
  let zy = eye[1] - center[1];
  let zz = eye[2] - center[2];
  let len = Math.hypot(zx, zy, zz) || 1;
  zx /= len;
  zy /= len;
  zz /= len;
  let xx = up[1] * zz - up[2] * zy;
  let xy = up[2] * zx - up[0] * zz;
  let xz = up[0] * zy - up[1] * zx;
  len = Math.hypot(xx, xy, xz) || 1;
  xx /= len;
  xy /= len;
  xz /= len;
  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;

  out[0] = xx;
  out[1] = yx;
  out[2] = zx;
  out[3] = 0;
  out[4] = xy;
  out[5] = yy;
  out[6] = zy;
  out[7] = 0;
  out[8] = xz;
  out[9] = yz;
  out[10] = zz;
  out[11] = 0;
  out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
  out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
  out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
  out[15] = 1;
  return out;
}

export function multiply(out, a, b) {
  for (let c = 0; c < 4; c += 1) {
    const b0 = b[c * 4];
    const b1 = b[c * 4 + 1];
    const b2 = b[c * 4 + 2];
    const b3 = b[c * 4 + 3];
    out[c * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
    out[c * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
    out[c * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
    out[c * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
  }
  return out;
}

/** 平行移動 → Y回転 → スケール の合成 */
export function compose(out, x, y, z, ry, sx, sy, sz) {
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  out[0] = c * sx;
  out[1] = 0;
  out[2] = -s * sx;
  out[3] = 0;
  out[4] = 0;
  out[5] = sy;
  out[6] = 0;
  out[7] = 0;
  out[8] = s * sz;
  out[9] = 0;
  out[10] = c * sz;
  out[11] = 0;
  out[12] = x;
  out[13] = y;
  out[14] = z;
  out[15] = 1;
  return out;
}

/* ----------------------------------------------------------- ジオメトリ */

/** 頂点をためて最後に1本のバッファにする箱 */
export function createGeometry() {
  return { pos: [], normal: [], color: [], uv: [], index: [] };
}

const tmp = new Float32Array(3);

/**
 * geo に別のジオメトリを（変換して）追加する。
 * matrix は compose() で作った 4x4。色は [r,g,b]（0〜1）。
 */
export function append(geo, part, matrix, color) {
  const base = geo.pos.length / 3;
  const p = part.pos;
  const n = part.normal;

  for (let i = 0; i < p.length; i += 3) {
    if (matrix) {
      const x = p[i];
      const y = p[i + 1];
      const z = p[i + 2];
      geo.pos.push(
        matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
        matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
        matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]
      );
      tmp[0] = matrix[0] * n[i] + matrix[4] * n[i + 1] + matrix[8] * n[i + 2];
      tmp[1] = matrix[1] * n[i] + matrix[5] * n[i + 1] + matrix[9] * n[i + 2];
      tmp[2] = matrix[2] * n[i] + matrix[6] * n[i + 1] + matrix[10] * n[i + 2];
      const len = Math.hypot(tmp[0], tmp[1], tmp[2]) || 1;
      geo.normal.push(tmp[0] / len, tmp[1] / len, tmp[2] / len);
    } else {
      geo.pos.push(p[i], p[i + 1], p[i + 2]);
      geo.normal.push(n[i], n[i + 1], n[i + 2]);
    }
    geo.color.push(color[0], color[1], color[2]);
  }
  if (part.uv) {
    for (let i = 0; i < part.uv.length; i += 1) geo.uv.push(part.uv[i]);
  } else {
    for (let i = 0; i < p.length / 3; i += 1) geo.uv.push(0, 0);
  }
  for (let i = 0; i < part.index.length; i += 1) geo.index.push(part.index[i] + base);
  return geo;
}

function emptyPart() {
  return { pos: [], normal: [], uv: [], index: [] };
}

/** 直方体（中心が原点） */
export function box(w, h, d) {
  const part = emptyPart();
  const x = w / 2;
  const y = h / 2;
  const z = d / 2;
  const faces = [
    [[x, -y, -z], [x, -y, z], [x, y, z], [x, y, -z], [1, 0, 0]],
    [[-x, -y, z], [-x, -y, -z], [-x, y, -z], [-x, y, z], [-1, 0, 0]],
    [[-x, y, -z], [x, y, -z], [x, y, z], [-x, y, z], [0, 1, 0]],
    [[-x, -y, z], [x, -y, z], [x, -y, -z], [-x, -y, -z], [0, -1, 0]],
    [[-x, -y, z], [-x, y, z], [x, y, z], [x, -y, z], [0, 0, 1]],
    [[x, -y, -z], [x, y, -z], [-x, y, -z], [-x, -y, -z], [0, 0, -1]],
  ];
  faces.forEach((f) => {
    const base = part.pos.length / 3;
    const n = f[4];
    for (let i = 0; i < 4; i += 1) {
      part.pos.push(f[i][0], f[i][1], f[i][2]);
      part.normal.push(n[0], n[1], n[2]);
    }
    part.uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    part.index.push(base, base + 2, base + 1, base, base + 3, base + 2);
  });
  return part;
}

/** 水平な円板（XZ 平面、法線 +Y） */
export function disc(radius, segments) {
  const part = emptyPart();
  part.pos.push(0, 0, 0);
  part.normal.push(0, 1, 0);
  part.uv.push(0.5, 0.5);
  for (let i = 0; i <= segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    part.pos.push(x, 0, z);
    part.normal.push(0, 1, 0);
    part.uv.push(0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5);
    if (i > 0) part.index.push(0, i + 1, i);
  }
  return part;
}

/** 水平なリング（XZ 平面） */
export function ring(inner, outer, segments) {
  const part = emptyPart();
  for (let i = 0; i <= segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    part.pos.push(c * inner, 0, s * inner, c * outer, 0, s * outer);
    part.normal.push(0, 1, 0, 0, 1, 0);
    part.uv.push(0, 0, 1, 1);
    if (i > 0) {
      const b = (i - 1) * 2;
      part.index.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
    }
  }
  return part;
}

/** 水平な四角（XZ 平面、幅 w × 奥行 d） */
export function quadXZ(w, d) {
  const part = emptyPart();
  const x = w / 2;
  const z = d / 2;
  part.pos.push(-x, 0, -z, x, 0, -z, x, 0, z, -x, 0, z);
  for (let i = 0; i < 4; i += 1) part.normal.push(0, 1, 0);
  part.uv.push(0, 0, 1, 0, 1, 1, 0, 1);
  part.index.push(0, 2, 1, 0, 3, 2);
  return part;
}

/** 垂直な四角（XY 平面、ビルボード用） */
export function quadXY(w, h) {
  const part = emptyPart();
  const x = w / 2;
  const y = h / 2;
  part.pos.push(-x, -y, 0, x, -y, 0, x, y, 0, -x, y, 0);
  for (let i = 0; i < 4; i += 1) part.normal.push(0, 0, 1);
  part.uv.push(0, 1, 1, 1, 1, 0, 0, 0);
  part.index.push(0, 1, 2, 0, 2, 3);
  return part;
}

/** 円柱／円錐（rTop = 0 で円錐）。原点は底面中心 */
export function cylinder(rTop, rBottom, h, segments) {
  const part = emptyPart();
  for (let i = 0; i <= segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    part.pos.push(c * rBottom, 0, s * rBottom, c * rTop, h, s * rTop);
    const ny = (rBottom - rTop) / h;
    const len = Math.hypot(1, ny) || 1;
    part.normal.push(c / len, ny / len, s / len, c / len, ny / len, s / len);
    part.uv.push(i / segments, 0, i / segments, 1);
    if (i > 0) {
      const b = (i - 1) * 2;
      part.index.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }
  }
  // ふた
  const capBase = part.pos.length / 3;
  part.pos.push(0, h, 0);
  part.normal.push(0, 1, 0);
  part.uv.push(0.5, 0.5);
  for (let i = 0; i <= segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    part.pos.push(Math.cos(a) * rTop, h, Math.sin(a) * rTop);
    part.normal.push(0, 1, 0);
    part.uv.push(0.5, 0.5);
    if (i > 0) part.index.push(capBase, capBase + i + 1, capBase + i);
  }
  return part;
}

/** 低ポリの球（原点が中心） */
export function sphere(radius, segments, rings) {
  const part = emptyPart();
  for (let y = 0; y <= rings; y += 1) {
    const v = y / rings;
    const phi = v * Math.PI;
    for (let x = 0; x <= segments; x += 1) {
      const u = x / segments;
      const theta = u * Math.PI * 2;
      const nx = Math.sin(phi) * Math.cos(theta);
      const ny = Math.cos(phi);
      const nz = Math.sin(phi) * Math.sin(theta);
      part.pos.push(nx * radius, ny * radius, nz * radius);
      part.normal.push(nx, ny, nz);
      part.uv.push(u, v);
    }
  }
  const row = segments + 1;
  for (let y = 0; y < rings; y += 1) {
    for (let x = 0; x < segments; x += 1) {
      const a = y * row + x;
      part.index.push(a, a + 1, a + row, a + 1, a + row + 1, a + row);
    }
  }
  return part;
}

/* ------------------------------------------------------------ シェーダー */

const VERT = `
attribute vec3 aPos;
attribute vec3 aNormal;
attribute vec3 aColor;
attribute vec2 aUV;
uniform mat4 uViewProj;
uniform mat4 uModel;
uniform vec3 uEye;
uniform float uBillboard;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform vec4 uUVTransform;
varying vec3 vNormal;
varying vec3 vColor;
varying vec2 vUV;
varying float vDist;
void main() {
  vec3 world;
  if (uBillboard > 0.5) {
    vec3 center = vec3(uModel[3][0], uModel[3][1], uModel[3][2]);
    world = center + aPos.x * uModel[0][0] * uCamRight + aPos.y * uModel[1][1] * uCamUp;
    vNormal = vec3(0.0, 1.0, 0.0);
  } else {
    world = (uModel * vec4(aPos, 1.0)).xyz;
    vNormal = normalize((uModel * vec4(aNormal, 0.0)).xyz);
  }
  vColor = aColor;
  vUV = aUV * uUVTransform.xy + uUVTransform.zw;
  vDist = length(world - uEye);
  gl_Position = uViewProj * vec4(world, 1.0);
}`;

const FRAG = `
precision mediump float;
uniform vec3 uSun;
uniform vec3 uSunColor;
uniform vec3 uSkyColor;
uniform vec3 uGroundColor;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform vec4 uTint;
uniform float uUseTex;
uniform float uUnlit;
uniform float uEmissive;
uniform sampler2D uTex;
varying vec3 vNormal;
varying vec3 vColor;
varying vec2 vUV;
varying float vDist;
void main() {
  vec4 tex = vec4(1.0);
  if (uUseTex > 0.5) tex = texture2D(uTex, vUV);
  float alpha = uTint.a * tex.a;
  if (alpha < 0.02) discard;
  vec3 base = vColor * uTint.rgb * tex.rgb;
  vec3 lit = base;
  if (uUnlit < 0.5) {
    vec3 n = normalize(vNormal);
    float d = max(dot(n, uSun), 0.0);
    vec3 ambient = mix(uGroundColor, uSkyColor, 0.5 + 0.5 * n.y);
    lit = base * (ambient + uSunColor * d);
  }
  lit += base * uEmissive;
  float f = clamp(1.0 - exp(-uFogDensity * uFogDensity * vDist * vDist), 0.0, 1.0);
  gl_FragColor = vec4(mix(lit, uFogColor, f), alpha);
}`;

function compile(gl, type, src) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) || 'shader error');
  }
  return shader;
}

/* -------------------------------------------------------------- 本体 */

export function createRenderer(canvas) {
  const opts = { antialias: true, alpha: false, depth: true, powerPreference: 'high-performance' };
  const gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
  if (!gl) return null;

  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);

  const attrib = {
    pos: gl.getAttribLocation(program, 'aPos'),
    normal: gl.getAttribLocation(program, 'aNormal'),
    color: gl.getAttribLocation(program, 'aColor'),
    uv: gl.getAttribLocation(program, 'aUV'),
  };
  const uni = {};
  [
    'uViewProj',
    'uModel',
    'uEye',
    'uBillboard',
    'uCamRight',
    'uCamUp',
    'uUVTransform',
    'uSun',
    'uSunColor',
    'uSkyColor',
    'uGroundColor',
    'uFogColor',
    'uFogDensity',
    'uTint',
    'uUseTex',
    'uUnlit',
    'uEmissive',
    'uTex',
  ].forEach((name) => {
    uni[name] = gl.getUniformLocation(program, name);
  });

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.uniform1i(uni.uTex, 0);

  const identity = mat4();
  const model = mat4();
  const viewProj = mat4();
  const view = mat4();
  const proj = mat4();
  const white = [1, 1, 1, 1];

  function upload(target, data, Type) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(target, buffer);
    gl.bufferData(target, new Type(data), gl.STATIC_DRAW);
    return buffer;
  }

  function createMesh(geo) {
    return {
      pos: upload(gl.ARRAY_BUFFER, geo.pos, Float32Array),
      normal: upload(gl.ARRAY_BUFFER, geo.normal, Float32Array),
      color: upload(gl.ARRAY_BUFFER, geo.color, Float32Array),
      uv: upload(gl.ARRAY_BUFFER, geo.uv, Float32Array),
      index: upload(gl.ELEMENT_ARRAY_BUFFER, geo.index, Uint16Array),
      count: geo.index.length,
      buffers: null,
    };
  }

  function createMeshFromPart(part, color) {
    const geo = createGeometry();
    append(geo, part, null, color);
    return createMesh(geo);
  }

  function disposeMesh(mesh) {
    if (!mesh) return;
    [mesh.pos, mesh.normal, mesh.color, mesh.uv, mesh.index].forEach((b) => gl.deleteBuffer(b));
  }

  function createTexture(source) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  function createRepeatTexture(source) {
    const tex = createTexture(source);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    return tex;
  }

  function setSize(width, height, dpr) {
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  const camera = {
    eye: [0, 20, 30],
    target: [0, 3, 0],
    fov: 0.95,
    right: [1, 0, 0],
    up: [0, 1, 0],
    forward: [0, 0, -1],
  };

  /** カメラ・光・フォグをまとめて設定し、画面をクリアする */
  function beginFrame(env) {
    const aspect = canvas.width / canvas.height || 1;
    perspective(proj, camera.fov, aspect, 0.5, 620);
    lookAt(view, camera.eye, camera.target, [0, 1, 0]);
    multiply(viewProj, proj, view);

    // カメラの基底（ビルボードとタップ判定に使う）
    camera.right[0] = view[0];
    camera.right[1] = view[4];
    camera.right[2] = view[8];
    camera.up[0] = view[1];
    camera.up[1] = view[5];
    camera.up[2] = view[9];
    camera.forward[0] = -view[2];
    camera.forward[1] = -view[6];
    camera.forward[2] = -view[10];

    gl.uniformMatrix4fv(uni.uViewProj, false, viewProj);
    gl.uniform3fv(uni.uEye, camera.eye);
    gl.uniform3fv(uni.uCamRight, camera.right);
    gl.uniform3fv(uni.uCamUp, camera.up);
    gl.uniform3fv(uni.uSun, env.sun);
    gl.uniform3fv(uni.uSunColor, env.sunColor);
    gl.uniform3fv(uni.uSkyColor, env.skyColor);
    gl.uniform3fv(uni.uGroundColor, env.groundColor);
    gl.uniform3fv(uni.uFogColor, env.fogColor);
    gl.uniform1f(uni.uFogDensity, env.fogDensity);

    gl.clearColor(env.clear[0], env.clear[1], env.clear[2], 1);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  function bind(location, buffer, size) {
    if (location < 0) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
  }

  /**
   * mesh を描く。
   * opts: { model, tint:[r,g,b,a], texture, uv:[rx,ry,ox,oy], unlit, emissive,
   *         billboard, blend, depthWrite, cull }
   */
  function draw(mesh, opts = {}) {
    if (!mesh || !mesh.count) return;
    gl.uniformMatrix4fv(uni.uModel, false, opts.model || identity);
    gl.uniform4fv(uni.uTint, opts.tint || white);
    gl.uniform1f(uni.uUnlit, opts.unlit ? 1 : 0);
    gl.uniform1f(uni.uEmissive, opts.emissive || 0);
    gl.uniform1f(uni.uBillboard, opts.billboard ? 1 : 0);
    gl.uniform4fv(uni.uUVTransform, opts.uv || [1, 1, 0, 0]);

    if (opts.texture) {
      gl.uniform1f(uni.uUseTex, 1);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, opts.texture);
    } else {
      gl.uniform1f(uni.uUseTex, 0);
    }

    if (opts.blend) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    } else {
      gl.disable(gl.BLEND);
    }
    gl.depthMask(opts.depthWrite === false ? false : true);
    if (opts.cull === false) gl.disable(gl.CULL_FACE);
    else gl.enable(gl.CULL_FACE);

    bind(attrib.pos, mesh.pos, 3);
    bind(attrib.normal, mesh.normal, 3);
    bind(attrib.color, mesh.color, 3);
    bind(attrib.uv, mesh.uv, 2);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.index);
    gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
  }

  /** 画面座標 → ワールドのレイ（カメラ基底から直接つくる） */
  function screenRay(nx, ny, aspect) {
    const t = Math.tan(camera.fov / 2);
    const dx = nx * t * aspect;
    const dy = ny * t;
    const d = [
      camera.forward[0] + camera.right[0] * dx + camera.up[0] * dy,
      camera.forward[1] + camera.right[1] * dx + camera.up[1] * dy,
      camera.forward[2] + camera.right[2] * dx + camera.up[2] * dy,
    ];
    const len = Math.hypot(d[0], d[1], d[2]) || 1;
    return { origin: camera.eye, dir: [d[0] / len, d[1] / len, d[2] / len] };
  }

  return {
    gl,
    camera,
    model,
    setSize,
    beginFrame,
    draw,
    createMesh,
    createMeshFromPart,
    disposeMesh,
    createTexture,
    createRepeatTexture,
    deleteTexture: (t) => gl.deleteTexture(t),
    screenRay,
  };
}

/** '#rrggbb' → [r,g,b]（0〜1） */
export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(v, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function mixRgb(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
