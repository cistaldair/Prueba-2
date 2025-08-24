const canvas = document.getElementById("mandelbrot");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let t = 0; // tiempo de animación

function mandelbrot(x, y, maxIter) {
  let zr = 0, zi = 0, iter = 0;
  while (zr * zr + zi * zi <= 4 && iter < maxIter) {
    const temp = zr * zr - zi * zi + x;
    zi = 2 * zr * zi + y;
    zr = temp;
    iter++;
  }
  return iter;
}

function draw() {
  const w = canvas.width;
  const h = canvas.height;
  const img = ctx.createImageData(w, h);

  // Zoom dinámico con seno para que "pulse" infinitamente
  const zoom = 1.5 * Math.pow(0.97, (Math.sin(t / 50) * 100 + t));
  const cx = -0.743643887037151; // punto famoso de zoom
  const cy =  0.13182590420533;

  for (let px = 0; px < w; px++) {
    for (let py = 0; py < h; py++) {
      const x = cx + (px - w / 2) * zoom / w;
      const y = cy + (py - h / 2) * zoom / h;

      const m = mandelbrot(x, y, 200);
      const color = m === 200 ? 0 : 255 - Math.floor(m * 255 / 200);

      const idx = (py * w + px) * 4;
      img.data[idx] = color;       // rojo
      img.data[idx + 1] = color;   // verde
      img.data[idx + 2] = color*0.8; // azul
      img.data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  t++;
  requestAnimationFrame(draw);
}

draw();
