# Phase 8 — 3D molecular viewer (Mol*)

Display-only PDB/mmCIF viewer wired into the project dashboard.

## Library choice

**[Mol\*](https://molstar.org/)** (`molstar` npm package, MIT) — preferred OSS
macromolecular viewer. Integrated via `Viewer.create` from
`molstar/lib/apps/viewer/app` with the light UI skin.

Why Mol* (not a lighter canvas-only library): it already understands PDB and
mmCIF, matches the formats this app imports, and stays fully client-side with
no structure upload.

## What it does / does not do

- **Does:** list PDB/mmCIF datasets in the open project; render a **copy** of
  `originalText` in Mol*; offer Full / Reduced / Summary modes.
- **Does not:** mutate `originalText`, rewrite coordinates, or touch HMM /
  bootstrap / AIC results under `project.state`.

## Modes

| Mode | Behavior |
|------|----------|
| **Full** | Mol* with compact controls; `powerPreference: low-power`. |
| **Reduced (CPU-safe)** | Minimal Mol* chrome, lower `pixelScale` / `pickScale`, prefer WebGL1, exports disabled. Honest label that detail is reduced — not a fake “high quality” view. |
| **Summary only** | No WebGL. Shows the import parse summary (ATOM/HETATM, chains, mmCIF categories, etc.). |

If WebGL cannot be created, or Mol* fails to initialize, the panel **forces
Summary only** and explains why.

## How to test

1. `npm install && npm run dev`
2. Create or open a project.
3. Import `fixtures/sample.pdb` and/or `fixtures/sample.cif` (also accept
   `.mmcif` for mmCIF).
4. Open **3D structure viewer** on the dashboard.
5. Select each dataset — the canvas should show the tiny sample structure
   (2 atoms in the fixtures; enough to prove load + render).
6. Switch to **Reduced** — UI chrome shrinks; status text mentions reduced mode.
7. Switch to **Summary only** — canvas unmounts; parse summary remains.
8. Optional: disable WebGL in browser flags / use a blocked context — panel
   should fall back to summary with an honest message.

## Fixtures

- `sample.pdb` — minimal PDB (`ALA` + water HETATM)
- `sample.cif` — minimal mmCIF `_atom_site` loop

## Build

```bash
npm run build
```

Mol* is code-split via dynamic `import()` so the initial app bundle stays
smaller; the viewer chunk loads when the panel mounts in Full/Reduced mode.

## Limitations

- Sample fixtures are tiny (2 atoms) — useful for smoke tests, not biology.
- Mol* is a large dependency; first open of the 3D panel downloads/compiles a
  sizable JS/CSS chunk.
- Reduced mode lowers GPU cost and hides chrome; it does **not** invent a
  separate ball-and-stick engine. Default Mol* presets still apply after load.
- No server-side rendering; viewer requires a browser with canvas + (for 3D)
  WebGL.
- Mol* brings its own plugin UI (React-based) into a host `div`; our app React
  tree does not control Mol* internals beyond create/load/dispose.
