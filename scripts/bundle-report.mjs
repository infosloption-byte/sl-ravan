import { readdir, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { gzipSync } from "node:zlib";

const folder = resolve(process.cwd(), "dist/assets");
let items;
try {
  items = (await readdir(folder)).filter(name => name.endsWith(".js"));
} catch {
  console.error("No dist/assets directory. Run npm run build first.");
  process.exitCode = 1;
}
if (items) {
  const sizes = await Promise.all(items.map(async name => {
    const data = await readFile(join(folder, name));
    return { name, raw: data.length, gzip: gzipSync(data, { level: 9 }).length };
  }));
  sizes.sort((a, b) => b.raw - a.raw);
  const kB = n => (n / 1024).toFixed(1) + " KiB";
  console.log("SL Ravan — production JavaScript asset size report");
  console.log("Largest JS chunks:");
  for (const entry of sizes.slice(0, 8)) {
    console.log("  " + entry.name + " | " + kB(entry.raw) + " raw | " + kB(entry.gzip) + " gzip");
  }
  console.log("Total JS bytes (all chunks; not all downloaded on launch):");
  console.log("  " + kB(sizes.reduce((v, x) => v + x.raw, 0)) + " raw / " +
    kB(sizes.reduce((v, x) => v + x.gzip, 0)) + " gzip");
}
