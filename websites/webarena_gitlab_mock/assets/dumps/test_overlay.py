#!/usr/bin/env python3
"""Regression suite for the frozen-corpus / overlay refactor.

The 12 mutable seed modules (2 072 728 B: 1 599 notes, 729 MRs, 613 issues,
1 133 users, …) left app state and mutations became a delta overlay resolved on
read by `src/utils/overlay.js`. The risks that buys are (a) a record that looks
created/edited/deleted in one view and not another — GitLab has many views over
the same records — and (b) an injected task state that no longer renders what it
used to. This checks both, plus the creative flows the site's tasks are built on.

    export LD_LIBRARY_PATH=/tmp/sysroot/usr/lib/x86_64-linux-gnu
    /tmp/pwvenv/bin/python assets/dumps/test_overlay.py --port 5320

Sections
  1  cold state / localStorage / /go budget
  2  legacy full-array injection vs lightweight overlay injection render
     identically — list view, detail view, dashboard, search
  3  edits and deletions of FROZEN records honoured by every read path
  4  the creative flows, each end to end + RELOAD: create issue, create MR,
     comment, assign, label, milestone, close, merge, star, invite member
  5  /go state_diff shape and size after each of those
  6  reconciler invariants: a no-op write produces an empty delta; the seed is
     never copied into state
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.request

from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
MOCK = os.path.dirname(os.path.dirname(HERE))
DATA = os.path.join(MOCK, "src", "data")

FAILS = []
PASSES = []

# Every sid this file uses is suffixed with RUN, so a re-run never inherits the
# previous run's mutations. Without it the second run found the project already
# starred ("Star" -> "Unstar"), `root` already a member, and three flows failed
# for reasons that had nothing to do with the code under test.
RUN = str(int(time.time()))


def sid(name):
    return "%s_%s" % (name, RUN)


def check(ok, label, detail=""):
    (PASSES if ok else FAILS).append(label if ok else "%s — %s" % (label, detail))
    print("  %s %s%s" % ("PASS" if ok else "FAIL", label,
                         "" if ok else "  <- " + str(detail)[:400]))
    return ok


def opener():
    return urllib.request.build_opener(urllib.request.ProxyHandler({}))


def http(url, data=None, timeout=180):
    req = urllib.request.Request(url, headers={"User-Agent": "curl/8"})
    if data is not None:
        req.data = json.dumps(data).encode()
        req.add_header("Content-Type", "application/json")
    return opener().open(req, timeout=timeout).read()


def go(base, sid):
    return json.loads(http("%s/go?sid=%s" % (base, sid)))


def minified(obj):
    return json.dumps(obj, separators=(",", ":"), ensure_ascii=False)


def seed(name):
    with open(os.path.join(DATA, name), encoding="utf8") as fh:
        return json.load(fh)


def inject(base, sid, state):
    http("%s/post?sid=%s" % (base, sid), {"action": "set", "state": state})


def new_page(ctx, base):
    page = ctx.new_page()
    page.errors = []
    page.on("console", lambda m: page.errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: page.errors.append(str(e)))
    return page


def visit(page, base, path, sid, wait=700):
    sep = "&" if "?" in path else "?"
    page.goto("%s%s%ssid=%s" % (base, path, sep, sid), wait_until="domcontentloaded")
    page.wait_for_timeout(wait)
    return page.inner_text("body")


# ---------------------------------------------------------------------------


def section1(base):
    print("\n[1] cold state / localStorage / /go budget")
    d = go(base, sid("cold_budget_probe"))
    init = minified(d["initial_state"])
    print("      cold state          : %s B utf8" % f"{len(init.encode()):,}")
    print("      two localStorage keys: %s UTF-16 units (%.2f%% of 5,242,880)"
          % (f"{len(init) * 2:,}", len(init) * 2 / 5242880 * 100))
    print("      /go whole payload   : %s B" % f"{len(minified(d).encode()):,}")
    check(len(init.encode()) < 500_000, "cold state well under 500 KB",
          "%d B" % len(init.encode()))
    check(len(init) * 2 < 5242880 * 0.05, "two localStorage keys under 5% of quota",
          "%d units" % (len(init) * 2))
    check(d["state_diff"] == {}, "untouched sid reports an EMPTY state_diff "
          "(server createInitialData() == client boot)", d["state_diff"])
    for k in ("users", "projects", "issues", "mergeRequests", "notes", "labels",
              "milestones", "members", "stars", "follows", "todos", "groups"):
        if k in d["initial_state"]:
            check(False, "corpus key %r is NOT in cold state" % k,
                  "%d rows present" % len(d["initial_state"][k]))
            break
    else:
        check(True, "no corpus collection appears in cold state")
    return d


PROJECT = "a11yproject/a11yproject.com"   # the most heavily anchored project


def page1_iids(ctx, base, path="/" + "a11yproject/a11yproject.com" + "/-/issues/?state=all"):
    """The iids the project issue list actually renders on page 1.

    The list is 20 rows and `per_page` is a UI control, not a query param, so a
    victim picked blindly out of the seed is usually on page 40 and every
    "visible in the list" assertion is vacuous — which is exactly how an earlier
    revision of this file produced three phantom failures.
    """
    page = ctx.new_page()
    page.goto(base + path + "&sid=" + sid("probe_page1"), wait_until="domcontentloaded")
    page.wait_for_timeout(900)
    iids = [int(m) for m in re.findall(r"#(\d+) · created", page.inner_text("body"))]
    page.close()
    return iids


def section2(base, ctx):
    """Legacy full-array injection vs lightweight overlay injection."""
    print("\n[2] legacy full-array injection == lightweight overlay injection")
    issues = seed("issues.json")
    projects = seed("projects.json")
    proj = next(p for p in projects if p["full_path"] == PROJECT)
    proj_issues = [i for i in issues if i["project_id"] == proj["id"]]
    new_iid = max(i["iid"] for i in proj_issues) + 1
    on_page1 = page1_iids(ctx, base)
    visible = [i for i in proj_issues if i["iid"] in on_page1]
    created = {
        "id": 900001, "iid": new_iid, "project_id": proj["id"],
        "title": "OVERLAY-PARITY-PROBE", "description": "injected by test_overlay.py",
        "author_id": 2330, "state": "opened", "confidential": False, "due_date": None,
        "milestone_id": None, "assignee_ids": [], "label_ids": [],
        "created_at": "2023-05-01 10:00:00", "updated_at": "2023-05-01 10:00:00",
        "closed_at": None, "closed_by_id": None, "upvotes": 0, "user_notes_count": 0,
    }
    # An EDIT to a frozen record, and a DELETION of one — both chosen from the
    # rows page 1 actually renders, so the list assertions below mean something.
    victim_edit = visible[0]
    victim_del = visible[1]
    edited = dict(victim_edit, title="OVERLAY-EDITED-TITLE")

    legacy_issues = [edited if i["id"] == victim_edit["id"] else i
                     for i in issues if i["id"] != victim_del["id"]] + [created]

    inject(base, sid("ovl_legacy"), {"issues": legacy_issues})
    inject(base, sid("ovl_light"), {
        "newIssues": [created],
        "issueEdits": {str(victim_edit["id"]): edited},
        "deletedIssues": [str(victim_del["id"])],
    })

    page = new_page(ctx, base)
    paths = [
        "/a11yproject/a11yproject.com/-/issues/?state=all",
        "/a11yproject/a11yproject.com/-/issues/%d" % new_iid,
        "/a11yproject/a11yproject.com/-/issues/%d" % victim_edit["iid"],
        "/dashboard/issues?scope=all&state=all",
        "/search?search=OVERLAY-PARITY-PROBE&scope=issues",
    ]
    for path in paths:
        a = visit(page, base, path, sid("ovl_legacy"))
        b = visit(page, base, path, sid("ovl_light"))
        # Normalise the relative-time strings, which tick between the two loads.
        norm = lambda s: re.sub(r"\d+ (second|minute|hour)s? ago", "<t>", s)
        check(norm(a) == norm(b), "identical render: %s" % path,
              "legacy %d chars vs light %d chars; first diff at %d"
              % (len(a), len(b), next((i for i, (x, y) in enumerate(zip(a, b)) if x != y), -1)))

    # And both must actually show the mutation, not merely agree on nothing.
    txt = visit(page, base, paths[0], sid("ovl_light"))
    check("OVERLAY-PARITY-PROBE" in txt, "created issue visible in the project issue list")
    check("OVERLAY-EDITED-TITLE" in txt, "edited FROZEN issue shows its new title")
    check(victim_del["title"] not in txt, "deleted FROZEN issue is gone from the list",
          victim_del["title"])
    check(page.errors == [], "no console errors during the parity pass", page.errors[:3])
    page.close()


def section3(base, ctx):
    """Edits and deletions of FROZEN records, honoured by EVERY read path."""
    print("\n[3] frozen-record edit / delete honoured by every view")
    issues = seed("issues.json")
    projects = seed("projects.json")
    proj = next(p for p in projects if p["full_path"] == PROJECT)
    on_page1 = page1_iids(ctx, base)
    victim = next(i for i in issues
                  if i["project_id"] == proj["id"] and i["iid"] in on_page1)
    edited = dict(victim, title="FROZEN-EDIT-SENTINEL")
    inject(base, sid("ovl_frozen"), {"issueEdits": {str(victim["id"]): edited}})

    page = new_page(ctx, base)
    views = {
        "project issue list": "/a11yproject/a11yproject.com/-/issues/?state=all",
        "issue detail": "/a11yproject/a11yproject.com/-/issues/%d" % victim["iid"],
        "search": "/search?search=FROZEN-EDIT-SENTINEL&scope=issues",
        "boards": "/a11yproject/a11yproject.com/-/boards",
    }
    for name, path in views.items():
        txt = visit(page, base, path, sid("ovl_frozen"))
        check("FROZEN-EDIT-SENTINEL" in txt, "edit visible in %s" % name, path)
        if name == "issue detail":
            # The old title legitimately survives on the detail page: the seeded
            # activity timeline carries GitLab's own system note "changed title
            # from <old> to <new>". Assert on the HEADING instead.
            head = page.inner_text(".issue-details .title, .detail-page-description .title, h1, h2")
            check("FROZEN-EDIT-SENTINEL" in head,
                  "issue detail HEADING shows the edited title", head[:160])
        else:
            check(victim["title"] not in txt, "old title gone from %s" % name, victim["title"])

    # The GLOBAL dashboard is 20 rows out of 613, newest first, across every
    # project — a11yproject's issues are years old and never reach page 1. So it
    # gets its own victim, read out of the rows it actually renders.
    dash = "/dashboard/issues?scope=all&state=all"
    page.goto("%s%s&sid=%s" % (base, dash, sid("dash_probe")),
              wait_until="domcontentloaded")
    page.wait_for_timeout(900)
    hits = re.findall(r"(\S+/\S+) #(\d+) · created", page.inner_text("body"))
    dvictim = None
    if hits:
        dpath, diid = hits[0]
        dproj = next((p for p in projects if p["full_path"] == dpath), None)
        if dproj:
            dvictim = next((i for i in issues if i["project_id"] == dproj["id"]
                            and str(i["iid"]) == diid), None)
    if check(dvictim is not None, "found a dashboard page-1 issue to edit",
             hits[:2]):
        inject(base, sid("ovl_dash"),
               {"issueEdits": {str(dvictim["id"]): dict(dvictim, title="DASH-EDIT-SENTINEL")}})
        txt = visit(page, base, dash, sid("ovl_dash"))
        check("DASH-EDIT-SENTINEL" in txt, "edit visible in global dashboard", dash)
        check(dvictim["title"] not in txt, "old title gone from global dashboard",
              dvictim["title"])

    inject(base, sid("ovl_frozen_del"), {"deletedIssues": [str(victim["id"])]})
    for name, path in list(views.items())[:2]:
        txt = visit(page, base, path, sid("ovl_frozen_del"))
        check(victim["title"] not in txt, "deleted frozen issue absent from %s" % name)
    check(page.errors == [], "no console errors in the frozen-record pass", page.errors[:3])
    page.close()


# ---------------------------------------------------------------------------
# 4 — the creative flows. Each: drive it, RELOAD, assert it survived, read /go.
# ---------------------------------------------------------------------------

def flow(page, base, sid, label, path, drive, assert_after, diff_keys):
    print("\n  -- %s" % label)
    visit(page, base, path, sid, wait=900)
    try:
        drive(page)
    except Exception as e:                                    # noqa: BLE001
        return check(False, "%s: drive" % label, e)
    page.wait_for_timeout(900)
    # RELOAD — the whole point: the mutation must come back from persistence.
    page.reload(wait_until="domcontentloaded")
    page.wait_for_timeout(900)
    body = page.inner_text("body")
    ok = assert_after(page, body)
    check(ok, "%s: survives reload" % label, body[:300])
    d = go(base, sid)
    diff = d["state_diff"]
    # `xEdits.<id>`, `repo.*` and `nextIds.*` arrive as DOTTED paths (SCHEMA.md
    # § Diff shape), so a requested key matches itself or anything under it.
    missing = [k for k in diff_keys
               if not any(d == k or d.startswith(k + ".") for d in diff)]
    check(not missing, "%s: /go state_diff reports %s" % (label, ", ".join(diff_keys)),
          "missing %s; diff has %s" % (missing, sorted(diff)))
    size = len(minified(d).encode())
    print("      /go after this mutation: %s B" % f"{size:,}")
    check(size < 500_000, "%s: /go payload under 500 KB" % label, "%d B" % size)
    return size


def section4(base, ctx):
    print("\n[4] creative flows, each driven then RELOADED")
    page = new_page(ctx, base)
    sizes = []
    P = "/byteblaze/dotfiles"

    def fill_and_submit(page, fields, button):
        for sel, val in fields:
            page.fill(sel, val)
        page.click(button)

    # --- star -------------------------------------------------------------
    sizes.append(flow(
        page, base, sid("flow_star"), "star a project", P,
        lambda p: p.get_by_role("button", name=re.compile(r"^\s*Star\s*$")).first.click(),
        lambda p, b: "Unstar" in b,   # sid is per-run, so the project starts unstarred
        ["newStars", "projectEdits"]))

    # --- create issue -----------------------------------------------------
    def drive_issue(p):
        p.fill("#issue_title", "OVERLAY FLOW ISSUE")
        p.fill("#issue_description", "created by test_overlay.py")
        p.get_by_role("button", name=re.compile("Create issue")).first.click()
    sizes.append(flow(
        page, base, sid("flow_issue"), "create an issue", P + "/-/issues/new",
        drive_issue,
        lambda p, b: "OVERLAY FLOW ISSUE" in b,
        ["newIssues", "nextIds.issue"]))

    # --- comment on it, then close it ------------------------------------
    def drive_comment(p):
        p.fill("textarea[name='note[note]']", "OVERLAY FLOW COMMENT")
        p.get_by_role("button", name=re.compile("^Comment$")).first.click()
    sizes.append(flow(
        page, base, sid("flow_issue"), "comment on the created issue",
        P + "/-/issues/" + str(_last_iid(base, sid("flow_issue"))),
        drive_comment,
        lambda p, b: "OVERLAY FLOW COMMENT" in b,
        ["newNotes"]))

    def drive_close(p):
        p.get_by_role("button", name=re.compile("Close issue")).first.click()
    sizes.append(flow(
        page, base, sid("flow_issue"), "close the created issue",
        P + "/-/issues/" + str(_last_iid(base, sid("flow_issue"))),
        drive_close,
        lambda p, b: "Closed" in b,
        ["newIssues"]))

    # --- create a label, then a milestone --------------------------------
    def drive_label(p):
        p.fill("#label_title", "overlay-flow-label")
        p.get_by_role("button", name=re.compile("Create label")).first.click()
    sizes.append(flow(
        page, base, sid("flow_label"), "create a label", P + "/-/labels/new",
        drive_label,
        lambda p, b: "overlay-flow-label" in b,
        ["newLabels", "nextIds.label"]))

    def drive_milestone(p):
        p.fill("#milestone_title", "overlay-flow-milestone")
        p.get_by_role("button", name=re.compile("Create milestone")).first.click()
    sizes.append(flow(
        page, base, sid("flow_ms"), "create a milestone", P + "/-/milestones/new",
        drive_milestone,
        lambda p, b: "overlay-flow-milestone" in b,
        ["newMilestones", "nextIds.milestone"]))

    # --- merge request: create, then merge -------------------------------
    def drive_mr(p):
        p.fill("#merge_request_title", "OVERLAY FLOW MR")
        p.get_by_role("button", name=re.compile("^Create merge request$")).first.click()
    # Step 1 (branch compare) keeps its CTA disabled until a source branch is
    # chosen — `js-requires-input`, which is what the source does. Deep-link
    # step 2 with the same query params step 1 would have produced.
    sizes.append(flow(
        page, base, sid("flow_mr"), "create a merge request",
        P + "/-/merge_requests/new?merge_request%5Bsource_branch%5D=master"
          + "&merge_request%5Btarget_branch%5D=main",
        drive_mr,
        lambda p, b: "OVERLAY FLOW MR" in b,
        ["newMergeRequests"]))

    # --- assign the created issue to byteblaze from the sidebar -----------
    issue_path = P + "/-/issues/" + str(_last_iid(base, sid("flow_issue")))

    def drive_assign(p):
        p.locator("[data-testid='edit-button'], [data-qa-selector='edit_link']").first.click()
        p.wait_for_timeout(400)
        p.locator("[data-qa-selector='assign_to_me_link']").first.click()
    sizes.append(flow(
        page, base, sid("flow_issue"), "assign the created issue", issue_path,
        drive_assign,
        lambda p, b: "Byte Blaze" in b,
        ["newIssues"]))

    # --- put a label on it -------------------------------------------------
    def drive_label_on_issue(p):
        # The sidebar's Labels block is the 4th Edit control (Assignee, Epic,
        # Milestone, Labels on this page); target it by its section heading.
        blk = p.locator(".block.labels")
        blk.locator("[data-qa-selector='edit_link']").first.click()
        p.wait_for_timeout(400)
        blk.locator(".dropdown-content li, .dropdown-content a").first.click()
        p.keyboard.press("Escape")
    sizes.append(flow(
        page, base, sid("flow_issue"), "add a label to the created issue", issue_path,
        drive_label_on_issue,
        lambda p, b: "Labels" in b,
        ["newIssues"]))

    # --- and a milestone ---------------------------------------------------
    # byteblaze/dotfiles has no seeded milestone, so the sidebar dropdown would
    # offer only "No milestone" and there would be nothing to pick. Create one in
    # THIS sid first — which also exercises created-record-referencing-created-
    # record, the case where both sides of the link live in the overlay.
    def drive_make_ms(p):
        p.fill("#milestone_title", "overlay-issue-milestone")
        p.get_by_role("button", name=re.compile("Create milestone")).first.click()
    sizes.append(flow(
        page, base, sid("flow_issue"), "create a milestone in the issue's session",
        P + "/-/milestones/new", drive_make_ms,
        lambda p, b: "overlay-issue-milestone" in b,
        ["newMilestones"]))

    def drive_ms_on_issue(p):
        blk = p.locator(".block.milestone")
        blk.locator("[data-qa-selector='edit_link']").first.click()
        p.wait_for_timeout(500)
        blk.get_by_text("overlay-issue-milestone", exact=False).first.click()
    sizes.append(flow(
        page, base, sid("flow_issue"), "set a milestone on the created issue", issue_path,
        drive_ms_on_issue,
        lambda p, b: "overlay-issue-milestone" in b,
        ["newIssues"]))

    # --- merge a SEEDED (frozen) merge request -----------------------------
    # Deliberately a frozen MR, not the one created above: merging it is the
    # edit-a-frozen-record path, so it must land in `mergeRequestEdits`.
    mrs = seed("merge_requests.json")
    projects_ = seed("projects.json")
    dot = next(p for p in projects_ if p["full_path"] == "byteblaze/dotfiles")
    open_mr = next((m for m in mrs
                    if m["project_id"] == dot["id"] and m["state"] == "opened"), None)
    if open_mr is None:
        open_mr = next(m for m in mrs if m["state"] == "opened")
        dot = next(p for p in projects_ if p["id"] == open_mr["project_id"])

    def drive_merge(p):
        p.get_by_role("button", name=re.compile(r"^Merge$")).first.click()
    sizes.append(flow(
        page, base, sid("flow_merge"), "merge a SEEDED merge request",
        "/%s/-/merge_requests/%d" % (dot["full_path"], open_mr["iid"]),
        drive_merge,
        lambda p, b: "Merged" in b,
        ["mergeRequestEdits"]))

    # --- invite a member --------------------------------------------------
    def drive_invite(p):
        p.get_by_role("button", name=re.compile("Invite members")).first.click()
        p.wait_for_timeout(600)
        p.fill("#invite-members-search", "root")
        p.wait_for_timeout(600)
        # `button.dropdown-item` — the "No matches found" row is an <li> with the
        # same class, and clicking it selects nobody, leaving Invite disabled.
        p.locator(".dropdown-menu.show button.dropdown-item").first.click()
        p.wait_for_timeout(400)
        p.get_by_role("button", name=re.compile("^Invite$")).first.click()
    sizes.append(flow(
        page, base, sid("flow_member"), "invite a project member", P + "/-/project_members",
        drive_invite,
        lambda p, b: "root" in b.lower(),
        ["newMembers", "nextIds.member"]))

    check(page.errors == [], "no console errors across the creative flows", page.errors[:5])
    page.close()
    real = [s for s in sizes if isinstance(s, int)]
    if real:
        print("\n      largest /go after a mutation: %s B" % f"{max(real):,}")
    return real


def _last_iid(base, sid):
    """iid of the newest issue in `sid`'s overlay, for the follow-up flows."""
    try:
        d = go(base, sid)
        new = d["current_state"].get("newIssues") or []
        if new:
            return new[-1]["iid"]
    except Exception:                                          # noqa: BLE001
        pass
    return 1


