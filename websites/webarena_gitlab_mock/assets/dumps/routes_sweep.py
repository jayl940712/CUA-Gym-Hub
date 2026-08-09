#!/usr/bin/env python3
"""Cold-load every ROUTES.md row with a fresh `?sid=`.

`assets/route_smoke.py` walks the anchor routes plus a hand-picked breadth list.
This walks the PARITY MAP itself: every numbered row of ROUTES.md, with its path
params filled from real seed records, one fresh `?sid=` each. It fails a row on a
blank body, a console error, an uncaught pageerror, or a lost `sid`.

    export LD_LIBRARY_PATH=/tmp/sysroot/usr/lib/x86_64-linux-gnu
    /tmp/pwvenv/bin/python assets/dumps/routes_sweep.py http://localhost:5320
"""
import json
import os
import re
import sys

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5320"
HERE = os.path.dirname(os.path.abspath(__file__))
MOCK = os.path.dirname(os.path.dirname(HERE))
DATA = os.path.join(MOCK, "src", "data")


def seed(name):
    with open(os.path.join(DATA, name), encoding="utf8") as fh:
        return json.load(fh)


PROJECTS = seed("projects.json")
ISSUES = seed("issues.json")
MRS = seed("merge_requests.json")
LABELS = seed("labels.json")
MILESTONES = seed("milestones.json")
TODOS = seed("todos.json")
COMMITS = seed("commits.json")
TREES = seed("repo_trees.json")

# One project that has an issue, an MR, a label, a milestone and a file tree, so
# every parameterised row below resolves against a record that really exists.
PROJ = next(p for p in PROJECTS if p["full_path"] == "a11yproject/a11yproject.com")
NS, PRJ = PROJ["full_path"].split("/", 1)
REF = PROJ.get("default_branch") or "main"
ISSUE = next(i for i in ISSUES if i["project_id"] == PROJ["id"])
MR = next(m for m in MRS if m["project_id"] == PROJ["id"])
LABEL = next(l for l in LABELS if l["project_id"] == PROJ["id"])
MILESTONE = next(m for m in MILESTONES if m["project_id"] == PROJ["id"])
SHA = (COMMITS.get(PROJ["full_path"], {}).get("list") or [{}])[0].get("sha", "")
BLOB = next((e["path"] for e in TREES.get(PROJ["full_path"], []) if e.get("type") == "blob"),
            "README.md")
TODO_ID = TODOS[0]["id"]

def resolve(path):
    """ROUTES.md path -> a concrete URL path, or None when the row is not a GET."""
    p = path
    # Rows that document a shape rather than a single URL.
    if p.startswith("/help/"):
        return "/help"
    if "{" in p:                       # /-/settings/{a,b,c} and the archive row
        first = re.search(r"\{([^,}]+)", p).group(1)
        p = re.sub(r"\{[^}]*\}", first, p)
    if ".atom" in p or "/-/archive/" in p:
        return None                    # not an SPA route: a feed / a download
    p = p.replace("/-/ide/project/:ns/:proj/edit/:ref/-/",
                  "/-/ide/project/%s/edit/%s/-/%s" % (PROJ["full_path"], REF, BLOB))
    p = p.replace(":ns/:proj", PROJ["full_path"])
    p = p.replace("<name>", "archive")
    # iid is per-collection.
    if "/-/merge_requests/:iid" in p:
        p = p.replace(":iid", str(MR["iid"]))
    elif "/-/milestones/:iid" in p:
        p = p.replace(":iid", str(MILESTONE["iid"]))
    else:
        p = p.replace(":iid", str(ISSUE["iid"]))
    if "/-/labels/:id" in p:
        p = p.replace(":id", str(LABEL["id"]))
    elif "/dashboard/todos/:id" in p:
        p = p.replace(":id", str(TODO_ID))
    p = p.replace(":username", "byteblaze")
    p = p.replace(":group", "gitlab-instance-58545a48")
    p = p.replace(":ref", REF)
    p = p.replace(":sha", SHA)
    p = p.replace("*path", BLOB)
    if p.endswith("?from=&to="):
        p = p[:-len("?from=&to=")] + "/-/compare"
        p = p.replace("/-/compare/-/compare", "/-/compare")
    if ":" in p or "*" in p.split("?")[0]:
        return None                    # unresolved param — report it
    return p


