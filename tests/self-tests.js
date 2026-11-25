#!/usr/bin/env node
/* self-tests — Claim. No framework, no dependencies.
 * SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
 * (c) 2026 Dr Sohil Momin
 *
 * The Provenance spec's "done means" is countable, so it is counted:
 *
 *   "A claim traced through 3 citations shows 1 origin and 3 repetitions, and the chain names who
 *    cited whom at each hop rather than only listing the citations. When all three citations trace
 *    back to the same origin the app reports 1 independent source, not 3 — the independent-source
 *    count and the citation count differ and both are shown. A citation with no traceable origin is
 *    marked untraced rather than assumed to be the origin."
 *
 * Red Flag's rules are here too: an empty flag list may only ever mean "read, and clean"; a passage
 * that was not read returns no list at all; every flag quotes its sentence; and nothing anywhere
 * says a claim is true or an author is bad.
 *
 *   node tests/self-tests.js
 */
"use strict";

var fs = require("fs");
var path = require("path");

var ROOT = path.join(__dirname, "..");
var C = require(path.join(ROOT, "docs", "play", "claim-core.js"));

var passed = 0;
var failed = [];
var group = "";
function section(n) { group = n; }
function ok(name, cond, detail) { if (cond) { passed++; return; } failed.push(group + " :: " + name + (detail ? " — " + detail : "")); }
function eq(name, a, b) { ok(name, a === b, "expected " + JSON.stringify(b) + ", got " + JSON.stringify(a)); }
function read(f) { return fs.readFileSync(path.join(ROOT, f), "utf8"); }

var T0 = Date.UTC(2026, 10, 25);

function threeHops(sameOrigin) {
  var c = C.newClaim("The water tank was never cleaned.").claim;
  c = C.addHop(c, { citedBy: "The Daily", source: sameOrigin ? "The same blog" : "a viral forward" }, T0).claim;
  c = C.addHop(c, { citedBy: "a viral forward", source: sameOrigin ? "The same blog" : "a WhatsApp group" }, T0).claim;
  c = C.addHop(c, { citedBy: "a WhatsApp group", source: sameOrigin ? "The same blog" : "The Daily", isOrigin: true }, T0).claim;
  return c;
}

/* ================================================ the spec's own "done means" */

section("done means — three citations, one origin, three repetitions");
var t = C.trace(threeHops(false));
eq("three citations", t.citations, 3);
eq("one origin", t.origins, 1);
eq("three repetitions", t.repetitions, 3);
eq("one independent source", t.independentSources, 1);
ok("the independent-source count and the citation count differ", t.independentSources !== t.citations);
ok("both counts are in the sentence", /3 citation/.test(t.says) && /1 independent source|One independent source/.test(t.says), t.says);

section("done means — the chain names who cited whom at each hop");
eq("three hops in the chain", t.chain.length, 3);
eq("hop 1 names the citer and the source", t.chain[0].names, "The Daily cites a viral forward");
eq("hop 2 names the next pair", t.chain[1].names, "a viral forward cites a WhatsApp group");
eq("hop 3 names the last pair", t.chain[2].names, "a WhatsApp group cites The Daily");
ok("each hop is a who-cited-whom, not a bare list", t.chain.every(function (h) { return / cites /.test(h.names); }));
eq("the origin hop is marked", t.chain[2].isOrigin, true);
ok("and says where the chain starts", /where this starts/.test(t.chain[2].says), t.chain[2].says);

section("done means — all three tracing to one origin is ONE source, not three");
var same = C.trace(threeHops(true));
eq("three citations again", same.citations, 3);
eq("but one independent source", same.independentSources, 1);
eq("and one origin", same.origins, 1);
ok("the app says so out loud", /one source, not 3 sources|One independent source/.test(same.says), same.says);
ok("it does not claim three sources", !/3 independent source/.test(same.says), same.says);

