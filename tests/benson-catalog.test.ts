import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const readMigration = (name: string) =>
  readFile(`supabase/migrations/${name}.sql`, "utf8");
const readSnapshot = async (cafe: string, day: string) => {
  const { items, placements } = JSON.parse(
    await readFile(
      `data/menu/scu-catalog/snapshots/${cafe}/${day}.json`,
      "utf8",
    ),
  );
  const parts = new Map<string, any>();
  for (const [id, visits] of Object.entries(placements) as [string, any[]][]) {
    for (const { daypart, station, start, end } of visits) {
      const partKey = [daypart, start, end].join(":");
      if (!parts.has(partKey))
        parts.set(partKey, {
          label: daypart,
          starttime: start,
          endtime: end,
          stations: [],
        });
      const part = parts.get(partKey);
      let venue = part.stations.find((s: any) => s.label === station);
      if (!venue) {
        venue = { id: String(items[id].station_id), label: station, items: [] };
        part.stations.push(venue);
      }
      venue.items.push(id);
    }
  }
  return { items, parts: [...parts.values()] };
};

test("dated Benson ingestion preserves recurring items, rotation, holiday hours and option evidence", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth,public to anon,authenticated,service_role;
      create schema cron;
      create function cron.schedule(text,text,text) returns int language sql as $$ select 1 $$;
      create schema benson_private;
      create type benson_private.http_response as (status int, content text);
      create function benson_private.http_get(text) returns benson_private.http_response
        language sql as $$ select 404,''::text $$;
    `);
    const schemas = (await readdir("supabase/migrations"))
      .filter((name) => name <= "20261119060000_buckys_bites.sql")
      .sort();
    for (const name of schemas)
      await db.exec(await readFile(`supabase/migrations/${name}`, "utf8"));
    const helper = await readMigration("20261119070000_benson_menu_sync");
    await db.exec(
      helper.slice(
        helper.indexOf("create function benson_private.amount"),
        helper.indexOf("create function benson_private.sync_menu"),
      ),
    );
    for (const name of [
      "20261119100000_benson_standalone_menu",
      "20261119120000_benson_catalog_expansion",
      "20261119120100_benson_catalog_rules",
      "20261119120200_benson_configured_food_logs",
      "20261119120300_benson_menu_option_nutrition",
      "20261120073000_burger_recipe_defaults",
    ])
      await db.exec(await readMigration(name));
    await db.exec(`
      insert into cafes(source_key,name,source_url) values('marketplace-2','Marketplace','https://example.test/');
      create view test_menu as
        select s.service_date, s.name period, s.starts_at, s.ends_at, k.name station, f.name,
          f.food_item_id, f.nutrition_source, o.modifier_groups, o.serving_options, o.price, o.id
        from menu_offerings o join menu_services s on s.id=o.menu_service_id
        join stations k on k.id=o.station_id join food_versions f on f.id=o.food_version_id
        where o.is_listed and s.status='published';
    `);
    const ingest = async (cafe: string, day: string, omit?: string) => {
      const { items, parts } = await readSnapshot(cafe, day);
      if (omit)
        for (const part of parts)
          for (const station of part.stations)
            station.items = station.items.filter((id: string) => id !== omit);
      await db.query("select benson_private.ingest_catalog($1,$2,$3,$4)", [
        cafe,
        day,
        JSON.stringify(items),
        JSON.stringify(parts),
      ]);
    };
    await ingest("marketplace-2", "2026-11-18");
    await ingest("marketplace-2", "2026-11-19", "23021002");
    await ingest("mission-bakery", "2026-11-19");
    await ingest("marketplace-2", "2026-11-19", "23021002");
    await ingest("marketplace-2", "2026-11-21");
    await ingest("mission-bakery", "2026-11-24");
    await db.query(
      "select benson_private.ingest_catalog('marketplace-2','2026-11-26',null,null)",
    );
    const records = await db.query<{
      station: string;
      name: string;
      price: string;
      id: string;
      modifier_groups: any[];
      serving_options: any[];
    }>("select * from test_menu where service_date='2026-11-19'");
    const rows = records.rows;
    assert.equal(rows.filter((r) => r.name === "French fries").length, 1);
    assert.equal(rows.filter((r) => r.name === "Coke").length, 0);
    assert.ok(
      rows.some(
        (r) =>
          r.name === "Fountain Drink 16oz" &&
          r.modifier_groups.some((group) =>
            group.options.some((option: any) => option.label === "Coke"),
          ),
      ),
    );
    const pasta = rows.filter((r) => r.name === "BYO Pasta - Full Portion");
    assert.equal(pasta.length, 2);
    assert.equal(pasta[0].price, "12.30");
    const groups = pasta[0].modifier_groups;
    assert.equal(groups.find((g) => g.name === "Vegetables").max, 3);
    assert.equal(
      groups.find((g) => g.name === "Protein").options[0].price,
      3.25,
    );
    assert.equal(
      groups[0].options.find((o: any) => o.label === "Cheese Ravioli")
        .observed_unavailable_on,
      "2026-11-19",
    );
    assert.ok(
      rows.some(
        (r) =>
          r.name === "Poke Bowl" &&
          r.modifier_groups.some(
            (g) => g.name === "Add-ons" && g.options[0].price === 1.55,
          ),
      ),
    );
    assert.ok(
      rows.some(
        (r) =>
          r.name === "Açaí Bowl" &&
          r.modifier_groups.some(
            (g) => g.name === "Toppings" && g.options.length === 12,
          ),
      ),
    );
    const latte = rows.find((r) => r.name === "Holiday Spice Latte")!;
    assert.deepEqual(
      latte.serving_options.map((o) => o.price),
      [5.75, 6.25, 6.75],
    );
    assert.equal(latte.serving_options[0].published_serving, true);
    assert.equal(latte.serving_options[1].published_serving, false);
    const holiday = await db.query<{ station: string; window: string }>(`
      select distinct station,to_char(starts_at at time zone 'America/Los_Angeles','HH24:MI')
        ||'-'||to_char(ends_at at time zone 'America/Los_Angeles','HH24:MI') as "window"
      from test_menu where service_date in ('2026-11-21','2026-11-24','2026-11-26') order by 1
    `);
    assert.deepEqual(holiday.rows, [
      { station: "Mission Bakery", window: "08:00-16:00" },
      { station: "The Fire", window: "16:00-19:00" },
    ]);
    const rotation = await db.query<{ names: string[][] }>(`
      select json_agg(names order by menu_date) names from (
        select service_date as menu_date,array_agg(distinct name order by name) names
        from test_menu where station='Simply Oasis' group by 1
      ) t
    `);
    assert.notDeepEqual(rotation.rows[0].names[0], rotation.rows[0].names[1]);

    const user = "00000000-0000-4000-8000-000000000001";
    await db.query("insert into auth.users(id) values ($1)", [user]);
    await db.exec(
      `set role authenticated; select set_config('request.jwt.claim.sub','${user}',false)`,
    );
    await assert.rejects(
      db.query(
        "select bites_log_configured_food($1,1,'Lunch',now(),null,array['missing'])",
        [pasta[0].id],
      ),
      /Choose a valid number of options/,
    );
    await db.query(
      "select bites_log_configured_food($1,1,'Breakfast',now(),'16 fl oz','{}')",
      [latte.id],
    );
    const saved = await db.query<{
      size: string;
      calories_kcal: number | null;
    }>(
      "select menu_selection->>'size' size,calories_kcal from food_logs join food_versions on food_version_id=food_versions.id",
    );
    assert.deepEqual(saved.rows, [{ size: "16 fl oz", calories_kcal: null }]);

    const logSelection = async (
      name: string,
      labels: string[],
      size?: string,
    ) => {
      const offering = rows.find((row) => row.name === name)!;
      const choices = offering.modifier_groups.flatMap((group) =>
        group.options
          .filter((option: any) => labels.includes(option.label))
          .map((option: any) => option.key),
      );
      assert.equal(choices.length, labels.length);
      const { rows: logs } = await db.query<{ id: string }>(
        "select bites_log_configured_food($1,1,'Lunch',now(),$2,$3) id",
        [offering.id, size ?? null, choices],
      );
      const result = await db.query<{
        food_version_id: string;
        calories: number | null;
        protein: number | null;
        incomplete_nutrients: string[];
        choices: { label: string }[];
      }>(
        `select food_version_id,calories_kcal::float8 calories,protein_g::float8 protein,
          incomplete_nutrients,menu_selection->'choices' choices
          from food_logs join food_versions on food_version_id=food_versions.id
          where food_logs.id=$1`,
        [logs[0].id],
      );
      return result.rows[0];
    };
    const burger = await logSelection("Signature Smash Burger", [
      "sourdough bread",
      "Single beef patty",
    ]);
    assert.deepEqual(
      burger.choices.map((choice) => choice.label),
      ["sourdough bread", "Single beef patty"],
    );
    const smash = rows.find((row) => row.name === "Signature Smash Burger")!;
    const included = smash.modifier_groups.flatMap((group) =>
      group.options
        .filter((option: any) => option.default)
        .map((option: any) => option.label),
    );
    assert.deepEqual(
      new Set(included.map((label) => label.toLowerCase())),
      new Set([
        "hamburger bun",
        "single beef patty",
        "american cheese",
        "caramelized onions",
        "dill pickle relish",
        "mayonnaise",
        "ketchup",
        "mustard",
        "seasoned fries",
      ]),
    );
    assert.equal((await logSelection(smash.name, included)).calories, 1170);
    const withoutCheese = await logSelection(
      smash.name,
      included.filter((label) => label !== "American cheese"),
    );
    assert.ok(
      !withoutCheese.choices.some(
        (choice) => choice.label === "American cheese",
      ),
    );
    assert.ok(withoutCheese.incomplete_nutrients.includes("calories_kcal"));
    const bowl = await logSelection("Poke Bowl", [
      "Forsman Ranch Brown Rice",
      "tuna",
    ]);
    assert.equal(bowl.calories, 280);
    assert.equal(bowl.protein, 36);
    assert.deepEqual(
      bowl.choices.map((choice) => choice.label),
      ["Forsman Ranch Brown Rice", "tuna"],
    );
    const bowlWithAvocado = await logSelection("Poke Bowl", [
      "Forsman Ranch Brown Rice",
      "tuna",
      "half avocado",
    ]);
    assert.equal(bowlWithAvocado.calories, 390);
    assert.notEqual(bowlWithAvocado.food_version_id, bowl.food_version_id);
    assert.equal(
      (await logSelection("Pancake (2)", ["Pancake Syrup"])).calories,
      390,
    );
    assert.equal(
      (await logSelection("Fountain Drink 16oz", ["Coke"])).calories,
      200,
    );
    const foam = await logSelection(
      "Iced Latte",
      ["Add Vanilla Cold Foam"],
      "16 fl oz",
    );
    assert.equal(foam.calories, 130);
    assert.ok(foam.incomplete_nutrients.includes("calories_kcal"));
    const pastaWithSauce = await logSelection("BYO Pasta - Full Portion", [
      "Regular Penne",
      "Marinara Sauce",
      "Broccoli",
    ]);
    assert.equal(pastaWithSauce.calories, 310);

    // Apply the campus rollout after a Benson installation already has its
    // own UUIDs, then exercise the same dated sync and authenticated log RPC.
    await db.exec("reset role");
    await db.exec(await readMigration("20261120080000_campus_cafe_menus"));
    await db.exec(await readMigration("20261120080100_campus_cafe_snapshot"));
    const campusRows = () =>
      db.query<{ id: string; food_item_id: string }>(
        "select id,food_item_id from test_menu where station='Fresh Bytes' and service_date='2026-11-19' order by id",
      );
    const before = (await campusRows()).rows;
    assert.equal(before.length, 2);
    await ingest("fresh-bytes", "2026-11-19");
    assert.deepEqual((await campusRows()).rows, before);
    await assert.rejects(
      ingest("cellar-market", "2026-11-19"),
      /Unsupported cafe/,
    );
    const drink = await db.query<{ id: string }>(
      "select id from test_menu where station='Sunstream Café' and name='Holiday Spice Latte' and service_date='2026-11-19'",
    );
    await db.exec("set role authenticated");
    const drinkLog = await db.query<{ id: string }>(
      "select bites_log_configured_food($1,1,'Snack',now(),'16 fl oz','{}') id",
      [drink.rows[0].id],
    );
    assert.ok(drinkLog.rows[0].id);
  } finally {
    await db.close();
  }
});
