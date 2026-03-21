'use strict';

const fs   = require('fs');
const path = require('path');
const args = process.argv.slice(2);

if (!args.length || args[0] === '--help' || args[0] === '-h') {
  console.log([
    'Usage: node obj-to-ascii-render.js <model.obj> [options]',
    '',
    'Options:',
    '  --id  <id>    HTML element id to target (default: ascii-<modelname>)',
    '  --out <file>  Output file path        (default: <modelname>-render.js)',
    '',
    'Examples:',
    '  node obj-to-ascii-render.js teapot.obj',
    '  node obj-to-ascii-render.js dragon.obj --id my-canvas --out dragon.js',
  ].join('\n'));
  process.exit(0);
}

const objFile = args[0];
if (!fs.existsSync(objFile)) {
  console.error(`Error: file not found: ${objFile}`);
  process.exit(1);
}

let elementId  = null;
let outputFile = null;
for (let i = 1; i < args.length; i++) {
  if (args[i] === '--id'  && args[i + 1]) elementId  = args[++i];
  if (args[i] === '--out' && args[i + 1]) outputFile = args[++i];
}

const modelName = path.basename(objFile, path.extname(objFile));
if (!elementId)  elementId  = `ascii-${modelName}`;
if (!outputFile) outputFile = path.join(path.dirname(objFile), `${modelName}-render.js`);

console.log(`Parsing ${objFile}...`);
const lines = fs.readFileSync(objFile, 'utf8').split(/\r?\n/);

const rawVerts   = [];
const rawNormals = [];
const rawFaces   = []; 

for (const line of lines) {
  const t = line.trim();
  if (!t || t[0] === '#') continue;
  const p = t.split(/\s+/);
  if (p[0] === 'v') {
    rawVerts.push([parseFloat(p[1]), parseFloat(p[2]), parseFloat(p[3])]);
  } else if (p[0] === 'vn') {
    rawNormals.push([parseFloat(p[1]), parseFloat(p[2]), parseFloat(p[3])]);
  } else if (p[0] === 'f') {
    const fv = p.slice(1).map(tok => {
      const s  = tok.split('/');
      const vi = parseInt(s[0], 10) - 1;
      const ni = s[2] ? parseInt(s[2], 10) - 1 : -1;
      return { v: vi, n: ni };
    });
    for (let i = 1; i < fv.length - 1; i++) {
      rawFaces.push([fv[0], fv[i], fv[i + 1]]);
    }
  }
}

if (!rawVerts.length) { console.error('Error: no vertices found.'); process.exit(1); }
if (!rawFaces.length)  { console.error('Error: no faces found.');    process.exit(1); }
console.log(`  raw: ${rawVerts.length} vertices, ${rawFaces.length} triangles`);

let minX = Infinity, maxX = -Infinity;
let minY = Infinity, maxY = -Infinity;
let minZ = Infinity, maxZ = -Infinity;
for (const [x, y, z] of rawVerts) {
  if (x < minX) minX = x; if (x > maxX) maxX = x;
  if (y < minY) minY = y; if (y > maxY) maxY = y;
  if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
}
const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2;
const scale = 2 / Math.max(maxX - minX, maxY - minY, maxZ - minZ, 1e-9);
const normVerts = rawVerts.map(([x, y, z]) => [
  (x - cx) * scale, (y - cy) * scale, (z - cz) * scale,
]);

let finalVerts, finalNormals, finalFaces;

const hasObjNormals = rawNormals.length > 0 && rawFaces.some(f => f[0].n >= 0);

