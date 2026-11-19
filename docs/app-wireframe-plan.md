# SCU Food — wireframe and interaction plan

Status: proposed product design. All review scores, user totals, goals and
component groupings in the accompanying mockup are illustrative. No ordering
integration or verified component quantities are assumed.

## Navigation

Five persistent root tabs, in this order: Home, Menu, Nutrition, Ratings, Me.
Each retains its navigation stack, filters and scroll position. Root tabs have
icons and text. Re-tapping a root tab returns to its root. Dish detail is a shared
destination reachable from Home, Menu, Ratings and the diary. Components push a
second full page; back restores the exact originating dish and scroll position.
The tab bar remains on standard detail pages; focused review/logging sheets may
cover it. Browsing works without an account. Sign-in is requested when saving a
review or syncing private data, without discarding the draft.

## Home: help me decide what to eat

Top: large Home title, Today/date, compact account shortcut.
Sections in priority order:
1. Top rated today: one prominent dish and two compact runners-up. Show Bucky
   stars, rating count, kitchen, service time and availability. Default to items
   still scheduled today; visibly distinguish Serving now and Later today.
2. Your day: logged meals and chosen nutrient progress; tap opens Nutrition.
   With no logs, use a useful Log your first meal action, not zero-filled charts.
3. Nutrition picks: High protein, Fiber-rich, or other user-chosen criteria.
   State the actual reason and serving-based number. Avoid a universal health
   score or assuming that fewer calories is always preferable. Unknown nutrients
   are excluded from that specific ranking, not treated as zero.
4. Saved and serving: favorites available today, linked directly to detail.
5. Optional rotating discovery slot: New this week or a kitchen closing soon.

Keep the first viewport focused on top rated and today's summary. Avoid putting
every idea on the first screen. No diet goals are required to use Home. Ratings
need a disclosed minimum sample size to qualify for top-rated placement; choose
the threshold after launch data exists. Until then show New / Not yet rated.

## Menu: where, when, and what

Top: Menu, search, date control, cafe picker and dietary filters. Cafe means a
location such as Marketplace; kitchen means a station such as La Parilla.
Each kitchen section contains:
- Kitchen name, Serving now / Opens at / Closed label.
- A shared-clock service timeline, breakfast/lunch/dinner labels and times.
- Meal-period selection and compact food rows: name, brief description, kcal,
  protein if available, Bucky score with count, and saved state.

Timeline behavior: use a proportional common time axis across kitchens, with a
clock marker at the current time. Past segments are muted, the current service
is highlighted and future periods are outlined or lightly filled. Breaks are
real gaps. Overlapping periods use two lanes rather than misleading contiguous
segments. Show an explicit time range in text. Tap a segment to select that
period's menu. No moving current-time marker for past/future dates. If actual
station-specific hours are unknown, label the hours as cafe service hours.
Respect reduced motion; the time marker need not animate continuously.

## Dish detail: understand, then act

Ordered vertically:
1. Back, save action, full wrapping dish name, kitchen/service context.
2. Full description, dietary tags and published allergen information.
3. Bucky score, count, and link to all reviews.
4. Components in a two-column grid, when structured components are available.
   Name and portion if known; no invented photos or ingredient quantities.
5. Nutrition per published serving: serving label, prominent calories; three
   directly labeled bars for protein/carbs/fat with gram values. If comparing
   nutrient grams, label the scale. Optional macro-energy proportions must use
   4/4/9 kcal per gram and be described as approximate, not published calories.
6. Fiber, sugar, saturated fat, sodium, cholesterol and trans fat as readable
   rows. More nutrients expands within the screen; values never depend on color.
7. Reviews: Most helpful / Latest, two excerpts, all reviews, Write a review.
8. Add to diary opens a portion/date/meal sheet, then confirms with Undo.

Transition: expand from the tapped item using native navigation transition / a
matched shared element where supported. Preserve identity through the title and
card bounds, then reveal the rest of the page. Do not scale long text as a bitmap.
Use system navigation fallback; honor Reduce Motion. Interactive back remains
available, and taps never wait for an animation to finish.

## Component detail: full-page ingredient view

