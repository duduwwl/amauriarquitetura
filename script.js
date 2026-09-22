const header = document.querySelector('[data-header]');
const menuButton = document.querySelector('.menu-toggle');
const menu = document.querySelector('.main-nav');
const year = document.querySelector('[data-year]');

year.textContent = new Date().getFullYear();

const updateHeader = () => header.classList.toggle('scrolled', window.scrollY > 36);
updateHeader();
window.addEventListener('scroll', updateHeader, { passive: true });

menuButton.addEventListener('click', () => {
  const open = menu.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(open));
  document.body.style.overflow = open ? 'hidden' : '';
});

menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
  menu.classList.remove('open');
  menuButton.setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
}));

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));

const projectDialog = document.querySelector('[data-project-dialog]');
const dialogImage = projectDialog.querySelector('[data-dialog-image]');
const dialogCategory = projectDialog.querySelector('[data-dialog-category]');
const dialogTitle = projectDialog.querySelector('[data-dialog-title]');
const dialogDescription = projectDialog.querySelector('[data-dialog-description]');

document.querySelectorAll('[data-project]').forEach((project) => {
  project.addEventListener('click', () => {
    dialogImage.src = project.dataset.image;
    dialogImage.alt = project.querySelector('img').alt;
    dialogCategory.textContent = project.dataset.category;
    dialogTitle.textContent = project.dataset.title;
    dialogDescription.textContent = project.dataset.description;
    projectDialog.showModal();
    document.body.style.overflow = 'hidden';
  });
});

const closeProject = () => {
  projectDialog.close();
  document.body.style.overflow = '';
};

projectDialog.querySelector('[data-dialog-close]').addEventListener('click', closeProject);
projectDialog.addEventListener('click', (event) => {
  if (event.target === projectDialog) closeProject();
});
projectDialog.addEventListener('close', () => {
  document.body.style.overflow = '';
  dialogImage.src = '';
});

const cinematicScenes = [...document.querySelectorAll('[data-cinematic]')];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let cinematicFrame;

const updateCinematicScenes = () => {
  cinematicFrame = null;
  if (reducedMotion.matches) return;

  cinematicScenes.forEach((scene) => {
    const rect = scene.querySelector('.cinematic-frame').getBoundingClientRect();
    const viewport = window.innerHeight;
    const progress = Math.min(1, Math.max(0, (viewport - rect.top) / (viewport + rect.height)));
    const travel = -4 + (progress * 8);
    const scale = 1.055 - (progress * .035);
    scene.style.setProperty('--cinematic-y', `${travel.toFixed(3)}%`);
    scene.style.setProperty('--cinematic-scale', scale.toFixed(4));
    scene.style.setProperty('--cinematic-progress', progress.toFixed(4));
  });
};

const requestCinematicUpdate = () => {
  if (!cinematicFrame) cinematicFrame = requestAnimationFrame(updateCinematicScenes);
};

if (cinematicScenes.length) {
  updateCinematicScenes();
  window.addEventListener('scroll', requestCinematicUpdate, { passive: true });
  window.addEventListener('resize', requestCinematicUpdate);
  reducedMotion.addEventListener('change', requestCinematicUpdate);
}