if (hasObjNormals) {
  const keyMap = new Map();
  finalVerts   = [];
  finalNormals = [];
  finalFaces   = [];
  for (const tri of rawFaces) {
    const newTri = tri.map(({ v, n }) => {
      const nIdx = n >= 0 ? n : 0;
      const key  = `${v}:${nIdx}`;
      if (!keyMap.has(key)) {
        keyMap.set(key, finalVerts.length);
        finalVerts.push(normVerts[v]);
        const raw = rawNormals[nIdx] || [0, 1, 0];
        const nl  = Math.sqrt(raw[0] ** 2 + raw[1] ** 2 + raw[2] ** 2) || 1;
        finalNormals.push([raw[0] / nl, raw[1] / nl, raw[2] / nl]);
      }
      return keyMap.get(key);
    });
    finalFaces.push(newTri);
  }
} else {
  finalVerts   = normVerts;
  finalNormals = normVerts.map(() => [0, 0, 0]);
  finalFaces   = rawFaces.map(([a, b, c]) => [a.v, b.v, c.v]);
  for (const [ai, bi, ci] of finalFaces) {
    const [ax, ay, az] = finalVerts[ai];
    const [bx, by, bz] = finalVerts[bi];
    const [ex2, ey2, ez2] = finalVerts[ci];
    const ex = bx - ax, ey = by - ay, ez = bz - az;
    const fx = ex2 - ax, fy = ey2 - ay, fz = ez2 - az;
    const nx = ey * fz - ez * fy;
    const ny = ez * fx - ex * fz;
    const nz = ex * fy - ey * fx;
    for (const idx of [ai, bi, ci]) {
      finalNormals[idx][0] += nx;
      finalNormals[idx][1] += ny;
      finalNormals[idx][2] += nz;
    }
  }
  for (const n of finalNormals) {
    const l = Math.sqrt(n[0] ** 2 + n[1] ** 2 + n[2] ** 2) || 1;
    n[0] /= l; n[1] /= l; n[2] /= l;
  }
}

const NV = finalVerts.length;
const NF = finalFaces.length;
console.log(`  final: ${NV} vertices, ${NF} triangles`);

if (NV > 65535) {
  console.warn(`Warning: ${NV} vertices exceeds the Uint16Array limit (65535); face indices will overflow.`);
  console.warn('         Try reducing the mesh (e.g. with Blender Decimate or Simplygon).');
}

const clamp16 = v => Math.max(-32767, Math.min(32767, Math.round(v)));

const Vdata = [];
for (const [x, y, z] of finalVerts) {
  Vdata.push(clamp16(x * 1000), clamp16(y * 1000), clamp16(z * 1000));
}

const Ndata = [];
for (const [nx, ny, nz] of finalNormals) {
  Ndata.push(clamp16(nx * 1000), clamp16(ny * 1000), clamp16(nz * 1000));
}

const Fdata = [];
for (const tri of finalFaces) {
  Fdata.push(tri[0], tri[1], tri[2]);
}

const templateFile = path.join(__dirname, 'ascii-bunny-render.js');
if (!fs.existsSync(templateFile)) {
  console.error(`Error: template not found: ${templateFile}`);
  console.error('Keep obj-to-ascii-render.js in the same folder as ascii-bunny-render.js.');
  process.exit(1);
}

const templateSrc = fs.readFileSync(templateFile, 'utf8');

const charsIdx = templateSrc.indexOf('\nconst CHARS');
if (charsIdx === -1) {
  console.error('Error: could not locate rendering engine in ascii-bunny-render.js.');
  process.exit(1);
}
const engineCode = templateSrc.slice(charsIdx + 1)
  .replace(`getElementById('ascii-bunny')`, `getElementById('${elementId}')`);

const header = [
  `// ${modelName} mesh — ${NV} vertices, ${NF} triangles`,
  `// Coords stored as integer * 1000, normals as integer * 1000`,
  `const V=new Int16Array([${Vdata.join(',')}]);`,
  `const N=new Int16Array([${Ndata.join(',')}]);`,
  `const F=new Uint16Array([${Fdata.join(',')}]);`,
  `const NV=${NV},NF=${NF};`,
  '',
].join('\n');

fs.writeFileSync(outputFile, header + engineCode, 'utf8');

console.log(`\nDone!`);
console.log(`  Output:     ${outputFile}`);
console.log(`  Element id: ${elementId}`);
console.log(`\nEmbed in HTML with:`);
console.log(`  <pre id="${elementId}" style="font-family:monospace;line-height:1;"></pre>`);
console.log(`  <script src="${path.basename(outputFile)}"></script>`);
