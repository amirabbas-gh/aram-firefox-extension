import { readFileSync, writeFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));

if (!pkg.version) {
  throw new Error("package.json is missing version");
}

manifest.version = pkg.version;
writeFileSync("manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Synced manifest.json version to ${pkg.version}`);
