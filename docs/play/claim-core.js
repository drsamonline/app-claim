/* claim-core — the engine behind Claim.
 * SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
 * (c) 2026 Dr Sohil Momin
 *
 * ONE JOB: show what a claim rests on, and how it travelled — without ever deciding whether it is
 * true. Both absorbed specs forbid the same verdict, in the same words: it does not say a claim is
 * true or false, and it does not say an author is good or bad.
 *
 *   provenance   a claim, and the hops it travelled: each hop names WHO CITED WHOM. Three
 *                citations that all end at one origin are ONE independent source, and the app
 *                says both numbers out loud because they differ.
 *   red flag     a passage, and the manipulation techniques it uses — each flag names the
 *                technique and quotes the sentence, so the reader can disagree with the flag.
 *
 * The rule that keeps the second one honest: an empty flag list may only ever mean "this text was
 * read and was clean". A passage that was not read returns no list at all.
 *
 * Pure functions: no DOM, no network, no storage.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.ClaimCore = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var VERSION = "1.0.0";
  var NOT_A_VERDICT = "This shows where a claim came from and how it travelled. It does not say whether it is true.";

  function clean(s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim(); }

  /* ----------------------------------------------------------- provenance */

  /* A hop is one step of the chain: `citedBy` said it, `source` is where they said they got it.
   * The chain is the list of hops, in order, from the claim outwards. */
  function newClaim(text) {
    var t = clean(text);
    if (!t) return { ok: false, field: "claim", reason: "a claim with no text is refused: there is nothing to trace" };
    return { ok: true, claim: { text: t, hops: [], createdAt: 0 } };
  }

  function addHop(claim, hop, now) {
    var citedBy = clean(hop && hop.citedBy);
    var source = clean(hop && hop.source);
    if (!citedBy) return { ok: false, field: "citedBy", reason: "a hop has to name who cited whom: the citer is missing" };
    if (!source) return { ok: false, field: "source", reason: "a hop has to name who cited whom: the source is missing" };
    var next = cloneClaim(claim);
    next.hops.push({
      id: "h" + (next.hops.length + 1),
      citedBy: citedBy,
      source: source,
      isOrigin: !!(hop && hop.isOrigin),
      url: clean(hop && hop.url),
      lastRead: clean(hop && hop.lastRead) || "",
      broken: !!(hop && hop.broken)
    });
    next.createdAt = next.createdAt || now || 0;
    return { ok: true, claim: next, says: citedBy + " cites " + source + "." };
  }

  /* The trace. An origin is a hop marked as one; a hop that is not marked and has no source of its
   * own is UNTRACED, never assumed to be the origin. */
  function trace(claim) {
    var hops = (claim && claim.hops) || [];
    if (!hops.length) {
      return {
        ok: false,
        reason: "no source found: no hop was recorded, so there is no chain to show",
        searched: claim && claim.text ? [claim.text] : [],
        analysed: false
      };
    }
    var origins = hops.filter(function (h) { return h.isOrigin; });
    /* A chain is traced if it ENDS at an origin. If it runs out, the last source is marked
     * untraced — it is not assumed to be the origin. */
    var terminal = hops[hops.length - 1];
    var untraced = terminal && !terminal.isOrigin ? [terminal.source] : [];
    var broken = hops.filter(function (h) { return h.broken; });

    /* Independent sources: distinct origins. Three citations that end at one origin are ONE. */
    var distinct = {};
    origins.forEach(function (h) { distinct[clean(h.source).toLowerCase()] = true; });
    var independent = Object.keys(distinct).length;

    var chain = hops.map(function (h, i) {
      return {
        step: i + 1,
        citedBy: h.citedBy,
        source: h.source,
        names: h.citedBy + " cites " + h.source,
        isOrigin: h.isOrigin,
        untraced: !h.isOrigin && !h.url && !h.lastRead && i === hops.length - 1,
        broken: h.broken,
        lastRead: h.lastRead,
        says: h.isOrigin
          ? h.source + " is where this starts, as far as this chain goes."
          : (h.broken
            ? h.citedBy + " cites " + h.source + ", and that link no longer resolves (last read " + (h.lastRead || "never") + ")."
            : h.citedBy + " cites " + h.source + ".")
      };
    });

    return {
      ok: true,
      claim: claim.text,
      chain: chain,
      citations: hops.length,
      /* The claim appears once per citation, so three citations are three repetitions of
       * whatever the origin said — the citation count and the independent-source count differ,
       * and both are shown. */
      repetitions: hops.length,
      origins: origins.length,
      independentSources: independent,
      untraced: untraced,
      broken: broken.map(function (h) { return { source: h.source, lastRead: h.lastRead }; }),
      verdict: null,
      notAVerdict: NOT_A_VERDICT,
      says: (independent === 1 && hops.length > 1
        ? "One independent source, and " + hops.length + " citation(s) of it \u2014 " + hops.length + " repetition(s) of one source, not " + hops.length + " sources. "
        : independent + " independent source(s) across " + hops.length + " citation(s). ") +
        (untraced.length ? untraced.length + " hop(s) have no traceable origin and are marked untraced, not assumed to be one. " : "") +
        (broken.length ? broken.length + " link(s) no longer resolve and are kept, marked broken. " : "") +
        "This shows where the claim came from, not whether it is true."
    };
  }

  /* -------------------------------------------------------------- red flag */

  var MIN_WORDS = 12;

  var TECHNIQUES = [
    { id: "urgency", name: "Manufactured urgency", re: /\b(act now|before it'?s too late|immediately|no time|urgent(ly)?|share this before|last chance)\b/i, why: "urgency pushes a decision before the evidence can be checked" },
    { id: "vague-authority", name: "Unnamed authority", re: /\b(experts say|scientists (say|agree)|studies (show|prove)|doctors say|sources say|it is (widely )?(known|reported))\b/i, why: "an authority that cannot be checked is not evidence" },
    { id: "fear", name: "Appeal to fear", re: /\b(terrifying|catastroph|disaster|destroy|wipe out|deadly|dangerous|threat to (your|our))\b/i, why: "fear shortens the distance between a claim and a conclusion" },
    { id: "dichotomy", name: "False dichotomy", re: /\b(either .{0,40} or|only two (options|choices)|you'?re either|with us or against us)\b/i, why: "two options are presented where more exist" },
    { id: "bandwagon", name: "Bandwagon", re: /\b(everyone knows|nobody believes|the whole (world|country)|most people (agree|know)|silent majority)\b/i, why: "popularity is not evidence" },
    { id: "conspiracy", name: "Conspiracy framing", re: /\b(they don'?t want you to know|hidden agenda|mainstream media (won'?t|will not)|what they'?re hiding|wake up)\b/i, why: "unfalsifiable secrecy makes the claim impossible to test" },
    { id: "ad-hominem", name: "Attack on the person", re: /\b(those people|such people|these (so-called|types)|idiots|traitors|paid (agent|shill))\b/i, why: "it argues about who said it, not what was said" },
    { id: "absolutism", name: "Absolute language", re: /\b(always|never|every single|proves? (that|it)|undeniable|100%|completely)\b/i, why: "an absolute claim needs absolute evidence" },
    { id: "whatabout", name: "Whataboutism", re: /\b(what about|but what about|why don'?t they talk about)\b/i, why: "it changes the subject rather than answering it" },
    { id: "loaded-question", name: "Loaded question", re: /\b(why (is|does) .{0,30}(still|keep)|how long will .{0,30}continue|when did you stop)\b/i, why: "the question contains the conclusion" },
    { id: "emotional-punctuation", name: "Amplified punctuation", re: /(!{2,}|\?{2,}|\b[A-Z]{5,}\b)/, why: "volume is doing the work that evidence should" }
  ];

  function sentences(text) {
    return String(text || "").replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  /* An empty flag list may only ever mean "read, and clean". A passage that was not read returns no
   * list at all — which is why `analysed` exists and why the page checks it before saying anything. */
  function analyse(text) {
    var raw = String(text == null ? "" : text);
    var words = raw.trim() ? raw.trim().split(/\s+/).length : 0;
    if (!raw.trim() || !/[a-z]/i.test(raw)) {
      return { ok: false, analysed: false, reason: "there is no text to read here, so nothing was analysed \u2014 and no empty list is offered, because an empty list would read as a verdict." };
    }
    if (words < MIN_WORDS) {
      return { ok: false, analysed: false, reason: "this passage is " + words + " word(s); the minimum is " + MIN_WORDS + ", so nothing was analysed and no list is offered." };
    }
    var flags = [];
    sentences(raw).forEach(function (s) {
      TECHNIQUES.forEach(function (t) {
        if (t.re.test(s)) flags.push({ technique: t.name, id: t.id, quote: s, why: t.why });
      });
    });
    return {
      ok: true,
      analysed: true,
      flags: flags,
      verdict: null,
      notAVerdict: NOT_A_VERDICT,
      says: flags.length
        ? flags.length + " technique(s) found. Each one quotes the sentence, so you can disagree with the flag rather than trust it."
        : "Read, and no technique from this list was found. That is not a judgement that the passage is true \u2014 only that these techniques were not used in it."
    };
  }

  /* --------------------------------------------------------------- storage */

  function cloneClaim(c) {
    return {
      text: (c && c.text) || "",
      hops: ((c && c.hops) || []).map(function (h) {
        return { id: h.id, citedBy: h.citedBy, source: h.source, isOrigin: !!h.isOrigin, url: h.url || "", lastRead: h.lastRead || "", broken: !!h.broken };
      }),
      createdAt: (c && c.createdAt) || 0
    };
  }

  function serialize(state) {
    return JSON.stringify({
      version: VERSION,
      savedOn: (state && state.savedOn) || 0,
      claims: ((state && state.claims) || []).map(cloneClaim),
      analyses: ((state && state.analyses) || []).slice()
    }, null, 2);
  }

  /* A chain that fails to parse is shown as BROKEN AT THE LINK THAT FAILED, never silently
   * shortened. An unreadable store is reported and offered for export. */
  function parseState(text) {
    var raw = String(text == null ? "" : text);
    if (!raw.trim()) return { ok: false, empty: true, reason: "nothing has been traced on this device yet", raw: raw };
    var data;
    try { data = JSON.parse(raw); }
    catch (e) {
      return { ok: false, brokenAt: 0, reason: "The saved store cannot be read, so it was not opened as an empty one. It is broken at the first link and offered for export.", raw: raw };
    }
    if (!data || (!Array.isArray(data.claims) && !Array.isArray(data.analyses))) {
      return { ok: false, brokenAt: 0, reason: "The saved file holds neither claims nor analyses, so it was not opened as an empty store.", raw: raw };
    }
    var claims = [];
    var brokenAt = -1;
    (Array.isArray(data.claims) ? data.claims : []).forEach(function (c, i) {
      if (brokenAt >= 0) return;
      if (!c || typeof c.text !== "string" || !Array.isArray(c.hops)) { brokenAt = i; return; }
      claims.push(cloneClaim(c));
    });
    if (brokenAt >= 0) {
      return {
        ok: false,
        brokenAt: brokenAt,
        reason: "The chain fails to parse at claim " + (brokenAt + 1) + ". It is shown as broken at that link rather than silently shortened, and the file is offered for export.",
        raw: raw
      };
    }
    return {
      ok: true,
      state: { version: data.version || VERSION, savedOn: Number(data.savedOn) || 0, claims: claims, analyses: Array.isArray(data.analyses) ? data.analyses : [] },
      raw: raw
    };
  }

  function stamp(when) {
    var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(when || ""));
    return m ? m[3] + "-" + m[2] + "-" + m[1] : "undated";
  }

  function traceMarkdown(t, meta) {
    var lines = ["# Claim: " + t.claim, ""];
    if (meta && meta.when) lines.push("Traced " + meta.when + ".");
    lines.push("");
    lines.push("> " + NOT_A_VERDICT);
    lines.push("");
    lines.push("## The chain");
    lines.push("");
    (t.chain || []).forEach(function (h) {
      lines.push(h.step + ". " + h.names + (h.isOrigin ? "  _(origin)_" : h.broken ? "  _(broken link, last read " + (h.lastRead || "never") + ")_" : ""));
    });
    lines.push("");
    lines.push("## Counts");
    lines.push("");
    lines.push("- Citations: " + t.citations);
    lines.push("- Repetitions: " + t.repetitions);
    lines.push("- Independent sources: " + t.independentSources);
    if (t.untraced.length) lines.push("- Untraced (no origin found, not assumed to be one): " + t.untraced.join(", "));
    if (t.broken.length) lines.push("- Broken links kept: " + t.broken.map(function (b) { return b.source + " (last read " + (b.lastRead || "never") + ")"; }).join(", "));
    return lines.join("\n");
  }

  function exportFile(what, payload, meta, writer) {
    meta = meta || {};
    if (typeof writer !== "function") return { ok: false, reason: "the file was not written: no writer is available in this browser" };
    var name, body, mime = "text/markdown;charset=utf-8";
    if (what === "trace") { name = "claim-trace-" + stamp(meta.when) + ".md"; body = traceMarkdown(payload.trace, meta); }
    else if (what === "raw") { name = "claim-unreadable-" + stamp(meta.when) + ".txt"; body = String(payload.raw || ""); mime = "text/plain;charset=utf-8"; }
    else return { ok: false, reason: "nothing was written: unknown export \u201c" + what + "\u201d" };
    try {
      var wrote = writer(name, body, mime);
      if (wrote === false) return { ok: false, filename: name, reason: "the file was not written: the browser refused the save" };
      return { ok: true, filename: name, bytes: body.length };
    } catch (e) {
      var why = e && e.name === "QuotaExceededError" ? "storage is full" : (e && e.message ? e.message : "storage is unavailable");
      return { ok: false, filename: name, reason: "the file was not written: " + why };
    }
  }

  return {
    version: VERSION,
    NOT_A_VERDICT: NOT_A_VERDICT,
    MIN_WORDS: MIN_WORDS,
    TECHNIQUES: TECHNIQUES,
    newClaim: newClaim,
    addHop: addHop,
    trace: trace,
    analyse: analyse,
    sentences: sentences,
    serialize: serialize,
    parseState: parseState,
    traceMarkdown: traceMarkdown,
    exportFile: exportFile
  };
});
