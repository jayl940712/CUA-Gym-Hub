# DEV — Round 2 fix pass, shard 1 of 3 (infra: vite.config.js, src/utils, src/context, src/App.jsx)

Build: **PASS** · Route smoke (201 cold loads in chromium): **0 failures**

Files touched — all inside my ownership:

| File | Change |
|---|---|
| `vite.config.js` | BUG-004 body decode · transport gzip |
| `src/utils/canonicalPath.js` (new) | BUG-B01 case-insensitive path resolution |
| `src/utils/instance.js` (new) | BUG-B05 / DIFF-005 / DIFF-A05 / BUG-003 host derivation |
| `src/utils/dataManager.js` | gzipped `/post` bodies |
| `src/context/AppContext.jsx` | BUG-B03 / PIPELINE-004 `allocateId` · case-insensitive indexes |
| `src/App.jsx` | canonical-path redirect |
| `assets/route_smoke.py` (new) | regression guard |

---

## Closed

### BUG-004 · P0 · `/post` corrupted multi-byte UTF-8 — CLOSED

`vite.config.js` now buffers the whole request body and decodes once, in a
shared `readBody(req)` helper used by `/post`:

```js
const chunks = []
for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
let buf = Buffer.concat(chunks)
```

**Verified.** POSTed a 3.02 MB body carrying 🐞, `Erik Linder-Norén`, `윤보미`,
`1993–2003` (EN DASH), `…`, `Mewen Le Hô`, 🤖 and ♿️ at a *shifting stride*, so
the multi-byte codepoints land on every possible residue of a 64 KiB chunk
boundary. Read `.mock-states/utf8probe.json` back: **byte-for-byte identical,
0 × U+FFFD**. Confirmed the probe is actually sensitive by splitting the same
string mid-codepoint under the old pattern — it yields `prefix��` where the
fixed path yields `prefix…`.

Also re-verified after the gzip work below: same probe, gzipped, still identical.

### BUG-B01 · P0 · case-insensitive project/namespace paths — CLOSED

`src/utils/canonicalPath.js` + a redirect in `src/App.jsx`. GitLab resolves
namespace/project paths case-insensitively and answers **301 to the canonical
path**, so the mock does the same thing rather than silently rendering under the
wrong casing.

- Lookup maps are **lowercase-KEYED, real-casing-VALUED**. Nothing in `src/data`
  is lowercased; the seed's stored casing is what gets rendered and linked, and
  it is what the redirect targets.
- Done once in `App.jsx` ahead of `<Routes>`, so it covers `/:ns/:proj` *and*
  every `/-/…` sub-route, `/groups/:group/…` and `/users/:username/…` in one
  place — no per-page resolver changes, nothing in shard 2/3's files.
- Rendered as `<RedirectWithQuery>` rather than fired from an effect, so
  `NotFound` never flashes first and `?sid=` survives.
- Only the namespace and project segments are rewritten. Refs, blob paths and
  iids are copied through byte-for-byte — branch names and file paths *are*
  case-sensitive in git.

**Verified in chromium**, all with `?sid=` intact:

```
/byteblaze/DOTFILES        -> /byteblaze/dotfiles
/ROOT/metaseq              -> /root/metaseq
/root/METASEQ              -> /root/metaseq
/convexegg/ChatGPT         -> /convexegg/chatgpt
/BYTEBLAZE/dotfiles/-/issues -> /byteblaze/dotfiles/-/issues
/ByteBlaze                 -> /byteblaze          (namespace lookup — it had the same bug)
/users/ByteBlaze           -> /users/byteblaze
```

