#!/usr/bin/env python3
"""Extract the WebArena task contract for one site into task_anchors.{json,md}.

A WebArena task is scored by its evaluator, not by how the page looks. Three
evaluator families appear in webarena.jsonl:

  url_match     the agent must END on a specific URL
  string_match  the agent's answer must contain specific strings
  program_html  a named page must contain specific strings, optionally under a
                DOM locator

Every URL and every string those evaluators name is an *anchor*: a value the
mock must reproduce exactly or the task becomes unpassable. Everything else in
the seed data is free to drift. This script turns the raw task file into that
anchor list so the playwright agent can test capability instead of diffing
every record on the page.

Usage:
    python3 shared/extract-task-anchors.py --site reddit
    python3 shared/extract-task-anchors.py --site shopping_admin --out-dir websites/webarena_shopping_admin_mock/assets
    python3 shared/extract-task-anchors.py --site gitlab --jsonl /webarena/webarena.jsonl --quiet

Site name maps to the placeholder WebArena uses in the task file:
    shopping -> __SHOPPING__, shopping_admin -> __SHOPPING_ADMIN__, etc.
"""

import argparse
import json
import os
import re
import sys
from collections import Counter, defaultdict

PLACEHOLDER_RE = re.compile(r"__[A-Z0-9_]+__")


def placeholder_for(site):
    """reddit -> __REDDIT__ ; shopping_admin -> __SHOPPING_ADMIN__"""
    return "__%s__" % site.upper()


def as_list(value):
    """web_name, web, and reference_url are sometimes str, sometimes list, sometimes None."""
    if value is None:
        return []
    return value if isinstance(value, list) else [value]


def flatten_strings(value):
    """must_include entries nest one level: ["a", ["b", "b-alt"]] means b OR b-alt."""
    if isinstance(value, str):
        yield value
    elif isinstance(value, list):
        for item in value:
            yield from flatten_strings(item)


def split_url(raw, placeholder):
    """Return (owner_placeholder, path). 'last' and 'func:...' are not real URLs."""
    if not isinstance(raw, str) or not raw:
        return None, None
    if raw == "last" or raw.startswith("func:"):
        return None, raw
    found = PLACEHOLDER_RE.findall(raw)
    owner = found[0] if found else None
    path = PLACEHOLDER_RE.sub("", raw, count=1)
    if not path.startswith("/"):
        path = "/" + path
    return owner, path or "/"


def extract(rows, site):
    placeholder = placeholder_for(site)
    tasks = []
    counts = Counter()

    for row in rows:
        if site not in as_list(row.get("web_name")):
            continue
        ev = row.get("eval") or {}
        eval_types = ev.get("eval_types") or []
        counts.update(eval_types)

        start_urls = []
        for raw in as_list(row.get("web")):
            owner, path = split_url(raw, placeholder)
            if path and owner == placeholder:
                start_urls.append(path)

        url_anchors = []
        for raw in as_list(ev.get("reference_url")):
            owner, path = split_url(raw, placeholder)
            if path and owner == placeholder:
                url_anchors.append(path)

        # string_match: the agent's stated answer is compared against these.
        # fuzzy_match is judged by an LLM, so it is a soft anchor, not an exact one.
        string_anchors, soft_anchors = [], []
        ref = ev.get("reference_answers")
        if isinstance(ref, dict):
            for kind in ("must_include", "exact_match"):
                for value in flatten_strings(ref.get(kind)):
                    string_anchors.append({"value": value, "kind": kind})
            for value in flatten_strings(ref.get("fuzzy_match")):
                soft_anchors.append({"value": value, "kind": "fuzzy_match"})

        # program_html: page content assertions. url == "last" means whatever page
        # the agent finished on, so the anchor binds to content, not to a route.
        page_anchors = []
        for entry in ev.get("program_html") or []:
            owner, path = split_url(entry.get("url"), placeholder)
            if path and path not in ("last",) and not path.startswith("func:") and owner != placeholder:
                continue  # assertion targets another site in a multi-site task
            required = entry.get("required_contents") or {}
            values = []
            for kind in ("must_include", "exact_match"):
                for value in flatten_strings(required.get(kind)):
                    values.append({"value": value, "kind": kind})
            if not values:
                continue
            page_anchors.append({
                "page": path or "last",
                "locator": entry.get("locator") or "",
                "required": values,
            })

        others = [w for w in as_list(row.get("web_name")) if w != site]
        tasks.append({
            "id": row.get("id"),
            "question": row.get("ques"),
            "eval_types": eval_types,
            "start_urls": start_urls,
            "url_anchors": url_anchors,
            "string_anchors": string_anchors,
            "soft_anchors": soft_anchors,
            "page_anchors": page_anchors,
            "also_needs_sites": others,
        })

    return tasks, counts


