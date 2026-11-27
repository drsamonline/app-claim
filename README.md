# Claim

Where a claim came from, and how it travelled. **It does not say whether the claim is true.**

> This shows where a claim came from and how it travelled. It does not say whether it is true, and it
> does not judge the person who wrote it.

- **Demo (the app itself):** https://drsamonline.github.io/app-claim/play/index.html
- **Landing page:** https://drsamonline.github.io/app-claim/
- **Release:** https://github.com/drsamonline/app-claim/releases/tag/app-latest
- **Plan row:** #15 of 37 in `drsamonline/forge` → `QUEUE/PLAN.json`
- **Specs absorbed:** `app-provenance` (lead), `app-red-flag`
- **Licence:** PolyForm Noncommercial 1.0.0
- **Sponsor:** [github.com/sponsors/drsamonline](https://github.com/sponsors/drsamonline) — free, offline, no account

## Status

| | |
|---|---|
| **Built** | Hops naming who cited whom; origin marked; untraced chains marked; citations/repetitions/independent sources counted separately; broken links kept with a date; eleven technique flags with quotes; corrupt stores and broken chains reported, not blanked. |
| **Release** | Windows EXE, Android APK and Linux binary, built from this source by `app-builder` in CI. |
| **Not built** | **Search and fetching.** The app never looks anything up, so it never presents an old chain as a current one. You record what you found. |
| **Untested** | The eleven technique patterns against real articles. They were written against realistic manipulative text; a subtle piece will produce fewer flags, and the app says "read, and clean" rather than implying the piece is honest. |

## The Provenance spec's "done means", counted

> "A claim traced through 3 citations shows 1 origin and 3 repetitions, and the chain names who cited
> whom at each hop rather than only listing the citations. When all three citations trace back to the
> same origin the app reports 1 independent source, not 3 — the independent-source count and the
> citation count differ and both are shown. A citation with no traceable origin is marked untraced
> rather than assumed to be the origin."

| The spec says | The test |
|---|---|
| 3 citations → 1 origin, 3 repetitions | `citations: 3`, `origins: 1`, `repetitions: 3` |
| the chain names who cited whom at each hop | each hop's `names` is asserted to read "X cites Y", hop by hop |
| all three to one origin → 1 independent source, not 3 | `independentSources: 1` while `citations: 3`, and both appear in the sentence |
| no traceable origin → marked untraced | the last source is in `untraced`, `origins: 0`, and the app says it was not assumed to be the origin |

## Two specs, one job

Provenance *traces where a claim came from*; Red Flag *shows how it was argued*. Both are the same job
— **show what a claim rests on, without judging it** — and both forbid the same verdict in the same
words. One engine, two modes, and no truth field anywhere.

## What it will not do

- **Say whether a claim is true.** There is no verdict field; `verdict: null` is the only value it can hold.
- **Judge the author.** It flags techniques, not people.
- **Offer an empty flag list for text it did not read.**
- **Assume the last hop is the origin.**
- **Shorten a chain that fails to parse.** Broken at the link that failed.
- **Use a key or a network.**

## When things go wrong

| Case | Behaviour |
|---|---|
| **Bad input** | No hops → "no source found", with the search terms. Too short to read → refused, no list at all. |
| **No network** | Nothing changes; nothing was ever fetched. |
| **Storage full or unavailable** | **NOT SAVED** at once; the chain stays on screen for the session. |
| **Corrupt saved state** | Reported, offered for export; a chain that fails to parse is broken at the link that failed. |

## The three numbers, and why they differ

| Number | What it counts |
|---|---|
| **Citations** | how many hops are in the chain |
| **Repetitions** | how many times the claim appears — once per citation |
| **Independent sources** | how many *distinct* origins the chain ends at |

A claim quoted by ten outlets, all of which got it from one blog, has **10 citations**, **10
repetitions** and **1 independent source**. That gap is the entire point of the app.

## Tests

```bash
npm test                      # all three suites
node tests/self-tests.js      # engine — 78 assertions, including the done-means
node tests/ui-tests.js        # the page in jsdom — 27 assertions (needs the dev-only jsdom)
node tests/page-smoke.js      # every local src/href resolves, nothing off-origin
```

Mutation-tested six ways on 25/11/2026. **Two survived the first run** and both taught me something:
one was an equivalent mutation (counting origins instead of distinct origins gives the same answer
for that fixture), and one was a **real hole** — my quote assertion used `indexOf(f.quote) >= 0`,
which is true for an empty string, so a flag with no quote passed. The assertion now requires a
non-empty quote of real length, and the mutation fails. The four that failed immediately:
repetitions counting only non-origin hops (1), an untraced chain assumed to be the origin (3), an
unread passage returning an empty list (4), and a broken store opening as empty (3).

## The bug class that recurred, third time

Setting a cheerful status **after** `persist()` — so a failed write's **NOT SAVED** warning was
overwritten by "A cites B. (1 hop(s) so far)". Same bug as rows #11 and #14. This time I fixed all
three call sites at once (add hop, trace, read passage) rather than the one the test hit, and the UI
test simulates a full quota to prove it.

## Layout

```
docs/index.html            landing page
docs/play/index.html       the app — Trace and Red flag
docs/play/app.js           DOM wiring: the chain, the counts, the flags, the save guard
docs/play/claim-core.js    the engine — hops, trace, counts, techniques, storage
docs/play/web-kit.js       vendored kit (unmodified)
docs/play/export-kit.js    vendored kit (unmodified)
tests/self-tests.js        engine suite (78)
tests/ui-tests.js          page suite (27, jsdom)
tests/page-smoke.js        shape on disk
PAGES.json                 landing = docs/index.html, app = docs/play/index.html
```

## Where the spec was silent, and what was chosen

- **Repetitions counts every hop**, including the origin's own appearance, because the spec's own numbers (3 citations → 3 repetitions) only work that way.
- **Untraced is about the END of the chain**, not about a hop missing a URL. A hop in the middle of a traced chain is traced.
- **Broken links are kept, not removed**, with the date last read — a chain with a hole is more honest than a shorter chain.
- **Eleven techniques, fixed and named.** A model could find more; a fixed list can be argued with, and that is the point of quoting the sentence.
- **No search.** The app would have to fetch, and a fetched page is a page that can change under a saved chain.

## What is not built, and why

**Search and fetching.** The spec's network clause says: with no network, claims already traced still
open, and each shows when it was last verified. This app never fetches at all, so it cannot present an
old chain as a current one — the strongest version of that promise.

**A "truth" score.** Both specs forbid it, and every such score is a verdict wearing a percentage.
