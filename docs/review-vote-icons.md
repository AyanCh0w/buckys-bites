# Review voting icons

Ready for integration. Created on November 19, 2026 using the built-in imagegen tool.

| Asset | Production path | Dimensions | Format | Size |
| --- | --- | --- | --- | --- |
| Helpful | `assets/icons/review-helpful.png` | 512 × 512 px | RGBA PNG | 175,820 bytes |
| Not helpful | `assets/icons/review-not-helpful.png` | 512 × 512 px | RGBA PNG | 173,034 bytes |

## Design

- White chef-glove thumbs-up and thumbs-down with Santa Clara red cuffs (prompt color: `#A32035`; rendered highlights and shadows vary).
- Rounded soft 3D forms, warm ivory shading, subtle creases, and broad finger shapes follow the visual character of `calories.webp`, `protein.webp`, and `leave-a-review.webp`.
- The thumbs-down asset was generated as an edit of the thumbs-up source to preserve the paired appearance. Its cuff moves to the top and thumb points down.
- Each hand is centered with matched apparent size: the principal silhouette is 438 px tall within the 512 px canvas. Thumbs are on the viewer's left and folded fingers on the right.
- No text, arrows, circles, square tiles, decorative objects, or baked-in background.
- Production preparation only trimmed excess transparent canvas and resampled with Lanczos3 into matching transparent 512 px canvases. The generated colors and alpha were retained.

## Verification

Both production files were decoded and inspected after resizing.

| Check | Helpful | Not helpful |
| --- | --- | --- |
| Dimensions | 512 × 512 | 512 × 512 |
| Channels | 4 (RGBA) | 4 (RGBA) |
| Alpha range | 0–255 | 0–255 |
| Fully transparent pixels | 168,976 | 169,564 |
| Nontransparent outer-border pixels | 0 | 0 |
| Visible bounds, alpha ≥ 128 (inclusive) | x: 100–411; y: 37–474 | x: 97–413; y: 37–474 |

Visual checks passed at native 32 px, at 160 px, and with an enlarged nearest-neighbor view of the 32 px rendering. Both gestures remain recognizable on warm light (`#F6F2EC`) and dark (`#242326`) backgrounds; red cuffs remain visible and the images do not show rectangular backgrounds. Alpha is genuine, not a checkerboard baked into the PNG. The generator uses near-opaque alpha across much of each glove; that original alpha was preserved.

This handoff contains only the two production assets and this document. Component wiring and asset registry changes are left to the integrating chat.

## Source generation

Built-in imagegen was used for both assets with `transparent_background: true`. No API/CLI fallback was used.

Source files retained outside the repository:

- Helpful: `~/.codex/generated_images/01a1f5e4-6ddf-7db0-8e37-623ca8b82178/exec-b18d5431-5d33-435e-a45f-aebc19b319a8.png`
- Not helpful: `~/.codex/generated_images/01a1f5e4-6ddf-7db0-8e37-623ca8b82178/exec-02825795-d247-4c73-be39-cf9677b23021.png`

### Helpful prompt

```text
Use case: stylized-concept
Asset type: production UI icon for Bucky’s Bites, displayed at 32px.
Primary request: one isolated white chef-glove hand making a very recognizable thumbs-up, with a Santa Clara red (#A32035) cuff. This is the helpful-review voting icon.
Style/medium: polished soft 3D illustration matching a small app icon set with a plump orange flame, softly modeled egg half, and friendly 3D horse mascot. Softly rounded forms, smooth matte material, restrained warm ivory shading and tiny creases, soft top-left studio illumination. A designed app icon, not a realistic hand photo.
Subject: a single white chef glove, short chunky rounded upright thumb on the viewer's left, compact fist to its right with four folded fingers suggested simply by broad soft forms. A short deep-red rounded cuff immediately below the fist, no exposed skin and no extended arm. Cuff main color #A32035. White glove should remain bright with gentle light-grey depth and a clear outer silhouette.
Composition/framing: square canvas, one centered object occupying approximately 84% of canvas height and 78% of width. Straight-on with a subtle three-quarter turn for volume. Entire object visible with generous even transparent padding; thumb decisively vertical upward. Strong readable silhouette at 32px. Keep finger detail sparse and broad.
Scene/backdrop: genuinely transparent background with alpha, absolutely no backdrop or floor.
Constraints: only one thumbs-up icon. No text, no arrow, no badge, no circle, no tile, no square frame, no extra objects, no floating decorations, no cast floor shadow, no drop-shadow halo, no hard black outlines, no jewelry, no watermark. Clean transparent cutout edges.
```

### Not-helpful prompt

The helpful source file above was passed as the image edit reference.

```text
Use case: precise-object-edit
Asset type: paired 32px review-voting icon for Bucky’s Bites.
Input image: the approved white chef-glove thumbs-up is the edit target and exact style reference.
Primary request: create its matching THUMBS-DOWN partner. Change the gesture orientation so the short red cuff is at the TOP of the hand, the compact folded fingers stay to the viewer's RIGHT, and the thumb extends clearly straight DOWN on the viewer's LEFT. This is one single downward-pointing chef-glove hand, with the thumb tip near the bottom of the image. Preserve the glove design, four rounded folded fingers, warm white material, restrained softly shaded 3D modeling, and Santa Clara red (#A32035) cuff. Keep the same hand size, proportions, three-quarter viewpoint, and composition weight as the source. Relight naturally from upper left, with soft highlights upper left and shadows lower right.
Composition: square image, fully visible single hand with even transparent margins, approximately 84% canvas height. Strong unambiguous thumbs-DOWN silhouette at 32px. No extra objects.
Background: true alpha transparency. Preserve transparency; do not add a backdrop, ground, shadow, circle, badge, tile, border, text, logo, or watermark. Clean antialiased edges, no floating specks.
```