const vertexShaderSource = `
  attribute vec2 a_position;
  varying vec2 v_uv;
  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const fragmentShaderSource = `
  precision highp float;
  uniform sampler2D u_image;
  uniform float u_time;
  uniform vec2 u_view;
  uniform vec2 u_image_size;
  varying vec2 v_uv;

  float ellipseMask(vec2 point, vec2 center, vec2 size) {
    return 1.0 - smoothstep(0.72, 1.0, length((point - center) / size));
  }

  void main() {
    float viewAspect = u_view.x / u_view.y;
    float imageAspect = u_image_size.x / u_image_size.y;
    vec2 cover = vec2(1.0);
    if (viewAspect > imageAspect) {
      cover.y = imageAspect / viewAspect;
    } else {
      cover.x = viewAspect / imageAspect;
    }

    vec2 uv = (v_uv - 0.5) * cover + 0.5;
    vec2 point = vec2(uv.x, 1.0 - uv.y);
    vec3 original = texture2D(u_image, uv).rgb;

    float waterBand = smoothstep(0.50, 0.56, point.y) * (1.0 - smoothstep(0.73, 0.79, point.y));
    float waterWidth = 1.0 - smoothstep(0.72, 0.91, point.x);
    float coolSurface = smoothstep(0.32, 0.67, clamp((original.b - original.r) * 3.0 + 0.54, 0.0, 1.0));
    float water = waterBand * waterWidth * (0.28 + coolSurface * 0.72);

    float upperBranches = ellipseMask(point, vec2(0.12, 0.09), vec2(0.34, 0.16));
    float centerTree = ellipseMask(point, vec2(0.47, 0.36), vec2(0.18, 0.24));
    float foregroundGrass = ellipseMask(point, vec2(0.34, 0.88), vec2(0.48, 0.19)) * (1.0 - smoothstep(0.72, 0.90, point.x));
    float foliage = clamp(upperBranches * 0.75 + centerTree + foregroundGrass * 0.48, 0.0, 1.0);

    float rippleA = sin(point.x * 96.0 + u_time * 1.75 + sin(point.y * 33.0));
    float rippleB = sin(point.x * 51.0 - u_time * 1.10 + point.y * 74.0);
    float rippleC = sin(point.y * 128.0 + u_time * 0.82);
    vec2 motion = vec2((rippleA * 0.00135 + rippleB * 0.0008), rippleC * 0.00042) * water;

    float breeze = sin(u_time * 0.72 + point.y * 17.0) + sin(u_time * 1.08 + point.x * 13.0) * 0.42;
    motion.x += breeze * 0.00135 * foliage;
    motion.y += sin(u_time * 0.56 + point.x * 11.0) * 0.00038 * foliage;

    vec3 color = texture2D(u_image, clamp(uv + motion, 0.001, 0.999)).rgb;
    float shimmer = (sin(point.x * 118.0 - u_time * 1.6 + point.y * 29.0) * 0.5 + 0.5) * water;
    color += vec3(0.012, 0.018, 0.021) * shimmer;
    gl_FragColor = vec4(color, 1.0);
  }
`;

const compileShader = (gl, type, source) => {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
};

const startLivingScene = (canvas) => {
  if (reducedMotion.matches) return;
  const frame = canvas.closest('.cinematic-frame');
  const image = frame.querySelector('[data-cinematic-image]');
  const gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    depth: false,
    powerPreference: 'high-performance',
  });
  if (!gl) return;

  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
  if (!vertexShader || !fragmentShader) return;

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
  gl.useProgram(program);

  const vertices = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

  const timeLocation = gl.getUniformLocation(program, 'u_time');
  const viewLocation = gl.getUniformLocation(program, 'u_view');
  const imageSizeLocation = gl.getUniformLocation(program, 'u_image_size');
  gl.uniform1i(gl.getUniformLocation(program, 'u_image'), 0);
  gl.uniform2f(imageSizeLocation, image.naturalWidth, image.naturalHeight);

  let isVisible = false;
  let isRunning = false;
  let needsResize = true;
  const startedAt = performance.now();

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    const renderScale = Math.min(pixelRatio, 1600 / Math.max(rect.width, 1));
    const width = Math.max(1, Math.round(rect.width * renderScale));
    const height = Math.max(1, Math.round(rect.height * renderScale));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
    gl.uniform2f(viewLocation, width, height);
    needsResize = false;
  };

  const render = (now) => {
    if (!isVisible || document.hidden || reducedMotion.matches) {
      isRunning = false;
      return;
    }
    if (needsResize) resize();
    gl.uniform1f(timeLocation, (now - startedAt) / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    canvas.classList.add('ready');
    canvas.dataset.animated = 'true';
    requestAnimationFrame(render);
  };

  const requestRender = () => {
    if (!isRunning && isVisible && !document.hidden && !reducedMotion.matches) {
      isRunning = true;
      requestAnimationFrame(render);
    }
  };

  const visibilityObserver = new IntersectionObserver(([entry]) => {
    isVisible = entry.isIntersecting;
    requestRender();
  }, { rootMargin: '120px' });
  visibilityObserver.observe(frame);

  new ResizeObserver(() => {
    needsResize = true;
    requestRender();
  }).observe(frame);
  document.addEventListener('visibilitychange', requestRender);
  reducedMotion.addEventListener('change', requestRender);
};

document.querySelectorAll('[data-living-scene]').forEach((canvas) => {
  const image = canvas.closest('.cinematic-frame').querySelector('[data-cinematic-image]');
  if (image.complete && image.naturalWidth) startLivingScene(canvas);
  else image.addEventListener('load', () => startLivingScene(canvas), { once: true });
});
