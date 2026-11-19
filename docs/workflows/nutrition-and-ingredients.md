# SCU nutrition and ingredient catalog

Run this workflow to capture every food or drink record the [SCU dining website](https://scudining.cafebonappetit.com/) publishes across its cafés and available dates. Collect mains, sides, drinks, toppings, condiments and add-ons, including items with missing nutrition or ingredients. Use the same output directory on repeat runs so dated snapshots accumulate.

From the project root, with Python 3.10+ and curl available, collect every date each café currently links to:

```sh
python3 "scripts/menu/fetch_scu_menu.py" --published
```

Fetch explicit dates or narrow to particular cafés when needed:

```sh
python3 "scripts/menu/fetch_scu_menu.py" --date 2026-11-18 --date 2026-11-19
python3 "scripts/menu/fetch_scu_menu.py" --date 2026-11-18 --cafe marketplace-2
```

With no date arguments, the script uses the current date in America/Los_Angeles. Add `--output <directory>` to build a separate catalog.

1. Check `data/menu/scu-catalog/latest-run.json` for dates, cafés, counts, errors and pages with no menu. Retry failed café-date pairs using explicit arguments. If the website has changed, verify the dated page and inspect its nutrition and ingredients panel before adapting the parser. Do not substitute data from a different day when a date is unavailable.
2. Use `data/menu/scu-catalog/nutrition-catalog.json` for lookups. It retains the published nutrition fields, units, serving sizes, ingredient text, options, dietary and allergen icons, recipe references and source occurrences. Blank source fields remain blank or null. Treat the ingredients field as the published ingredient list and preserve the menu description separately. The full public menu payload and station placements are stored in one snapshot per café and date under `data/menu/scu-catalog/snapshots/`.
3. The catalog merges repeated published records across café dates without relying on the site's daily menu-item ID. Where labels match but nutrition, ingredients, serving details or other retained source fields differ, preserve separate versions. Use the occurrence list to trace each one. Avoid merging a component into a similarly named entrée, or copying nutrition from a different portion or preparation.
4. Spot-check representative prepared dishes, beverages, variant sizes, and records with missing data against the site's “nutrition + ingredients” panels. Keep scope explicit when reporting coverage. A single run can collect available menus. Seasonal items, future rotations and historical pages the site no longer serves require additional dated runs or archived source pages.

The fetcher updates a café-date snapshot after a successful read and leaves its last saved snapshot available if a later fetch errors. Saving a successful snapshot for a newer date adds to the catalog. The collector does not generate images.
