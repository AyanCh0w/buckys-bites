# Repository organization audit

Audited November 19, 2026. Scope: prepare the existing Expo app for an app-focused Git repository, preserve functionality, and retain every existing project file. Original raster artwork remains local and ignored, as selected by the app owner.

## Result

- **818 files, approximately 63 MiB**, are eligible for Git, including the runtime app, bundled assets, editable navigation/iOS icons, lockfile, database migrations, tests, menu evidence, scripts, and documentation.
- **596 original raster files, 726.68 MiB**, remain on disk and are excluded from Git. Their paths, sizes, and SHA-256 checksums are recorded in [the artwork inventory](../design/original-artwork.csv).
- All **1,413 inventoried pre-existing project files** remain present, accounting for moves. The inventory excludes dependency, Git, Expo-cache, and build-output directories; those directories were also left in place. No artwork, menu snapshots, report, migration, or app feature was removed.
- No file in `src/`, `assets/`, or `composer-icon/` was edited by this organization task. App configuration, EAS configuration, package versions, the npm lockfile, and database migrations were preserved. One independently modified source file is noted below.
- At the end of this organization audit, the existing Git repository had no commits, no staged files, and no configured remote. This report records the organization pass before the separately requested initial commit and push.

## File organization

| Previous location | Current location |
| --- | --- |
| `menu-output/` | `data/menu/` |
| `AI WORKFLOWS/*.py` | `scripts/menu/` |
| `AI WORKFLOWS/__pycache__/` | `scripts/menu/__pycache__/` (preserved, ignored) |
| `AI WORKFLOWS/01 - Menu images.md` | `docs/workflows/menu-images.md` |
| `AI WORKFLOWS/02 - Nutrition and ingredients.md` | `docs/workflows/nutrition-and-ingredients.md` |
| Raster source folders under `app-icons/` | `design/originals/app-icons/` |
| `bucky-ratings/` | `design/originals/bucky-ratings/` |
| `dining-icons/` | `design/originals/dining-icons/` |
| `bucky-neutral.png` | `design/originals/bucky-neutral.png` |
| `outputs/…/Benson nutrition audit.xlsx` | `docs/reports/benson-nutrition-audit.xlsx` |
| Original detailed `README.md` | `docs/development-notes.md`, with an updated link base and historical context |

`app-icons/navigation/` and `composer-icon/` retain their paths because they are editable sources used by the navigation generator and Expo configuration. The runtime layout under `src/` and `assets/` also retains its paths. Documentation and maintenance scripts point to the new locations; the catalog test now reads snapshots from `data/menu/`. The internal relative paths in saved image manifests remain valid.

The root README now describes setup, folder responsibilities, and verification. Additional directory guides explain data provenance, artwork storage, and maintenance commands. The detailed implementation history was retained rather than replaced with a summary.

## Git configuration

`.gitignore` now covers Python caches, test output, logs, common local credential/signing files, Supabase CLI state, and original raster artwork, in addition to the existing dependency/Expo/build exclusions. It keeps `.env.example` visible. All bundled `assets/`, the complete Icon Composer document, the runtime catalog/asset registry, and menu snapshots required by tests remain eligible for Git.

`.gitattributes` classifies text and common binary formats. `.nvmrc` selects Node 24, matching the Node major already present in the project's development dependencies and the installed Expo/React Native engine requirements. `.env.example` contains commented optional client overrides and no private credentials. No dependency versions or runtime configuration values changed.

The original `ios/` and `android/` ignore policy is retained: neither directory existed at audit time, and native projects are generated from Expo configuration. Revisit that policy if intentionally maintaining native source in the future.

## Fresh-checkout issue fixed

Before the change, `npm run typecheck` passed in this workspace but failed when only Git-eligible files were copied to a temporary checkout. `Tap.tsx` uses React Native Web's `hovered` state, whose declaration was being supplied indirectly by the ignored, generated `expo-env.d.ts` file.

`tsconfig.json` now explicitly includes `expo/types` alongside the existing Node and React types. This loads the same ambient declarations before Expo generates local files. It does not change emitted JavaScript or app behavior. The generated declaration file remains ignored.

## Verification

| Check | Result |
| --- | --- |
| Before organization: TypeScript and test suite | Passed; 53 tests |
| Git-only temporary checkout: TypeScript | Passed without `.expo/` or `expo-env.d.ts` |
| Git-only temporary checkout: test suite | Passed; 53 tests, including isolated PGlite database checks |
| Catalog rules consistency | Passed with `python3 scripts/build-benson-catalog-rules.py --check`; migration content unchanged |
| iOS export | Passed; Hermes bytecode bundle generated |
| Web export | Passed; HTML, bundles, and assets generated |
| Moved Python scripts | Syntax, imports, input resolution, and SQL-import input collection passed |
| Changed JavaScript maintenance scripts | Syntax checks passed; relocated artwork input directories verified |
| Runtime asset references | 541 static relative `require()` references resolved to files included in Git; Expo icon paths included |
| Files and paths | Every inventoried original file accounted for; no case-insensitive candidate path collisions |
| Git exclusions | No cache, dependency, generated build, or ignored original-artwork files in Git candidates |
| Git object integrity | `git fsck --no-reflogs --no-dangling` passed |
| Credential-pattern scan | No private-key blocks or recognized private-token patterns found in 230 candidate text files; only the existing public Supabase publishable configuration was detected |
| Documentation links | All relative links in the root README and documentation guides resolve |

The temporary checkout contained only Git-eligible project files and reused the existing installed dependencies. It did **not** include the ignored source artwork, original build output, Expo cache, or Python caches. A new dependency installation was not performed. The latest Expo agent CLI download was unavailable because the npm registry could not be resolved; the export used the locally cached Expo agent CLI 1.0.31 with the project's installed Expo CLI and Node 24.22.3.

Export validation checks bundle generation, not a signed native build or an on-device interaction session. No Supabase data was changed, no migrations were deployed, and the live-catalog exporter and artwork generators were not run against the working app.

## Remaining observations

- **Concurrent source edit:** `src/components/food-orbit.tsx` changed independently during the audit. This task did not write to it or revert it. The verification copy was refreshed, and TypeScript plus both exports passed again with that edit. Runtime/build inputs matched the final verification copy when the audit finished. Other original runtime source files and bundled assets matched the initial preservation hashes.
- **Local artwork needs a separate backup:** Git intentionally excludes the 596 originals. A checkout can run and export the app, but artwork regeneration requires restoring those originals at the inventory paths. Saved HTML/image previews may also require them.
- **Existing Git object storage:** the pre-existing `.git/` directory contained about 740 MiB of loose objects despite having no commits. It was left untouched, including an observed temporary object. Git object cleanup was outside this organization task; this storage is separate from the files eligible for a first commit.
- **Existing release notes:** Apple provider activation, native device checks, and other previously recorded product follow-ups remain documented in [Apple sign-in](apple-sign-in.md) and [development notes](development-notes.md). This audit does not mark them complete.
- **License metadata:** no root license file or bundled-font license notices were present. This task did not assign distribution rights or add a license.

## First commit

Review the candidate files and make the first local commit when ready:

```sh
git status --short
git add .
git diff --cached --stat
git commit -m "chore: init"
```

The `.gitignore` rules keep the large originals and local state out of `git add .`. A remote can be configured separately when the destination and visibility are chosen.
