"""Capture GitLab pages: HTML + screenshot. Usage: cap.py <listfile>
listfile lines:  <slug>\t<path>[\tshot]
"""
import sys, os, re, json
from playwright.sync_api import sync_playwright

BASE = "http://localhost:8023"
HTML = "/webarena/CUA-Gym-Hub/websites/webarena_gitlab_mock/assets/html"
SHOT = "/webarena/CUA-Gym-Hub/websites/webarena_gitlab_mock/assets/screenshots/reference"
os.makedirs(HTML, exist_ok=True); os.makedirs(SHOT, exist_ok=True)

items = []
for line in open(sys.argv[1]):
    line = line.rstrip("\n")
    if not line.strip() or line.startswith("#"): continue
    parts = line.split("\t")
    items.append((parts[0], parts[1], len(parts) > 2 and parts[2] == "shot"))

results = []
with sync_playwright() as p:
    b = p.chromium.launch(args=["--no-sandbox"])
    ctx = b.new_context(viewport={"width": 1920, "height": 1080},
                        storage_state="/tmp/recon/gitlab/state.json")
    pg = ctx.new_page()
    for slug, path, shot in items:
        try:
            r = pg.goto(BASE + path, wait_until="domcontentloaded", timeout=45000)
            pg.wait_for_timeout(2500)
            status = r.status if r else None
            open(f"{HTML}/{slug}.html", "w").write(pg.content())
            if shot:
                pg.screenshot(path=f"{SHOT}/{slug}.png", full_page=False)
            results.append({"slug": slug, "path": path, "status": status,
                            "final_url": pg.url, "title": pg.title()})
            print(f"{status} {path} -> {pg.url}  | {pg.title()}")
        except Exception as e:
            print(f"ERR {path}: {type(e).__name__} {e}")
            results.append({"slug": slug, "path": path, "error": str(e)[:200]})
    b.close()
json.dump(results, open(sys.argv[1] + ".json", "w"), indent=1)
