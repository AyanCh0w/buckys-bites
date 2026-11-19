# Maintenance scripts

Run these commands from the project root. App setup uses the committed catalog and assets and does not require running generators.

| Command | Inputs and effects |
| --- | --- |
| `node scripts/generate-navigation-icons.mjs` | Reads `app-icons/navigation/*.svg`; writes scale-specific images in `assets/navigation/`, the web icon module, and the navigation source README. |
| `npm run icons` | Reads the Icon Composer document configured by `app.json`; regenerates the general app icon and favicon. Requires macOS and Icon Composer. |
| `node scripts/prepare-assets.mjs` | Reads local originals from `design/originals/` and `data/menu/scu-images/`; writes optimized artwork and `src/data/assets.ts`. Restore the complete original artwork before running this on another checkout. |
| `python3 scripts/build-benson-catalog-rules.py --check` | Checks the committed SQL migration against saved menu snapshots, `benson-holiday-hours.json`, and `benson-transact.json`; does not change files or contact Supabase. |
| `python3 scripts/build-benson-catalog-rules.py` | Regenerates the local catalog rules SQL migration from the same evidence. It does not apply that migration. |
| `node scripts/export-benson-catalog.mjs` | Reads the live public Supabase catalog; updates `src/data/catalog.json` and `data/menu/benson-catalog-image-targets.json`. Coordinate catalog and artwork changes before exporting. |
| `python3 scripts/menu/fetch_scu_menu.py --published` | Fetches public menus using Python and curl; updates dated snapshots and the cumulative catalog under `data/menu/scu-catalog/`. Use `--help` for date, café, fixture, and output options. |
| `python3 scripts/menu/audit_scu_nutrition.py` | Rebuilds the November 18 nutrition audit from saved snapshots, menu notes, and the image manifest. |
| `python3 scripts/menu/extend_scu_nutrition_audit.py` | Rebuilds the follow-up audit using saved evidence. Run the base audit first. |
| `python3 scripts/menu/build_scu_supabase_import.py` | Reads the saved November 18 audit and evidence; prints transactional import SQL to stdout. It does not connect to or modify a database. |

The four Python tools in `scripts/menu/` use the Python standard library. Keep them together because the audit and import scripts share helpers. Detailed instructions are in [menu images](../docs/workflows/menu-images.md) and [nutrition and ingredients](../docs/workflows/nutrition-and-ingredients.md).

Asset and catalog generators overwrite generated files by design. They are maintenance tools, not installation steps. The repository organization audit did not regenerate the app catalog or artwork.
