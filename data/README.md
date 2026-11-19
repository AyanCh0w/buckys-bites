# Menu evidence and generated data

`menu/` contains the material previously stored in `menu-output/`. Paths inside image manifests remain relative to their existing `scu-images/` directory.

- `menu/scu-catalog/snapshots/` contains dated public menu snapshots. Keep these in Git: `tests/benson-catalog.test.ts` and the catalog rules generator depend on them.
- `menu/scu-catalog/` also contains the cumulative nutrition catalog, fetch summary, and audit results.
- `menu/scu-images/manifest.json` records image identities, prompts, verification, and provenance. The progress JSON is retained too.
- Raster originals, thumbnails, and rejected/review image attempts under `menu/scu-images/` remain on disk and are ignored by Git. A fresh checkout will contain their metadata but not the original images.
- The remaining JSON, Markdown, CSV, and HTML files preserve saved menu extracts, image prompts, and image targets. HTML/image previews that reference originals require those local files.

The app reads the committed runtime bundle in `src/data/catalog.json`, not this directory. Do not exclude the whole `data/` directory or regenerate the bundle as part of ordinary setup.

The [nutrition audit spreadsheet](../docs/reports/benson-nutrition-audit.xlsx) is retained under documentation. See [maintenance scripts](../scripts/README.md) for commands that update this data.
