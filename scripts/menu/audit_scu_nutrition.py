#!/usr/bin/env python3
"""Audit the November 18 Marketplace image mapping and published nutrition."""
from collections import Counter, defaultdict
from decimal import Decimal
from html import unescape
import json
from pathlib import Path
import re
import unicodedata

ROOT = Path(__file__).resolve().parents[2] / 'data/menu'
DATE = '2026-11-18'
MENU = ROOT / f'scu-menu-{DATE}.md'
MANIFEST = ROOT / 'scu-images/manifest.json'
SNAPSHOT = ROOT / 'scu-catalog/snapshots/marketplace-2' / f'{DATE}.json'
OUTPUT = ROOT / 'scu-catalog' / f'marketplace-{DATE}-nutrition-audit.json'
ALIASES = {
    'bun': 'hamburger-bun',
    'monterey-jack': 'monterey-jack-cheese',
    'tomatoes': 'tomato',
    'bell-peppers': 'bell-pepper',
    'no-gluten-pizza-crust': 'gluten-free-pizza-crust',
    'mozzarella-cheese': 'mozzarella',
    'steamed-jasmine-rice': 'jasmine-rice',
    'stir-fried-bok-choy-shiitake-mushrooms-carrots': 'stir-fried-bok-choy-shiitake-mushrooms-and-carrots',
    'roasted-shiitake-mushrooms': 'shiitake-mushrooms',
}
CHOICES = 'choice of bulgogi beef, chicken, or gochujang fried tofu'


def slug(name):
    name = unicodedata.normalize('NFKD', unescape(name).casefold())
    name = ''.join(char for char in name if not unicodedata.combining(char))
    return re.sub('[^a-z0-9]+', '-', name).strip('-')


def component_slug(name):
    key = slug(name)
    return ALIASES.get(key, key)


def dish_slug(name):
    return slug(re.sub(r'^Value Meal\s*-\s*', '', name, flags=re.I))


def reference(item_id, name, facts, option_id=None):
    return {'item_id': item_id, 'option_recipe_id': option_id, 'name': name, 'nutrition': facts}


def option_rows(item):
    options = item.get('options')
    return options.get('values', []) if isinstance(options, dict) else []


def read_fact(fact):
    if not fact:
        return None
    match = re.fullmatch(r'(?:(<|less than)\s*)?(\d+(?:\.\d+)?)\s*([a-z ]*)',
                         str(fact['value']).strip().lower())
    if not match:
        return None
    bound, number, suffix = match.groups()
    unit = fact.get('unit', '').lower()
    if suffix and unit and suffix != unit:
        return None
    value = Decimal(number)
    return (Decimal(0) if bound else value, value, unit or suffix, bool(bound))


def compare(parent_facts, children):
    results = {}
    for field, fact in parent_facts.items():
        parent = read_fact(fact)
        components = [read_fact(child.get(field)) for child in children]
        if not parent or not components or any(not part or part[2] != parent[2] for part in components):
            continue
        low, high = (sum(part[index] for part in components) for index in (0, 1))
        bounded = parent[3] or any(part[3] for part in components)
        result = {
            'published': fact['value'],
            'unit': parent[2] or 'kcal',
            'component_sum': str(low) if low == high else None,
            'component_range': [str(low), str(high)] if low != high else None,
            'delta_component_sum_minus_published': str(low - parent[0]) if not bounded else None,
            'display_match': (
                (low < parent[1] if parent[3] else low <= parent[1])
                and (high > parent[0] if any(part[3] for part in components) else high >= parent[0])
            ),
        }
        results[field] = result
    return results


def candidate_for_portion(candidates, station):
    same_station = [candidate for candidate in candidates if candidate['station_id'] == station]
    pool = same_station or candidates
    signatures = {json.dumps(candidate['nutrition'], sort_keys=True) for candidate in pool}
    return pool[0] if len(signatures) == 1 else None


