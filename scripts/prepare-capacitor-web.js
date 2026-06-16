const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "www");
const files = ["index.html", "styles.css", "app.js", "config.js", "supabase-adapter.js"];

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

for (const file of files) {
  fs.copyFileSync(path.join(root, file), path.join(outDir, file));
}

console.log(`Prepared Capacitor web assets in ${outDir}`);
