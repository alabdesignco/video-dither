import * as THREE from 'three';
import GUI from 'lil-gui';

const scriptOrigin =
  typeof document !== 'undefined' && document.currentScript && document.currentScript.src
    ? new URL(document.currentScript.src).origin
    : window.location.origin;
const defaultVideo = `${scriptOrigin}/assets/candle.mp4`;

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-dither]').forEach(container => {
    const canvas = document.createElement('canvas');
    const vid = document.createElement('video');

    vid.autoplay = true;
    vid.loop = true;
    vid.muted = true;
    vid.playsInline = true;
    vid.crossOrigin = 'anonymous';
    vid.src = defaultVideo;

    container.style.overflow = 'hidden';
    vid.style.display = 'none';
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;transform:translateZ(0);will-change:transform;';

    container.appendChild(vid);
    container.appendChild(canvas);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    let fpsAcc = 0;
    let fpsFrames = 0;
    let fpsLast = performance.now();
    let fpsValue = 0;
    let renderLast = 0;
    let lastRenderT = 0;

    const videoTex = new THREE.VideoTexture(vid);
    videoTex.minFilter = THREE.LinearFilter;
    videoTex.magFilter = THREE.LinearFilter;
    videoTex.flipY = false;

    const vert = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `;

    const frag = `
  precision highp float;

  uniform sampler2D uVideo;
  uniform float uTime;
  uniform vec3  uColorDark;
  uniform vec3  uColorLight;

  uniform float uBias;
  uniform float uNoiseScale;
  uniform float uNoiseSpeed;
  uniform float uNoiseWeight;
  uniform float uPulseSpeed;
  uniform float uPulseWeight;
  uniform float uAnimStrength;

  uniform vec2  uMouse;
  uniform float uMouseInfluence;
  uniform float uRippleRadius;
  uniform float uRippleStrength;
  uniform float uRippleFreq;
  uniform float uRippleSpeed;
  uniform float uAspect;
  uniform float uIdleSway;
  uniform float uIdleSpeed;
  uniform float uVideoRatio;
  uniform float uZoom;

  varying vec2 vUv;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise2D(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i),              hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    ) * 2.0 - 1.0;
  }

  const float bayer8[64] = float[64](
     0.0/64.0,48.0/64.0,12.0/64.0,60.0/64.0, 3.0/64.0,51.0/64.0,15.0/64.0,63.0/64.0,
    32.0/64.0,16.0/64.0,44.0/64.0,28.0/64.0,35.0/64.0,19.0/64.0,47.0/64.0,31.0/64.0,
     8.0/64.0,56.0/64.0, 4.0/64.0,52.0/64.0,11.0/64.0,59.0/64.0, 7.0/64.0,55.0/64.0,
    40.0/64.0,24.0/64.0,36.0/64.0,20.0/64.0,43.0/64.0,27.0/64.0,39.0/64.0,23.0/64.0,
     2.0/64.0,50.0/64.0,14.0/64.0,62.0/64.0, 1.0/64.0,49.0/64.0,13.0/64.0,61.0/64.0,
    34.0/64.0,18.0/64.0,46.0/64.0,30.0/64.0,33.0/64.0,17.0/64.0,45.0/64.0,29.0/64.0,
    10.0/64.0,58.0/64.0, 6.0/64.0,54.0/64.0, 9.0/64.0,57.0/64.0, 5.0/64.0,53.0/64.0,
    42.0/64.0,26.0/64.0,38.0/64.0,22.0/64.0,41.0/64.0,25.0/64.0,37.0/64.0,21.0/64.0
  );

  void main() {
    vec2 uv = vUv;

    float screenRatio = uAspect;
    float videoRatio  = uVideoRatio;
    vec2 scale;
    vec2 offset;

    if (videoRatio > screenRatio) {
      float s = screenRatio / videoRatio;
      scale  = vec2(s, 1.0);
      offset = vec2((1.0 - s) * 0.5, 0.0);
    } else {
      float s = videoRatio / screenRatio;
      scale  = vec2(1.0, s);
      offset = vec2(0.0, (1.0 - s) * 0.5);
    }

    uv = uv * scale + offset;

    vec2 zoomCenter = vec2(0.5, 0.35);
    uv = (uv - zoomCenter) * uZoom + zoomCenter;

    float idle = sin(uTime * uIdleSpeed + vUv.y * 3.5) * uIdleSway * vUv.y;
    uv.x += idle;

    vec2 delta = vUv - uMouse;
    delta.x *= uAspect;
    float dist = length(delta);

    float falloff   = smoothstep(uRippleRadius, 0.0, dist);
    float wave      = sin(dist * uRippleFreq - uTime * uRippleSpeed);
    vec2  rippleDir = normalize(delta + 0.0001);
    vec2  ripple    = rippleDir * wave * falloff * uRippleStrength * uMouseInfluence;

    uv += ripple;
    uv.y = 1.0 - uv.y;

    vec4 videoColor = texture2D(uVideo, clamp(uv, 0.0, 1.0));

    float lum = dot(vec3(0.2126, 0.7152, 0.0722), videoColor.rgb);
    lum = 1.0 - lum;

    float n = noise2D(vUv * uNoiseScale + uTime * uNoiseSpeed);
    float pulse = sin(uTime * uPulseSpeed) * 0.5 + 0.5;
    float bias = uBias + (n * uNoiseWeight + pulse * uPulseWeight) * uAnimStrength;

    int x = int(mod(gl_FragCoord.x, 8.0));
    int y = int(mod(gl_FragCoord.y, 8.0));
    float threshold = bayer8[y * 8 + x];

    vec3 color = mix(uColorDark, uColorLight, step(threshold + bias, lum));
    gl_FragColor = vec4(color, 1.0);
  }