def bacon_increment_check(dishes, items, same_recipe):
    base = dishes['dish:cheese-burger-combo']
    bacon_combo = dishes['dish:bacon-cheese-burger-combo']
    bacon = items['23020655']
    bacon_recipe = str(bacon['recipes']['entrees'][0]['recipe_id'])
    assert Counter(row['recipe_id'] for row in bacon_combo['recipe_components']) == (
        Counter(row['recipe_id'] for row in base['recipe_components']) + Counter([bacon_recipe]))
    station_id = items[bacon_combo['item_id']]['station_id']
    assert bacon['station_id'] == station_id == items[base['item_id']]['station_id']
    facts = next(candidate for candidate in same_recipe[bacon_recipe] if candidate['item_id'] == '23020655')
    comparison = compare(bacon_combo['published_nutrition'], [base['published_nutrition'], facts['nutrition']])
    assert comparison['servingSize']['display_match']
    return {
        'method': 'Add one same-station bacon serving to the published base combo total. The source recipe lists differ by the bacon recipe and the displayed total serving sizes differ by 1 oz.',
        'base_item_id': base['item_id'],
        'target_item_id': bacon_combo['item_id'],
        'add_on_item_id': facts['item_id'],
        'add_on_recipe_id': bacon_recipe,
        'comparison': comparison,
    }


