#!/usr/bin/env python3
"""
Split the per-project half of the gitlab corpus into lazy chunks.

WHY
---
`src/data/*.json` is 23.8 MB and every byte of it was in the eager module graph
on every route (`src/data/frozen.js` -> `src/utils/overlay.js` -> AppContext, and
a second, larger import site in `src/utils/dataManager.js` for the seven STATIC
git modules). Measured parse cost is ~32 ms/MB with a ~130 ms floor, so first
paint scaled with TOTAL corpus size — 508 ms today, and the planned 3-5x seed
expansion would have made it 1.6-2.5 s.

17.7 MB of that corpus is per-project data: nobody looking at `/byteblaze/dotfiles`
needs facebook/react's commit history, notes, diffs or CI jobs. This script slices
it by project id into `src/data/by-project/<id>.json`, which the app loads with
`import()` through `src/data/lazy.js`. Median chunk is 81 KB, p90 216 KB, max 431 KB.

THE ISSUE / MR SPLIT
-------------------
Issues and merge requests cannot go per-project: the navbar's assigned-issue
counts, both sidebars' open-issue counts, `/dashboard/issues`,
`/dashboard/merge_requests`, `/dashboard/milestones`, `/search` and the group
rollups all read across EVERY project, and `overlay.reconcileCollection()`
derives deletion tombstones from the base array — a partially loaded base would
tombstone every unloaded project's issues on the first write. So their existence
is global and eager.

Their BODIES are not. `description` is 54 % of issues.json and 35 % of
merge_requests.json (2.91 MB together) and is read by exactly five views, four of
which are project routes. So each record is split:

  eager   `issues_index.json` / `merge_requests_index.json` — every field except
          `description`, TUPLE-encoded as `{fields:[…], rows:[[…],…]}`. Dropping
          the repeated JSON key names is worth more than half the file: 1.41 ->
          0.62 MB for issues and 2.26 -> 1.03 MB for merge requests, which takes
          the eager cost of one issue from ~790 B to ~160 B.
  lazy    the description, in the owning project's chunk (`issueBodies` /
          `mrBodies`), spliced back on at materialize time by `overlay.withBody()`.

`/search` is the one cross-project view that reads descriptions (GitLab's
non-Elasticsearch search is a LIKE over title+description). It gets its own
`search_bodies.json` holding every description in one lazy module, so it costs
one request instead of 173. Those bytes are therefore in `dist` TWICE — once
sharded into the chunks, once whole. Only LOADED bytes matter here and no route
ever loads both, so the duplication is deliberate; both copies are written from
the same in-memory dict below and cannot drift.

WHAT STAYS EAGER
----------------
Cross-cutting reference data that every route can reach and that grows with the
number of PROJECTS and USERS, not with the number of issues/notes/commits:
projects, users, groups, labels, milestones, members, stars, follows, todos,
current_user, repo_languages, the two metadata indexes above, and the small CI
header (job_specs / statuses / _page_size).

SOURCE OF TRUTH
---------------
The monolithic `src/data/*.json` files stay canonical — the extract scripts still
write them, and this script only DERIVES from them. Re-run it after any reseed:

    python3 assets/dumps/build_lazy_chunks.py            # rebuild
    python3 assets/dumps/build_lazy_chunks.py --verify   # non-zero if stale

`--verify` recomputes every chunk in memory and compares, so a seed edit that was
not followed by a rebuild is caught rather than silently serving stale data.
"""
import json
import os
import sys
import shutil

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
DATA = os.path.join(ROOT, 'src', 'data')
OUT = os.path.join(DATA, 'by-project')


def load(name):
    with open(os.path.join(DATA, name), 'r', encoding='utf-8') as fh:
        return json.load(fh)


def dumps(obj):
    # Compact, stable ordering: the chunks are build artifacts that get committed,
    # so a rebuild with unchanged input must produce a byte-identical file or every
    # reseed shows 175 spurious diffs.
    return json.dumps(obj, separators=(',', ':'), sort_keys=True, ensure_ascii=False)


