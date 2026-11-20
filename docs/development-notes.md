# Bucky’s Bites — development notes

Historical implementation notes retained from the original README. Test counts and environment observations below describe earlier development checks; see [the repository audit](repository-audit.md) for the organization audit and [the root README](../README.md) for setup. Commands and code-formatted paths are relative to the project root.

Expo app for iPhone, using BDO Grotesk for primary text and the supplied Helvetica Neue Medium Condensed for secondary labels, numbers, and prices. Typography uses three base sizes: 14, 17, and 28, while respecting accessibility text scaling. The SCU Dining catalog and transparent dish, ingredient, Bucky, and café artwork are bundled for offline display. The browser preview is for layout and interaction review; iOS uses native tabs, native stack navigation, SwiftUI segmented controls, SF Symbols, haptics, and Liquid Glass where available.

## Run

```sh
npm install
npx --yes @expo/agent-cli@latest start
```

Open the project in an SDK 58 compatible Expo Go or development build. A local simulator requires full Xcode. This workspace currently has command-line tools only, so a standalone native build has not been verified. The user has tested the Expo Go app on an iPhone and confirmed the detail-screen and Home/Menu scrolling fixes.

```sh
npm run web
npm run typecheck
npm test
npx --yes @expo/agent-cli@latest export --platform ios --platform web
```

The active preview uses port 8081. Public Supabase configuration is in `src/lib/supabase.ts`; optional `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` environment variables override it. No service-role key is shipped.

## App icons

The bottom navigation uses five custom rounded line icons. Editable sources live in `app-icons/navigation/`; run `node scripts/generate-navigation-icons.mjs` after changing them. Native tabs use tintable 28-point PNGs at 1×/2×/3×, while the browser uses the same SVG paths. Selected icons use a slightly heavier stroke and the current theme’s accent color. Preview: [Menu with custom icons](navigation/menu-preview.jpg), [enlarged icon set](navigation/icon-set.png). TypeScript and iOS/web exports pass, and all five tab destinations were checked in the browser. The native device appearance has not been visually verified.

The source is `composer-icon/buckysbites.icon`. `ios.icon` references this Icon Composer document directly, so Xcode generates the native icon sizes and appearance variants. The general app icon (`assets/icon.png`) and web favicon (`assets/favicon.png`) are rendered exports of the same design.

After editing the document in Icon Composer, run `npm run icons` on macOS with Icon Composer or Xcode installed. For a custom installation, set `ICON_COMPOSER_ICTOOL` to Icon Composer's `Contents/Executables/ictool`. The bulk artwork preparation script leaves these app icons alone. A new native build is required to change the installed iOS Home Screen icon; Expo Go keeps its own icon.

## Current experience

- iOS text entry uses plain SwiftUI fields and the system font, including profile names, review comments, nutrition goals, and measurement estimates. The native font keeps the caret, selection, and text on the same metrics and supports Dynamic Type. Field colors, rounded containers, and surrounding brand typography remain consistent with the app.

