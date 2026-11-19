#!/usr/bin/env python3
"""Write one transactional SQL import for the curated November 18 Marketplace menu."""
from collections import Counter
from datetime import datetime, timedelta
import hashlib
import json
import re
import sys
from uuid import NAMESPACE_URL, uuid5
from zoneinfo import ZoneInfo

from audit_scu_nutrition import DATE, MANIFEST, OUTPUT, ROOT, SNAPSHOT, read_fact

NAMESPACE = 'scudining.cafebonappetit.com'
TIMEZONE = ZoneInfo('America/Los_Angeles')
NUTRIENTS = {
    'calories_kcal': 'calories', 'protein_g': 'proteinContent', 'carbohydrate_g': 'carbohydrateContent',
    'total_fat_g': 'fatContent', 'saturated_fat_g': 'saturatedFatContent', 'trans_fat_g': 'transFatContent',
    'fiber_g': 'fiberContent', 'sugar_g': 'sugarContent', 'sodium_mg': 'sodiumContent',
    'cholesterol_mg': 'cholesterolContent',
}


def compact(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))


def sql_json(value):
    data = compact(value)
    marker = '$scu$'
    while marker in data:
        marker = marker[:-1] + '_$'
    return f'{marker}{data}{marker}::jsonb'


def recordset(value, columns):
    return f'jsonb_to_recordset({sql_json(value)}) as src({columns})'


def timestamp(day, time):
    return datetime.fromisoformat(f'{day}T{time}').replace(tzinfo=TIMEZONE)


def exact_numeric(fact):
    parsed = read_fact(fact)
    return format(parsed[0], 'f') if parsed and not parsed[3] else None


