import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { AVATARS, avatarId, avatarAsset, isAvatarId } from "../src/lib/avatars";

test("avatar identifiers are restricted to eight bundled choices, with Classic for older profiles", () => {
  assert.equal(AVATARS.length, 8);
  assert.equal(new Set(AVATARS.map((a) => a.id)).size, 8);
  for (const { id } of AVATARS) {
    assert.equal(isAvatarId(id), true);
    assert.equal(
      avatarId(JSON.parse(JSON.stringify({ avatar_id: id })).avatar_id),
      id,
    );
    assert.equal(avatarAsset(id), `icons/bucky-${id}`);
    assert.ok(fs.existsSync(`assets/icons/bucky-${id}.webp`));
  }
  for (const invalid of [
    undefined,
    null,
    "",
    "../../secret",
    "bucky-chef",
    "CHEF",
    1,
  ]) {
    assert.equal(isAvatarId(invalid), false);
    assert.equal(avatarId(invalid), "classic");
  }
});