def build_indexes(tasks):
    """Invert task -> anchors into anchor -> tasks, which is what a tester wants."""
    routes = defaultdict(set)
    strings = defaultdict(lambda: {"kinds": set(), "tasks": set(), "pages": set()})
    locators = defaultdict(set)

    for task in tasks:
        tid = task["id"]
        for path in task["start_urls"]:
            routes[path].add(tid)
        for path in task["url_anchors"]:
            routes[path].add(tid)
        for anchor in task["string_anchors"]:
            entry = strings[anchor["value"]]
            entry["kinds"].add(anchor["kind"])
            entry["tasks"].add(tid)
            entry["pages"].add("(answer)")
        for page in task["page_anchors"]:
            if page["page"] and page["page"] != "last" and not page["page"].startswith("func:"):
                routes[page["page"]].add(tid)
            if page["locator"]:
                locators[page["locator"]].add(tid)
            for anchor in page["required"]:
                entry = strings[anchor["value"]]
                entry["kinds"].add(anchor["kind"])
                entry["tasks"].add(tid)
                entry["pages"].add(page["page"] or "last")

    return (
        [{"path": p, "task_ids": sorted(t)} for p, t in sorted(routes.items())],
        [{"value": v, "kinds": sorted(d["kinds"]), "pages": sorted(d["pages"]),
          "task_ids": sorted(d["tasks"])} for v, d in sorted(strings.items())],
        [{"locator": l, "task_ids": sorted(t)} for l, t in sorted(locators.items())],
    )