IGNORE = re.compile(r"favicon|net::ERR_|Download the React DevTools")


def with_sid(base, path, sid):
    """`?sid=` goes BEFORE the fragment.

    Three ROUTES.md rows are hash routes (`/projects/new#blank_project`), and
    naively appending the query put the sid inside the fragment
    (`#blank_project?sid=x`), where the app never sees it — reported as three
    phantom "sid LOST" failures.
    """
    frag = ""
    if "#" in path:
        path, frag = path.split("#", 1)
        frag = "#" + frag
    sep = "&" if "?" in path else "?"
    return "%s%s%ssid=%s%s" % (base, path, sep, sid, frag)


def main():
    rows = []
    with open(os.path.join(MOCK, "ROUTES.md"), encoding="utf8") as fh:
        for line in fh:
            m = re.match(r"\|\s*(\d+)\s*\|\s*`([^`]+)`\s*\|", line)
            if m:
                rows.append((int(m.group(1)), m.group(2)))

    plan, skipped = [], []
    for num, src in rows:
        got = resolve(src)
        (plan if got else skipped).append((num, src, got))

    print("ROUTES.md rows with a path: %d · drivable: %d · not-a-GET-route: %d"
          % (len(rows), len(plan), len(skipped)))
    for num, src, _ in skipped:
        print("  skip #%s %s" % (num, src))

    failures = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        ctx = browser.new_context(viewport={"width": 1280, "height": 720})
        for num, src, path in plan:
            sid = "sweep_%d" % num
            page = ctx.new_page()
            errs = []
            page.on("console", lambda m: errs.append("console.%s: %s" % (m.type, m.text))
                    if m.type == "error" and not IGNORE.search(m.text) else None)
            page.on("pageerror", lambda e: errs.append("pageerror: %s" % e))
            try:
                page.goto(with_sid(BASE, path, sid), wait_until="load", timeout=30000)
                page.wait_for_timeout(500)
                if not (page.inner_text("body") or "").strip():
                    errs.append("BLANK PAGE")
                if "sid=%s" % sid not in page.evaluate("location.search"):
                    errs.append("sid LOST -> %s" % page.evaluate("location.search"))
            except Exception as e:                             # noqa: BLE001
                errs.append("navigation failed: %s" % e)
            page.close()
            if errs:
                failures.append((num, src, path, errs))
                print("FAIL #%s %s\n      -> %s\n      %s"
                      % (num, src, path, "\n      ".join(errs[:3])), flush=True)
        # --- zero external requests -------------------------------------
        # Every request the mock makes must go to its own origin. A CDN font, a
        # gravatar or an analytics beacon would make the mock non-offline and is
        # a migration-contract breach (WEBARENA_MIGRATION.md §3).
        foreign = []
        page = ctx.new_page()
        page.on("request", lambda r: foreign.append(r.url)
                if not r.url.startswith(BASE) and not r.url.startswith("data:")
                and not r.url.startswith("blob:") else None)
        for path in [p for _, _, p in plan][:30]:
            try:
                page.goto(with_sid(BASE, path, "net"), wait_until="load", timeout=30000)
                page.wait_for_timeout(400)
            except Exception:                                  # noqa: BLE001
                pass
        page.close()
        browser.close()

    print("\nexternal requests across 30 routes: %d%s"
          % (len(foreign), "" if not foreign else " -> " + ", ".join(sorted(set(foreign))[:5])))
    if foreign:
        failures.append((0, "external requests", "", sorted(set(foreign))[:5]))

    print("driven: %d · failing: %d" % (len(plan), len(failures)))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
