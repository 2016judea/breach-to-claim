// Tell Bing (and through it ChatGPT search) and Yandex which pages changed. Key file is
// public/<key>.txt, written by build.mjs.
import fs from "node:fs";
import { INDEXNOW_KEY } from "./build.mjs";
import { SITE } from "../api/mcp.js";

const xml = fs.readFileSync(new URL("../public/sitemap.xml", import.meta.url), "utf8");
const urlList = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const r = await fetch("https://api.indexnow.org/indexnow", { method: "POST", headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: new URL(SITE).host, key: INDEXNOW_KEY, keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`, urlList }) });
console.log(`IndexNow: ${r.status} for ${urlList.length} urls`);