def build():
    """project id (str) -> chunk dict. Only projects that actually have data."""
    projects = load('projects.json')
    by_path = {p['full_path']: p for p in projects}
    by_id = {p['id']: p for p in projects}

    chunks = {}

    def bucket(pid):
        key = str(pid)
        if key not in chunks:
            chunks[key] = {}
        return chunks[key]

    # --- STATIC git modules, already keyed by full_path -----------------------
    for fname, field in (
        ('repo_files.json', 'files'),
        ('repo_trees.json', 'tree'),
        ('commits.json', 'commits'),
        ('contributors.json', 'contributors'),
        ('branches.json', 'branches'),
        ('tags.json', 'tags'),
        ('tree_last_commits.json', 'treeLastCommits'),
    ):
        data = load(fname)
        for full_path, value in data.items():
            proj = by_path.get(full_path)
            if proj is None:
                # A full_path with no project row can never be reached by a route;
                # dropping it silently would hide a seed inconsistency.
                print('WARN %s: no project for %r' % (fname, full_path), file=sys.stderr)
                continue
            bucket(proj['id'])[field] = value

    # --- notes: keyed by project_id ------------------------------------------
    notes_by_project = {}
    for note in load('notes.json'):
        notes_by_project.setdefault(note.get('project_id'), []).append(note)
    for pid, rows in notes_by_project.items():
        if pid not in by_id:
            print('WARN notes.json: no project for id %r (%d notes)' % (pid, len(rows)), file=sys.stderr)
            continue
        bucket(pid)['notes'] = rows

    # --- resource_events: keyed by (noteable_type, noteable_id) --------------
    # The three resource-event tables carry no project_id, so the owning project
    # comes from the issue / merge request they hang off.
    owner = {}
    for issue in load('issues.json'):
        owner[('Issue', issue['id'])] = issue['project_id']
    mrs = load('merge_requests.json')
    for mr in mrs:
        owner[('MergeRequest', mr['id'])] = mr['project_id']

    events_by_project = {}
    for ev in load('resource_events.json'):
        pid = owner.get((ev.get('noteable_type'), ev.get('noteable_id')))
        if pid is None:
            continue  # event for a record that is not in the curated sample
        events_by_project.setdefault(pid, []).append(ev)
    for pid, rows in events_by_project.items():
        bucket(pid)['resourceEvents'] = rows

    # --- merge_request_diffs: keyed by MR id ---------------------------------
    mr_project = {str(mr['id']): mr['project_id'] for mr in mrs}
    diffs_by_project = {}
    for mr_id, rec in load('merge_request_diffs.json').items():
        pid = mr_project.get(str(mr_id))
        if pid is None:
            print('WARN merge_request_diffs.json: no MR %r' % mr_id, file=sys.stderr)
            continue
        diffs_by_project.setdefault(pid, {})[str(mr_id)] = rec
    for pid, rec in diffs_by_project.items():
        bucket(pid)['mrDiffs'] = rec

    # --- ci_pipelines.projects: already keyed by project id ------------------
    for pid_str, rows in load('ci_pipelines.json')['projects'].items():
        bucket(int(pid_str))['pipelines'] = rows

    # --- issue / MR descriptions ---------------------------------------------
    for rows, field in ((load('issues.json'), 'issueBodies'), (mrs, 'mrBodies')):
        for rec in rows:
            body = rec.get('description')
            if body is None:
                # Absent, not empty: `overlay.withBody()` splices nothing and the
                # record keeps the `null` the index already carries.
                continue
            pid = rec['project_id']
            if pid not in by_id:
                continue
            bucket(pid).setdefault(field, {})[str(rec['id'])] = body

    return chunks


# ---------------------------------------------------------------------------
# Eager metadata indexes
# ---------------------------------------------------------------------------

