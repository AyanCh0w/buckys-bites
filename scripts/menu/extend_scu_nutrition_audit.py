#!/usr/bin/env python3
"""Check cross-menu component evidence and reconcile independently sourced estimates."""
from collections import Counter, defaultdict
from decimal import Decimal
import json

from audit_scu_nutrition import (
    DATE, OUTPUT, ROOT, SNAPSHOT, compare, component_slug, dish_slug, option_rows, read_fact,
)

CATALOG = ROOT / 'scu-catalog'
RESULT = CATALOG / f'marketplace-{DATE}-nutrition-followup.json'
GUIDE = 'https://georgefox.cafebonappetit.com/wellness/nutrition-facts-tables/'
GUIDE_FIELDS = {
    'calories': '', 'fatContent': 'g', 'saturatedFatContent': 'g',
    'carbohydrateContent': 'g', 'fiberContent': 'g', 'proteinContent': 'g', 'sodiumContent': 'mg',
}
GUIDE_PROXIES = {
    'dish:french-toast-2': ('French toast', '2 slices', (350, 13, 6, 45, 2, 12, 470), Decimal(1)),
    'dish:pancake-2': ('Pancake (~6-inch)', '3 pancakes', (150, 2, 0, 30, 1, 3, 470), Decimal(2) / 3),
    'dish:buttermilk-waffle': ('Waffles (~6-inch round)', '1 waffle', (210, 2.5, 0, 41, 1, 4, 640), Decimal(1)),
}
SCU_PROXIES = {
    ('dish:chicken-rice-bowl', '79870.3'): ('14115262', 'Substitutes a 1 oz broccoli serving without the oil in the roasted recipe.'),
    ('dish:salmon-rice-bowl', '79870.3'): ('14115262', 'Substitutes a 1 oz broccoli serving without the oil in the roasted recipe.'),
    ('dish:express-breakfast-scrambled-eggs-tater-tots-and-bacon', '75540549'): (
        '23021268', 'Substitutes a 3 oz scrambled egg serving from La Parilla Breakfast with a different recipe ID.'),
}


def collect_sources(snapshots, dish_names):
    recipes, labels = defaultdict(dict), defaultdict(dict)
    for snapshot in snapshots:
        for item_id, item in snapshot['items'].items():
            location = {key: snapshot[key] for key in ('cafe', 'date', 'source')}
            location.update(item_id=item_id, station_id=item['station_id'])
            for option in option_rows(item):
                facts = option.get('side_nutrition_details') or {}
                if facts.get('calories'):
                    name = option.get('label') or option.get('description') or ''
                    evidence = dict(location, recipe_id=str(option['id']), kind='in_dish_option', name=name, nutrition=facts)
                    register(recipes, labels, evidence, [name])
            item_recipes = item.get('recipes') or {}
            entrees = item_recipes.get('entrees', [])
            facts = item['nutrition_details']
            if len(entrees) != 1 or item_recipes.get('sides') or option_rows(item) or not facts.get('calories'):
                continue
            recipe = entrees[0]
            evidence = dict(location, recipe_id=str(recipe['recipe_id']), name=item['label'], nutrition=facts,
                            kind='one_recipe_dish' if dish_slug(item['label']) in dish_names else 'standalone')
            register(recipes, labels, evidence, [item['label'], recipe['recipe_name']])
    return recipes, labels


def register(recipes, labels, evidence, names):
    key = (
        evidence['cafe'], evidence['station_id'], evidence['recipe_id'], evidence['kind'], evidence['name'].strip(),
        tuple(sorted((field, str(fact['value']), fact['unit']) for field, fact in evidence['nutrition'].items())),
    )
    # Prefer the target date for a repeated, identical label and portion.
    indexes = [recipes[evidence['recipe_id']]] if evidence['kind'] != 'one_recipe_dish' else []
    indexes.extend(labels[component_slug(name)] for name in names
                   if evidence['kind'] != 'one_recipe_dish' or component_slug(names[0]) == component_slug(names[-1]))
    for index in indexes:
        if key not in index or evidence['date'] == DATE:
            index[key] = evidence


def choose_candidate(candidates, station_id):
    if not candidates:
        return None

    def rank(candidate):
        marketplace = candidate['cafe'] == 'marketplace-2'
        return (not (marketplace and candidate['station_id'] == station_id),
                not marketplace, candidate['date'] != DATE)

    best_rank = min(map(rank, candidates))
    best = [candidate for candidate in candidates if rank(candidate) == best_rank]
    different_facts = {json.dumps(candidate['nutrition'], sort_keys=True) for candidate in best}
    return best[0] if len(different_facts) == 1 else None


def implied_remainder(parent, sides):
    result = {}
    for field, fact in parent.items():
        total = read_fact(fact)
        parts = [read_fact(side.get(field)) for side in sides]
        if not total or any(not part or part[2] != total[2] for part in parts):
            continue
        low = total[0] - sum(part[1] for part in parts)
        high = total[1] - sum(part[0] for part in parts)
        result[field] = {
            'difference': str(low) if low == high else None,
            'difference_bounds': [str(low), str(high)] if low != high else None,
            'unit': total[2] or 'kcal',
            'negative_difference': high < 0,
        }
    return result