def main():
    snapshot = json.loads(SNAPSHOT.read_text())
    assert snapshot['date'] == DATE and snapshot['status'] == 'menu'
    items = snapshot['items']
    prompt_source = f'../scu-menu-{DATE}-image-prompts.json'
    entries = {
        key: entry for key, entry in json.loads(MANIFEST.read_text())['entries'].items()
        if (entry.get('source') or '').partition('#')[0] == prompt_source
    }
    visual = {
        dish_slug(name): parts.split(' · ')
        for name, parts in re.findall(r'^- \*\*(.+?)\*\* — (.+)$', MENU.read_text(), re.M)
    }
    by_name = defaultdict(list)
    for item_id, item in items.items():
        by_name[dish_slug(item['label'])].append(item_id)
    ids = {key: by_name[key][0] for key in visual if len(by_name[key]) == 1}
    assert {f'dish:{key}' for key in ids} == {key for key in entries if key.startswith('dish:')}
    dish_ids = set(ids.values())
    same_recipe, by_component = defaultdict(list), defaultdict(list)
    for item_id, item in items.items():
        for option in option_rows(item):
            name = option.get('label') or option.get('description') or ''
            facts = option.get('side_nutrition_details')
            if facts:
                by_component[component_slug(name)].append(reference(item_id, name, facts, str(option['id'])))
        recipes = item.get('recipes') or {}
        main_recipes = recipes.get('entrees', [])
        facts = item['nutrition_details']
        if len(main_recipes) != 1 or recipes.get('sides') or not facts or not facts.get('calories'):
            continue
        # A simple one-recipe menu item can itself be the component (e.g. plain waffle).
        if item_id in dish_ids:
            if component_slug(item['label']) == component_slug(main_recipes[0]['recipe_name']):
                by_component[component_slug(item['label'])].append(reference(item_id, item['label'], facts))
            continue
        candidate = dict(reference(item_id, item['label'], facts), station_id=item['station_id'])
        same_recipe[str(main_recipes[0]['recipe_id'])].append(candidate)
        for key in {component_slug(item['label']), component_slug(main_recipes[0]['recipe_name'])}:
            by_component[key].append(candidate)

    dish_records = {}
    used_components = set()
    for slug_key, item_id in ids.items():
        item = items[item_id]
        dish_key = f'dish:{slug_key}'
        links = []
        for label in visual[slug_key]:
            names = ['bulgogi beef', 'chicken', 'gochujang fried tofu'] if label == CHOICES else [label]
            keys = [f'component:{component_slug(name)}' for name in names]
            assert all(key in entries for key in keys), keys
            used_components.update(keys)
            links.append({'display': label, 'image_keys': keys, 'choose_one': label == CHOICES})

        options = {str(option['id']): option for option in option_rows(item)}
        components = []
        parent = item['nutrition_details']
        recipes = [(role, row) for role, rows in item['recipes'].items() for row in rows]
        for role, recipe in recipes:
            rid = str(recipe['recipe_id'])
            name = recipe['recipe_name'].strip()
            component = {'recipe_id': rid, 'name': name, 'source_group': role, 'candidate': None}
            if rid in options and options[rid].get('side_nutrition_details'):
                option = options[rid]
                component['name'] = name or option.get('label') or option.get('description')
                component['basis'] = 'published_in_dish_option'
                component['candidate'] = reference(item_id, component['name'], option['side_nutrition_details'], rid)
            else:
                candidates = same_recipe[rid]
                component['candidate_item_ids'] = [candidate['item_id'] for candidate in candidates]
                candidate = candidate_for_portion(candidates, item['station_id'])
                component['basis'] = 'standalone_portion_unconfirmed' if candidate else (
                    'multiple_standalone_portions' if candidates else 'no_independent_exact_recipe_facts')
                component['candidate'] = candidate
                if len(recipes) == 1 and candidate and candidate['station_id'] == item['station_id']:
                    serving = read_fact(candidate['nutrition'].get('servingSize'))
                    if serving and not serving[3] and serving == read_fact(parent.get('servingSize')):
                        component['basis'] = 'same_station_same_recipe_same_serving'
            components.append(component)

        facts = [row['candidate']['nutrition'] for row in components if row['candidate']]
        all_present = len(facts) == len(components)
        has_choice = any(link['choose_one'] for link in links)
        independently_testable = all_present and not has_choice and all(
            row['basis'] in {'published_in_dish_option', 'same_station_same_recipe_same_serving'}
            for row in components)
        totals = compare(parent, facts) if facts else {}
        if independently_testable:
            status = 'matched_at_display_precision' if len(totals) == len(parent) and all(
                value['display_match'] for value in totals.values()) else 'published_component_total_differs'
        elif has_choice:
            status = 'choice_and_missing_component_or_portion'
        elif all_present:
            status = 'exploratory_standalone_sum_only'
        else:
            status = 'missing_or_ambiguous_exact_recipe_facts'
        record = {
            'item_id': item_id, 'name': entries[dish_key]['name'],
            'image_path': entries[dish_key]['path'], 'visual_components': links,
            'published_nutrition': parent, 'published_ingredients': item['ingredients'],
            'recipe_components': components, 'status': status,
        }
        if facts and not has_choice:
            key = 'independent_comparison' if independently_testable else (
                'exploratory_standalone_sum' if all_present else 'partial_candidate_sum')
            record[key] = totals
        if has_choice:
            side_facts = [row for row in components if row['basis'] == 'published_in_dish_option']
            choices = {'bulgogi beef', 'gochujang fried tofu'}
            record['choice_audit'] = {
                'all_options_including_both_proteins_excluding_kimchi': compare(parent, [row['candidate']['nutrition'] for row in side_facts]),
                'one_protein_excluding_kimchi': {
                    name: compare(parent, [row['candidate']['nutrition'] for row in side_facts
                                          if row['name'] not in choices or row['name'] == name])
                    for name in sorted(choices)
                },
            }
        dish_records[dish_key] = record

    components = {
        key: {'name': entry['name'], 'image_path': entry['path'], 'appears_in_visual_mapping': key in used_components,
              'published_label_or_alias_candidates': by_component[key.split(':', 1)[1]]}
        for key, entry in entries.items() if entry['type'] == 'component'
    }
    counts = {
        'source_items': len(items),
        'mapped_dishes': len(dish_records),
        'dishes_with_published_calories': sum(bool(d['published_nutrition'].get('calories')) for d in dish_records.values()),
        'visual_component_assets': len(components),
        'used_visual_component_assets': len(used_components),
        'visual_components_with_published_label_or_alias_candidates': sum(
            bool(c['published_label_or_alias_candidates']) for c in components.values()),
        'dishes_with_in_dish_option_facts': sum(
            any(c['basis'] == 'published_in_dish_option' for c in row['recipe_components']) for row in dish_records.values()),
        'in_dish_option_fact_occurrences': sum(
            c['basis'] == 'published_in_dish_option'
            for row in dish_records.values() for c in row['recipe_components']),
        'reconciliation_status': dict(Counter(row['status'] for row in dish_records.values())),
    }
    output = {
        'date': DATE, 'source': snapshot['source'], 'snapshot_fetched_at': snapshot['fetched_at'],
        'notes': [
            'Visual mappings come from the curated menu and connect to image keys. They can omit nonvisual ingredients.',
            'Recipe comparisons use exact source recipe IDs; component image coverage also uses labels and explicit aliases.',
            'Standalone servings are illustrative unless the one-recipe dish shares the station, recipe and serving size.',
            'Partial sums are incomplete and can include standalone serving assumptions. No missing value is treated as zero.',
            'Display matches honor less-than bounds and do not assume unpublished rounding tolerances.',
        ],
        'summary': counts, 'dishes': dish_records, 'components': components,
        'paired_dish_check': bacon_increment_check(dish_records, items, same_recipe),
    }
    temporary = OUTPUT.with_suffix('.tmp')
    temporary.write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(OUTPUT)
    print(json.dumps(counts, indent=2))


if __name__ == '__main__':
    main()
