// WebGL renderer of the 3D kit preview: stadium-style lights, generated 360° environments and a
// fabric shader with normal / shine maps. Extracted verbatim from PES Editor Rebuilt js/kit3d.js
// (K3LIGHTS, K3ENV.scene, K3GL; BSD-3-Clause, copyright AgustinMarconi27) — see pes/THIRD_PARTY_NOTICES.md.
// Only the export wrapper, the light-state helper and the removal of the HDR import / UV picking differ.
/* eslint-disable */
export const LIGHT_PRESETS = {
  'estudio': { n: 'Estudio', key: [-35, 32, 1.4, '#fff6ea'], fill: [55, 8, .5, '#cfe0ff'], rim: [175, 28, .9, '#ffffff'], amb: .55, exp: 1.05, env: 'estudio' },
  'estadio-dia': { n: 'Estadio de día', key: [28, 55, 1.9, '#fff1d6'], fill: [-70, 12, .4, '#bcd6ff'], rim: [190, 22, .5, '#ffffff'], amb: .6, exp: 1, env: 'dia' },
  'estadio-noche': { n: 'Estadio de noche', key: [-25, 42, 1.6, '#eef4ff'], fill: [62, 40, 1.05, '#dfe9ff'], rim: [180, 35, 1.15, '#bcd2ff'], amb: .45, exp: 1.1, env: 'noche' },
  'atardecer': { n: 'Atardecer', key: [-65, 12, 1.8, '#ffb36b'], fill: [75, 20, .45, '#9a83ff'], rim: [175, 18, .85, '#ff7aa8'], amb: .5, exp: 1, env: 'atardecer' },
  'vestuario': { n: 'Vestuario', key: [0, 62, 1.35, '#ffe2b8'], fill: [-90, 20, .4, '#ffd9a8'], rim: [180, 40, .45, '#ffffff'], amb: .65, exp: 1, env: 'vestuario' },
};