def collect():
    snapshot = json.loads(SNAPSHOT.read_text())
    audit = json.loads(OUTPUT.read_text())
    followup = json.loads((ROOT / 'scu-catalog' / f'marketplace-{DATE}-nutrition-followup.json').read_text())
    manifest = json.loads(MANIFEST.read_text())['entries']
    assert snapshot['status'] == 'menu' and snapshot['date'] == DATE and snapshot['cafe'] == 'marketplace-2'
    assert set(audit['dishes']) == set(followup['dishes'])
    audit_image_keys = set(audit['dishes']) | set(audit['components'])
    assert audit_image_keys <= manifest.keys()

    versions, links, recipes, reviews, images, offers = [], [], [], [], [], []
    stations, services = {}, {}
    selected_items, selected_placements = {}, {}
    item_order = {item_id: position for position, item_id in enumerate(snapshot['placements'])}
    for dish_key, row in audit['dishes'].items():
        item_id = row['item_id']
        raw = snapshot['items'][item_id]
        details = raw['nutrition_details']
        follow = followup['dishes'][dish_key]
        assert item_id == follow['item_id'] and details == row['published_nutrition'] == follow['published_nutrition']
        icon_pairs = (raw.get('cor_icon') or {}).items()
        # Bon Appétit uses IDs 250 and above for the allergen warning icons in this snapshot.
        allergen = sorted({label for key, label in icon_pairs if int(key) >= 250})
        diet = sorted({label for key, label in icon_pairs if int(key) < 250})
        serving = details.get('servingSize')
        content = {
            'name': row['name'], 'description': raw['description'] or None, 'ingredients_text': raw['ingredients'] or None,
            'source_recipe_ids': [component['recipe_id'] for component in row['recipe_components']],
            'dietary_tags': diet, 'allergen_tags': allergen, 'allergen_information_available': bool(allergen),
            'serving_description': f"{serving['value']} {serving['unit']}".strip() if serving else None,
            'published_nutrition': details,
        }
        digest = hashlib.sha256(compact(content).encode()).hexdigest()
        versions.append(dict(content, item_key=item_id, content_hash=digest,
                             **{column: exact_numeric(details.get(field)) for column, field in NUTRIENTS.items()}))
        for position, link in enumerate(row['visual_components']):
            for option, component_key in enumerate(link['image_keys']):
                assert component_key in audit['components']
                links.append({
                    'item_key': item_id, 'position': position, 'option_position': option,
                    'component_key': component_key, 'display_label': link['display'],
                    'choice_group': 'protein' if link['choose_one'] else None,
                })
        for position, component in enumerate(follow['component_rows']):
            selected = component['selected']
            recipes.append({
                'item_key': item_id, 'position': position, 'source_recipe_id': component['recipe_id'],
                'name': component['name'], 'source_group': component['source_group'],
                'nutrition_status': selected['status'] if selected else 'unavailable',
                'serving_evidence': selected,
            })
        reviews.append({
            'item_key': item_id, 'status': follow['status'], 'comparison': follow.get('comparison'),
            'implied_main_estimate': follow.get('implied_main'), 'option_comparison': follow.get('published_option_comparison'),
        })
        placements = snapshot['placements'][item_id]
        selected_items[item_id], selected_placements[item_id] = raw, placements
        for placement in placements:
            service_key = ':'.join((placement['daypart'], placement['start'], placement['end']))
            station_key = str(raw['station_id'])
            assert stations.get(station_key, placement['station']) == placement['station']
            stations[station_key] = placement['station']
            starts = timestamp(DATE, placement['start'])
            ends = timestamp(DATE, placement['end'])
            if ends <= starts:
                ends += timedelta(days=1)
            services[service_key] = {
                'source_key': service_key, 'name': placement['daypart'],
                'starts_at': starts.isoformat(), 'ends_at': ends.isoformat(),
            }
            price = str(raw['price']).strip()
            offers.append({
                'item_key': item_id, 'station_key': station_key, 'service_key': service_key,
                'source_occurrence_key': f'{station_key}:{item_id}',
                'section': raw.get('sub_station') or None,
                'price': price if re.fullmatch(r'\d+(\.\d{1,2})?', price) else None,
                'sort_order': item_order[item_id],
            })
        images.append(image_metadata(dish_key, manifest[dish_key], item_key=item_id))

    components = []
    for key, row in audit['components'].items():
        components.append({'component_key': key, 'name': row['name'],
                           'candidates': followup['visual_component_published_candidates'][key]})
        images.append(image_metadata(key, manifest[key], component_key=key))
    assert len(versions) == 63 and len(components) == 133 and len(links) == 246 and len(images) == 196
    assert len({(row['service_key'], row['source_occurrence_key']) for row in offers}) == len(offers)
    assert Counter(row['status'] for row in reviews) == {'verified_display_match': 1, 'estimated_scenario': 6, 'unresolved': 56}
    return {
        'meta': [{
            'source_key': snapshot['cafe'], 'service_date': DATE, 'source_url': snapshot['source'],
            'seen_at': snapshot['fetched_at'],
            'sync_id': str(uuid5(NAMESPACE_URL, f"{snapshot['source']}|{snapshot['fetched_at']}|curated-63")),
            'payload': {
                'scope': 'curated_dishes_only', 'is_complete_menu': False, 'selected_items': selected_items,
                'placements': selected_placements,
            },
        }],
        'stations': [{'source_key': key, 'name': name} for key, name in stations.items()],
        'services': list(services.values()), 'versions': versions, 'components': components,
        'links': links, 'recipes': recipes, 'reviews': reviews, 'images': images, 'offers': offers,
    }


def image_metadata(key, entry, item_key=None, component_key=None):
    assert entry['status'] == 'ready' and entry['generated_prompt']
    return {
        'image_key': key, 'item_key': item_key, 'component_key': component_key,
        'prompt': entry['generated_prompt'], 'generator_settings': entry['generator_settings'],
    }


