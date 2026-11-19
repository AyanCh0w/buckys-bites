import { readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const path = (...parts) => join(root, ...parts);
const readJson = async (...parts) =>
  JSON.parse(await readFile(path(...parts), "utf8"));
const bundlePath = path("src", "data", "catalog.json");
const queuePath = path("data", "menu", "benson-catalog-image-targets.json");
const config = await readFile(path("src", "lib", "supabase.ts"), "utf8");
const api =
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  config.match(/"(https:\/\/[^"]+\.supabase\.co)"/)?.[1];
const key =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  config.match(/"(sb_publishable_[^"]+)"/)?.[1];
if (!api || !key) throw new Error("Set the project URL and publishable key.");

async function fetchRows(table) {
  const rows = [];
  const limit = 500;
  for (let offset = 0; ; offset += limit) {
    const url = new URL(`/rest/v1/${table}`, api);
    url.search = new URLSearchParams({
      select: "*",
      order: "id.asc",
      limit: String(limit),
      offset: String(offset),
    }).toString();
    const res = await fetch(url, {
      headers: { apikey: key },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok)
      throw new Error(`Catalog read failed for ${table} (HTTP ${res.status})`);
    const next = await res.json();
    rows.push(...next);
    if (next.length < limit) return rows;
  }
}

async function writeAtomic(target, value) {
  const temp = target + `.${process.pid}.tmp`;
  await writeFile(temp, JSON.stringify(value, null, 2) + "\n");
  await rename(temp, target);
}

const [
  cafes,
  stations,
  services,
  offerings,
  foods,
  components,
  links,
  identities,
  mobile,
] = await Promise.all(
  [
    "cafes",
    "stations",
    "menu_services",
    "menu_offerings",
    "food_versions",
    "menu_components",
    "bites_catalog_component_links",
    "food_items",
  ]
    .map(fetchRows)
    .concat(readJson("scripts", "benson-transact.json")),
);

const bundle = await readJson("src", "data", "catalog.json");
const images = bundle.images;
const baselineDishIds = new Set(images.map((image) => image.foodId));
const baselineComponentIds = new Set(images.map((image) => image.componentId));
const byId = (rows) => new Map(rows.map((row) => [row.id, row]));
const foodVersions = byId(foods);
const foodItems = byId(identities);
const venues = byId(stations);
const periods = byId(services);
const componentRecords = byId(components);

const oldImages = new Map(images.map((image) => [image.key, image]));
const slug = (name) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

function imageAliases(kind, name, id) {
  const exact = oldImages.get(`${kind}:${slug(name)}`);
  const attached = images.filter(
    (image) => (kind === "dish" ? image.foodId : image.componentId) === id,
  );
  return [
    ...new Set(
      [...attached, ...(exact ? [exact] : [])].map((image) => image.key),
    ),
  ];
}

const dishTargets = new Map();
const componentTargets = new Map();
const published = offerings.filter(
  (offering) =>
    offering.is_listed &&
    periods.get(offering.menu_service_id)?.status === "published",
);

for (const offering of published) {
  const version = foodVersions.get(offering.food_version_id);
  const item = foodItems.get(version.food_item_id);
  const station = venues.get(offering.station_id).name;
  const service = periods.get(offering.menu_service_id);
  const rawId = offering.source_occurrence_key.split(":").at(-1);
  const url = offering.menu_source_url ?? version.source_url;
  const link = {
    url,
    date: service.service_date,
    source_item_id: rawId,
    daypart: service.name,
  };
  const isMobile = item.source_namespace === mobile.namespace;
  const options = (offering.modifier_groups ?? []).map((group) => ({
    ...group,
    options: group.options.map(({ component_id, ...choice }) => choice),
  }));
  if (!baselineDishIds.has(item.id)) {
    const target = dishTargets.get(item.id) ?? {
      kind: "dish",
      display_name: item.name,
      station,
      stations: [],
      source_namespace: item.source_namespace,
      source_key: item.source_item_id,
      food_item_id: item.id,
      food_version_ids: [],
      label_type:
        item.source_namespace === "benson-builder"
          ? "descriptive"
          : "published",
      evidence: [],
      service_dates: [],
      configurations: [],
      image_aliases: imageAliases("dish", item.name, item.id),
    };
    if (!target.stations.includes(station)) target.stations.push(station);
    if (!target.service_dates.includes(service.service_date))
      target.service_dates.push(service.service_date);
    if (!target.food_version_ids.includes(version.id))
      target.food_version_ids.push(version.id);
    const evidence = isMobile
      ? {
          source: mobile.source,
          observation_date: mobile.observed,
          reference_service: link,
        }
      : link;
    target.evidence.push(evidence);
    const configuration = {
      menu_section: offering.menu_section,
      price: offering.price,
      serving: version.serving_description,
      description: version.description,
      ingredients: version.ingredients_text,
      sizes: offering.serving_options,
      choices: options,
    };
    if (
      !target.configurations.some(
        (prior) => JSON.stringify(prior) === JSON.stringify(configuration),
      )
    )
      target.configurations.push(configuration);
    dishTargets.set(item.id, target);
  }

  for (const group of offering.modifier_groups ?? []) {
    for (const detail of group.options) {
      if (!detail.component_id || baselineComponentIds.has(detail.component_id))
        continue;
      const component = componentRecords.get(detail.component_id);
      const target = componentTargets.get(component.id) ?? {
        kind: "component",
        display_name: component.name,
        station,
        component_key: component.component_key,
        component_id: component.id,
        choice_groups: [],
        parent_foods: [],
        evidence: [],
        published_servings: (
          component.published_serving_candidates ?? []
        ).flatMap((candidate) =>
          candidate.nutrition?.servingSize
            ? [
                {
                  source_item_id: candidate.item_id ?? null,
                  url: candidate.source,
                  serving: candidate.nutrition.servingSize,
                },
              ]
            : [],
        ),
        image_aliases: imageAliases("component", component.name, component.id),
      };
      const sourceItem = detail.key.startsWith("component:benson:")
        ? detail.key.split(":").at(-1)
        : null;
      const evidence = sourceItem
        ? { ...link, source_item_id: sourceItem, price: detail.price }
        : {
            source: mobile.source,
            observation_date: mobile.observed,
            price: detail.price,
            observed_unavailable_on: detail.observed_unavailable_on,
          };
      if (!target.choice_groups.includes(group.name))
        target.choice_groups.push(group.name);
      if (
        !target.parent_foods.some((parent) => parent.food_item_id === item.id)
      )
        target.parent_foods.push({
          food_item_id: item.id,
          label: version.name,
        });
      if (
        !target.evidence.some(
          (prior) => JSON.stringify(prior) === JSON.stringify(evidence),
        )
      )
        target.evidence.push(evidence);
      componentTargets.set(component.id, target);
    }
  }
}

const targets = [...dishTargets.values(), ...componentTargets.values()].sort(
  (a, b) =>
    a.kind.localeCompare(b.kind) ||
    a.station.localeCompare(b.station) ||
    a.display_name.localeCompare(b.display_name),
);
if (
  !dishTargets.size ||
  !componentTargets.size ||
  !stations.some((s) => s.name === "Mission Bakery")
)
  throw new Error("The project has no verified Benson expansion to export.");
for (const image of images) {
  if (
    (image.foodId && !foodItems.has(image.foodId)) ||
    (image.componentId && !componentRecords.has(image.componentId))
  )
    throw new Error(
      `An existing image references a missing catalog row (${image.key}).`,
    );
}

await writeAtomic(bundlePath, {
  cafes,
  foods,
  links,
  images,
  services,
  stations,
  offerings,
  components,
});
await writeAtomic(queuePath, {
  status: "ready",
  base_ready: true,
  ready_artifacts: {
    bundle: "src/data/catalog.json",
    live_catalog: new URL(api).hostname,
    migrations: [
      "20261119120000_benson_catalog_expansion.sql",
      "20261119120100_benson_catalog_rules.sql",
      "20261119120200_benson_configured_food_logs.sql",
    ],
  },
  targets,
  pending_verification: mobile.pending_verification,
});
console.log(
  `Exported ${published.length} listed placements, ${dishTargets.size} dish targets and ${componentTargets.size} component targets.`,
);
