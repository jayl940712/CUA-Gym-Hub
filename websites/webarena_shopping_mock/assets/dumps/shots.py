import sys, os, time
from playwright.sync_api import sync_playwright
BASE="http://10.186.197.203:7770"
OUT="/webarena/CUA-Gym-Hub/websites/webarena_shopping_mock/assets/screenshots/reference"

SHOTS = [
 ("01-home", "/"),
 ("02-category-video-games", "/video-games.html"),
 ("03-category-headphones", "/electronics/headphones.html"),
 ("04-category-headphones-sorted-price-desc", "/electronics/headphones.html?product_list_order=price&product_list_dir=desc"),
 ("05-category-headphones-page2", "/electronics/headphones.html?p=2"),
 ("06-category-mens-shoes-filtered", "/clothing-shoes-jewelry/men/shoes.html?price=0-10%2C0-100"),
 ("07-search-usb-wifi", "/catalogsearch/result/?q=usb+wifi"),
 ("08-search-chairs-sorted-asc", "/catalogsearch/result/index/?product_list_order=price&q=chairs&product_list_dir=asc"),
 ("09-search-no-results", "/catalogsearch/result/?q=asdfghjkl"),
 ("10-advanced-search", "/catalogsearch/advanced/"),
 ("11-product-sceptre-tv", "/sceptre-e195bd-srr-19-inch-720p-led-tv-true-black-2017.html"),
 ("12-product-6s-headphones", "/6s-wireless-headphones-over-ear-noise-canceling-hi-fi-bass-foldable-stereo-wireless-kid-headsets-earbuds-with-built-in-mic-micro-sd-tf-fm-for-iphone-samsung-ipad-pc-black-gold.html"),
 ("13-product-with-options", "/bornbridge-artificial-spiral-topiary-tree-indoor-outdoor-topiary-trees-artificial-outdoor-plants-2-pack-4-cypress.html"),
 ("14-cart", "/checkout/cart/"),
 ("15-account-dashboard", "/customer/account/"),
 ("16-account-edit", "/customer/account/edit/"),
 ("17-address-book", "/customer/address/"),
 ("18-address-edit", "/customer/address/edit/id/26/"),
 ("19-order-history", "/sales/order/history/"),
 ("20-order-view-180", "/sales/order/view/order_id/180/"),
 ("21-order-view-148", "/sales/order/view/order_id/148/"),
 ("22-wishlist", "/wishlist/"),
 ("23-my-reviews", "/review/customer/"),
 ("24-my-downloads", "/downloadable/customer/products/"),
 ("25-newsletter", "/newsletter/manage/"),
 ("26-contact", "/contact/"),
 ("27-404", "/this-page-does-not-exist.html"),
 ("28-checkout", "/checkout/"),
 ("29-category-beauty", "/beauty-personal-care.html"),
 ("30-category-nintendo-switch", "/video-games/nintendo-switch.html"),
]

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width":1440,"height":900}, ignore_https_errors=True)
    pg = ctx.new_page()
    pg.goto(BASE+"/customer/account/login/", wait_until="domcontentloaded", timeout=60000)
    pg.fill("#email","emma.lopez@gmail.com"); pg.fill("#pass","Password.123")
    pg.click("#send2"); pg.wait_for_load_state("domcontentloaded", timeout=60000)
    print("logged in ->", pg.url)
    for name, path in SHOTS:
        try:
            pg.goto(BASE+path, wait_until="domcontentloaded", timeout=60000)
            pg.wait_for_timeout(2500)
            pg.screenshot(path=os.path.join(OUT, name+".png"), full_page=True)
            print("ok", name, pg.url)
        except Exception as e:
            print("FAIL", name, repr(e)[:160])
    b.close()