section("done means — a citation with no traceable origin is marked untraced");
var runsOut = C.newClaim("Something nobody can place.").claim;
runsOut = C.addHop(runsOut, { citedBy: "A forward", source: "a source nobody names" }, T0).claim;
var rt = C.trace(runsOut);
eq("there is no origin", rt.origins, 0);
eq("the last source is marked untraced", rt.untraced.length, 1);
eq("and it is named", rt.untraced[0], "a source nobody names");
ok("the app says it was not assumed to be the origin", /not assumed to be one/.test(rt.says), rt.says);
eq("a traced chain has nothing untraced", t.untraced.length, 0);

/* ============================================================ must-nots */

section("must-not — it must not decide whether a claim is true");
eq("the trace carries no verdict", t.verdict, null);
ok("it says so in words", /does not say whether it is true/.test(C.NOT_A_VERDICT), C.NOT_A_VERDICT);
ok("no truth verdict anywhere in the engine (a null placeholder is not a verdict)",
  !/\b(isTrue|truthy|accurate|hoax|debunked)\s*[:=]/i.test(read("docs/play/claim-core.js")) &&
  /* "verdict: null" is the absence of a verdict; anything else would be one */
  !/\bverdict\s*:/.test(read("docs/play/claim-core.js").replace(/verdict\s*:\s*null/g, "")));
ok("the export repeats it", /does not say whether it is true/.test(C.traceMarkdown(t, { when: "25/11/2026" })));

section("must-not — a claim with no source is reported, never shown with a partial chain");
var noHops = C.trace(C.newClaim("A claim nobody has traced.").claim);
eq("it is refused", noHops.ok, false);
ok("the reason says no source found", /no source found/.test(noHops.reason), noHops.reason);
ok("it reports the search terms used", Array.isArray(noHops.searched) && noHops.searched.length === 1, JSON.stringify(noHops.searched));
eq("no chain is offered", noHops.chain, undefined);
eq("an empty claim is refused", C.newClaim("   ").ok, false);

section("must-not — a broken link is kept and marked, with the date last read");
var brokenClaim = C.newClaim("A claim with a dead link.").claim;
brokenClaim = C.addHop(brokenClaim, { citedBy: "An article", source: "a page that is gone", broken: true, lastRead: "12/11/2026" }, T0).claim;
var bt = C.trace(brokenClaim);
eq("the hop is kept", bt.chain.length, 1);
eq("it is marked broken", bt.chain[0].broken, true);
eq("with the date it was last read", bt.chain[0].lastRead, "12/11/2026");
ok("and the chain says so", /no longer resolves/.test(bt.chain[0].says) && /12\/11\/2026/.test(bt.chain[0].says), bt.chain[0].says);
ok("the summary counts it", /link\(s\) no longer resolve/.test(bt.says), bt.says);

section("must-not — an empty flag list only ever means 'read, and clean'");
var short = C.analyse("too short");
eq("a short passage is refused", short.ok, false);
eq("and is marked as not analysed", short.analysed, false);
eq("with no flag list at all", short.flags, undefined);
ok("the reason says no list is offered", /no list is offered/.test(short.reason), short.reason);
eq("an empty passage is refused", C.analyse("   ").ok, false);
var clean = C.analyse("The committee met on Tuesday and approved the minutes of the previous meeting without discussion.");
eq("a clean passage is analysed", clean.analysed, true);
eq("and returns an empty list", clean.flags.length, 0);
ok("which the app explains as read-and-clean, not a verdict", /not a judgement that the passage is true/.test(clean.says), clean.says);

section("must-not — every flag names a technique and quotes its sentence");
var TEXT = "Experts say this is terrifying. Act now before it is too late!! Everyone knows the mainstream media will not report it.";
var a = C.analyse(TEXT);
ok("techniques are found", a.flags.length >= 3, a.flags.length);
ok("every flag quotes a real sentence from the text",
  a.flags.every(function (f) { return typeof f.quote === "string" && f.quote.length > 10 && TEXT.indexOf(f.quote) >= 0; }),
  a.flags.map(function (f) { return JSON.stringify(f.quote); }).join(" | "));
