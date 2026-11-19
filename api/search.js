// /api/search?q=<company>: the front page's lookup when the typed name matches no open
// settlement. Returns any closed settlement and any breach notice on record under that name.
// The query is not logged or stored.
import { loadData, statusOf, matchSettlements, matchNotices } from "../lib/data.js";

export default function handler(req, res) {
  const q = String((req.query && req.query.q) || "").slice(0, 80);
  const data = loadData();
  const hits = q.length >= 3 ? matchSettlements(q, data) : [];
  const out = {
    settlements: hits.slice(0, 5).map((s) => ({ slug: s.slug, company: s.name, ...statusOf(s), claim_deadline: s.deadlines.claim?.date || null })),
    notices: q.length >= 3 ? matchNotices(q, data, 5).map((n) => ({ organization: n.organization, reported_to: n.reported_to, reported_at: n.reported_at, source: n.source_url })) : [],
  };
  res.setHeader("content-type", "application/json");
  res.setHeader("cache-control", "public, max-age=600");
  res.end(JSON.stringify(out));
}
