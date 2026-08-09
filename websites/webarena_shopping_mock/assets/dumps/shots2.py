import os
from playwright.sync_api import sync_playwright
BASE="http://10.186.197.203:7770"
OUT="/webarena/CUA-Gym-Hub/websites/webarena_shopping_mock/assets/screenshots/reference"
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={"width":1440,"height":900}); pg=ctx.new_page()
    pg.goto(BASE+"/customer/account/login/",wait_until="domcontentloaded",timeout=60000)
    pg.fill("#email","emma.lopez@gmail.com"); pg.fill("#pass","Password.123"); pg.click("#send2")
    pg.wait_for_load_state("domcontentloaded",timeout=60000)
    # reviews tab
    pg.goto(BASE+"/6s-wireless-headphones-over-ear-noise-canceling-hi-fi-bass-foldable-stereo-wireless-kid-headsets-earbuds-with-built-in-mic-micro-sd-tf-fm-for-iphone-samsung-ipad-pc-black-gold.html",wait_until="domcontentloaded",timeout=60000)
    pg.wait_for_timeout(2500); pg.click("#tab-label-reviews-title"); pg.wait_for_timeout(3500)
    pg.screenshot(path=OUT+"/31-product-reviews-tab.png",full_page=True); print("ok reviews tab")
    # mega menu
    pg.goto(BASE+"/",wait_until="domcontentloaded",timeout=60000); pg.wait_for_timeout(2000)
    pg.hover("li.level0.category-item:has-text(\"Beauty & Personal Care\") > a"); pg.wait_for_timeout(1500)
    pg.screenshot(path=OUT+"/32-nav-megamenu-open.png",clip={"x":0,"y":0,"width":1440,"height":700}); print("ok menu")
    # minicart
    pg.click(".action.showcart"); pg.wait_for_timeout(3000)
    pg.screenshot(path=OUT+"/33-minicart-open.png",clip={"x":0,"y":0,"width":1440,"height":900}); print("ok minicart")
    # home page 2
    pg.goto(BASE+"/?p=2",wait_until="domcontentloaded",timeout=60000); pg.wait_for_timeout(2500)
    pg.screenshot(path=OUT+"/34-home-page2.png",full_page=True); print("ok home p2")
    # list view of category
    pg.goto(BASE+"/electronics/headphones.html?product_list_mode=list",wait_until="domcontentloaded",timeout=60000); pg.wait_for_timeout(2500)
    pg.screenshot(path=OUT+"/35-category-list-view.png",full_page=True); print("ok list view")
    # search autocomplete
    pg.goto(BASE+"/",wait_until="domcontentloaded",timeout=60000); pg.wait_for_timeout(1500)
    pg.fill("#search","head"); pg.wait_for_timeout(3000)
    pg.screenshot(path=OUT+"/36-search-autocomplete.png",clip={"x":0,"y":0,"width":1440,"height":500}); print("ok autocomplete")
    b.close()