Back to dish; component name; source recipe label if available; complete nested
ingredient list; published allergens; nutrition only when independently supplied
for that component. Explicit Nutrition unavailable state otherwise. Component
nutrition must never be inferred by dividing dish totals. Removing a component
does not recalculate nutrition without known component amounts.

Fallback: when only free-text dish ingredients exist, replace the component grid
with an Ingredients card opening the complete source text. Parsed ingredient
names can support browsing, but should not be represented as verified recipes.

## Nutrition: a personal daily summary

Top: Nutrition, date navigation and Day / Week / Month control.
Daily: activity-inspired rings for selected positive goals, e.g. protein/fiber,
with exact consumed and goal values alongside. All goals are optional and
user-set. Energy uses a neutral consumed/target display if a target is enabled.
Sugar/sodium use limit indicators only when limits are configured, not rings
that encourage filling them. Do not assume default calorie targets.
Next: chronological meals grouped Breakfast, Lunch, Dinner, Snacks; food name,
servings, time and edit/delete. Add from menu, recent foods or favorites.
Details: nutrients with known totals and explicit incomplete-data indicators.

Week: seven daily bars for the selected nutrient, optional user target reference,
daily selection, average across logged days with denominator. Distinguish no
logging from zero consumption. Month: weekly trend and calendar log coverage.
Keep feedback neutral; no shame language, compulsory streaks or food morality.
Never describe logged foods as ordered unless actual ordering is integrated.

## Ratings: community food discussion

Top: Ratings, Latest / Top, time filter (Today, This week, This month, Custom),
optional kitchen/dish filter. This week means the user's selected local calendar
week; display the date range so it is not confused with rolling seven days.
Review cards: author display name/avatar, time, linked dish and kitchen, Bucky
stars (1–5), title/body, optional photo, helpful-vote count, reply count, overflow.
Top sorts by helpful votes in the selected timeframe with deterministic recency
tie-breaking; the timeframe filters review creation date. All-time dish rating
and this-week review feed are distinct and labeled. Consider a separate trending
algorithm later, not an unexplained composite score at launch.

Tap dish -> dish detail. Tap discussion -> full review and replies. Write review
-> choose dish, Bucky score, text, optional photo, publish. One active rating per
user per dish; allow editing and record the visit date/version context when known.
One helpful vote per user/review; prevent self-voting. Include report, block,
moderation states and deleted-content handling before launching public posting.

## Me: identity, preferences and ownership

Profile header: display name/avatar, edit account. Optional contribution counts:
reviews, helpful votes received, kitchens tried. Insights focus on the person's
activity, e.g. most-reviewed kitchen or frequently saved dish, with date range.
Rows: My ratings, Saved foods, Dietary preferences, Nutrition goals, Appearance,
Notifications (only when relevant), Feedback, Help, Privacy, Terms, Data export,
Delete account, Sign out. Browsing remains possible signed out.
Separate public profile information from private food logs; logs and goals are
never visible to the ratings community by default.

## State and accessibility checklist

- First load skeletons preserve layout; offline cache has a last-updated label.
- Source error retains cached menus; closed, unpublished and empty-filter states
  have distinct copy. A published menu does not guarantee stock availability.
- Long dish names wrap; component grid becomes a list at large Dynamic Type.
- VoiceOver reads timeline periods, selected state, nutrient values and goals.
- Minimum 44pt targets, native back gesture, dark mode and reduced transparency.
- Missing reviews show Be the first to rate; missing nutrition stays unknown.
- Dietary filters preserve source labels and never imply allergy-safe food.

## Scope and schema impact

First release: all five tab destinations, menu ingestion, Home discovery, dish
details, basic diary and reviews. Rich weekly/monthly insights follow when the
user has enough logged data; do not present invented insight cards.

Existing schema covers menus, versioned nutrition, favorites and food logs.
Additional migrations are needed for public profiles, private preferences/goals,
reviews (user + stable food unique; optional food version context), helpful votes,
review replies, reports and moderation, blocked users, plus feedback submissions.
Component browsing needs structured source recipes/components and their links to
food versions; the existing ingredients table alone does not model components.
Review/photo uploads need storage access policies and deletion handling.
No schema changes are applied as part of this wireframe plan.