export const KitEnv = (() => {
  const W = 512, H = 256, cache = new Map();
  const dirOf = (u, v) => { const ph = (u - .5) * 2 * Math.PI, th = v * Math.PI; return [Math.sin(th) * Math.sin(ph), Math.cos(th), -Math.sin(th) * Math.cos(ph)]; };
  const sdir = (az, el) => { const a = az * Math.PI / 180, e = el * Math.PI / 180; return [Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e) * -1]; };
  const blob = (d, c, size, pow = 1) => { const k = Math.max(0, d[0] * c[0] + d[1] * c[1] + d[2] * c[2]); return Math.pow(Math.max(0, (k - (1 - size)) / size), pow); };
  const mix = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
  const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
  const SCENES = {
    estudio: (d, u, v) => { let c = mix([.10, .11, .13], [.32, .34, .37], Math.max(0, d[1]) * .8 + .2); if (d[1] < -.05) c = [.05, .05, .06];
      for (const [az, el, s, k] of [[-40, 30, .06, 9], [55, 15, .08, 4], [180, 35, .05, 6]]) { const b = blob(d, sdir(az, el), s, 2) * k; c = c.map(x => x + b); } return c; },
    dia: (d, u, v) => { const y = d[1]; let c;
      if (y > .12) c = mix([.62, .76, .95], [.22, .45, .85], Math.min(1, (y - .12) * 1.6)); else if (y > -.02) { const st = hash(Math.floor(u * 400), Math.floor(v * 120)); c = mix([.28, .30, .33], [.55, .56, .58], st * .5 + (y + .02) * 2); } else c = mix([.22, .48, .2], [.12, .32, .12], Math.min(1, -y * 2));
      c = c.map(x => x + blob(d, sdir(28, 55), .004, 1) * 40 + blob(d, sdir(28, 55), .08, 2) * .8); return c; },
    noche: (d, u, v) => { const y = d[1]; let c;
      if (y > .1) c = mix([.05, .07, .13], [.01, .015, .035], Math.min(1, (y - .1) * 1.5)); else if (y > -.03) { const st = hash(Math.floor(u * 500), Math.floor(v * 150)); c = [.04, .045, .06].map(x => x + (st > .992 ? .35 : 0)); } else c = mix([.12, .32, .14], [.06, .18, .08], Math.min(1, -y * 2));
      for (const az of [-45, 45, 135, -135]) { const b = blob(d, sdir(az, 38), .006, 1) * 30 + blob(d, sdir(az, 38), .07, 3) * 1.1; c = c.map(x => x + b); } return c; },
    atardecer: (d, u, v) => { const y = d[1]; let c = y > 0 ? mix([.95, .55, .3], [.18, .12, .32], Math.min(1, y * 1.8)) : mix([.2, .12, .16], [.07, .05, .08], Math.min(1, -y * 3));
      c = c.map((x, i) => x + blob(d, sdir(-65, 8), .003, 1) * [30, 18, 8][i] + blob(d, sdir(-65, 8), .1, 2) * [1.2, .6, .3][i]); return c; },
    vestuario: (d, u, v) => { const y = d[1]; let c = y > .55 ? [.55, .5, .45] : y > -.25 ? mix([.36, .28, .22], [.5, .42, .34], (y + .25)) : [.2, .13, .08];
      for (const az of [0, 90, 180, -90]) { const b = blob(d, sdir(az, 70), .01, 1) * 14; c = c.map((x, i) => x + b * [1, .9, .75][i]); } return c; },
  };
  // armónicos esféricos (9 coeficientes): la luz difusa que llega de todo el entorno
  function sh9(f, w, h) {
    const C = Array.from({ length: 9 }, () => [0, 0, 0]); let tot = 0;
    for (let y = 0; y < h; y++) { const v = (y + .5) / h, wgt = Math.sin(v * Math.PI); for (let x = 0; x < w; x++) {
      const d = dirOf((x + .5) / w, v), c = f(x, y), [X, Y, Z] = d;
      const b = [.282095, .488603 * Y, .488603 * Z, .488603 * X, 1.092548 * X * Y, 1.092548 * Y * Z, .315392 * (3 * Z * Z - 1), 1.092548 * X * Z, .546274 * (X * X - Y * Y)];
      for (let i = 0; i < 9; i++) for (let k = 0; k < 3; k++) C[i][k] += c[k] * b[i] * wgt; tot += wgt; } }
    const norm = 4 * Math.PI / tot; return C.map(c => c.map(x => x * norm));
  }
  const tone = x => Math.round(255 * Math.pow(Math.min(1, x / (1 + x * .35)), 1 / 2.2));
  function scene(key) {
    if (cache.has(key)) return cache.get(key); const fn = SCENES[key] || SCENES.estudio, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d'), im = g.createImageData(W, H), F = new Float32Array(W * H * 3);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const u = (x + .5) / W, v = (y + .5) / H, c = fn(dirOf(u, v), u, v), i = (y * W + x); F[i * 3] = c[0]; F[i * 3 + 1] = c[1]; F[i * 3 + 2] = c[2]; im.data[i * 4] = tone(c[0]); im.data[i * 4 + 1] = tone(c[1]); im.data[i * 4 + 2] = tone(c[2]); im.data[i * 4 + 3] = 255; }
    g.putImageData(im, 0, 0);
    const sw = 64, sh = 32, sh_ = sh9((x, y) => { const sx = Math.floor((x + .5) * W / sw), sy = Math.floor((y + .5) * H / sh), i = sy * W + sx; return [F[i * 3], F[i * 3 + 1], F[i * 3 + 2]]; }, sw, sh);
    const e = { canvas: cv, sh: sh_, name: key }; cache.set(key, e); return e;
  }
  return { scene, SCENES: Object.keys(SCENES) };
})();