- First launch introduces the app with six dishes flying into an orbit around Bucky, then a pullback and name reveal. The tour continues through Home-style lunch/dinner specials, two stacked, interactive sample reviews with compact food headers and full-width review text, and animated nutrient artwork with a real bundled dish’s published values. Intro completion is stored on the device; Me → Settings → Replay onboarding opens it again and returns to Settings when finished. The intro has no skip action.
- The four-step intro ends with “Let’s eat.” Daily goals are created automatically from [FDA Daily Values](https://www.fda.gov/food/nutrition-facts-label/daily-value-nutrition-and-supplement-facts-labels): 2,000 calories, 50 g protein, 275 g carbs, 78 g fat, 28 g fiber, 2,300 mg sodium, and a 20 g saturated-fat limit. No total-sugar target is invented from the added-sugar value. New profiles persist these defaults with an insert that preserves existing records. Older empty profiles receive the same starting values; saved personal goals and intentionally cleared goals after initialization are preserved.
- Me → Goals offers optional measurement estimates with native numeric fields for age, feet/inches, and pounds, a sex selector, descriptive activity choices, and a live calorie/macro preview. Goals and the separate estimate page use push/pop transitions, with native swipe-back on iPhone and Expo’s animated stack in the browser. Reduced motion uses a fade. Going back preserves the editor’s unsaved targets and scroll position. “Use these goals” saves directly, preserves targets outside the estimate, and returns to the updated goals editor. Invalid inputs keep the form intact. Measurements are never saved. “Use general daily goals” restores the generic values to the editor for review and saving.
- Review scores throughout the app show a single number beside a Bucky expression, with matching icon and number sizes. The 0–5 range remains available to screen readers. Onboarding motion uses Reanimated transforms/opacity, respects reduced motion, and keeps content scrollable at small sizes and larger text settings.

- Home opens with a featured written review. Its preview shows the dish, Bucky rating, review excerpt, and reviewer information. Tapping it opens that review in Ratings with its author and full details. Today’s specials show dish photos at Spice Market, Global Grill, Simply Oasis, and Chef’s Table. For paired entrées, All meals shows the regular version, Vegetarian shows a vegetarian or vegan version, and Vegan shows only dishes labeled vegan. A station with one lunch and one dinner option shows their photos side by side. Lunch and dinner share a row when their dish selections match. Each photo opens its dated dish offering. Today’s pick shows your highest-rated dish on the campus day’s published menu, using your latest score for each dish. A short list of up to three dishes you haven’t rated follows.
- Menu highlights the top two available dishes across all kitchens during an active published breakfast, lunch, or dinner service, followed by a scrollable kitchen list. Outside those services it shows just the kitchen list. Each row uses a featured dish with no image frame. Closed kitchens remain tappable and are dimmed according to kitchen hours in America/Los_Angeles. Weekdays use the November 19 Transact screenshot, confirmed by the user as the regular schedule, for Spice Market, Global Grill, La Parrilla, Mission Bakery, Fire Grill, Trattoria, and Simply Oasis. Slice reopens at 5:30 PM; its published lunch and closing times remain because the screenshot does not show a complete schedule. Known holiday exceptions and explicit café closures take precedence; weekends and other kitchens retain their dated published services. Service breaks remain intact and contiguous hours are combined. Dishes still require a dated menu, and current-meal highlights exclude closed kitchens. No menu search, café dropdown, date chooser, or pagination.
- Each kitchen opens a menu with plain Breakfast, Lunch, and Dinner tabs. The current campus meal is selected automatically; a manual choice remains until the next meal period. Unserved periods are disabled. One-dish menus use a large centered image; two-dish menus share the available screen equally. Larger menus, small viewports, and larger text use a plain scrollable list. Kitchen operating hours are separate from the source's dated dish service windows.
- Dish details default to Reviews, followed by the Nutrition tab. Nutrition contains the macro summary, large ingredient images, and the remaining facts inline below ingredients. Values display cal, g, or mg next to the number. The allergen UI and All nutrients buttons are removed; original source data is retained. Ingredient pages show independently published nutrition when one unambiguous serving is available, otherwise “Not available.” Images remain unboxed.
- Daily nutrition fits one screen when space allows, with scrolling on smaller screens or larger text, two recent food entries, and an all-food detail list. Weekly/monthly views distinguish days without logs. Online food logs reference a food version, portion, eating time, and meal period. The app derives nutrition from that version; it does not store separate per-person nutrient totals.
- Saving meals, reviews, and votes requires a real Supabase session. Development previews automatically open a visual profile so the interface can be reviewed; only profile preferences are cached for that preview. It never saves food logs or reviews locally. Release builds require a real session unless EXPO_PUBLIC_PREVIEW_ACCOUNT=true explicitly enables the visual preview. Anonymous Supabase authentication is disabled.
- Public review history, votes, karma, account data, reports, export, and account-deletion requests use the deployed cloud migration. Account deletion currently submits a request for the developer to handle; it does not delete an account automatically.

- Meal customization offers All meals, Vegetarian, and Vegan. Published vegan labels also qualify for the vegetarian view. Preferences filter Home and Menu; preferences persist with the local preview or signed-in account. The same profile preference is ready for future onboarding.
- Menus sort open options first, then your latest rating, then the latest-score community average and count. Kitchen rows feature their highest-ranked matching dish.
- Me begins with avatar/name and a pencil that opens the name and picture customizer. Three direct buttons—Meals, Goals, Settings—sit above the user’s review feed. About and Privacy are small footer actions. Eight bundled Bucky avatars are available; Classic is the default for missing or invalid values. Real accounts persist the validated avatar ID in Supabase, and public reviews display the reviewer’s current avatar.
- The forum has Top Day / Top Week / Top All time via an inline timeframe dropdown, For You, and New. Only written comments appear or accept votes. Rating-only entries still count toward dish averages. Removing comment text removes its existing votes.
- For You combines net helpfulness and recency with eating history, personal scores, current availability, and dietary preferences. Its deterministic ranking does not collect engagement telemetry.
- App controls use Santa Clara Red, with supporting SCU palette colors from [the university’s brand guide](https://www.scu.edu/umc/brand/colors/). Large transparent food artwork stays unboxed.

## Sign-in

Me and the food-log prompt offer Sign in with Apple on supported iOS devices and username/password sign-in for existing accounts. Both use the same Supabase session storage and contribution permissions. See the [account setup guide](apple-sign-in.md) for Apple’s client IDs and reviewer access.

## Backend status

`supabase/migrations/20261119060000_buckys_bites.sql` was tested locally and applied with explicit user approval. Supabase recorded it as `20261119070649_buckys_bites_accounts_cloud`. Existing food-log permissions and accounts were preserved.

The migration adds retained eating history, dated reviews, an immutable submission ledger, latest-score aggregates, review votes, karma, profiles/avatars/preferences, reports, and authenticated owner-scoped RPCs. Logging creates a meal record and eating-history record atomically. Public review data exposes the day eaten, not the precise eating timestamp. Other students cannot read personal meal logs.

The service-role-only `bites_developer_meals` view exposes user, food version, portion, meal period, and eating time for a future developer dashboard, without per-user nutrient totals. No dashboard UI is built yet. Live permission checks confirm that authenticated students cannot read this view, the service role can, authenticated users can call the logging RPC, and signed-out users cannot. Privileged credentials must stay on the server.

The app reads the live Supabase catalog with a bundled and cached fallback. The bundle includes the Benson Marketplace and Mission Bakery publications for November 17–28, 2026. The existing `benson-daily-menu` job refreshes both cafes at campus midnight and retries each cafe independently during the existing retry window. The dated service rows control what appears on the current campus day’s menu.

The rules migration is generated by `python3 scripts/build-benson-catalog-rules.py`. The rules use the saved Bon Appétit publications, the Thanksgiving hours, and the November 19 Transact observations. `node scripts/export-benson-catalog.mjs` reads the public catalog, keeps the current bundled image mappings, and exports the base catalog and image queue. Coordinate a base export with the image owner before running it against a shared checkout.

## Defaults pending product confirmation

- Weekly reviews use a rolling seven-day interval, enforced independently of review deletion.
- Editing a review requires a meal in the last 72 hours.
- Deleting a log retains eligibility; deleting a selected associated review is explicit. Account deletion is currently a developer-handled request.
- Latest remaining review scores contribute to dish averages. Deleted/hidden reviews and removed votes no longer affect karma; karma may be negative.
- Home selects written reviews using helpfulness, relevance, and freshness; a controversial review needs votes on both sides. No review text is invented for unrated dishes.
- Nutrition logging is uncapped. Proposed daily participation limits are not enabled until their behavior is decided.
- The UI logs food now; the backend supports past eating times up to 30 days, with review eligibility based on that time.
- Appearance always follows the device. The manual theme picker has been removed, and overrides saved by earlier versions are cleared. Native navigation, status bars, glass, SwiftUI pickers/menus, keyboards, forms, and nutrient charts follow system appearance. Notifications, a public avatar uploader, and a production moderation dashboard are not included yet; reports can be reviewed in Supabase.

## Verification

Weekday hours correction: TypeScript and all 52 tests pass. Regression coverage compares the kitchen list with the November 19, 2:40 PM Transact screenshot and checks lunch breaks, Slice's 5:30 PM reopening, 8:30 PM dinner closures, Fire Grill's 11:58 PM cutoff, holiday and explicit closures, campus daylight-saving time, and exclusion of closed kitchens from current-meal highlights. The correction applies to bundled, cached, and live catalogs without changing published dish offerings.

Review layout update: onboarding lists both examples without selection tabs. The feed, dish pages, Me, and Home’s featured review share a compact 88px food image beside the dish name and rating. Written reviews span the full width underneath, followed by the reviewer’s avatar, name, and date. Ratings without text omit the text and voting controls. Written reviews place the up/down vote controls beside the reviewer’s avatar, name, and date. Net totals and the three-dot review menus are removed. Review voting uses matching transparent chef-glove icons with 44pt targets, selected states, and accessible helpful/not-helpful labels. TypeScript, all 44 tests, and iOS Hermes/web exports pass. Browser checks cover compact cards at 320px and 393px phone widths, both stacked examples, inline voting, removal of net totals, and removal of review menus. Earlier checks cover removal of appearance controls and Settings → Replay onboarding → Settings. Preview: [inline review votes](onboarding/reviews-inline-votes.jpg).

The goals revision passes TypeScript, all 47 tests, and iOS Hermes/web exports. Tests cover generic defaults, legacy empty profiles, personal and intentionally cleared goals, US-unit conversion, invalid measurements, and the existing age/activity-specific energy equations. Browser checks cover the four-step intro, automatic legacy defaults, live estimates, validation and recovery, and saving goals across reloads. Native keyboard behavior and VoiceOver still need an iPhone check.

Twenty-nine tests cover Apple authentication nonce/state validation, cancellation and failed exchanges, plus recurring hours across daylight-saving changes, inline nutrient units, Home selection, review-derived profile dishes, current-meal highlights, next opening/closing boundaries, personalized menu ordering, forum ranking/timeframes, dietary visibility, text-only voting, nutrition scaling and missing values, campus timezone/DST, service availability, ingredient serving ambiguity, latest-review aggregates, weekly/72-hour eligibility, retained voting eligibility, avatar validation/fallback/assets, and database authorization/log/review/vote/deletion-request flows using isolated PGlite databases. Database tests also cover avatar visibility, rejected invalid values, and developer-view access restrictions. iOS Hermes and web exports pass.

Browser checks cover one- and two-dish kitchen layouts at phone size, avatar selection surviving reload, the three text sizes and font families, pencil navigation, three preference buttons, all six additional nutrient images on dish and ingredient pages, sign-in being required before saving food, and Nutrition overflow at 393 × 667. A real Supabase user login has not been exercised. The user confirmed on an iPhone that new dishes show their full image at the top and the last Home/Menu item clears the bottom bar. The latest profile picker screenshot is [here](profile-avatar-preview.jpg).

All tabs use automatic iOS scroll insets. Menu, Nutrition, and Ratings keep fixed headers while their scroll viewports extend beneath the floating tab bar; bottom clearance lives in the scroll content instead of a solid screen-level strip. Detail screens with fixed headers/footers use the navigation-aware `SafeAreaView` from `react-native-screens`, so their nested lists use no additional automatic inset. Forms use automatic scroll insets for the SDK 58 Liquid Glass header. This avoids both clipped content and doubled padding; new dish/ingredient identities start at the top while returning from an ingredient preserves the dish's position.

All eight avatar images and six additional nutrient icons—fiber, sugar, sodium, saturated fat, trans fat, and cholesterol—are bundled. Runtime rendering does not require signed storage URLs. Existing Bucky rating expressions and primary nutrient icons are unchanged.

Nutrient artwork is also used in daily and period totals, goals, food logging, history, and compact dish previews. Shared number/unit rendering keeps units on the same baseline with a consistent gap. Ring values remain centered with or without a goal; the goal appears below the ring. Browser geometry checks confirmed all three ring centers and the four secondary-value baselines align, and all ten nutrient images load.

Generated imagery is disclosed in Me → About. Bucky’s Bites is not affiliated with, endorsed by, or operated by Santa Clara University. This appears in About and the account flow. Final community terms and operating/moderation arrangements still need the app owner’s release review.

Initial dark-mode verification covered all five tabs, the review timeframe menu, and nutrient rings at 393 × 852. Appearance now follows the system without a manual picker. Native iPhone appearance has not been visually verified. Preview: [dark Nutrition](dark-mode-preview.jpg).