def write_markdown(path, site, tasks, counts, routes, strings, locators):
    def escape(text):
        return str(text).replace("|", "\\|").replace("\n", " ")

    lines = [
        "# %s — WebArena Task Anchors" % site,
        "",
        "> Generated by `shared/extract-task-anchors.py` from `webarena.jsonl`.",
        "> Regenerate rather than editing by hand.",
        "",
        "**%d tasks** target this site: %s." % (
            len(tasks),
            ", ".join("%s %s" % (n, k) for k, n in sorted(counts.items())) or "none",
        ),
        "",
        "An anchor is a URL or string a task's evaluator compares against. Reproduce",
        "anchors exactly. Records that appear in no anchor may drift — sample them for",
        "shape and move on.",
        "",
        "## Anchor Routes (%d)" % len(routes),
        "",
        "Every one must resolve in the mock and render the matching record.",
        "",
        "| Path | Tasks |",
        "|---|---|",
    ]
    for route in routes:
        ids = route["task_ids"]
        shown = ", ".join(ids[:6]) + (" +%d more" % (len(ids) - 6) if len(ids) > 6 else "")
        lines.append("| `%s` | %s |" % (escape(route["path"]), shown))

    lines += [
        "",
        "## Anchor Strings (%d)" % len(strings),
        "",
        "Each must appear verbatim on the page named, or in the answer the site makes",
        "readable. A paraphrase fails the task.",
        "",
        "| String | Kind | Where | Tasks |",
        "|---|---|---|---|",
    ]
    for anchor in strings:
        ids = anchor["task_ids"]
        shown = ", ".join(ids[:4]) + (" +%d more" % (len(ids) - 4) if len(ids) > 4 else "")
        value = escape(anchor["value"])
        if len(value) > 80:
            value = value[:77] + "..."
        lines.append("| `%s` | %s | %s | %s |" % (
            value, ", ".join(anchor["kinds"]), escape(", ".join(anchor["pages"])), shown))

    if locators:
        lines += [
            "",
            "## Anchor Locators (%d)" % len(locators),
            "",
            "`program_html` evaluators run these against the finished page. The DOM they",
            "select must exist in the mock.",
            "",
            "| Locator | Tasks |",
            "|---|---|",
        ]
        for entry in locators:
            loc = escape(entry["locator"])
            if len(loc) > 100:
                loc = loc[:97] + "..."
            lines.append("| `%s` | %s |" % (loc, ", ".join(entry["task_ids"][:4])))

    multi = [t for t in tasks if t["also_needs_sites"]]
    if multi:
        lines += [
            "",
            "## Cross-Site Tasks (%d)" % len(multi),
            "",
            "These also touch another site. Only this site's half is testable here.",
            "",
            "| Task | Also needs | Question |",
            "|---|---|---|",
        ]
        for task in multi:
            lines.append("| %s | %s | %s |" % (
                task["id"], ", ".join(task["also_needs_sites"]), escape(task["question"])[:90]))

    lines.append("")
    with open(path, "w") as handle:
        handle.write("\n".join(lines))


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--site", required=True,
                        help="web_name as it appears in the task file (shopping, gitlab, reddit, map, wikipedia, shopping_admin)")
    parser.add_argument("--jsonl", default="/webarena/webarena.jsonl")
    parser.add_argument("--out-dir", default=None,
                        help="defaults to websites/webarena_<site>_mock/assets")
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args()

    if not os.path.exists(args.jsonl):
        sys.exit("task file not found: %s" % args.jsonl)

    rows = []
    with open(args.jsonl) as handle:
        for number, line in enumerate(handle, 1):
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError as err:
                sys.exit("%s:%d is not valid JSON: %s" % (args.jsonl, number, err))

    known = sorted({w for r in rows for w in as_list(r.get("web_name"))})
    if args.site not in known:
        sys.exit("no tasks for site %r. Known sites: %s" % (args.site, ", ".join(known)))

    tasks, counts = extract(rows, args.site)
    routes, strings, locators = build_indexes(tasks)

    out_dir = args.out_dir or os.path.join("websites", "webarena_%s_mock" % args.site, "assets")
    os.makedirs(out_dir, exist_ok=True)
    json_path = os.path.join(out_dir, "task_anchors.json")
    md_path = os.path.join(out_dir, "task_anchors.md")

    with open(json_path, "w") as handle:
        json.dump({
            "site": args.site,
            "placeholder": placeholder_for(args.site),
            "source": os.path.abspath(args.jsonl),
            "task_count": len(tasks),
            "eval_type_counts": dict(counts),
            "anchor_routes": routes,
            "anchor_strings": strings,
            "anchor_locators": locators,
            "tasks": tasks,
        }, handle, indent=2)

    write_markdown(md_path, args.site, tasks, counts, routes, strings, locators)

    if not args.quiet:
        print("site            : %s (%s)" % (args.site, placeholder_for(args.site)))
        print("tasks           : %d  [%s]" % (
            len(tasks), ", ".join("%s=%d" % (k, v) for k, v in sorted(counts.items()))))
        print("anchor routes   : %d" % len(routes))
        print("anchor strings  : %d" % len(strings))
        print("anchor locators : %d" % len(locators))
        print("wrote           : %s" % json_path)
        print("                  %s" % md_path)


if __name__ == "__main__":
    main()