ok("every flag names a technique", a.flags.every(function (f) { return f.technique && f.technique.length > 3; }));
ok("every flag says why", a.flags.every(function (f) { return f.why && f.why.length > 10; }));
ok("the unnamed authority is caught", a.flags.some(function (f) { return f.id === "vague-authority"; }));
ok("the urgency is caught", a.flags.some(function (f) { return f.id === "urgency"; }));
ok("the bandwagon is caught", a.flags.some(function (f) { return f.id === "bandwagon"; }));

section("must-not — it must not judge the author or the article");
eq("the analysis carries no verdict", a.verdict, null);
ok("no author judgement in any flag", a.flags.every(function (f) { return !/\b(liar|dishonest|bad person|evil|idiot)\b/i.test(f.why + f.technique); }));
ok("no truth label is ever produced by the analyser",
  C.analyse(TEXT).flags.every(function (f) { return !/\b(true|false|fake|hoax|liar)\b/i.test(f.technique + " " + f.why); }));

section("must-not — an unreadable store is reported, never opened as an empty one");
var bad = C.parseState("{ broken store");
eq("it is reported", bad.ok, false);
ok("it says it was not opened as an empty one", /not opened as an empty one/.test(bad.reason), bad.reason);
eq("it names the link it broke at", bad.brokenAt, 0);
eq("the raw text is kept for export", bad.raw, "{ broken store");
var partial = C.parseState(JSON.stringify({ claims: [{ text: "ok", hops: [] }, { text: 5 }] }));
eq("a chain that fails to parse is reported", partial.ok, false);
eq("with the link it failed at", partial.brokenAt, 1);
ok("and it is not silently shortened", /rather than silently shortened/.test(partial.reason), partial.reason);
eq("nothing saved yet is distinguished from a broken store", C.parseState("").empty, true);

section("must-not — it must not grow a second job");
var core = read("docs/play/claim-core.js");
ok("no second store, no tags, no sync", !/\b(tags|labels|folders)\s*[:=]/i.test(core) && !/\bsync\s*[:(]/i.test(core));
ok("no model, key or endpoint", !/\b(apiKey|endpoint|openai|gpt)\s*[:=]/i.test(core) && !/https?:\/\//.test(core));
ok("no network call", !/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/.test(core + read("docs/play/app.js")));
ok("the page forbids connections", /connect-src 'none'/.test(read("docs/play/index.html")));

section("failure case — storage full or unavailable");
var thrown = C.exportFile("trace", { trace: t }, { when: "25/11/2026" }, function () {
  var e = new Error("quota"); e.name = "QuotaExceededError"; throw e;
});
eq("a failed write is reported as failed", thrown.ok, false);
ok("a failed write says the file was not written", /not written/.test(thrown.reason), thrown.reason);
ok("a failed write names the cause", /storage is full/.test(thrown.reason));
eq("no writer means no file", C.exportFile("trace", { trace: t }, {}, null).ok, false);
ok("the page keeps the chain on screen for the session", /stays on screen for this session/.test(read("docs/play/app.js")));

section("shape — every script the page loads exists beside it");
var page = read("docs/play/index.html");
var srcs = (page.match(/<script[^>]+src="([^"]+)"/g) || []).map(function (t) { return t.replace(/.*src="([^"]+)"/, "$1"); });
srcs.forEach(function (s) {
  ok("script src resolves: " + s, fs.existsSync(path.join(ROOT, "docs", "play", s.replace(/^\.\//, ""))));
});
ok("the landing page exists", fs.existsSync(path.join(ROOT, "docs", "index.html")));
ok("the page manifest exists", fs.existsSync(path.join(ROOT, "PAGES.json")));

var total = passed + failed.length;
if (!total) { console.error("self-tests: 0 assertions ran. That is a failure, not a pass."); process.exit(1); }
if (failed.length) {
  console.error("self-tests: " + passed + "/" + total + " passed, " + failed.length + " FAILED");
  failed.slice(0, 12).forEach(function (f) { console.error("  FAIL " + f); });
  process.exit(1);
}
console.log("self-tests: " + passed + "/" + total + " assertions passed");
