# Changelog

All notable changes to Claim are recorded here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Dates: dd/mm/yyyy.

## [Unreleased]

## [1.0.0] — 25/11/2026

### Added
- **Trace**: a claim and the hops it travelled, each hop naming **who cited whom**. The origin is
  marked; a chain that runs out is marked **untraced** rather than assumed to be the origin.
- Three counts that differ and are all shown: **citations**, **repetitions**, **independent
  sources**. Three citations ending at one origin read as one independent source, not three.
- A broken link is kept and marked, with the date it was last read.
- A claim with no hops is reported as **no source found**, with the search terms used — never shown
  with a partial chain presented as complete.
- **Red flag**: eleven manipulation techniques, each flag naming the technique, quoting the sentence
  and giving the reason. The reader can disagree with a flag rather than trust it.
- The rule that keeps the reader honest: an empty flag list is only ever produced for text that was
  actually read. Text that was not read returns **no list at all**.
- Corruption handling: an unreadable store is reported and offered for export, never opened as an
  empty one; a chain that fails to parse is shown as **broken at the link that failed**, never
  silently shortened.
- A failed save says **NOT SAVED** at once, and the chain stays on screen for the session.
- PWA shell, CI (78 engine assertions + 27 in jsdom + page smoke), and the app-builder pipeline
  pinned to the canonical SHA for the EXE/APK/Linux release.

### Not built
- Search and fetching: the app records what you found and never presents an old chain as current.
