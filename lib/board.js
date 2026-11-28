const BOARD_ORIGIN = "https://brickandmortar.dev";
const BOARD_PAGE = BOARD_ORIGIN + "/requests";
const BOARD_TOOL_NAMES = ["request_a_feature", "report_a_bug", "list_feature_requests", "upvote_feature_request", "other_brick_and_mortar_connectors"];
const isBoardTool = (name) => BOARD_TOOL_NAMES.includes(name);
const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: true, idempotentHint: false };
const READ = { readOnlyHint: true, destructiveHint: false, openWorldHint: true, idempotentHint: true };
function boardTools(cfg) {
  const n = cfg.name;
  return [
    {
      name: "request_a_feature",
      title: `Request a ${n} feature`,
      description: `Files a feature request for ${n} on Brick & Mortar's public request board (brickandmortar.dev/requests), where anyone can read and upvote it, and notifies the person who builds ${n}. For something ${n} does not do or hold yet${cfg.asks ? ": " + cfg.asks : ""}. title is the person's own words, verbatim and short; detail is optional; contact is an email or handle exactly as they offered it, sent to the builder only and never shown on the board. ok true means it was filed.`,
      inputSchema: { type: "object", properties: {
        title: { type: "string", description: "What they want, in their own words, ideally under 90 characters" },
        detail: { type: "string", description: "Optional: what they were trying to do" },
        contact: { type: "string", description: "Optional: email or handle for a reply, verbatim, only if offered" }
      }, required: ["title"], additionalProperties: false },
      annotations: { title: "Request a feature", ...WRITE }
    },
    {
      name: "report_a_bug",
      title: `Report a ${n} bug: something broke or came out wrong`,
      description: `Files a bug report for ${n} on Brick & Mortar's public request board (brickandmortar.dev/requests, tagged Bug) and notifies the person who fixes it. For something ${n} did that went wrong${cfg.breaks ? ": " + cfg.breaks : ""}. It takes what the chat already knows: which tool was called, the input that was passed, and the exact error text or wrong result. title and what_happened are the person's own words, verbatim. contact is sent to the builder only. A missing feature is request_a_feature. ok true means it was filed.`,
      inputSchema: { type: "object", properties: {
        title: { type: "string", description: "What went wrong, in a few of the person's own words, under 90 characters" },
        what_happened: { type: "string", description: "What they did and what came back instead, in their words" },
        expected: { type: "string", description: "What they expected" },
        tool: { type: "string", description: "The tool that failed or answered wrongly" },
        input: { type: "string", description: "The input that was passed to it, without personal details" },
        error_text: { type: "string", description: "The exact error text or wrong value returned, if any" },
        client: { type: "string", description: "Which assistant this is, e.g. Claude, ChatGPT, Grok" },
        contact: { type: "string", description: "Optional: email or handle for a reply, verbatim, only if offered" }
      }, required: ["title"], additionalProperties: false },
      annotations: { title: "Report a bug", ...WRITE }
    },
    {
      name: "list_feature_requests",
      title: `${n} feature requests and bug reports`,
      description: `The requests and bug reports filed for ${n} on Brick & Mortar's public board: each with its id, kind (feature or bug), title, upvotes, status (requested, building, shipped) and, once answered, the builder's response and shipped date. A request already on the board can be upvoted by id.`,
      inputSchema: { type: "object", properties: {
        status: { type: "string", enum: ["requested", "building", "shipped"], description: "Only this status" },
        kind: { type: "string", enum: ["feature", "bug"], description: "Only feature requests, or only bug reports" }
      }, additionalProperties: false },
      annotations: { title: "List feature requests", ...READ }
    },
    {
      name: "upvote_feature_request",
      title: `Upvote a ${n} feature request`,
      description: `Adds one upvote to a request on Brick & Mortar's public board, by id from list_feature_requests. One vote per caller; repeat calls do not add more.`,
      inputSchema: { type: "object", properties: { id: { type: "string", description: "Request id from list_feature_requests" } }, required: ["id"], additionalProperties: false },
      annotations: { title: "Upvote a feature request", ...WRITE, idempotentHint: true }
    },
    {
      name: "other_brick_and_mortar_connectors",
      title: "Other connectors from Brick & Mortar",
      description: `Lists the other connectors published by Brick & Mortar, the maker of ${n}: each one's name, the question it answers, its scope (city, county, state, federal or other), its topics and where it is listed. Data only.`,
      inputSchema: { type: "object", properties: {
        scope: { type: "string", enum: ["city", "county", "state", "federal", "other"], description: "Only connectors with this scope" },
        topic: { type: "string", description: "Only connectors with this topic, e.g. property, permits, tax" }
      }, additionalProperties: false },
      annotations: { title: "Other Brick & Mortar connectors", ...READ }
    }
  ];
}
function boardInstructions(cfg) {
  return `If the person asks for something ${cfg.name} cannot do, or something it did went wrong, offer request_a_feature or report_a_bug and file only after they agree, passing their words verbatim; say it was filed only when ok is true, and give the board link. When a result is found: false or outside coverage, its next field may name request_a_feature, or another Brick & Mortar connector when that connector answers the question; other_brick_and_mortar_connectors lists them when the person asks what else Brick & Mortar makes.`;
}
const s = (v, max) => {
  const t = typeof v === "string" ? v.trim().slice(0, max) : "";
  return t || void 0;
};
async function http(ctx, path, init) {
  const f = ctx.fetch || fetch;
  try {
    const headers = { accept: "application/json", "user-agent": "mcp-connector/1.0" };
    let body;
    if (init && init.body !== void 0) {
      if (!ctx.token) return null;
      headers["content-type"] = "application/json";
      headers["x-mcp-token"] = ctx.token;
      body = JSON.stringify(init.body);
    }
    const r = await f(BOARD_ORIGIN + path, { method: body ? "POST" : "GET", headers, body, signal: AbortSignal.timeout(12e3) });
    const j = await r.json().catch(() => null);
    if (!j || typeof j !== "object") return null;
    if (!r.ok) return { ok: false, http_status: r.status, error: typeof j.error === "string" ? j.error : void 0 };
    return j;
  } catch {
    return null;
  }
}
const notFiled = (what, r) => ({
  ok: false,
  filed: false,
  message: `Could not ${what} right now${r && r.error ? ` (${String(r.error).slice(0, 160)})` : ""}. Nothing was filed. The board is at ${BOARD_PAGE}, where the person can post it themselves.`,
  board: BOARD_PAGE
});
let CATALOG = null;
const CATALOG_TTL_MS = 10 * 60 * 1e3;
const WHERE = ["name", "answers", "scope", "topics", "status", "claude_url", "chatgpt_url", "mcp_url", "site_url"];
async function callBoardTool(cfg, tool, args, ctx = {}) {
  args = args && typeof args === "object" ? args : {};
  if (tool === "request_a_feature" || tool === "report_a_bug") {
    const bug = tool === "report_a_bug";
    const title = s(args.title, 300);
    if (!title) return { ok: false, filed: false, needs: bug ? "Ask the person what went wrong, then call again with it as title." : `Ask the person what they want ${cfg.name} to do, then call again with it as title.` };
    const detail = bug ? [s(args.what_happened, 1200), args.expected ? "Expected: " + s(args.expected, 400) : void 0].filter(Boolean).join("\n") || void 0 : s(args.detail, 1200);
    const context = [
      bug && s(args.tool, 80) ? "tool: " + s(args.tool, 80) : "",
      bug && s(args.input, 300) ? "input: " + s(args.input, 300) : "",
      bug && s(args.error_text, 400) ? "error: " + s(args.error_text, 400) : "",
      s(args.client, 60) || s(ctx.client, 60) ? "client: " + (s(args.client, 60) || s(ctx.client, 60)) : ""
    ].filter(Boolean).join(" | ") || void 0;
    const r = await http(ctx, "/api/requests", { body: { connector: cfg.slug, kind: bug ? "bug" : "feature", title, detail, contact: s(args.contact, 254), context } });
    if (!r || r.ok !== true || !r.id) return notFiled(bug ? "file this bug report" : "file this request", r);
    return {
      ok: true,
      id: r.id,
      kind: bug ? "bug" : "feature",
      duplicate: !!r.duplicate,
      message: r.duplicate ? "That is already on the board; it was not filed twice. It can be upvoted by id." : `Filed on Brick & Mortar's public board for ${cfg.name}, and the builder was notified. A contact, if given, is not shown on the board.`,
      board: typeof r.url === "string" ? r.url : BOARD_PAGE
    };
  }
  if (tool === "list_feature_requests") {
    const q = "?connector=" + encodeURIComponent(cfg.slug) + (["requested", "building", "shipped"].includes(args.status) ? "&status=" + args.status : "");
    const r = await http(ctx, "/api/requests" + q);
    if (!r || !Array.isArray(r.requests)) return { ok: false, message: `Could not read the board right now. It is at ${BOARD_PAGE}.`, board: BOARD_PAGE };
    const list = r.requests.filter((x) => x && (!x.connector || x.connector === cfg.slug) && (!["feature", "bug"].includes(args.kind) || x.kind === args.kind)).map(({ voted, contact, ...x }) => x);
    return { board: typeof r.board === "string" ? r.board : BOARD_PAGE, connector: cfg.slug, count: list.length, requests: list };
  }
  if (tool === "upvote_feature_request") {
    const id = s(args.id, 80);
    if (!id) return { ok: false, needs: "Pass the request id from list_feature_requests." };
    const r = await http(ctx, "/api/requests/vote", { body: { id, voter: `mcp:${cfg.slug}:${s(ctx.voter, 120) || "anon"}` } });
    if (!r || r.ok !== true) return notFiled("add that upvote", r);
    return { ok: true, id, votes: r.votes, already_voted: !!(r.already || r.already_voted), board: BOARD_PAGE };
  }
  if (tool === "other_brick_and_mortar_connectors") {
    const scope = ["city", "county", "state", "federal", "other"].includes(args.scope) ? args.scope : "";
    const topic = (s(args.topic, 40) || "").toLowerCase();
    const key = cfg.slug;
    if (!CATALOG || CATALOG.key !== key || Date.now() - CATALOG.at > CATALOG_TTL_MS) {
      const r = await http(ctx, "/api/connectors?exclude=" + encodeURIComponent(cfg.slug));
      if (r && Array.isArray(r.connectors)) CATALOG = { at: Date.now(), key, rows: r.connectors, updated: typeof r.updated === "string" ? r.updated : void 0 };
      else if (!CATALOG || CATALOG.key !== key) return { ok: false, message: `Could not load the list right now. Brick & Mortar is at ${BOARD_ORIGIN}.`, site: BOARD_ORIGIN };
    }
    const rows = CATALOG.rows.filter((c) => c && c.slug !== cfg.slug && (!scope || c.scope === scope) && (!topic || Array.isArray(c.topics) && c.topics.some((t) => String(t).toLowerCase() === topic))).map((c) => Object.fromEntries(WHERE.filter((k) => c[k] != null).map((k) => [k, c[k]])));
    return { publisher: "Brick & Mortar", as_of: CATALOG.updated, count: rows.length, connectors: rows };
  }
  return { ok: false, error: "Unknown tool " + tool };
}
export {
  BOARD_ORIGIN,
  BOARD_PAGE,
  BOARD_TOOL_NAMES,
  boardInstructions,
  boardTools,
  callBoardTool,
  isBoardTool
};