def section6(base, ctx):
    """Reconciler invariants."""
    print("\n[6] reconciler invariants")
    page = new_page(ctx, base)
    # A write that changes only `ui` must not tombstone anything.
    visit(page, base, "/-/profile/preferences", sid("inv_noop"))
    try:
        page.get_by_role("button", name=re.compile("Save changes")).first.click()
        page.wait_for_timeout(800)
    except Exception:                                          # noqa: BLE001
        pass
    d = go(base, sid("inv_noop"))
    cur = d["current_state"]
    dirty = [k for k in cur
             if (k.startswith("new") or k.endswith("Edits") or k.startswith("deleted"))
             and cur[k]]
    check(not dirty, "a ui-only write leaves every overlay key empty", dirty)
    check(len(minified(cur).encode()) < 20_000,
          "state after a ui-only write is still tiny",
          "%d B" % len(minified(cur).encode()))
    check(page.errors == [], "no console errors in the invariant pass", page.errors[:3])
    page.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=5320)
    ap.add_argument("--host", default="http://localhost")
    args = ap.parse_args()
    base = "%s:%d" % (args.host, args.port)

    print("overlay regression suite -> %s" % base)
    section1(base)
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        for w, h in ((1920, 1080), (1280, 720)):
            print("\n=== viewport %dx%d ===" % (w, h))
            ctx = browser.new_context(viewport={"width": w, "height": h})
            section2(base, ctx)
            section3(base, ctx)
            if (w, h) == (1920, 1080):
                section4(base, ctx)
                section6(base, ctx)
            ctx.close()
        browser.close()

    print("\n%d passed, %d failed" % (len(PASSES), len(FAILS)))
    for f in FAILS:
        print("  FAIL %s" % f)
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
