// The daily run: find official sites, read them, extract what changed, pull breach notices,
// rebuild the site. Runs in .github/workflows/refresh.yml and by hand (`npm run refresh`).
// Without ANTHROPIC_API_KEY it still runs: stored facts are re-checked against each page in
// code, and new sites wait as "new, not read yet" (scripts/extract.mjs).
import { discover } from "./discover.mjs";
import { readSites } from "./read_sites.mjs";
import { extract } from "./extract.mjs";
import { notices } from "./notices.mjs";


const t0 = Date.now();
await discover();
await readSites({ log: () => {} }).then((r) => console.log(`sites read ${r.ok}/${r.total}, walled ${r.walled}, failed ${r.failed}`));
await extract({ log: (l) => (/^(ok|skip|FAILED|settlements)/.test(l) ? console.log(l) : null) });
await notices();
// build() reads data through lib/data.js, which caches: run it in a fresh process.
const { execFileSync } = await import("node:child_process");
execFileSync(process.execPath, [new URL("./build.mjs", import.meta.url).pathname], { stdio: "inherit" });
console.log(`refresh done in ${Math.round((Date.now() - t0) / 1000)}s`);
