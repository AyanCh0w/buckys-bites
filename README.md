# Bucky’s Bites

An Expo SDK 58 app for SCU dining, built for iPhone with a browser preview. It includes campus menus, dish and ingredient artwork, nutrition tracking, reviews, and Supabase account data. The catalog and app artwork are bundled for offline display.

## Get started

Use Node 24.3 or newer within Node 24 (`.nvmrc` selects 24), and npm. The exact dependency tree is recorded in `package-lock.json`.

```sh
npm ci
npm start
```

Open the app in a compatible Expo Go or development build. For a browser preview, run `npm run web`. A local iOS simulator or standalone iOS build requires the appropriate Xcode installation.

Public Supabase defaults already exist in `src/lib/supabase.ts`. To override them, copy `.env.example` to `.env.local` and uncomment the two configuration values. Never put a service-role key or other private credentials in `EXPO_PUBLIC_*` variables; those values are embedded in the app.

Sign in with Apple is the app’s login method. See [Apple sign-in setup](docs/apple-sign-in.md) for provider configuration and native verification. Development builds also provide a visual preview profile; saving meals and reviews requires a real session.

## Project layout

| Path | Purpose |
| --- | --- |
| `src/app/` | Expo Router screens and platform-specific layouts |
| `src/components/`, `src/lib/`, `src/state/` | UI, shared logic, and providers |
| `src/data/` | Bundled catalog and asset registry; commit these generated app inputs |
| `assets/` | Bundled images, icons, and fonts; required to run and build |
| `app-icons/navigation/` | Editable SVG navigation icons |
| `composer-icon/` | Layered iOS icon source referenced by `app.json` |
| `data/menu/` | Saved public menu evidence, catalogs, image manifests, and prompts |
| `scripts/` | Asset and catalog maintenance tools, including `scripts/menu/` |
| `supabase/` | Database migrations and SQL checks |
| `tests/` | App logic and isolated database tests |
| `docs/` | Setup notes, design references, workflows, screenshots, and reports |
| `design/originals/` | Local original artwork, preserved but excluded from Git |

The original PNGs under `data/menu/scu-images/` are also local-only. Their manifests remain in Git. Every image required by the app is committed under `assets/` or `composer-icon/`; the originals are only needed for artwork maintenance. See [artwork organization](design/README.md).

## Verify

```sh
npm run typecheck
npm test
python3 scripts/build-benson-catalog-rules.py --check
npm run export
```

The SQL tests run in isolated PGlite databases and do not modify the live Supabase project. Python 3.10+ is needed for menu maintenance and the catalog rules check; normal app development only needs Node/npm. The export command checks the iOS JavaScript/Hermes bundle and the web bundle; it does not create a signed native app.

## Maintenance

- [Scripts and their inputs/outputs](scripts/README.md)
- [Menu and nutrition data](data/README.md)
- [Documentation index](docs/README.md)
- [Repository audit and file moves](docs/repository-audit.md)

The root Expo, EAS, TypeScript, and npm configuration files retain their existing locations. Commit `package-lock.json` with dependency changes. Caches, generated builds, local environments, signing credentials, Python bytecode, and original raster artwork are ignored. Back up the ignored artwork separately if you need to edit or regenerate it on another computer.
