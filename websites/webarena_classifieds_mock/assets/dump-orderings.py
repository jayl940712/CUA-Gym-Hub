#!/usr/bin/env python3
"""Capture the source's REAL result ordering, page by page.

Why this is not a simple `ORDER BY` dump
----------------------------------------
Osclass sorts by `i_price` or `dt_pub_date` with **no tie-break**, and thousands of items
share a price. MySQL's order inside a tie group is whatever the chosen plan produces, and
measurement shows it changes with the LIMIT:

    cat 11, i_price ASC, first 12 rows
      LIMIT 12          -> 19982 66339 20278 9379 …   (matches the live site)
      no LIMIT          -> 9379 15619 19982 20278 …   (does not)
      via iPagesize=50  -> 19982 66339 4696 7915 …    (does not)

So there is no single stable total order to capture. The only faithful reproduction is to
issue the site's own query once per page, with `LIMIT 12 OFFSET n`.

This matters because ~12 tasks are phrased "the item **on this page**" against URLs as
deep as `iPage=331` — the page contents *are* the answer.

The other load-bearing detail is `SELECT oc_t_item.*`: selecting only `pk_i_id` lets
MySQL use a covering index and yields a different tie order.

Read-only: SELECT only. Writes assets/dumps/orderings.json.
"""
import json, os, subprocess, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "dumps", "orderings.json")
PAGE = 12
GLOBAL_PAGES = 200          # no anchor route pages the all-categories listing this deep

SORTS = [("newest", "dt_pub_date", "DESC"),
         ("priceAsc", "i_price", "ASC"),
         ("priceDesc", "i_price", "DESC")]

SELECT = "SELECT oc_t_item.*, oc_t_item.s_contact_name as s_user_name FROM oc_t_item"
FILTER = "oc_t_item.b_enabled=1 AND oc_t_item.b_active=1"


def run_batch(statements):
    """Feed many statements to one mysql session; return stdout."""
    script = "\n".join(statements)
    p = subprocess.run(
        ["docker", "exec", "-i", "classifieds_db", "mysql", "-uroot", "-ppassword",
         "osclass", "-Nsr"],
        input=script.encode(), capture_output=True)
    if p.returncode:
        sys.exit(p.stderr.decode()[-3000:])
    return p.stdout.decode("utf-8", "replace")


def paged(where, col, direction, total):
    """Issue one LIMIT 12 OFFSET n query per page, exactly as the site does."""
    stmts = []
    npages = (total + PAGE - 1) // PAGE
    for pg in range(npages):
        stmts.append("SELECT '@@%d';" % pg)
        stmts.append("%s WHERE %s AND %s ORDER BY oc_t_item.%s %s LIMIT %d OFFSET %d;"
                     % (SELECT, where, FILTER, col, direction, PAGE, pg * PAGE))
    seq, seen_marker = [], False
    for chunk in range(0, len(stmts), 4000):
        for line in run_batch(stmts[chunk:chunk + 4000]).splitlines():
            if line.startswith("@@"):
                seen_marker = True
                continue
            if not seen_marker or not line.strip():
                continue
            head = line.split("\t", 1)[0]
            if head.isdigit():
                seq.append(int(head))
    return seq


def main():
    cats = [c["id"] for c in
            (json.loads(l) for l in open(os.path.join(ROOT, "assets/dumps/categories.jsonl")))]
    counts = {}
    for line in run_batch(["SELECT fk_i_category_id, COUNT(*) FROM oc_t_item "
                           "WHERE %s GROUP BY 1;" % FILTER]).splitlines():
        if "\t" in line:
            a, b = line.split("\t")
            counts[int(a)] = int(b)
    total_all = sum(counts.values())

    out = {"pageSize": PAGE, "byCategory": {}, "global": {},
           "globalPagesCaptured": GLOBAL_PAGES}
    t0 = time.time()
    for cat in sorted(cats):
        n = counts.get(cat, 0)
        out["byCategory"][str(cat)] = {}
        for key, col, d in SORTS:
            seq = paged("oc_t_item.fk_i_category_id IN (%d)" % cat, col, d, n)
            if len(seq) != n:
                sys.exit("cat %d/%s: got %d ids, expected %d" % (cat, key, len(seq), n))
            out["byCategory"][str(cat)][key] = seq
        print("cat %2d: %5d items  (%.0fs elapsed)" % (cat, n, time.time() - t0), flush=True)

    for key, col, d in SORTS:
        out["global"][key] = paged("1=1", col, d, min(total_all, GLOBAL_PAGES * PAGE))
        print("global %s: %d ids" % (key, len(out["global"][key])), flush=True)

    with open(OUT, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print("wrote %s (%.1f MB, %.0fs)" % (OUT, os.path.getsize(OUT) / 1e6, time.time() - t0))


if __name__ == "__main__":
    main()
