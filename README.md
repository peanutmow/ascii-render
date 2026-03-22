# ascii-render

Render any 3D object as animated ASCII art on a website via JavaScript.  
Includes the Stanford Bunny as a ready-to-use example, plus a converter that turns any `.obj` file into an equivalent self-contained renderer script.

<img width="950" height="915" alt="image" src="https://github.com/user-attachments/assets/889d604f-2864-4f0d-b317-720d422347b0" />

---

## Files

| File | Purpose |
|------|---------|
| `ascii-bunny-render.js` | Ready-to-use example — drop it into any page |
| `obj-to-ascii-render.js` | Node.js converter: `.obj` → renderer JS |

---

## Quick start — use the Bunny as-is

1. Add a `<pre>` element with `id="ascii-bunny"` to your page.
2. Include the script.
3. Move the mouse to rotate; the model follows the cursor.

```html
<pre id="ascii-bunny" style="font-family:monospace;line-height:1;"></pre>
<script src="ascii-bunny-render.js"></script>
```

---

## Convert your own `.obj` file

### Prerequisites

- [Node.js](https://nodejs.org/) (any recent version, no npm packages needed)
- A `.obj` mesh file — exported from Blender, MeshLab, etc.

### Run the converter

Place your `.obj` file in the same folder, then run:

```bash
node obj-to-ascii-render.js mymodel.obj
```

This produces `mymodel-render.js` in the same directory, targeting an HTML element with `id="ascii-mymodel"`.

### Options

| Flag | Default | Description |
|------|---------|-------------|
| `--id <id>` | `ascii-<modelname>` | HTML element `id` the script will write to |
| `--out <file>` | `<modelname>-render.js` | Output file path |

```bash
# Custom element id and output path
node obj-to-ascii-render.js dragon.obj --id my-canvas --out public/dragon.js
```

### Embed the output

```html
<!-- Add a <pre> whose id matches the --id you used (or the default) -->
<pre id="ascii-mymodel" style="font-family:monospace;line-height:1;"></pre>
<script src="mymodel-render.js"></script>
```

---

## OBJ support

| Feature | Supported |
|---------|-----------|
| Vertex positions (`v`) | ✅ |
| Per-vertex normals (`vn`) | ✅ (used when present) |
| Triangles and quads (`f`) | ✅ (quads fan-triangulated) |
| N-gons (`f` with >4 vertices) | ✅ (fan-triangulated) |
| UV coordinates (`vt`) | ignored (not needed for ASCII shading) |
| Materials / `mtl` files | ignored |

If the `.obj` has no normals, smooth per-vertex normals are computed automatically by averaging adjacent face normals.

**Mesh size limit:** face indices are stored as `Uint16Array`, so meshes must have ≤ 65 535 vertices after processing.  For large meshes, use Blender's *Decimate* modifier or a similar tool to reduce polygon count first.


---

## Tips

- **Orientation** — models export in various coordinate systems.  If your model appears sideways or upside-down, rotate it 90° in Blender before exporting.
- **Scale** — the converter normalises the mesh to fit the `[-1, 1]³` cube automatically.
- **Multiple models on one page** — give each `<pre>` a unique `id` and use `--id` when converting each model.


