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

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

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
  uniform float u_pan;
  uniform float u_scene;
  uniform vec2 u_view;
  uniform vec2 u_image_size;
  varying vec2 v_uv;

  float ellipseMask(vec2 point, vec2 center, vec2 size) {
    return 1.0 - smoothstep(0.78, 1.0, length((point - center) / size));
  }

  float softBox(vec2 point, vec2 lower, vec2 upper, float edge) {
    vec2 start = smoothstep(lower, lower + vec2(edge), point);
    vec2 end = 1.0 - smoothstep(upper - vec2(edge), upper, point);
    return start.x * start.y * end.x * end.y;
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
    uv.x += (u_pan - 0.5) * (1.0 - cover.x) * 0.96;
    vec2 point = vec2(uv.x, 1.0 - uv.y);
    vec3 original = texture2D(u_image, uv).rgb;
    float isHero = step(0.5, u_scene);

    // The masks stay in image coordinates, so masonry, glazing and furniture
    // never wobble as the camera moves across the panorama.
    float projectWater = softBox(point, vec2(0.29, 0.55), vec2(0.67, 0.68), 0.025);
    float heroWater = softBox(point, vec2(0.41, 0.66), vec2(0.96, 0.81), 0.035);
    float water = mix(projectWater, heroWater, isHero);

    float projectLeaves =
      softBox(point, vec2(0.02, 0.01), vec2(0.37, 0.22), 0.04) +
      ellipseMask(point, vec2(0.57, 0.31), vec2(0.075, 0.15)) +
      softBox(point, vec2(0.88, 0.13), vec2(1.0, 0.44), 0.04) +
      softBox(point, vec2(0.02, 0.77), vec2(0.44, 1.0), 0.06) +
      softBox(point, vec2(0.70, 0.80), vec2(1.0, 1.0), 0.06);
    float heroLeaves =
      softBox(point, vec2(0.81, 0.01), vec2(1.0, 0.30), 0.04) +
      softBox(point, vec2(0.02, 0.75), vec2(0.39, 1.0), 0.06) +
      softBox(point, vec2(0.62, 0.86), vec2(1.0, 1.0), 0.05);
    float leafColor = smoothstep(-0.08, 0.06, original.g - original.b) *
      (1.0 - smoothstep(0.08, 0.26, original.r - original.g));
    float foliage = clamp(mix(projectLeaves, heroLeaves, isHero), 0.0, 1.0) * leafColor;

    float skyLimit = mix(0.46, 0.19, smoothstep(0.35, 0.67, point.x));
    float clouds = isHero * (1.0 - smoothstep(skyLimit - 0.06, skyLimit, point.y)) *
      (1.0 - smoothstep(0.80, 0.91, point.x));

    float rippleA = sin(point.x * 96.0 + u_time * 1.75 + sin(point.y * 33.0));
    float rippleB = sin(point.x * 51.0 - u_time * 1.10 + point.y * 74.0);
    float rippleC = sin(point.y * 128.0 + u_time * 0.82);
    vec2 motion = vec2((rippleA * 0.0020 + rippleB * 0.0011), rippleC * 0.00065) * water;

    float breeze = sin(u_time * 0.72 + point.y * 17.0) + sin(u_time * 1.08 + point.x * 13.0) * 0.42;
    motion.x += breeze * 0.0018 * foliage;
    motion.y += sin(u_time * 0.56 + point.x * 11.0) * 0.0007 * foliage;
    motion.x += clouds * (sin(u_time * 0.19 + point.y * 4.0) * 0.0030 + sin(u_time * 0.11) * 0.0012);

    vec3 color = texture2D(u_image, clamp(uv + motion, 0.001, 0.999)).rgb;
    float shimmer = (sin(point.x * 118.0 - u_time * 1.6 + point.y * 29.0) * 0.5 + 0.5) * water;
    color += vec3(0.022, 0.030, 0.033) * shimmer;
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
  const frame = canvas.closest('[data-living-scene-container]');
  const image = frame.querySelector('[data-cinematic-image]');
  const isHero = canvas.dataset.scene === 'hero';
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
  const panLocation = gl.getUniformLocation(program, 'u_pan');
  const sceneLocation = gl.getUniformLocation(program, 'u_scene');
  const viewLocation = gl.getUniformLocation(program, 'u_view');
  const imageSizeLocation = gl.getUniformLocation(program, 'u_image_size');
  gl.uniform1i(gl.getUniformLocation(program, 'u_image'), 0);
  gl.uniform1f(sceneLocation, isHero ? 1 : 0);
  gl.uniform2f(imageSizeLocation, image.naturalWidth, image.naturalHeight);

  let isVisible = false;
  let isRunning = false;
  let needsResize = true;
  const startedAt = performance.now();
  const clamp = (value) => Math.min(1, Math.max(0, value));

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
    const elapsed = now - startedAt;
    const frameRect = frame.getBoundingClientRect();
    const scrollProgress = clamp((window.innerHeight - frameRect.top) / (window.innerHeight + frameRect.height));
    const openingProgress = clamp(elapsed / 13000);
    const easedOpening = openingProgress * openingProgress * (3 - 2 * openingProgress);
    const panProgress = isHero ? 0.18 + easedOpening * 0.80 : 0.04 + scrollProgress * 0.92;
    gl.uniform1f(timeLocation, elapsed / 1000);
    gl.uniform1f(panLocation, panProgress);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    if (!isHero) frame.style.setProperty('--cinematic-progress', scrollProgress.toFixed(4));
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
  const image = canvas.closest('[data-living-scene-container]').querySelector('[data-cinematic-image]');
  if (image.complete && image.naturalWidth) startLivingScene(canvas);
  else image.addEventListener('load', () => startLivingScene(canvas), { once: true });
});