def pack(rows):
    """`[{...}, …]` -> `{fields:[…], rows:[[…], …]}` with `description` dropped.

    The field list is the UNION of every record's keys, sorted, so a record that
    happens to omit an optional field still round-trips to the same shape as its
    neighbours — `src/data/frozen.js` rebuilds plain objects from this and every
    reader downstream sees exactly the keys it saw before the split.
    """
    fields = set()
    for r in rows:
        fields.update(r.keys())
    fields.discard('description')
    fields = sorted(fields)
    return {'fields': fields, 'rows': [[r.get(f) for f in fields] for r in rows]}


def indexes():
    return {
        'issues_index.json': pack(load('issues.json')),
        'merge_requests_index.json': pack(load('merge_requests.json')),
    }


def search_bodies():
    """Every issue/MR description in one lazy module — `/search` reads only this."""
    out = {'issues': {}, 'mergeRequests': {}}
    for rows, key in ((load('issues.json'), 'issues'), (load('merge_requests.json'), 'mergeRequests')):
        for rec in rows:
            if rec.get('description') is not None:
                out[key][str(rec['id'])] = rec['description']
    return out


def ci_header():
    """The non-per-project part of ci_pipelines.json — stays eager, ~2 KB."""
    ci = load('ci_pipelines.json')
    return {k: v for k, v in ci.items() if k != 'projects'}


def write(chunks):
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)
    total = 0
    sizes = []
    for pid, chunk in sorted(chunks.items(), key=lambda kv: int(kv[0])):
        body = dumps(chunk)
        total += len(body)
        sizes.append((len(body), pid))
        with open(os.path.join(OUT, '%s.json' % pid), 'w', encoding='utf-8') as fh:
            fh.write(body)

    for name, payload in list(indexes().items()) + [('ci_header.json', ci_header()),
                                                    ('search_bodies.json', search_bodies())]:
        body = dumps(payload)
        print('  %-28s %8.2f MB' % (name, len(body) / 1e6))
        with open(os.path.join(DATA, name), 'w', encoding='utf-8') as fh:
            fh.write(body)

    sizes.sort()
    print('wrote %d chunks, %.2f MB total' % (len(chunks), total / 1e6))
    if sizes:
        print('  median %d B  p90 %d B  max %d B (project %s)'
              % (sizes[len(sizes) // 2][0], sizes[int(len(sizes) * 0.9)][0], sizes[-1][0], sizes[-1][1]))


def verify(chunks):
    stale = []
    on_disk = set(f[:-5] for f in os.listdir(OUT)) if os.path.isdir(OUT) else set()
    for pid, chunk in chunks.items():
        path = os.path.join(OUT, '%s.json' % pid)
        if not os.path.exists(path):
            stale.append('missing %s.json' % pid)
            continue
        with open(path, 'r', encoding='utf-8') as fh:
            if fh.read() != dumps(chunk):
                stale.append('stale %s.json' % pid)
    for extra in sorted(on_disk - set(chunks)):
        stale.append('orphan %s.json' % extra)
    for name, payload in list(indexes().items()) + [('ci_header.json', ci_header()),
                                                    ('search_bodies.json', search_bodies())]:
        path = os.path.join(DATA, name)
        if not os.path.exists(path):
            stale.append('missing ' + name)
            continue
        with open(path, 'r', encoding='utf-8') as fh:
            if fh.read() != dumps(payload):
                stale.append('stale ' + name)
    if stale:
        print('LAZY CHUNKS ARE STALE (%d):' % len(stale))
        for s in stale[:20]:
            print('  ' + s)
        print('Run: python3 assets/dumps/build_lazy_chunks.py')
        return 1
    print('lazy chunks up to date (%d)' % len(chunks))
    return 0


if __name__ == '__main__':
    built = build()
    if '--verify' in sys.argv:
        sys.exit(verify(built))
    write(built)