def build_sql(data):
    stage_columns = {
        'meta': 'source_key text, service_date date, source_url text, seen_at timestamptz, sync_id uuid, payload jsonb',
        'stations': 'source_key text, name text',
        'services': 'source_key text, name text, starts_at timestamptz, ends_at timestamptz',
        'versions': (
            'item_key text, content_hash text, name text, description text, ingredients_text text, source_recipe_ids text[], '
            'dietary_tags text[], allergen_tags text[], allergen_information_available boolean, serving_description text, '
            'published_nutrition jsonb, ' + ', '.join(f'{column} numeric' for column in NUTRIENTS)
        ),
        'components': 'component_key text, name text, candidates jsonb',
        'links': 'item_key text, position int, option_position int, component_key text, display_label text, choice_group text',
        'recipes': 'item_key text, position int, source_recipe_id text, name text, source_group text, nutrition_status text, serving_evidence jsonb',
        'reviews': 'item_key text, status text, comparison jsonb, implied_main_estimate jsonb, option_comparison jsonb',
        'images': 'image_key text, item_key text, component_key text, prompt text, generator_settings jsonb',
        'offers': 'item_key text, station_key text, service_key text, source_occurrence_key text, section text, price numeric, sort_order int',
    }
    nutrient_columns = ', '.join(NUTRIENTS)
    nutrient_values = ', '.join(f's.{column}' for column in NUTRIENTS)
    statements = ['begin;', "select pg_advisory_xact_lock(hashtext('scu:marketplace-2:2026-11-18'));"]
    statements.extend(f'create temporary table scu_seed_{key} on commit drop as select * from {recordset(data[key], columns)};'
                      for key, columns in stage_columns.items())
    statements.append(f"""
insert into public.cafes (source_key, name, timezone, source_url)
select source_key, 'Marketplace', 'America/Los_Angeles', 'https://scudining.cafebonappetit.com/cafe/marketplace-2/'
from scu_seed_meta
on conflict (source_key) do nothing;

create temporary table scu_seed_cafe on commit drop as
select c.id, m.* from scu_seed_meta m join public.cafes c using (source_key);

insert into public.stations (cafe_id, source_key, name)
select c.id, s.source_key, s.name from scu_seed_stations s cross join scu_seed_cafe c
on conflict (cafe_id, source_key) do nothing;

insert into public.food_items (source_namespace, source_item_id, name, first_seen_at, last_seen_at)
select '{NAMESPACE}', s.item_key, s.name, c.seen_at, c.seen_at
from scu_seed_versions s cross join scu_seed_cafe c
on conflict (source_namespace, source_item_id) do update
set first_seen_at = least(food_items.first_seen_at, excluded.first_seen_at),
    last_seen_at = greatest(food_items.last_seen_at, excluded.last_seen_at),
    name = case when excluded.last_seen_at >= food_items.last_seen_at then excluded.name else food_items.name end;

create temporary table scu_seed_item_ids on commit drop as
select s.*, f.id as food_item_id
from scu_seed_versions s join public.food_items f
on f.source_namespace = '{NAMESPACE}' and f.source_item_id = s.item_key;

insert into public.food_versions (
  food_item_id, content_hash, name, description, ingredients_text, source_recipe_ids, dietary_tags,
  allergen_tags, allergen_information_available, serving_description, published_nutrition,
  {nutrient_columns}, nutrition_source, source_url, captured_at
)
select s.food_item_id, s.content_hash, s.name, s.description, s.ingredients_text, s.source_recipe_ids,
  s.dietary_tags, s.allergen_tags, s.allergen_information_available, s.serving_description, s.published_nutrition,
  {nutrient_values}, 'published', c.source_url, c.seen_at
from scu_seed_item_ids s cross join scu_seed_cafe c
on conflict (food_item_id, content_hash) do nothing;

create temporary table scu_seed_version_ids on commit drop as
select s.item_key, v.id as food_version_id from scu_seed_item_ids s join public.food_versions v
on v.food_item_id = s.food_item_id and v.content_hash = s.content_hash;

insert into public.menu_components (component_key, name, published_serving_candidates)
select component_key, name, candidates from scu_seed_components
on conflict (component_key) do update set name = excluded.name, published_serving_candidates = excluded.published_serving_candidates;

insert into public.food_version_components (food_version_id, position, option_position, component_id, display_label, choice_group)
select v.food_version_id, s.position, s.option_position, c.id, s.display_label, s.choice_group
from scu_seed_links s join scu_seed_version_ids v using (item_key) join public.menu_components c using (component_key)
on conflict (food_version_id, position, option_position) do update
set component_id = excluded.component_id, display_label = excluded.display_label, choice_group = excluded.choice_group;

insert into public.food_version_recipe_components (food_version_id, position, source_recipe_id, name, source_group, nutrition_status, serving_evidence)
select v.food_version_id, s.position, s.source_recipe_id, s.name, s.source_group, s.nutrition_status, s.serving_evidence
from scu_seed_recipes s join scu_seed_version_ids v using (item_key)
on conflict (food_version_id, position) do update
set source_recipe_id = excluded.source_recipe_id, name = excluded.name, source_group = excluded.source_group,
    nutrition_status = excluded.nutrition_status, serving_evidence = excluded.serving_evidence;

insert into public.food_version_nutrition_audits (food_version_id, status, comparison, implied_main_estimate, option_comparison)
select v.food_version_id, s.status, s.comparison, s.implied_main_estimate, s.option_comparison
from scu_seed_reviews s join scu_seed_version_ids v using (item_key)
on conflict (food_version_id) do update set status = excluded.status, comparison = excluded.comparison,
    implied_main_estimate = excluded.implied_main_estimate, option_comparison = excluded.option_comparison;

insert into public.catalog_image_assets (image_key, food_item_id, component_id, prompt, generator_settings)
select s.image_key, i.food_item_id, c.id, s.prompt, s.generator_settings
from scu_seed_images s left join scu_seed_item_ids i using (item_key) left join public.menu_components c using (component_key)
on conflict (image_key) do update set prompt = excluded.prompt, generator_settings = excluded.generator_settings
where catalog_image_assets.storage_object_path is null;

insert into public.menu_services (cafe_id, service_date, source_key, name, starts_at, ends_at, status, last_successful_sync_at)
select c.id, c.service_date, s.source_key, s.name, s.starts_at, s.ends_at, 'published', c.seen_at
from scu_seed_services s cross join scu_seed_cafe c
on conflict (cafe_id, service_date, source_key) do update
set status = 'published', last_successful_sync_at = excluded.last_successful_sync_at
where menu_services.last_successful_sync_at is null or menu_services.last_successful_sync_at <= excluded.last_successful_sync_at;

insert into public.menu_offerings (cafe_id, menu_service_id, station_id, food_version_id, source_occurrence_key, menu_section, price, sort_order, last_seen_at)
select c.id, m.id, t.id, v.food_version_id, s.source_occurrence_key, s.section, s.price, s.sort_order, c.seen_at
from scu_seed_offers s join scu_seed_version_ids v using (item_key)
cross join scu_seed_cafe c
join public.menu_services m on m.cafe_id = c.id and m.service_date = c.service_date and m.source_key = s.service_key
join public.stations t on t.cafe_id = c.id and t.source_key = s.station_key
on conflict (menu_service_id, source_occurrence_key) do update
set food_version_id = excluded.food_version_id, station_id = excluded.station_id, menu_section = excluded.menu_section,
    price = excluded.price, sort_order = excluded.sort_order, is_listed = true, last_seen_at = excluded.last_seen_at
where menu_offerings.last_seen_at <= excluded.last_seen_at;

insert into public.sync_runs (id, cafe_id, service_date, started_at, completed_at, status, source_url, raw_payload)
select sync_id, id, service_date, seen_at, greatest(seen_at, now()), 'succeeded', source_url, payload
from scu_seed_cafe on conflict (id) do nothing;

do $$
begin
  if (select count(*) from scu_seed_version_ids) <> {len(data['versions'])}
    or (select count(*) from public.food_version_components c join scu_seed_version_ids v using (food_version_id)) <> {len(data['links'])}
    or (select count(*) from public.food_version_recipe_components r join scu_seed_version_ids v using (food_version_id)) <> {len(data['recipes'])}
    or (select count(*) from public.food_version_nutrition_audits a join scu_seed_version_ids v using (food_version_id)) <> {len(data['reviews'])}
    or (select count(*) from public.catalog_image_assets a join scu_seed_images s using (image_key)) <> {len(data['images'])}
    or (select count(*) from public.menu_offerings o join scu_seed_cafe c on c.id = o.cafe_id
        join public.menu_services m on m.id = o.menu_service_id and m.service_date = c.service_date
        join scu_seed_offers s on s.source_occurrence_key = o.source_occurrence_key and s.service_key = m.source_key)
        <> {len(data['offers'])}
  then
    raise exception 'SCU import verification failed';
  end if;
end;
$$;
commit;
""")
    return '\n'.join(statements)


if __name__ == '__main__':
    sys.stdout.write(build_sql(collect()))
