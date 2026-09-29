// Dev utility: extract dominant colors from the official STEG logo PNG (no deps).
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const file = process.argv[2] ?? 'public/logo/logo-steg-1200x327.png';
const buf = readFileSync(file);

// Parse PNG chunks
let off = 8;
let ihdr = null;
const idat = [];
while (off < buf.length) {
  const len = buf.readUInt32BE(off);
  const type = buf.toString('ascii', off + 4, off + 8);
  const data = buf.subarray(off + 8, off + 8 + len);
  if (type === 'IHDR') ihdr = data;
  else if (type === 'IDAT') idat.push(data);
  off += 12 + len;
}
const w = ihdr.readUInt32BE(0);
const h = ihdr.readUInt32BE(4);
const bitDepth = ihdr[8];
const colorType = ihdr[9];
const interlace = ihdr[12];
console.log(`PNG ${w}x${h} depth=${bitDepth} colorType=${colorType} interlace=${interlace}`);
if (bitDepth !== 8 || interlace !== 0) {
  console.error('unsupported PNG layout — inspect manually');
  process.exit(1);
}
const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
let palette = null;
// Re-scan for PLTE if colorType 3
off = 8;
while (off < buf.length) {
  const len = buf.readUInt32BE(off);
  const type = buf.toString('ascii', off + 4, off + 8);
  if (type === 'PLTE') palette = buf.subarray(off + 8, off + 8 + len);
  off += 12 + len;
}

const raw = inflateSync(Buffer.concat(idat));
const stride = w * channels;
const px = Buffer.alloc(stride * h);
let pos = 0;
for (let y = 0; y < h; y++) {
  const filter = raw[pos++];
  const row = raw.subarray(pos, pos + stride);
  pos += stride;
  const out = px.subarray(y * stride, (y + 1) * stride);
  for (let x = 0; x < stride; x++) {
    const a = x >= channels ? out[x - channels] : 0;
    const b = y > 0 ? px[(y - 1) * stride + x] : 0;
    const c = x >= channels && y > 0 ? px[(y - 1) * stride + x - channels] : 0;
    let val = row[x];
    switch (filter) {
      case 0: break;
      case 1: val = (val + a) & 0xff; break;
      case 2: val = (val + b) & 0xff; break;
      case 3: val = (val + ((a + b) >> 1)) & 0xff; break;
      case 4: {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        const pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        val = (val + pred) & 0xff;
        break;
      }
    }
    out[x] = val;
  }
}

function colorAt(x, y) {
  const i = (y * w + x) * channels;
  if (colorType === 3) {
    const idx = px[i];
    return [palette[idx * 3], palette[idx * 3 + 1], palette[idx * 3 + 2]];
  }
  if (colorType === 0) { const v = px[i]; return [v, v, v]; }
  if (colorType === 4) { const v = px[i]; return [v, v, v]; }
  return [px[i], px[i + 1], px[i + 2]];
}
function alphaAt(x, y) {
  const i = (y * w + x) * channels;
  if (channels === 4 || channels === 2) return px[i + channels - 1];
  return 255;
}

const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
const counts = new Map();
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const a = alphaAt(x, y);
    if (a < 200) continue;
    const c = colorAt(x, y);
    const key = hex(c);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
}
const total = [...counts.values()].reduce((s, n) => s + n, 0);
console.log('opaque pixels:', total);
const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
for (const [k, n] of sorted.slice(0, 24)) {
  console.log(k, `${((n / total) * 100).toFixed(2)}%`);
}
