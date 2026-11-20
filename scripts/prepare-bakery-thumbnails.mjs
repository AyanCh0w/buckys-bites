import fs from "node:fs/promises";
import sharp from "sharp";

const catalog = JSON.parse(await fs.readFile("src/data/catalog.json", "utf8"));
const stations = new Set(
  catalog.stations
    .filter((station) => station.source_key === "mission-bakery")
    .map((station) => station.id),
);
const versions = new Set(
  catalog.offerings
    .filter((offering) => stations.has(offering.station_id))
    .map((offering) => offering.food_version_id),
);
const foods = new Set(
  catalog.foods
    .filter((food) => versions.has(food.id))
    .map((food) => food.food_item_id),
);
const keys = [
  ...new Set(
    catalog.images
      .filter((image) => foods.has(image.foodId) && image.path)
      .map((image) => image.path.replace(/\.png$/, "")),
  ),
  "cafes/mission-bakery",
].sort();

// Two physical pixels per point for the 96-point category covers.
const size = 192;
const columns = Math.ceil(Math.sqrt(keys.length));
const rows = Math.ceil(keys.length / columns);
const background = { r: 0, g: 0, b: 0, alpha: 0 };
const tiles = await Promise.all(
  keys.map(async (key, index) => ({
    input: await sharp(`assets/${key}.webp`)
      .resize(size, size, { fit: "contain", background })
      .png()
      .toBuffer(),
    left: (index % columns) * size,
    top: Math.floor(index / columns) * size,
  })),
);
await sharp({
  create: {
    width: columns * size,
    height: rows * size,
    channels: 4,
    background,
  },
})
  .composite(tiles)
  .webp({ quality: 88 })
  .toFile("assets/bakery-thumbnails.webp");
await fs.writeFile(
  "src/data/bakery-thumbnails.json",
  JSON.stringify({ columns, rows, keys }, null, 2) + "\n",
);