def guide_proxy(dish_key):
    name, serving, values, multiplier = GUIDE_PROXIES[dish_key]
    facts = {
        field: {'value': str((Decimal(str(value)) * multiplier).quantize(Decimal('0.001')).normalize()), 'unit': unit}
        for (field, unit), value in zip(GUIDE_FIELDS.items(), values, strict=True)
    }
    # Decimal normalization can create exponents. The fact parser expects plain decimals.
    for fact in facts.values():
        fact['value'] = format(Decimal(fact['value']), 'f')
    return {
        'status': 'estimated_generic_bon_appetit_portion', 'name': name, 'source': GUIDE,
        'reference_portion': serving, 'serving_multiplier': str(multiplier), 'nutrition': facts,
        'note': 'Bon Appétit reference table hosted by another campus. The Marketplace recipe and weight are unconfirmed.',
    }


def main():
    audit = json.loads(OUTPUT.read_text())
    current = json.loads(SNAPSHOT.read_text())['items']
    snapshots = [json.loads(path.read_text()) for path in sorted((CATALOG / 'snapshots').glob('*/*.json'))]
    dishes = audit['dishes']
    exact, labels = collect_sources(snapshots, {key.split(':', 1)[1] for key in dishes})
    result = {}
    newly_observed_recipes = set()
    for key, dish in dishes.items():
        station = current[dish['item_id']]['station_id']
        entries = []
        for component in dish['recipe_components']:
            recipe_id = component['recipe_id']
            candidates = list(exact[recipe_id].values())
            evidence = component['candidate']
            basis = component['basis']
            if basis in {'published_in_dish_option', 'same_station_same_recipe_same_serving'}:
                chosen = dict(evidence, source=audit['source'], date=DATE, status=basis)
            elif not evidence and (key, recipe_id) in SCU_PROXIES:
                proxy_id, assumption = SCU_PROXIES[key, recipe_id]
                item = current[proxy_id]
                chosen = {'status': 'estimated_different_scu_recipe_and_portion', 'item_id': proxy_id,
                          'source': audit['source'], 'date': DATE, 'name': item['label'],
                          'nutrition': item['nutrition_details'], 'note': assumption}
            elif dish['status'] != 'matched_at_display_precision' and key in GUIDE_PROXIES:
                chosen = guide_proxy(key)
            else:
                candidate = choose_candidate(candidates, station)
                chosen = dict(candidate, status='estimated_same_recipe_unconfirmed_in_dish_portion') if candidate else None
            if basis == 'no_independent_exact_recipe_facts' and candidates:
                newly_observed_recipes.add(recipe_id)
            entries.append({'name': component['name'], 'recipe_id': recipe_id, 'source_group': component['source_group'],
                            'exact_recipe_portion_evidence': candidates, 'selected': chosen})
        row = {'name': dish['name'], 'item_id': dish['item_id'], 'published_nutrition': dish['published_nutrition'],
               'component_rows': entries, 'status': 'unresolved'}
        if 'choice_audit' in dish:
            row['published_option_comparison'] = dish['choice_audit']
        elif 'independent_comparison' in dish:
            row.update(status='verified_display_match', comparison=dish['independent_comparison'])
        elif all(entry['selected'] for entry in entries):
            selected = [entry['selected']['nutrition'] for entry in entries]
            row.update(status='estimated_scenario', comparison=compare(row['published_nutrition'], selected))
        else:
            known = [entry['selected']['nutrition'] for entry in entries
                     if entry['selected'] and entry['selected']['status'] == 'published_in_dish_option']
            if len(known) and len(known) == len(entries) - 1 and entries[0]['source_group'] == 'entrees':
                row['implied_main'] = {
                    'status': 'estimated_by_subtraction_excluded_from_reconciliation',
                    'component': entries[0]['name'],
                    'facts': implied_remainder(row['published_nutrition'], known),
                }
        result[key] = row

    visual = {key: list(labels[key.split(':', 1)[1]].values()) for key in audit['components']}
    estimated = [row for row in result.values() if row['status'] == 'estimated_scenario']
    summary = {
        'cafes': len({snap['cafe'] for snap in snapshots}), 'dated_pages': len(snapshots),
        'pages_with_menus': sum(snap['status'] == 'menu' for snap in snapshots),
        'date_range': [min(snap['date'] for snap in snapshots), max(snap['date'] for snap in snapshots)],
        'source_menu_item_occurrences': sum(len(snap['items']) for snap in snapshots),
        'visual_components_with_published_label_or_alias_candidates': sum(bool(rows) for rows in visual.values()),
        'new_exact_recipe_ids_with_published_portions': sorted(newly_observed_recipes),
        'dish_statuses': dict(Counter(row['status'] for row in result.values())),
        'estimated_calorie_matches': sum(row['comparison']['calories']['display_match'] for row in estimated),
        'estimated_main_remainders': sum('implied_main' in row for row in result.values()),
    }
    payload = {
        'scope': f'Marketplace on {DATE}',
        'summary': summary,
        'source_pages': [{k: snap[k] for k in ('cafe', 'date', 'source', 'status')} for snap in snapshots],
        'paired_dish_check': audit['paired_dish_check'],
        'notes': [
            'Exact recipe ID alone does not establish its serving size in the target dish. Prioritize same café, station and date. Keep competing portions visible.',
            'Estimated scenarios use published comparison portions and are not verified recipe sums. Missing or incompatible units are not imputed.',
            'Implied remainders subtract published in-dish side facts from the parent and can only be used as estimates. They never count as reconciliation matches.',
        ],
        'dishes': result, 'visual_component_published_candidates': visual,
    }
    tmp = RESULT.with_suffix('.tmp')
    tmp.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + '\n')
    tmp.replace(RESULT)
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    main()
