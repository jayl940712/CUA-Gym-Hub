import json
from playwright.sync_api import sync_playwright
BASE="http://10.186.197.203:7770"
TARGETS = {
 "body":"body",
 "page-wrapper":".page-wrapper",
 "page-main":".page-main",
 "header.content":".header.content",
 "panel.header":".panel.header",
 "panel.wrapper":".panel.wrapper",
 "logo":".logo",
 "nav.sections":".nav-sections",
 "nav.item.level0>a":".navigation .level0 > .level-top",
 "search input":"#search",
 "search button":"button.action.search",
 "page-title":".page-title .base",
 "breadcrumbs":".breadcrumbs",
 "breadcrumb link":".breadcrumbs a",
 "sidebar":".sidebar-main",
 "filter title":".filter-options-title",
 "filter link":".filter-options-content a",
 "product-item":".product-item",
 "product-item-name a":".product-item-name a",
 "price":".price-box .price",
 "btn tocart":".product-item .action.tocart",
 "rating stars":".rating-result",
 "toolbar amount":".toolbar-amount",
 "sorter select":".sorter-options",
 "pager current":".pages .item.current",
 "pager link":".pages a.page",
 "footer":".page-footer",
 "footer link":".footer.content a",
 "newsletter btn":".block.newsletter .action.subscribe",
 "copyright":".copyright",
}
PRODPAGE = {
 "product title":".page-title .base",
 "product price":".product-info-main .price",
 "add to cart":"#product-addtocart-button",
 "stock":".stock.available",
 "sku":".product.attribute.sku .value",
 "tab label":".product.data.items > .item.title > .switch",
 "tab active":".product.data.items > .item.title.active > .switch",
 "qty input":"#qty",
 "secondary btn":".product-social-links .action.towishlist",
}
PROPS=["color","backgroundColor","fontFamily","fontSize","fontWeight","lineHeight","padding","margin","border","borderRadius","boxShadow","width","maxWidth","height","textTransform","letterSpacing"]
def grab(pg, targets):
    out={}
    for k,sel in targets.items():
        try:
            r=pg.eval_on_selector(sel, """(el,props)=>{const s=getComputedStyle(el);const o={};props.forEach(p=>o[p]=s[p]);const b=el.getBoundingClientRect();o._box=[Math.round(b.width),Math.round(b.height)];return o;}""", PROPS)
            out[k]=r
        except Exception as e:
            out[k]={"ERROR":str(e)[:80]}
    return out
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={"width":1440,"height":900}); pg=ctx.new_page()
    pg.goto(BASE+"/electronics/headphones.html",wait_until="domcontentloaded",timeout=60000); pg.wait_for_timeout(3000)
    res={"category_page":grab(pg,TARGETS)}
    pg.goto(BASE+"/sceptre-e195bd-srr-19-inch-720p-led-tv-true-black-2017.html",wait_until="domcontentloaded",timeout=60000); pg.wait_for_timeout(3000)
    res["product_page"]=grab(pg,PRODPAGE)
    res["links"]=pg.evaluate("""()=>{const a=document.querySelector('.footer.content a');const s=getComputedStyle(a);return {color:s.color};}""")
    b.close()
json.dump(res,open("/tmp/recon/shopping/tokens.json","w"),indent=1)
print(json.dumps(res,indent=1)[:200])
