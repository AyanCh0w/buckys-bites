import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const a = "00000000-0000-4000-8000-000000000001",
  b = "00000000-0000-4000-8000-000000000002";
const food = "10000000-0000-4000-8000-000000000001",
  version = "20000000-0000-4000-8000-000000000001";
test("database authorization, atomic logs, eligibility, history, votes, and deletion", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}'); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth,public to anon,authenticated,service_role; grant execute on function auth.uid() to anon,authenticated,service_role;`,
    );
    // This suite verifies the app schema through its migration. Later ingestion
    // migrations need Supabase's http/pg_cron extensions and their own runtime.
    const migrations = (await fs.readdir("supabase/migrations"))
      .filter(
        (name) =>
          name.endsWith(".sql") && name <= "20261119060000_buckys_bites.sql",
      )
      .sort();
    for (const name of migrations)
      await db.exec(await fs.readFile("supabase/migrations/" + name, "utf8"));
    await db.query(`insert into auth.users(id) values ($1),($2)`, [a, b]);
    await db.query(
      `insert into public.food_items(id,source_item_id,name) values ($1,'fixture','Test dish')`,
      [food],
    );
    await db.query(
      `insert into public.food_versions(id,food_item_id,content_hash,name,source_url,calories_kcal,protein_g) values($1,$2,'fixture','Test dish','https://example.test',400,25)`,
      [version, food],
    );
    async function asUser(user: string, sql: string, params: any[] = []) {
      await db.exec(
        `set role authenticated; select set_config('request.jwt.claim.sub','${user}',false);`,
      );
      try {
        return await db.query(sql, params);
      } finally {
        await db.exec("reset role");
      }
    }
    await assert.rejects(
      asUser(a, "select bites_save_review($1,4)", [food]),
      /72 hours/,
    );
    await assert.rejects(
      asUser(
        a,
        `insert into food_logs(user_id,food_version_id,servings) values($1,$2,1)`,
        [b, version],
      ),
      /row-level security/,
    );
    await assert.rejects(
      asUser(a, "select bites_log_food($1,1,$2,now()+interval '1 hour')", [
        version,
        "Lunch",
      ]),
      /past 30 days/,
    );
    await assert.rejects(
      asUser(a, "select bites_log_food($1,$2,$3)", [version, "NaN", "Lunch"]),
      /valid portion/,
    );
    const log = (
      await asUser(a, "select bites_log_food($1,0.25,$2) as id", [
        version,
        "Lunch",
      ])
    ).rows[0] as { id: string };
    assert.equal(
      (await asUser(a, "select * from bites_eating_history")).rows.length,
      1,
    );
    assert.equal((await asUser(b, "select * from food_logs")).rows.length, 0);
    const r = (
      await asUser(a, "select bites_save_review($1,5,$2) as id", [
        food,
        "Delicious",
      ])
    ).rows[0] as { id: string };
    await assert.rejects(
      asUser(a, "select bites_save_review($1,4)", [food]),
      /seven days/,
    );
    await assert.rejects(
      asUser(a, "select bites_vote($1,1)", [r.id]),
      /own review/,
    );
    await assert.rejects(
      asUser(b, "select bites_vote($1,1)", [r.id]),
      /have eaten/,
    );
    const logB = (
      await asUser(b, "select bites_log_food($1,1,$2) as id", [
        version,
        "Lunch",
      ])
    ).rows[0] as { id: string };
    await asUser(b, "select bites_vote($1,1)", [r.id]);
    let publicReview = (await db.query("select * from bites_public_reviews"))
      .rows[0] as any;
    assert.equal(publicReview.karma, 1);
    assert.equal(publicReview.upvotes, 1);
    assert.equal(publicReview.avatar_id, "classic");
    await asUser(a, "update bites_profiles set avatar_id='chef' where id=$1", [
      a,
    ]);
    assert.equal(
      (
        await db.query<any>(
          "select avatar_id from bites_public_reviews where id=$1",
          [r.id],
        )
      ).rows[0].avatar_id,
      "chef",
    );
    await assert.rejects(
      asUser(
        a,
        "update bites_profiles set avatar_id='not-an-avatar' where id=$1",
        [a],
      ),
      /check constraint/,
    );
    await asUser(b, "update bites_profiles set avatar_id='music' where id=$1", [
      a,
    ]);
    assert.equal(
      (
        await db.query<any>(
          "select avatar_id from bites_profiles where id=$1",
          [a],
        )
      ).rows[0].avatar_id,
      "chef",
    );
    await assert.rejects(
      asUser(a, "select * from bites_developer_meals"),
      /permission denied/,
    );

    await asUser(b, "select bites_vote($1,-1)", [r.id]);
    publicReview = (await db.query("select * from bites_public_reviews"))
      .rows[0] as any;
    assert.equal(publicReview.karma, -1);
    assert.equal(publicReview.downvotes, 1);
    assert.equal(publicReview.upvotes, 0);
    await asUser(b, "select bites_vote($1,0)", [r.id]);
    assert.equal((await db.query("select * from bites_votes")).rows.length, 0);
    await asUser(b, "select bites_vote($1,1)", [r.id]);
    await asUser(a, "select bites_save_review($1,5,$2,$3)", [
      food,
      " \n\t ",
      r.id,
    ]);
    assert.equal((await db.query("select * from bites_votes")).rows.length, 0);
    await assert.rejects(
      asUser(b, "select bites_vote($1,1)", [r.id]),
      /written reviews/,
    );
    assert.equal(
      (await db.query("select * from bites_rating_stats")).rows.length,
      1,
    );
    await asUser(a, "select bites_save_review($1,5,$2,$3)", [
      food,
      "Delicious",
      r.id,
    ]);
    await asUser(a, "select bites_delete_log($1)", [log.id]);
    assert.equal((await asUser(a, "select * from food_logs")).rows.length, 0);
    assert.equal(
      (await asUser(a, "select * from bites_eating_history")).rows.length,
      1,
    );
    assert.equal(
      (await db.query("select * from bites_reviews")).rows.length,
      1,
    );
    await asUser(b, "select bites_delete_log($1)", [logB.id]);
    await asUser(b, "select bites_vote($1,1)", [r.id]);
    await asUser(a, "delete from bites_reviews where id=$1", [r.id]);
    await assert.rejects(
      asUser(a, "select bites_save_review($1,4)", [food]),
      /seven days/,
    );
    assert.equal((await db.query("select * from bites_votes")).rows.length, 0);
    // Roll the cooldown back, retaining old eating history: another review still needs a recent meal.
    await db.query(
      "update bites_review_submissions set submitted_at=now()-interval '8 days'",
    );
    await db.query(
      "update bites_eating_history set eaten_at=now()-interval '73 hours'",
    );
    await assert.rejects(
      asUser(a, "select bites_save_review($1,4)", [food]),
      /72 hours/,
    );
    const fresh = (
      await asUser(a, "select bites_log_food($1,1,$2) as id", [
        version,
        "Dinner",
      ])
    ).rows[0] as { id: string };
    const first = (
      await asUser(a, "select bites_save_review($1,2) as id", [food])
    ).rows[0] as { id: string };
    await db.query(
      "update bites_review_submissions set submitted_at=now()-interval '8 days'",
    );
    await db.query(
      "update bites_reviews set created_at=now()-interval '8 days'",
    );
    const second = (
      await asUser(a, "select bites_save_review($1,5) as id", [food])
    ).rows[0] as { id: string };
    assert.equal(
      Number(
        (
          await db.query<{ average: string }>(
            "select average from bites_rating_stats",
          )
        ).rows[0]?.average,
      ),
      5,
    );
    await asUser(a, "delete from bites_reviews where id=$1", [second.id]);
    assert.equal(
      Number(
        (
          await db.query<{ average: string }>(
            "select average from bites_rating_stats",
          )
        ).rows[0]?.average,
      ),
      2,
    );
    await asUser(a, "select bites_delete_log($1,$2)", [fresh.id, first.id]);
    assert.equal(
      (await db.query("select * from bites_reviews")).rows.length,
      0,
    );
    assert.ok(
      (await asUser(a, "select * from bites_eating_history")).rows.length > 0,
    );
    const undo = (
      await asUser(b, "select bites_log_food($1,1,$2) as id", [
        version,
        "Dinner",
      ])
    ).rows[0] as { id: string };
    await asUser(b, "select bites_delete_log($1,null,true)", [undo.id]);
    assert.equal(
      (
        await db.query("select * from bites_eating_history where log_id=$1", [
          undo.id,
        ])
      ).rows.length,
      0,
    );
    await db.exec("set role anon");
    assert.equal(
      (await db.query("select * from bites_public_reviews")).rows.length,
      0,
    );
    await assert.rejects(
      db.query("select * from bites_eating_history"),
      /permission denied/,
    );
    await db.exec("reset role");
    await asUser(a, "select bites_request_account_deletion()");
    assert.equal(
      (await db.query("select * from auth.users where id=$1", [a])).rows.length,
      1,
    );
    assert.equal(
      (await asUser(a, "select * from bites_deletion_requests")).rows.length,
      1,
    );
    assert.equal(
      (await asUser(b, "select * from bites_deletion_requests")).rows.length,
      0,
    );
  } finally {
    await db.close();
  }
});
