# Artwork sources

The repository keeps app-ready artwork and editable navigation/iOS icon sources in Git. Large raster originals remain available locally and are ignored, as selected for this repository.

| Location | Git policy | Use |
| --- | --- | --- |
| `assets/` | Commit | All bundled food, component, rating, café, avatar, UI, and navigation assets, plus fonts and exported app icons |
| `app-icons/navigation/` | Commit | Editable navigation SVGs |
| `composer-icon/` | Commit | Layered iOS icon document and its image layer; required by `app.json` |
| `design/originals/app-icons/` | Local only | Original dietary, availability, food, avatar, Bucky, and nutrient illustrations |
| `design/originals/bucky-ratings/` | Local only | Original rating expressions |
| `design/originals/dining-icons/` | Local only | Original café artwork |
| `design/originals/bucky-neutral.png` | Local only | Neutral Bucky reference image |
| `data/menu/scu-images/` raster files | Local only | Dish/component originals, thumbnails, and review attempts |
| `data/menu/scu-images/` JSON files | Commit | Image manifests, provenance, and generation progress |

No original artwork was discarded. Git will not back up the local-only files. Copy these original folders separately when setting up another artwork-editing workstation; then use the commands in [the script guide](../scripts/README.md). A normal checkout can run, test, and export the app using committed assets.

[Original artwork inventory](original-artwork.csv) records the repository-relative path, byte size, and SHA-256 checksum of all 596 local raster originals present at the audit. Update this inventory when intentionally replacing or adding originals.

Design references and prompts are in [Bucky avatars](../docs/bucky-avatar-prompts.md), [review vote icons](../docs/review-vote-icons.md), and [menu image workflow](../docs/workflows/menu-images.md).