**webarena-396 specifically:** injected a state containing a `byteblaze/chatgpt`
fork, then loaded `/byteblaze/ChatGPT?sid=…`. It now resolves to
`/byteblaze/chatgpt` and renders the project. Note the rendered name is
`Chatgpt` (the seed's real casing, unchanged); webarena's `program_html`
`must_include` comparison is case-insensitive, so `ChatGPT` matches.

### BUG-B03 / BUG-007 / PIPELINE-004 · `allocateId` — CLOSED

`allocateId` returned `null` because it assigned inside a `setStateRaw` updater,
which React 18 does not run before the calling function returns. (It looked
intermittent because React's eager-state optimisation runs the updater inline
when the fiber has no pending update — i.e. the first call in a handler and not
the rest.)

Rewrote the provider around a `stateRef` that mirrors `state` synchronously:

- `allocateId` **reserves**, it does not write. It reads `stateRef`, returns the
  id synchronously, and parks the counter bump in a `reservedIds` ref.
- The caller's own `setState` folds the parked bump into the same object as the
  new record, so **one logical mutation is still exactly one persisted write**.
- Reserving twice before a write yields distinct ids.
- `setState` itself is now synchronous against `stateRef`, so back-to-back
  `setState` calls in one handler each see the previous one's result.

**Verified in chromium against `/go`:**

```
label create   -> 1 POST · state_diff ['labels', 'nextIds.label']
                  added label id 1927 (non-null) · nextIds.label 1927 -> 1928
invite 2 users -> 1 POST · state_diff ['members', 'nextIds.member']
                  member ids [206, 207] — unique, non-null
                  nextIds.member 206 -> 208
```

Note: shard 2/3 independently fixed the member path by moving the allocation
into an `addMembers` reducer in `components/create/mutations.js`. Compatible —
no overlap, and the six remaining `allocateId` call sites (notes, milestones,
labels ×2, issues, MRs) are fixed by this change.

### BUG-B05 / DIFF-005 / DIFF-A05 / BUG-003 · host derivation — HELPER LANDED, call sites belong to shards 2/3

`src/utils/instance.js` is new and hard-codes no host:

```js
instanceOrigin()            // http://host:port          (window.location.origin)
instanceHostname()          // host                      (no port)
instanceUrlPrefix(ns)       // http://host:port/<ns>/    — the input-group prefix
httpCloneUrl(fullPath)      // http://host:port/ns/proj.git
sshCloneUrl(fullPath)       // ssh://git@host:2222/ns/proj.git
```

Only the SSH **port** stays constant (2222 — it is a property of the deployment,
and the source's own clone panel renders it); the host is derived.

**Call sites to adopt it — none are in my files:**

| File:line | Current | Replace with |
|---|---|---|
| `src/pages/NewProject.jsx:252,257,258` | `` `http://localhost:8023/${n.path}/` `` | `instanceUrlPrefix(n.path)` |
| `src/pages/NewProject.jsx:355` | `git push … http://localhost:8023/${user}/…` | `` `git push --set-upstream ${instanceUrlPrefix(currentUser.username)}<project-slug>.git main` `` |
| `src/pages/NewGroup.jsx:221` | `http://localhost:8023/` | `instanceUrlPrefix()` |
| `src/pages/ForkProject.jsx:154,155` | `http://localhost:8023/` | `instanceUrlPrefix()` |
| `src/pages/ProjectSettingsGeneral.jsx:485` | `` `http://localhost:8023/${project.namespace.path}/` `` | `instanceUrlPrefix(project.namespace.path)` |
| `src/pages/GroupSettings.jsx:148` | `http://localhost:8023/` | `instanceUrlPrefix()` |
| `src/pages/ProfileAccount.jsx:81` | `http://localhost:8023/` | `instanceUrlPrefix()` |
| `src/pages/ProjectOverview.jsx:62` | `` ssh://git@__GITLAB_SSH__/… `` (**BUG-003, P1**) | `sshCloneUrl(project.full_path)` |

`ProjectOverview.jsx:63` already does `window.location.origin` by hand and can
switch to `httpCloneUrl` / `instanceOrigin` for consistency.

Also exposed for shards 2/3, in `AppContext`'s `indexes`:
`projectsByPathLower`, `groupsByPathLower`, `usersByUsernameLower` — lowercase
keys, records with their real casing.

---

## Partially closed

### PARITY-008 / PIPELINE-005 · session payload

**Reached: `/go` 4.47 MB → 1.10 MB on the wire (4.1×); `POST /post` 2.23 MB →
0.49 MB (4.6×). The state itself is unchanged at 2.23 MB.**

I did **not** shrink the seed. I could not find a record- or field-level cut
that is safe to make in this shard:

- The 2.23 MB is 12 mutable modules — notes 708 KB, MRs 480 KB, issues 425 KB,
  users 265 KB (1133 rows), projects 99 KB. The static git modules (~2.4 MB) are
  already out of state.
- Cutting it means dropping records or fields, and `assets/task_anchors.md`
  whitelists 145 routes and 252 strings spread across all of them. Per the brief
  an oversized diff is a P2 and a missing anchor is a P0, so I stopped here.
- Record-level pruning would also mean regenerating `src/data/*.json`, which is
  explicitly forbidden while sharded.

So the saving is taken on the wire, where it cannot drop an anchor:

- `vite.config.js` — `sendJson()` gzips `/go` and `/state` responses at level 1,
  only when the client sends `Accept-Encoding: gzip`, with `Vary` set. Level 1
  costs 13 ms for 2.2 MB at 4.1×, vs 30 ms for 4.5× at level 6; `/go` is on the
  per-step path of every rollout, so latency wins.
- `src/utils/dataManager.js` — `encodePost()` gzips the request body with
  `CompressionStream`, falling back to plain JSON if it is unavailable or
  throws. `readBody()` inflates on `Content-Encoding: gzip`.
- **`.mock-states/<sid>.json` stays plain, uncompressed JSON** — the harness and
  the test shards read those files directly. Only HTTP bodies are compressed.

Verified: `curl` without `Accept-Encoding` still gets 4,465,059 bytes of plain
JSON; with gzip it gets 1,101,337 bytes that decompress to the identical
document. A browser mutation POSTs 492 KB with `content-encoding: gzip`.

**If the 2.23 MB itself must come down**, that is a seed-curation job for a
serial step, not a sharded one. The cheapest real cut is `users` — 1133 rows,
265 KB, most of them present only as an author/assignee id — but it needs a
reachability pass cross-checked against all 252 anchor strings before a single
row is removed.

---

## Regression guard — `assets/route_smoke.py`

```bash
export LD_LIBRARY_PATH=/tmp/sysroot/usr/lib/x86_64-linux-gnu
/tmp/pwvenv/bin/python assets/route_smoke.py http://localhost:5211
```

Cold-loads **201 routes** in real chromium — all 145 `anchor_routes` from
`assets/task_anchors.json` plus 56 shells reached by clicking — each with a
**fresh `?sid=`**, and fails on any console error, any uncaught pageerror, or an
empty `<body>`. Vite HMR/websocket/favicon noise is filtered out. It then asserts
the 7 case-insensitive redirects above, including that `?sid=` survives each one.
Exit code is non-zero on any failure, so it can gate a round.

This is the check that would have caught last round's white-screen: a
`ReferenceError` on `/` is invisible to `npm run build` and fails here in ~2 s.

**Result after my fixes: 201/201 clean, 0 console errors, 0 pageerrors, 7/7
redirects correct.** No route in any shard's files threw — nothing to hand back.

---

## Not mine / handed to other shards

- **BUG-003 (P1, `__GITLAB_SSH__`)** — `src/pages/ProjectOverview.jsx:62`. Helper
  `sshCloneUrl()` is ready; one-line adoption.
- **BUG-B05 remaining call sites** — the 7 files in the table above.
- **BUG-B02 (P1, `created_date_asc`)** — `src/pages/IssuablesList.jsx:335`.
- **BUG-B04 (P1, fork slug)** — `src/pages/ForkProject.jsx`.
- **BUG-002 (P0, invite role default)** — already fixed by another shard;
  `MembersTable.jsx:133` now initialises `role` to `10`. Confirmed by reading.
- **DIFF-001, BUG-005, BUG-006 (P2)** — `src/pages/**`.

## Source discipline

Read-only. No request was made to `localhost:8023` from this shard at all — the
case-insensitivity evidence came from `TEST.part-routes-b.md`, which recorded the
source's 301s. No `?sort=` URL was loaded on 8023. No `src/data/*.json` file was
read-modified, no identifier renamed, no record fabricated.
