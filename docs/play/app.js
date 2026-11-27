/* app — the Claim page. SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
 * (c) 2026 Dr Sohil Momin
 *
 * Wiring only: the chain, the counts, the untraced rule and the technique flags live in
 * claim-core.js, which the tests exercise directly.
 */
(function () {
  "use strict";

  var C = window.ClaimCore;
  var $ = function (id) { return document.getElementById(id); };

  var K_STATE = "claim:state";

  var els = {
    status: $("status"), claimText: $("claimText"), startBtn: $("startBtn"), example: $("example"), claimNote: $("claimNote"),
    hopCard: $("hopCard"), citedBy: $("citedBy"), source: $("source"), lastRead: $("lastRead"),
    isOrigin: $("isOrigin"), isBroken: $("isBroken"), addHop: $("addHop"), traceBtn: $("traceBtn"), exportBtn: $("exportBtn"),
    traceCard: $("traceCard"), chainList: $("chainList"), counts: $("counts"), traceNote: $("traceNote"),
    passage: $("passage"), flagBtn: $("flagBtn"), flagNote: $("flagNote"),
    flagsCard: $("flagsCard"), flagCount: $("flagCount"), flagList: $("flagList"), flagSays: $("flagSays")
  };

  var state = { claim: null, trace: null, analyses: [], unreadable: null };

  function today() {
    var d = new Date();
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear();
  }

  function setStatus(kind, msg) {
    els.status.className = "status show " + kind;
    els.status.textContent = msg;
  }
  function clearStatus() { els.status.className = "status"; els.status.textContent = ""; }

  function node(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function persist() {
    try {
      window.localStorage.setItem(K_STATE, C.serialize({ savedOn: Date.now(), claims: state.claim ? [state.claim] : [], analyses: state.analyses }));
      return true;
    } catch (e) {
      setStatus("bad", "NOT SAVED: " + (e && e.name === "QuotaExceededError" ? "storage is full" : "storage is unavailable") +
        ". The chain stays on screen for this session, so the work is not lost mid-read.");
      return false;
    }
  }

  /* ---------------------------------------------------------------- trace */

  function startChain() {
    clearStatus();
    var out = C.newClaim(els.claimText.value);
    if (!out.ok) { setStatus("bad", out.reason); els.claimText.focus(); return; }
    state.claim = out.claim;
    state.trace = null;
    els.hopCard.hidden = false;
    els.traceCard.hidden = true;
    els.exportBtn.hidden = true;
    setStatus("ok", "Chain started. Add one hop at a time \u2014 who cited whom.");
  }

  function addHop() {
    clearStatus();
    if (!state.claim) { setStatus("bad", "Start a chain first."); return; }
    var out = C.addHop(state.claim, {
      citedBy: els.citedBy.value,
      source: els.source.value,
      lastRead: els.lastRead.value,
      isOrigin: els.isOrigin.checked,
      broken: els.isBroken.checked
    }, Date.now());
    if (!out.ok) { setStatus("bad", out.reason); return; }
    state.claim = out.claim;
    els.citedBy.value = "";
    els.source.value = "";
    els.isOrigin.checked = false;
    els.isBroken.checked = false;
    var saved = persist();
    /* a failed save keeps its warning: the cheerful line only appears when the write worked */
    if (saved) setStatus("ok", out.says + " (" + state.claim.hops.length + " hop(s) so far)");
  }

  function traceIt() {
    clearStatus();
    if (!state.claim) { setStatus("bad", "Start a chain first."); return; }
    var t = C.trace(state.claim);
    if (!t.ok) { setStatus("bad", t.reason); return; }
    state.trace = t;
    els.traceCard.hidden = false;
    els.exportBtn.hidden = false;

    els.chainList.textContent = "";
    t.chain.forEach(function (h) {
      var li = node("li", h.isOrigin ? "origin" : h.broken ? "broken" : "");
      li.appendChild(node("span", "n", "hop " + h.step));
      li.appendChild(document.createTextNode(h.names));
      if (h.isOrigin) li.appendChild(node("div", "hint", "the origin, as far as this chain goes"));
      if (h.broken) li.appendChild(node("div", "hint", "that link no longer resolves \u2014 last read " + (h.lastRead || "never")));
      if (h.untraced) li.appendChild(node("div", "hint", "no traceable origin: marked untraced, not assumed to be the origin"));
      els.chainList.appendChild(li);
    });

    els.counts.textContent = "";
    [["Citations", t.citations], ["Repetitions", t.repetitions], ["Independent sources", t.independentSources]].forEach(function (pair) {
      var box = node("div");
      box.appendChild(node("b", null, String(pair[1])));
      box.appendChild(node("span", null, pair[0]));
      els.counts.appendChild(box);
    });

    els.traceNote.textContent = t.says;
    var savedTrace = persist();
    if (savedTrace) setStatus(t.independentSources === 1 && t.citations > 1 ? "warn" : "ok", t.says);
  }

  /* ---------------------------------------------------------------- flags */

  function readPassage() {
    clearStatus();
    var out = C.analyse(els.passage.value);
    if (!out.ok) {
      /* No list is shown at all: an empty list would read as a verdict. */
      els.flagsCard.hidden = true;
      setStatus("bad", out.reason);
      return;
    }
    els.flagsCard.hidden = false;
    els.flagCount.textContent = out.flags.length ? "\u00b7 " + out.flags.length : "\u00b7 none";
    els.flagList.textContent = "";
    out.flags.forEach(function (f) {
      var li = node("li");
      li.appendChild(node("span", "t", f.technique));
      li.appendChild(node("span", "q", "\u201c" + f.quote + "\u201d"));
      li.appendChild(node("span", "w", f.why));
      els.flagList.appendChild(li);
    });
    els.flagSays.textContent = out.says;
    state.analyses.push({ at: Date.now(), flags: out.flags.length });
    var savedRead = persist();
    if (savedRead) setStatus(out.flags.length ? "warn" : "ok", out.says);
  }

  /* --------------------------------------------------------------- export */

  function exportTrace() {
    if (!state.trace) { setStatus("bad", "Trace a chain first."); return; }
    var out = C.exportFile("trace", { trace: state.trace }, { when: today() }, function (name, text, mime) {
      if (!window.Export || typeof window.Export.save !== "function") throw new Error("the export kit did not load");
      window.Export.save(name, text, mime);
      return true;
    });
    if (out.ok) { els.claimNote.textContent = "Wrote " + out.filename + "."; setStatus("ok", "Wrote " + out.filename + "."); }
    else setStatus("bad", out.reason + ".");
  }

  /* ---------------------------------------------------------------- tabs */

  ["trace", "flags"].forEach(function (name) {
    $("tab-" + name).addEventListener("click", function () {
      ["trace", "flags"].forEach(function (other) {
        var on = other === name;
        $("tab-" + other).setAttribute("aria-selected", on ? "true" : "false");
        $("panel-" + other).hidden = !on;
      });
    });
  });

  /* ---------------------------------------------------------------- wire */

  els.startBtn.addEventListener("click", startChain);
  els.addHop.addEventListener("click", addHop);
  els.traceBtn.addEventListener("click", traceIt);
  els.flagBtn.addEventListener("click", readPassage);
  els.exportBtn.addEventListener("click", exportTrace);

  els.example.addEventListener("click", function () {
    els.claimText.value = "The water tank was never cleaned.";
    state.claim = C.newClaim(els.claimText.value).claim;
    [
      { citedBy: "The Daily", source: "a viral forward" },
      { citedBy: "a viral forward", source: "a WhatsApp group" },
      { citedBy: "a WhatsApp group", source: "The Daily", isOrigin: true }
    ].forEach(function (h) { state.claim = C.addHop(state.claim, h, Date.now()).claim; });
    els.hopCard.hidden = false;
    var saved = persist();
    traceIt();if (saved) 
    setStatus("warn", "Example loaded: three citations, all of them ending at one origin \u2014 one independent source, not three.");
  });

  /* ------------------------------------------------------------ start up */

  $("verdict-trace").textContent = C.NOT_A_VERDICT;
  $("verdict-flags").textContent = C.NOT_A_VERDICT;

  var raw = null;
  try { raw = window.localStorage.getItem(K_STATE); } catch (e) { raw = null; }
  if (raw) {
    var parsed = C.parseState(raw);
    if (parsed.ok) {
      if (parsed.state.claims.length) {
        state.claim = parsed.state.claims[0];
        els.claimText.value = state.claim.text;
        els.hopCard.hidden = false;
        if (state.claim.hops.length) traceIt();
      }
      state.analyses = parsed.state.analyses;
    } else {
      state.unreadable = parsed;
      setStatus("bad", parsed.reason);
      var keep = node("button", "small", "Export the unreadable store");
      keep.addEventListener("click", function () {
        var out = C.exportFile("raw", parsed, { when: today() }, function (name, text, mime) {
          if (!window.Export || typeof window.Export.save !== "function") throw new Error("the export kit did not load");
          window.Export.save(name, text, mime);
          return true;
        });
        setStatus(out.ok ? "ok" : "bad", out.ok ? "Wrote " + out.filename + "." : out.reason);
      });
      els.claimNote.parentNode.insertBefore(keep, els.claimNote);
    }
  }

  if (window.Loom && window.Loom.pwa) window.Loom.pwa.register("sw.js");
})();
