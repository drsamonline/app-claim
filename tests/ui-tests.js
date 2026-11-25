#!/usr/bin/env node
/* ui-tests — the Claim page in a real DOM (jsdom).
 * SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
 * (c) 2026 Dr Sohil Momin
 *
 * The engine has its own suite, including the countable done-means. This one proves the page is
 * wired to it: a chain of three hops shows one origin and three repetitions, the counts are on
 * screen, a hop that runs out is marked untraced, a short passage shows NO flag list, a real
 * passage shows flags with quotes, and a broken store is reported.
 *
 *   npm install --no-save jsdom && node tests/ui-tests.js
 */
"use strict";

var fs = require("fs");
var path = require("path");
var { JSDOM } = require("jsdom");

var ROOT = path.join(__dirname, "..");
var PLAY = path.join(ROOT, "docs", "play");
var PAGE = path.join(PLAY, "index.html");

var passed = 0, failed = [];
function ok(n, c, d) { if (c) { passed++; return; } failed.push(n + (d ? " — " + d : "")); }
function eq(n, a, b) { ok(n, a === b, "expected " + JSON.stringify(b) + ", got " + JSON.stringify(a)); }

function build(seed) {
  var dom = new JSDOM(fs.readFileSync(PAGE, "utf8"), { url: "https://example.test/play/index.html", runScripts: "outside-only", pretendToBeVisual: true });
  var w = dom.window;
  if (seed) Object.keys(seed).forEach(function (k) { w.localStorage.setItem(k, seed[k]); });
  w.URL.createObjectURL = function () { return "blob:x"; };
  w.URL.revokeObjectURL = function () {};
  w.HTMLAnchorElement.prototype.click = function () {};
  ["web-kit.js", "export-kit.js", "claim-core.js", "app.js"].forEach(function (f) {
    w.eval(fs.readFileSync(path.join(PLAY, f), "utf8"));
  });
  return dom;
}

var dom = build(null), w = dom.window, d = w.document;
var $ = function (id) { return d.getElementById(id); };

ok("the engine loaded", !!w.ClaimCore);
ok("the page states it is not a verdict", /does not say whether it is true/.test($("verdict-trace").textContent), $("verdict-trace").textContent);
ok("the flag panel states it too", /does not say whether it is true/.test($("verdict-flags").textContent));

/* ------------------------------------------------------------- the chain */

$("claimText").value = "";
$("startBtn").click();
ok("an empty claim is refused", /nothing to trace/.test($("status").textContent), $("status").textContent);

$("example").click();
eq("the chain shows three hops", d.querySelectorAll("#chainList li").length, 3);
ok("each hop names who cited whom", /The Daily cites a viral forward/.test($("chainList").textContent), $("chainList").textContent);
ok("the origin hop is marked", /the origin, as far as this chain goes/.test($("chainList").textContent));
var counts = $("counts").textContent;
ok("the counts show citations, repetitions and independent sources", /Citations/.test(counts) && /Repetitions/.test(counts) && /Independent sources/.test(counts), counts);
ok("three citations and one independent source are both on screen", /3/.test(counts) && /1/.test(counts));
ok("the app says one source, not three", /one source, not 3 sources|One independent source/.test($("traceNote").textContent), $("traceNote").textContent);

$("exportBtn").click();
ok("the trace exports", /Wrote claim-trace-\d{4}-\d\d-\d\d\.md/.test($("claimNote").textContent), $("claimNote").textContent);

/* ------------------------------------------------------- an untraced hop */

var dom2 = build({ "claim:state": JSON.stringify({ claims: [{ text: "Nobody can place this.", hops: [{ id: "h1", citedBy: "A forward", source: "a source nobody names", isOrigin: false }] }], analyses: [] }) });
var d2 = dom2.window.document;
ok("a chain that runs out is marked untraced", /untraced, not assumed to be the origin/.test(d2.getElementById("chainList").textContent),
  d2.getElementById("chainList").textContent);

/* --------------------------------------------------------------- flags */

$("tab-flags").click();
eq("the flag panel shows", $("panel-flags").hidden, false);

$("passage").value = "too short";
$("flagBtn").click();
eq("a short passage shows NO flag list", $("flagsCard").hidden, true);
ok("and says why", /no list is offered/.test($("status").textContent), $("status").textContent);

var TEXT = "Experts say this is terrifying. Act now before it is too late!! Everyone knows the mainstream media will not report it.";
$("passage").value = TEXT;
$("flagBtn").click();
eq("a real passage shows the flag panel", $("flagsCard").hidden, false);
ok("flags are listed", d.querySelectorAll("#flagList li").length >= 3, d.querySelectorAll("#flagList li").length);
ok("each flag quotes its sentence", Array.prototype.every.call(d.querySelectorAll("#flagList .q"), function (q) {
  return TEXT.indexOf(q.textContent.replace(/^“|”$/g, "")) >= 0;
}), $("flagList").textContent);
ok("the unnamed authority is named on screen", /Unnamed authority/.test($("flagList").textContent));

$("passage").value = "The committee met on Tuesday and approved the minutes of the previous meeting without discussion.";
$("flagBtn").click();
eq("a clean passage shows the panel with no flags", d.querySelectorAll("#flagList li").length, 0);
ok("and says read-and-clean, not a verdict", /not a judgement that the passage is true/.test($("flagSays").textContent), $("flagSays").textContent);

/* ------------------------------------------- a broken store on reload */

var dom3 = build({ "claim:state": "{ broken store" });
var d3 = dom3.window.document;
ok("a broken store is reported", /cannot be read/.test(d3.getElementById("status").textContent), d3.getElementById("status").textContent);
ok("it says it was not opened as an empty one", /not opened as an empty one/.test(d3.getElementById("status").textContent));
ok("it offers an export of the unreadable store",
  Array.prototype.some.call(d3.querySelectorAll("button"), function (b) { return /Export the unreadable store/.test(b.textContent); }));
ok("the broken file is not overwritten", /broken store/.test(dom3.window.localStorage.getItem("claim:state")));

/* --------------------------------------------- a failed save says so */

var dom4 = build(null), w4 = dom4.window, d4 = dom4.window.document;
Object.defineProperty(w4, "localStorage", { configurable: true, get: function () {
  return { getItem: function () { return null; }, setItem: function () { var e = new Error("q"); e.name = "QuotaExceededError"; throw e; }, removeItem: function () {}, clear: function () {} };
} });
d4.getElementById("claimText").value = "A claim";
d4.getElementById("startBtn").click();
d4.getElementById("citedBy").value = "A";
d4.getElementById("source").value = "B";
d4.getElementById("addHop").click();
ok("a failed save says NOT SAVED", /NOT SAVED:/.test(d4.getElementById("status").textContent), d4.getElementById("status").textContent);
ok("and says the chain stays on screen", /stays on screen for this session/.test(d4.getElementById("status").textContent));

var total = passed + failed.length;
if (!total) { console.error("ui-tests: 0 assertions ran."); process.exit(1); }
if (failed.length) { console.error("ui-tests: " + passed + "/" + total + " passed, " + failed.length + " FAILED"); failed.forEach(function (f) { console.error("  FAIL " + f); }); process.exit(1); }
console.log("ui-tests: " + passed + "/" + total + " assertions passed");
dom.window.close(); dom2.window.close(); dom3.window.close(); dom4.window.close();
