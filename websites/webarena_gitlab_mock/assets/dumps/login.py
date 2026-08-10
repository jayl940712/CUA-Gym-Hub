import json, os, sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:8023"
OUT = "/tmp/recon/gitlab/state.json"

with sync_playwright() as p:
    b = p.chromium.launch(args=["--no-sandbox"])
    ctx = b.new_context(viewport={"width":1920,"height":1080}, ignore_https_errors=True)
    pg = ctx.new_page()
    pg.goto(BASE + "/users/sign_in", wait_until="domcontentloaded", timeout=60000)
    pg.fill("#user_login", "byteblaze")
    pg.fill("#user_password", "hello1234")
    pg.click("input[type=submit][data-qa-selector=sign_in_button], button[type=submit]")
    pg.wait_for_load_state("domcontentloaded", timeout=60000)
    pg.wait_for_timeout(3000)
    print("URL after login:", pg.url)
    print("TITLE:", pg.title())
    ctx.storage_state(path=OUT)
    print("saved", OUT)
    b.close()