`;

    const mat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: {
        uVideo: { value: videoTex },
        uTime: { value: 0 },
        uColorDark: { value: new THREE.Color('#0E0E0E') },
        uColorLight: { value: new THREE.Color('#E8E2DA') },
        uBias: { value: 0.08 },
        uNoiseScale: { value: 1.4 },
        uNoiseSpeed: { value: 0.3 },
        uNoiseWeight: { value: 0.77 },
        uPulseSpeed: { value: 3.1 },
        uPulseWeight: { value: 0.87 },
        uAnimStrength: { value: 0.22 },
        uMouse: { value: new THREE.Vector2(0.5, 0.5) },
        uMouseInfluence: { value: 0 },
        uRippleRadius: { value: 0.35 },
        uRippleStrength: { value: 0.018 },
        uRippleFreq: { value: 18.0 },
        uRippleSpeed: { value: 4.0 },
        uAspect: { value: 1 },
        uVideoRatio: { value: 1.0 },
        uIdleSway: { value: 0.006 },
        uIdleSpeed: { value: 1.8 },
        uZoom: { value: 1.0 }
      }
    });

    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));

    let mouseTarget = new THREE.Vector2(0.5, 0.5);
    let mouseCurrent = new THREE.Vector2(0.5, 0.5);
    let mouseInfluenceTarget = 0;

    const hasPointer = window.matchMedia('(pointer: fine)').matches;

    if (hasPointer) {
      window.addEventListener('pointermove', e => {
        const r = container.getBoundingClientRect();
        mouseTarget.set(
          (e.clientX - r.left) / r.width,
          1 - (e.clientY - r.top) / r.height
        );
        mouseInfluenceTarget = 1;
      });

      container.addEventListener('pointerleave', () => {
        mouseInfluenceTarget = 0;
      });
    }

    const perf = {
      fps: '0.0',
      scale: '1.00',
      targetFps: 24
    };

    const params = {
      bias: 0.08,
      noiseScale: 1.4,
      noiseSpeed: 0.3,
      noiseWeight: 0.77,
      pulseSpeed: 3.1,
      pulseWeight: 0.87,
      animStrength: 0.22,
      rippleRadius: 0.35,
      rippleStrength: 0.018,
      rippleFreq: 18.0,
      rippleSpeed: 4.0,
      idleSway: 0.006,
      idleSpeed: 1.8,
      zoom: 1.0,
      colorDark: '#0E0E0E',
      colorLight: '#E8E2DA'
    };

    const gui = new GUI({ title: 'Dither Controls' });
    const fP = gui.addFolder('Perf');
    const fpsController = fP.add(perf, 'fps').name('FPS').listen();
    const scaleController = fP.add(perf, 'scale').name('Scale').listen();
    fP.add(perf, 'targetFps', [0, 15, 24, 30, 45, 60]).name('Cap FPS');
    fpsController.disable();
    scaleController.disable();
    gui.hide();

    const fD = gui.addFolder('Dither');
    fD.add(params, 'bias', 0, 0.5, 0.001).name('Bias').onChange(v => {
      mat.uniforms.uBias.value = v;
    });

    const fB = gui.addFolder('Breathing');
    fB.add(params, 'noiseScale', 0.1, 5, 0.01).name('Noise Scale').onChange(v => {
      mat.uniforms.uNoiseScale.value = v;
    });
    fB.add(params, 'noiseSpeed', 0, 2, 0.01).name('Noise Speed').onChange(v => {
      mat.uniforms.uNoiseSpeed.value = v;
    });
    fB.add(params, 'noiseWeight', 0, 1, 0.01).name('Noise Weight').onChange(v => {
      mat.uniforms.uNoiseWeight.value = v;
    });
    fB.add(params, 'pulseSpeed', 0, 10, 0.1).name('Pulse Speed').onChange(v => {
      mat.uniforms.uPulseSpeed.value = v;
    });
    fB.add(params, 'pulseWeight', 0, 1, 0.01).name('Pulse Weight').onChange(v => {
      mat.uniforms.uPulseWeight.value = v;
    });
    fB.add(params, 'animStrength', 0, 1, 0.01).name('Anim Strength').onChange(v => {
      mat.uniforms.uAnimStrength.value = v;
    });

    const fS = gui.addFolder('Ripple');
    fS.add(params, 'idleSway', 0, 0.05, 0.001).name('Idle Sway').onChange(v => {
      mat.uniforms.uIdleSway.value = v;
    });
    fS.add(params, 'idleSpeed', 0, 5, 0.1).name('Idle Speed').onChange(v => {
      mat.uniforms.uIdleSpeed.value = v;
    });
    fS.add(params, 'rippleRadius', 0, 1, 0.01).name('Radius').onChange(v => {
      mat.uniforms.uRippleRadius.value = v;
    });
    fS.add(params, 'rippleStrength', 0, 0.1, 0.001).name('Strength').onChange(v => {
      mat.uniforms.uRippleStrength.value = v;
    });
    fS.add(params, 'rippleFreq', 1, 40, 0.5).name('Ring Frequency').onChange(v => {
      mat.uniforms.uRippleFreq.value = v;
    });
    fS.add(params, 'rippleSpeed', 0, 15, 0.1).name('Ring Speed').onChange(v => {
      mat.uniforms.uRippleSpeed.value = v;
    });

    fS.add(params, 'zoom', 0.5, 1.5, 0.01).name('Zoom').onChange(v => {
      mat.uniforms.uZoom.value = v;
    });

    const fC = gui.addFolder('Colors');
    fC.addColor(params, 'colorDark').name('Ink').onChange(v => {
      mat.uniforms.uColorDark.value.set(v);
    });
    fC.addColor(params, 'colorLight').name('Background').onChange(v => {
      mat.uniforms.uColorLight.value.set(v);
    });

    gui.add(
      {
        log() {
          console.log(JSON.stringify({ perf, params }, null, 2));
        }
      },
      'log'
    ).name('📋 Log values');

    let lastW = 0, lastH = 0;
    const resize = () => {
      const w = container.offsetWidth;
      const h = container.offsetHeight;
      if (!w || !h || (w === lastW && h === lastH)) return;
      lastW = w; lastH = h;
      renderer.setSize(w, h, false);
      mat.uniforms.uAspect.value = w / h;
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const animate = t => {
      requestAnimationFrame(animate);
      if (perf.targetFps) {
        const minDelta = 1000 / perf.targetFps;
        if (t - renderLast < minDelta) return;
        renderLast = t - ((t - renderLast) % minDelta);
      }
      const dt = lastRenderT ? (t - lastRenderT) / 1000 : 0;
      lastRenderT = t;
      const time = t * 0.001;
      mat.uniforms.uTime.value = time;

      const mouseEase = 1 - Math.exp(-dt * 14);
      mouseCurrent.lerp(mouseTarget, mouseEase);
      mat.uniforms.uMouse.value.copy(mouseCurrent);

      const inf = mat.uniforms.uMouseInfluence.value;
      const influenceEase = 1 - Math.exp(-dt * 18);
      mat.uniforms.uMouseInfluence.value += (mouseInfluenceTarget - inf) * influenceEase;

      fpsFrames++;
      fpsAcc += t - fpsLast;
      if (fpsAcc >= 500) {
        fpsValue = (fpsFrames * 1000) / fpsAcc;
        fpsFrames = 0;
        fpsAcc = 0;
        perf.fps = fpsValue.toFixed(1);
        perf.scale = renderer.getPixelRatio().toFixed(2);
      }
      fpsLast = t;

      renderer.render(scene, camera);
    };

    vid.addEventListener('loadedmetadata', () => {
      mat.uniforms.uVideoRatio.value = vid.videoWidth / vid.videoHeight;
    });

    vid.addEventListener(
      'canplay',
      () => {
        requestAnimationFrame(animate);
      },
      { once: true }
    );

    vid.play().catch(() => {});
  });
});