export const KitGL = (() => {
  const VS = `attribute vec3 p;attribute vec3 n;attribute vec2 t;uniform mat4 mvp;uniform mat4 mv;uniform float grow;varying vec3 vn;varying vec2 vt;varying vec3 vp;
    void main(){vec3 q=p*grow;vn=mat3(mv)*n;vt=t;vp=(mv*vec4(q,1.)).xyz;gl_Position=mvp*vec4(q,1.);}`;
  const FS = `#extension GL_OES_standard_derivatives : enable
    precision highp float;varying vec3 vn;varying vec2 vt;varying vec3 vp;
    uniform sampler2D tex;uniform sampler2D nrm;uniform sampler2D srm;uniform sampler2D gls;uniform sampler2D env;uniform sampler2D env2;
    uniform float useTex;uniform float useN;uniform float useS;uniform float useG;uniform float bump;uniform vec3 col;uniform float glossK;uniform float debug;
    uniform vec3 L1;uniform vec3 C1;uniform vec3 L2;uniform vec3 C2;uniform vec3 L3;uniform vec3 C3;uniform float amb;uniform float specK;uniform float expo;uniform float defSpec;uniform float defRough;
    uniform vec3 sh[9];uniform float envInt;uniform float envYaw;uniform float envMix;uniform float useEnv;
    const float PI=3.14159265;
    vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
    vec3 rotY(vec3 d,float a){float c=cos(a),s=sin(a);return vec3(c*d.x+s*d.z,d.y,-s*d.x+c*d.z);}
    vec2 eq(vec3 d){return vec2(.5+atan(d.x,-d.z)/(2.*PI),acos(clamp(d.y,-1.,1.))/PI);}
    vec3 envS(vec3 d,float b){vec2 u=eq(rotY(d,envYaw));vec3 a=pow(texture2D(env,u,b).rgb,vec3(2.2));vec3 c=pow(texture2D(env2,u,b).rgb,vec3(2.2));return mix(c,a,envMix);}
    vec3 irr(vec3 n){vec3 d=rotY(n,envYaw);float x=d.x,y=d.y,z=d.z;return max(vec3(0.),.886227*sh[0]+1.023328*(sh[1]*y+sh[2]*z+sh[3]*x)+.858086*(sh[4]*x*y+sh[5]*y*z+sh[7]*x*z)+.247708*sh[6]*(3.*z*z-1.)+.429043*sh[8]*(x*x-y*y));}
    vec3 light(vec3 N,vec3 V,vec3 L,vec3 C,vec3 alb,float sp,float sh_){float d=max(dot(N,L),0.);vec3 H=normalize(L+V);float s=pow(max(dot(N,H),0.),sh_)*sp*(sh_+8.)/40.;float w=.25;float dw=max((dot(N,L)+w)/(1.+w),0.);return C*(alb*mix(d,dw,.35)+s*d);}
    void main(){vec3 N=normalize(vn);vec3 V=normalize(-vp);if(dot(N,V)<0.)N=-N;
      if(useN>.5){vec3 dp1=dFdx(vp),dp2=dFdy(vp);vec2 du1=dFdx(vt),du2=dFdy(vt);vec3 p2=cross(dp2,N),p1=cross(N,dp1);vec3 T=p2*du1.x+p1*du2.x;vec3 B=p2*du1.y+p1*du2.y;float iv=inversesqrt(max(max(dot(T,T),dot(B,B)),1e-12));
        vec2 nn=(texture2D(nrm,vt).rg*2.-1.)*bump;vec3 tn=vec3(nn.x,-nn.y,sqrt(max(0.,1.-dot(nn,nn))));N=normalize(T*iv*tn.x+B*iv*tn.y+N*tn.z);}
      float g=useG>.5?texture2D(gls,vt).r:.5;
      if(debug>.5&&debug<1.5){gl_FragColor=vec4(vec3(g),1.);return;}
      if(debug>1.5){gl_FragColor=vec4(N*.5+.5,1.);return;}
      vec3 alb=useTex>.5?texture2D(tex,vt).rgb:col;alb=pow(alb,vec3(2.2));
      vec2 sr=useS>.5?texture2D(srm,vt).rg:vec2(defSpec,defRough);
      float gm=mix(1.,.15+g*1.85,glossK);float sp=sr.x*.55*specK*gm;float rough=clamp(sr.y-(g-.5)*.5*glossK,.04,1.);float sh_=mix(48.,5.,rough);
      vec3 c=alb*amb*(useEnv>.5?irr(N)*envInt:vec3(.35))+light(N,V,L1,C1,alb,sp,sh_)+light(N,V,L2,C2,alb,sp*.5,sh_)+light(N,V,L3,C3,alb,sp*.8,sh_);
      if(useEnv>.5){vec3 R=reflect(-V,N);float fr=.04+.96*pow(1.-max(dot(N,V),0.),5.);c+=envS(R,rough*7.)*fr*sp*1.4*envInt;}
      c+=pow(1.-max(dot(N,V),0.),3.)*C3*.15;
      gl_FragColor=vec4(pow(aces(c*expo),vec3(1./2.2)),1.);}`;
  // fondo: el entorno visto por la cámara
  const BVS = `attribute vec2 q;varying vec2 vq;void main(){vq=q;gl_Position=vec4(q,.999,1.);}`;
  const BFS = `precision highp float;varying vec2 vq;uniform sampler2D env;uniform sampler2D env2;uniform float envYaw;uniform float envMix;uniform vec2 tanH;uniform float blur;uniform float expo;uniform float pitch;
    const float PI=3.14159265;vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
    void main(){vec3 d=normalize(vec3(vq.x*tanH.x,vq.y*tanH.y,-1.));float c=cos(pitch),s=sin(pitch);d=vec3(d.x,c*d.y-s*d.z,s*d.y+c*d.z);
      float cy=cos(envYaw),sy=sin(envYaw);d=vec3(cy*d.x+sy*d.z,d.y,-sy*d.x+cy*d.z);vec2 u=vec2(.5+atan(d.x,-d.z)/(2.*PI),acos(clamp(d.y,-1.,1.))/PI);
      vec3 a=pow(texture2D(env,u,blur).rgb,vec3(2.2)),b=pow(texture2D(env2,u,blur).rgb,vec3(2.2));gl_FragColor=vec4(pow(aces(mix(b,a,envMix)*expo),vec3(1./2.2)),1.);}`;
  // selección: guarda la coordenada de textura (12 bits por eje) para pintar sobre el modelo
  const PFS = `precision highp float;varying vec2 vt;void main(){vec2 u=clamp(vt,0.,1.)*4095.;float uh=floor(u.x/16.),ul=mod(floor(u.x),16.),vh=floor(u.y/256.),vl=mod(floor(u.y),256.);gl_FragColor=vec4(uh/255.,(ul*16.+vh)/255.,vl/255.,1.);}`;
  const PVS = `attribute vec3 p;attribute vec2 t;uniform mat4 mvp;uniform float grow;varying vec2 vt;void main(){vt=t;gl_Position=mvp*vec4(p*grow,1.);}`;
  function make(canvas) {
    const gl = canvas.getContext('webgl', { antialias: true, preserveDrawingBuffer: true, premultipliedAlpha: false, alpha: true }); if (!gl) return null;
    gl.getExtension('OES_standard_derivatives');
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const prog = (v, f) => { const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, v)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, f)); gl.linkProgram(pr); return pr; };
    const pr = prog(VS, FS), bp = prog(BVS, BFS), pp = prog(PVS, PFS); gl.useProgram(pr);
    const U = (p, n) => gl.getUniformLocation(p, n), loc = { p: gl.getAttribLocation(pr, 'p'), n: gl.getAttribLocation(pr, 'n'), t: gl.getAttribLocation(pr, 't') };
    for (const n of ['mvp', 'mv', 'grow', 'tex', 'nrm', 'srm', 'gls', 'env', 'env2', 'useTex', 'useN', 'useS', 'useG', 'bump', 'col', 'glossK', 'debug', 'L1', 'C1', 'L2', 'C2', 'L3', 'C3', 'amb', 'specK', 'expo', 'defSpec', 'defRough', 'envInt', 'envYaw', 'envMix', 'useEnv']) loc[n] = U(pr, n);
    loc.sh = U(pr, 'sh');
    [['tex', 0], ['nrm', 1], ['srm', 2], ['gls', 3], ['env', 4], ['env2', 5]].forEach(([n, i]) => gl.uniform1i(loc[n], i));
    const bl = { q: gl.getAttribLocation(bp, 'q') }; for (const n of ['env', 'env2', 'envYaw', 'envMix', 'tanH', 'blur', 'expo', 'pitch']) bl[n] = U(bp, n);
    gl.useProgram(bp); gl.uniform1i(bl.env, 4); gl.uniform1i(bl.env2, 5); gl.useProgram(pr);
    const pl = { p: gl.getAttribLocation(pp, 'p'), t: gl.getAttribLocation(pp, 't'), mvp: U(pp, 'mvp'), grow: U(pp, 'grow') };
    const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enable(gl.DEPTH_TEST);
    return { gl, pr, bp, pp, loc, bl, pl, quad, bufs: [], tx: {}, src: {} };
  }
  // une las normales de todas las piezas que se tocan (camiseta, mangas, cuello, short): sin esto se ven "escalones" de luz en las costuras
  function weld(parts, tol = .003) {
    const acc = new Map(), key = (x, y, z) => Math.round(x / tol) + ',' + Math.round(y / tol) + ',' + Math.round(z / tol);
    for (const { m } of parts) for (const me of m.meshes) for (let i = 0; i < me.pos.length / 3; i++) { const k = key(me.pos[i * 3], me.pos[i * 3 + 1], me.pos[i * 3 + 2]); let v = acc.get(k); if (!v) acc.set(k, v = [0, 0, 0]); v[0] += me.nrm[i * 3]; v[1] += me.nrm[i * 3 + 1]; v[2] += me.nrm[i * 3 + 2]; }
    return parts.map(({ k, m }) => ({ k, m: { meshes: m.meshes.map(me => { const n = new Float32Array(me.nrm.length); for (let i = 0; i < me.pos.length / 3; i++) { const v = acc.get(key(me.pos[i * 3], me.pos[i * 3 + 1], me.pos[i * 3 + 2])), l = Math.hypot(v[0], v[1], v[2]) || 1, o = me.nrm; const d = (o[i * 3] * v[0] + o[i * 3 + 1] * v[1] + o[i * 3 + 2] * v[2]) / l; if (d > .5) { n[i * 3] = v[0] / l; n[i * 3 + 1] = v[1] / l; n[i * 3 + 2] = v[2] / l; } else { n[i * 3] = o[i * 3]; n[i * 3 + 1] = o[i * 3 + 1]; n[i * 3 + 2] = o[i * 3 + 2]; } } return Object.assign({}, me, { nrm: n }); }) } }));
  }
  const ORDER = { shirt: 0, shorts: 1, socks: 2, sleeve: 3, collar: 4 };
  function upload(R, parts) {
    const { gl } = R; for (const b of R.bufs) for (const x of [b.p, b.n, b.t, b.i]) gl.deleteBuffer(x); R.bufs = [];
    for (const { k, m } of [...parts].sort((a, b) => (ORDER[a.k] ?? 9) - (ORDER[b.k] ?? 9))) for (const me of m.meshes) {
      const mk = (data, tgt = gl.ARRAY_BUFFER) => { const o = gl.createBuffer(); gl.bindBuffer(tgt, o); gl.bufferData(tgt, data, gl.STATIC_DRAW); return o; };
      R.bufs.push({ k, p: mk(me.pos), n: mk(me.nrm), t: mk(me.uv), i: mk(me.idx, gl.ELEMENT_ARRAY_BUFFER), c: me.idx.length, uv: me.hasUV });
    }
  }
  // slot: 0 kit, 1 normal, 2 srm, 3 brillo (alfa del kit), 4 y 5 entorno
  function setTex(R, slot, src, wrap) {
    const { gl } = R; R.rev = R.rev || {}; if (R.src[slot] === src && (!src || R.rev[slot] === (src.__rev || 0))) return; R.src[slot] = src; R.rev[slot] = src ? src.__rev || 0 : 0;
    if (R.tx[slot]) { gl.deleteTexture(R.tx[slot]); R.tx[slot] = null; } if (!src) return;
    const t = R.tx[slot] = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + slot); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    const pot = v => !(v & (v - 1));
    if (pot(src.width) && pot(src.height)) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); const an = gl.getExtension('EXT_texture_filter_anisotropic'); if (an && slot < 4) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, 8); if (slot >= 4) gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); }
    else { gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); }
  }
  const setTexture = (R, src) => setTex(R, 0, src);
  const mul = (a, b) => { const o = new Float32Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; } return o; };
  const rgb = h => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
  const dir = (az, el) => { const a = az * Math.PI / 180, e = el * Math.PI / 180; return [Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)]; };
  function matrices(R, sc) {
    const c = R.gl.canvas, W = c.width, H = c.height, { center: ce, radius: r, mirror } = sc.fit, cy = Math.cos(sc.yaw), sy = Math.sin(sc.yaw), cp = Math.cos(sc.pitch), sp = Math.sin(sc.pitch), a = W / H;
    const T = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -ce[0], -ce[1], -ce[2], 1]), Mi = new Float32Array([mirror, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    const Ry = new Float32Array([cy, 0, -sy, 0, 0, 1, 0, 0, sy, 0, cy, 0, 0, 0, 0, 1]), Rx = new Float32Array([1, 0, 0, 0, 0, cp, sp, 0, 0, -sp, cp, 0, 0, 0, 0, 1]);
    let MV = mul(Rx, mul(Ry, mul(Mi, T))), P; const d = sc.dist || r * 2.7, fov = (sc.fov || 48) * Math.PI / 360, px = sc.panX || 0, py = sc.panY || 0;
    if (sc.ortho) { const s = r * 1.04, sx = a >= 1 ? s * a : s, syy = a >= 1 ? s : s / a; P = new Float32Array([1 / sx, 0, 0, 0, 0, 1 / syy, 0, 0, 0, 0, -1 / (r * 4), 0, 0, 0, 0, 1]); MV = mul(new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -r * 2, 1]), MV); P = mul(P, new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, r * 2, 1])); }
    else { const f = 1 / Math.tan(fov), n = d * .05, fr = d * 4; P = new Float32Array([f / a, 0, 0, 0, 0, f, 0, 0, 0, 0, (fr + n) / (n - fr), -1, 0, 0, 2 * fr * n / (n - fr), 0]); MV = mul(new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -px, -py, -d, 1]), MV); }
    return { MV, P, MVP: mul(P, MV), tanH: [Math.tan(fov) * a, Math.tan(fov)] };
  }
  const bindMesh = (gl, attrs, b) => { for (const [at, bf, n] of attrs) { if (at < 0) continue; gl.bindBuffer(gl.ARRAY_BUFFER, bf); gl.enableVertexAttribArray(at); gl.vertexAttribPointer(at, n, gl.FLOAT, false, 0, 0); } gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.i); };
  function draw(R, sc) {
    const { gl, loc } = R, c = gl.canvas, W = c.width, H = c.height; gl.viewport(0, 0, W, H); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const M = matrices(R, sc), Lt = sc.L, hasEnv = !!R.tx[4];
    // fondo
    if (hasEnv && sc.bg && !sc.ortho) {
      gl.useProgram(R.bp); gl.disable(gl.DEPTH_TEST); gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, R.tx[4]); gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, R.tx[5] || R.tx[4]);
      gl.uniform1f(R.bl.envYaw, Lt.envYaw); gl.uniform1f(R.bl.envMix, R.tx[5] ? Lt.envMix : 1); gl.uniform2f(R.bl.tanH, M.tanH[0], M.tanH[1]); gl.uniform1f(R.bl.blur, sc.bgBlur ?? 2); gl.uniform1f(R.bl.expo, Lt.exp * (sc.bgExp ?? 1)); gl.uniform1f(R.bl.pitch, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, R.quad); gl.enableVertexAttribArray(R.bl.q); gl.vertexAttribPointer(R.bl.q, 2, gl.FLOAT, false, 0, 0); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.disableVertexAttribArray(R.bl.q); gl.enable(gl.DEPTH_TEST);
    }
    gl.useProgram(R.pr);
    gl.uniformMatrix4fv(loc.mvp, false, M.MVP); gl.uniformMatrix4fv(loc.mv, false, M.MV); gl.uniform1f(loc.grow, sc.grow || 1);
    const setL = (u, cu, l) => { const v = dir(l[0], Math.max(-10, Math.min(89, l[1]))), cc = rgb(l[3]).map(x => x * l[2]); gl.uniform3f(loc[u], v[0], v[1], v[2]); gl.uniform3f(loc[cu], cc[0], cc[1], cc[2]); };
    setL('L1', 'C1', Lt.key); setL('L2', 'C2', Lt.fill); setL('L3', 'C3', Lt.rim);
    gl.uniform1f(loc.amb, Lt.amb); gl.uniform1f(loc.specK, Lt.spec); gl.uniform1f(loc.expo, Lt.exp); gl.uniform1f(loc.envInt, Lt.envInt); gl.uniform1f(loc.envYaw, Lt.envYaw); gl.uniform1f(loc.envMix, R.tx[5] ? Lt.envMix : 1); gl.uniform1f(loc.useEnv, hasEnv ? 1 : 0);
    if (Lt.sh) gl.uniform3fv(loc.sh, new Float32Array(Lt.sh.flat()));
    gl.uniform1f(loc.defSpec, sc.defSpec == null ? .3 : sc.defSpec); gl.uniform1f(loc.defRough, sc.defRough == null ? .6 : sc.defRough); gl.uniform1f(loc.glossK, sc.glossK ?? 1); gl.uniform1f(loc.debug, sc.debug || 0);
    gl.disable(gl.CULL_FACE);
    for (let s = 0; s < 6; s++) { gl.activeTexture(gl.TEXTURE0 + s); gl.bindTexture(gl.TEXTURE_2D, R.tx[s] || (s === 5 ? R.tx[4] : null) || null); }
    for (const b of R.bufs) {
      const useTex = R.tx[0] && b.uv && sc.textured.has(b.k), col = sc.colors[b.k] || [.6, .6, .6], useN = useTex && R.tx[1] && sc.nrm !== false;
      gl.uniform1f(loc.useTex, useTex ? 1 : 0); gl.uniform3f(loc.col, col[0], col[1], col[2]); gl.uniform1f(loc.useN, useN ? 1 : 0); gl.uniform1f(loc.useS, useTex && R.tx[2] ? 1 : 0); gl.uniform1f(loc.useG, useTex && R.tx[3] ? 1 : 0); gl.uniform1f(loc.bump, sc.bump ?? 1);
      // las piezas que van encima (cuello, mangas) se adelantan un poquito para que no "peleen" con la camiseta en las uniones
      const off = b.k === 'collar' ? 3 : b.k === 'sleeve' ? 1.5 : 0; if (off) { gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-off, -off); } else gl.disable(gl.POLYGON_OFFSET_FILL);
      bindMesh(gl, [[loc.p, b.p, 3], [loc.n, b.n, 3], [loc.t, b.t, 2]], b); gl.drawElements(gl.TRIANGLES, b.c, gl.UNSIGNED_SHORT, 0);
    }
    gl.disable(gl.POLYGON_OFFSET_FILL);
    return M;
  }
  return { make, upload, setTex, draw };
})();

/** Light + environment of a preset, in the shape KitGL.draw expects (sc.L). */
export function lightState(presetKey) {
  const PR = LIGHT_PRESETS[presetKey] || LIGHT_PRESETS.estudio;
  const env = KitEnv.scene(PR.env);
  return { key: PR.key, fill: PR.fill, rim: PR.rim, amb: PR.amb, exp: PR.exp, spec: 1, envInt: 1, envYaw: 0, sh: env.sh, env, envMix: 1 };
}
