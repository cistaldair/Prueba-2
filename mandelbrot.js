// Mandelbrot WebGL — zoom con rueda y pan con arrastre
(() => {
  const canvas = document.getElementById('glcanvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2); // nitidez sin matar GPU

  // WebGL1 para máxima compatibilidad
  const gl = canvas.getContext('webgl', { antialias: false, preserveDrawingBuffer: false });
  if (!gl) {
    alert('Tu navegador no soporta WebGL.');
    return;
  }

  // Compilación de shaders
  const vsSrc = document.getElementById('vs').textContent.trim();
  const fsSrc = document.getElementById('fs').textContent.trim();

  function compile(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(sh));
      throw new Error('Error compilando shader');
    }
    return sh;
  }
  const vs = compile(gl.VERTEX_SHADER, vsSrc);
  const fs = compile(gl.FRAGMENT_SHADER, fsSrc);

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(prog));
    throw new Error('Error linkeando programa');
  }
  gl.useProgram(prog);

  // Quad de pantalla completa
  const posBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1,-1,  1,-1,  -1, 1,
    -1, 1,  1,-1,   1, 1
  ]), gl.STATIC_DRAW);

  const a_pos = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(a_pos);
  gl.vertexAttribPointer(a_pos, 2, gl.FLOAT, false, 0, 0);

  // Uniforms
  const u_resolution = gl.getUniformLocation(prog, 'u_resolution');
  const u_center     = gl.getUniformLocation(prog, 'u_center');
  const u_scale      = gl.getUniformLocation(prog, 'u_scale');
  const u_aspect     = gl.getUniformLocation(prog, 'u_aspect');
  const u_maxIter    = gl.getUniformLocation(prog, 'u_maxIter');
  const u_smooth     = gl.getUniformLocation(prog, 'u_smooth');

  // Estado de vista
  let width = 0, height = 0;
  let center = { x: -0.743643887037151, y: 0.13182590420533 }; // zona "seahorse valley"
  let scale = 3.0;                // alto del plano complejo visible
  let maxIter = 1000;             // ajustable con zoom
  let smooth = 0.85;              // curva de brillo (0.5–1.5)
  let isDragging = false;
  let lastMouse = { x: 0, y: 0 };

  function resize() {
    const cssW = Math.floor(window.innerWidth);
    const cssH = Math.floor(window.innerHeight);
    const newW = Math.max(1, Math.floor(cssW * dpr));
    const newH = Math.max(1, Math.floor(cssH * dpr));
    if (newW !== width || newH !== height) {
      width = newW; height = newH;
      canvas.width = width; canvas.height = height;
      canvas.style.width = cssW + 'px';
      canvas.style.height = cssH + 'px';
      gl.viewport(0, 0, width, height);
    }
  }

  function iterForScale(s) {
    // más profundidad de iteración a medida que nos acercamos
    // regla empírica rápida
    const target = Math.floor(200.0 + Math.log(3.0 / s + 1.0) * 250.0);
    return Math.min(4096, Math.max(100, target));
  }

  function draw(ts) {
    resize();

    const aspect = width / height;
    maxIter = iterForScale(scale);

    gl.uniform2f(u_resolution, width, height);
    gl.uniform2f(u_center, center.x, center.y);
    gl.uniform1f(u_scale, scale);
    gl.uniform1f(u_aspect, aspect);
    gl.uniform1i(u_maxIter, maxIter);
    gl.uniform1f(u_smooth, smooth);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // HUD
    if (statsEl) {
      if (!draw._last) draw._last = ts;
      if (!draw._frames) draw._frames = 0;
      draw._frames++;
      if (ts - draw._last > 500) {
        const fps = (draw._frames * 1000) / (ts - draw._last);
        draw._frames = 0; draw._last = ts;
        statsEl.innerHTML = `
          <div>FPS: ${fps.toFixed(0)} | Iter: ${maxIter}</div>
          <div>Center: ${center.x.toFixed(12)}, ${center.y.toFixed(12)}</div>
          <div>Scale: ${scale.toExponential(3)} (alto plano)</div>
        `;
      }
    }

    requestAnimationFrame(draw);
  }

  // Interacción: zoom con rueda (acerca hacia el puntero)
  function screenToWorld(px, py) {
    const aspect = width / height;
    const nx = (px * dpr - width * 0.5);
    const ny = (py * dpr - height * 0.5);
    const wx = center.x + (nx / (0.5 * height)) * (scale * 0.5) * aspect;
    const wy = center.y + (ny / (0.5 * height)) * (scale * 0.5);
    return { x: wx, y: wy };
  }

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    // deltaY>0 aleja, deltaY<0 acerca
    const zoomIntensity = 0.0018; // sensibilidad
    const factor = Math.exp(-e.deltaY * zoomIntensity);

    // mantener el punto bajo el cursor fijo durante el zoom:
    const before = screenToWorld(e.clientX, e.clientY);
    scale *= factor;
    // clamp mínimo/máximo razonable (float precision)
    scale = Math.max(1e-13, Math.min(4.0, scale));

    const after = screenToWorld(e.clientX, e.clientY);
    center.x += (before.x - after.x);
    center.y += (before.y - after.y);
  }, { passive: false });

  // Paneo con arrastre
  canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastMouse.x = e.clientX;
    lastMouse.y = e.clientY;
  });
  window.addEventListener('mouseup', () => isDragging = false);
  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - lastMouse.x;
    const dy = e.clientY - lastMouse.y;
    lastMouse.x = e.clientX;
    lastMouse.y = e.clientY;

    // convertir delta de píxeles a delta en plano complejo
    const aspect = width / height;
    center.x -= (dx * dpr) / (0.5 * height) * (scale * 0.5) * aspect;
    center.y += (dy * dpr) / (0.5 * height) * (scale * 0.5);
  });

  // Evitar scroll de la página con la rueda sobre el canvas
  window.addEventListener('keydown', (e) => {
    // Atajos: +/- para zoom, 0 para reset rápido
    if (e.key === '+' || e.key === '=') {
      const rect = canvas.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const fakeEvent = { preventDefault(){}, deltaY: -100, clientX: cx, clientY: cy };
      canvas.dispatchEvent(new WheelEvent('wheel', fakeEvent));
    } else if (e.key === '-') {
      const rect = canvas.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const fakeEvent = { preventDefault(){}, deltaY: +100, clientX: cx, clientY: cy };
      canvas.dispatchEvent(new WheelEvent('wheel', fakeEvent));
    } else if (e.key === '0') {
      center = { x: -0.743643887037151, y: 0.13182590420533 };
      scale = 3.0;
    }
  });

  // HUD
  const statsEl = document.getElementById('stats');

  // Iniciar
  resize();
  requestAnimationFrame(draw);

  // Ajuste de precisión: bajar iteraciones si GPU sufre
  // Puedes exponer un control si lo necesitas.
})();
