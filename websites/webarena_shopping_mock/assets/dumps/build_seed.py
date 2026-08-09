import json, re, os, html, collections
# SEED_OUT lets a dev regenerate into a scratch dir and diff before copying
# individual files across. Seeds are owned by different agents in a sharded
# round, so a blind full-tree overwrite clobbers concurrent work.
OUT=os.environ.get("SEED_OUT") or "/webarena/CUA-Gym-Hub/websites/webarena_shopping_mock/src/data"
os.makedirs(OUT, exist_ok=True)
R="/tmp/recon/shopping"
DUMPS="/webarena/CUA-Gym-Hub/websites/webarena_shopping_mock/assets/dumps"

def jl(p):
    return [json.loads(l) for l in open(p, encoding='utf8')]

def num(v):
    if v is None: return None
    f=float(v)
    return int(f) if f==int(f) else round(f,4)

# ---------- categories ----------
cats=[]
for c in jl(f"{R}/categories.jsonl"):
    if c['entity_id'] in (1,2):
        continue
    cats.append({
      "id": c['entity_id'], "parentId": c['parent_id'], "name": c['name'],
      "urlKey": c['url_key'], "urlPath": c['url_path'], "level": c['level'],
      "position": c['position'], "childrenCount": c['children_count'],
      "isActive": bool(c['is_active']), "includeInMenu": bool(c['include_in_menu']),
      "dbProductCount": int(c['product_count']),
    })
json.dump(cats, open(f"{OUT}/categories.json","w"), separators=(',',':'))

# ---------- products ----------
gallery=collections.defaultdict(list)
for g in jl(f"{R}/product_gallery.jsonl"):
    if not g['disabled']:
        gallery[g['product_id']].append((g['position'] or 0, g['value']))
prods={}
for p in jl(f"{R}/products_raw.jsonl"):
    pid=p['entity_id']
    imgs=[v for _,v in sorted(gallery.get(pid,[]))]
    prods[pid]={
      "id": pid, "sku": p['sku'], "typeId": p['type_id'],
      "name": p['name'], "urlKey": p['url_key'],
      "price": num(p['price']), "specialPrice": num(p['special_price']),
      "image": p['image'], "smallImage": p['small_image'], "thumbnail": p['thumbnail'],
      "gallery": imgs,
      "status": p['status'], "visibility": p['visibility'],
      "qty": num(p['qty']), "inStock": bool(p['is_in_stock']),
      "ratingSummary": p['rating_summary'], "reviewsCount": p['reviews_count'] or 0,
      "categoryIds": [int(x) for x in (p['categories'] or '').split(',') if x],
      "createdAt": p['created_at'],
    }
json.dump(list(prods.values()), open(f"{OUT}/products.json","w"), separators=(',',':'))

# ---------- product options ----------
opts=collections.defaultdict(list)
for o in jl(f"{R}/product_options.jsonl"):
    vals=sorted(o['values'] or [], key=lambda v:(v['sort_order'] or 0, v['option_type_id']))
    opts[o['product_id']].append({
      "optionId": o['option_id'], "title": o['title'], "type": o['type'],
      "isRequire": bool(o['is_require']), "sortOrder": o['sort_order'],
      "values": [{"optionTypeId":v['option_type_id'], "title":v['title'],
                  "price":num(v['price']), "priceType":v['price_type']} for v in vals],
    })
json.dump({str(k):sorted(v,key=lambda x:x['sortOrder']) for k,v in opts.items()},
          open(f"{OUT}/productOptions.json","w"), separators=(',',':'))

# ---------- descriptions ----------
# NO TRUNCATION. Descriptions are carried over from the container verbatim,
# minus what clean_desc.clean() has to remove to keep the mock offline.
#
# History (AUDIT PARITY-001): this step used to cap descriptions at 600 chars
# (5 000 for a hand-picked "priority" id list). That cut 829 of 1 105 records,
# frequently mid-word — product 76401 kept 597 of 19 819 chars and ended at
# "…This product is 3D-related. To help"; product 99660 kept only carousel
# chrome and zero prose. WebArena tasks mine description text ("what material
# is X", "does the description mention Y"), so a cap makes them unanswerable
# and the mid-word cut is visible on screen. The corpus is ~3.5 MB of cleaned
# HTML and lives OUTSIDE createInitialData() — utils/catalog.js imports it
# statically and it never enters app state, so the /go diff budget is
# unaffected; only the JS bundle grows. Do not reintroduce a cap without
# recording it in SOURCE.md's declared gaps.
import clean_desc
# descriptions.jsonl is mirrored into assets/dumps/ because /tmp/recon is
# volatile; prefer the durable copy, fall back to the recon scratch dir.
_desc_src = f"{DUMPS}/descriptions.jsonl"
if not os.path.exists(_desc_src): _desc_src = f"{R}/descriptions.jsonl"
desc={}
for d in jl(_desc_src):
    desc[str(d['entity_id'])]=clean_desc.clean(d['description'])
json.dump(desc, open(f"{OUT}/productDescriptions.json","w"), separators=(',',':'))
print("descriptions", len(desc), "records,",
      sum(len(v) for v in desc.values()), "chars (uncapped)")

# ---------- reviews ----------
byprod=collections.defaultdict(list)
for r in jl(f"{R}/reviews.jsonl"):
    byprod[r['product_id']].append(r)
reviews=[]
# Keep every approved review. The dump is only 3 210 rows (the SQL already
# filters status_id=1), so the old `rs[:12]` cap for non-priority products
# saved ~130 rows while leaving six products whose "Reviews (N)" tab printed
# the source summary (112, 23, 16, 17, 13, 21) over a list that paginated only
# 12 rows.
for pid, rs in byprod.items():
    rs.sort(key=lambda r: r['created_at'], reverse=True)
    for r in rs:
        reviews.append({
          "reviewId": r['review_id'], "productId": pid,
          "title": r['title'], "detail": r['detail'], "nickname": r['nickname'],
          "customerId": r['customer_id'], "rating": r['rating'],
          "createdAt": r['created_at'],
        })
reviews.sort(key=lambda r:(r['productId'], -r['reviewId']))
json.dump(reviews, open(f"{OUT}/reviews.json","w"), separators=(',',':'))

# ---------- orders ----------
items=collections.defaultdict(list)
for it in jl(f"{DUMPS}/order_items.jsonl"):
    po=None
    try: po=json.loads(it['product_options']) if it['product_options'] else None
    except Exception: po=None
    # sales_order_item.product_options is a serialized blob whose option labels
    # and values are stored HTML-ESCAPED by Magento, while the sibling `name`
    # column is not. The source template then escapes again on output, so the
    # browser shows the DECODED text: order 148 renders `4' Boxwood` for the
    # stored `4&#039; Boxwood`, order 156 renders `75" X 48"` for the stored
    # `75&quot; X 48&quot;` (verified in assets/html/order-view-148.html and on
    # the live container). Storing the raw blob text in the seed means React
    # escapes the ampersand and the literal entity shows on screen (DIFF-302).
    # Decode once here, generically — the dump contains &quot; and &#039; today
    # but a narrow re.sub for one of them is what caused the bug.
    sel=[{"label":html.unescape(o['label']),"value":html.unescape(o['value'])}
         for o in (po or {}).get('options',[])] if po else []
    items[it['order_id']].append({
      "itemId": it['item_id'], "productId": it['product_id'], "sku": it['sku'],
      "name": it['name'], "price": num(it['price']), "qtyOrdered": num(it['qty_ordered']),
      "rowTotal": num(it['row_total']), "productType": it['product_type'],
      "options": sel,
    })
addrs=collections.defaultdict(dict)
for a in jl(f"{DUMPS}/order_addresses.jsonl"):
    addrs[a['parent_id']][a['address_type']]=a
orders=[]
for o in jl(f"{DUMPS}/orders.jsonl"):
    oid=o['entity_id']
    def addr(t):
        a=addrs.get(oid,{}).get(t)
        if not a: return None
        return {k:a.get(k) for k in ("firstname","lastname","street","city","region","postcode","country_id","telephone","company","email")}
    orders.append({
      "entityId": oid, "incrementId": o['increment_id'], "status": o['status'], "state": o['state'],
      "createdAt": o['created_at'], "grandTotal": num(o['grand_total']), "subtotal": num(o['subtotal']),
      "shippingAmount": num(o['shipping_amount']), "taxAmount": num(o['tax_amount']),
      "discountAmount": num(o['discount_amount']), "totalQtyOrdered": num(o['total_qty_ordered']),
      "shippingDescription": o['shipping_description'], "customerEmail": o['customer_email'],
      "shippingMethod": "flatrate_flatrate",
      "paymentMethod": "checkmo", "paymentTitle": "Check / Money order",
      "billingAddress": addr('billing'), "shippingAddress": addr('shipping'),
      "items": items.get(oid, []),
    })
orders.sort(key=lambda o:-o['entityId'])
json.dump(orders, open(f"{OUT}/orders.json","w"), separators=(',',':'))

for f in sorted(os.listdir(OUT)):
    print(f, round(os.path.getsize(f"{OUT}/{f}")/1024,1), "KB")

# ---------- listings (captured ground-truth orderings + counts) ----------
import urllib.parse
umap=json.load(open(f"{R}/listing_url_map.json"))
L=json.load(open(f"{R}/listings.json"))
def parse_amount(s):
    if not s: return None
    m=re.search(r'of ([\d,]+)', s)
    if m: return int(m.group(1).replace(',',''))
    m=re.search(r'^(\d+) Item', s)
    return int(m.group(1)) if m else None
listings=[]
for r in L:
    u=umap.get(r['file'])
    if not u: continue
    pu=urllib.parse.urlparse(u)
    listings.append({
      "url": u, "path": pu.path or "/",
      "query": dict(urllib.parse.parse_qsl(pu.query)),
      "title": r['title'], "toolbarAmount": r['toolbar_amount'],
      "totalCount": parse_amount(r['toolbar_amount']),
      "productIds": [p['id'] for p in r['products'] if p['id']],
      "sorterOptions": r['sorter'], "limiterOptions": r['limiter'],
      "sortDirNext": r.get('sort_dir_next'),
      "filters": r['filters'], "currentFilters": r.get('current_filters', []),
      "pageLinks": r['pages'],
    })
json.dump(listings, open(f"{OUT}/listings.json","w"), separators=(',',':'))

# ---------- homepage ----------
home=[p['id'] for p in json.load(open(f"{R}/home_products.json"))[:12]]
home2=[l for l in listings if l['url']=='/?pbaocw=2']
json.dump({
  "title":"One Stop Market","blockTitle":"Product Showcases",
  "pageParam":"pbaocw","pageSize":12,"totalCount":24,
  "productIds": list(range(104499, 104475, -1)),  # widget = newest 24 products, entity_id desc
}, open(f"{OUT}/homepage.json","w"), separators=(',',':'))
print("listings", len(listings))

# ---------- customer / addresses / cart / wishlist / store ----------
json.dump({
  "id": 27, "email": "emma.lopez@gmail.com", "firstname": "Emma", "lastname": "Lopez",
  "dob": None, "gender": None, "createdAt": "2023-04-23 16:42:28",
  "groupId": 1, "defaultBilling": 26, "defaultShipping": 26,
  "newsletterSubscribed": False,
  "addresses": [{
    "id": 26, "firstname": "Emma", "lastname": "Lopez", "company": None,
    "street": ["101 S San Mateo Dr"], "city": "San Mateo", "region": "California",
    "regionId": 12, "postcode": "94010", "countryId": "US", "country": "United States",
    "telephone": "6505551212", "isDefaultBilling": True, "isDefaultShipping": True,
  }],
}, open(f"{OUT}/customer.json","w"), indent=1)

# itemId is the REAL Magento quote_item.item_id, not a 1-based index.
#   SELECT item_id, product_id, sku FROM quote_item WHERE quote_id=255;
#     554 -> 15033 B087QSCXGT
#     555 -> 15787 B08JLHHCM6
#     556 -> 10617 B09LQTV3RX
# and assets/html/cart.html agrees: name="cart[554][qty]",
# Edit -> /checkout/cart/configure/id/554/product_id/15033.
# These ids are ADDRESSABLE URL segments (ROUTES.md #18 configure, #19 delete),
# so inventing 1/2/3 made both routes 404 / no-op at their real ids (BUG-201).
# dataManager.createInitialData().nextCartItemId must stay above max(itemId).
json.dump({
  "quoteId": 255, "itemsCount": 3, "itemsQty": 3, "subtotal": 350.42, "grandTotal": 350.42,
  "updatedAt": "2023-05-05 19:28:17",
  "items": [
    {"itemId": 554, "productId": 15033, "sku": "B087QSCXGT",
     "name": "Uttermost Volterra Crackled Taupe-Gray Ceramic Table Lamp",
     "qty": 1, "price": 250.80, "rowTotal": 250.80, "options": []},
    {"itemId": 555, "productId": 15787, "sku": "B08JLHHCM6",
     "name": "NOZE Rustic Coat Rack Wall Mounted Shelf with 4 Hooks, Hanging Entryway Organizer for Mug Coffee Cup, Holding Solid Wooden Shelf with 2 Baskets for Kitchen Living Room, Bathroom and Bedroom",
     "qty": 1, "price": 40.99, "rowTotal": 40.99, "options": []},
    {"itemId": 556, "productId": 10617, "sku": "B09LQTV3RX",
     "name": "Plus Size Lingerie for Women Sexy for Sex Naughty Eyelash Lace Bodysuit Naughty Mesh One Piece Teddy Bodysuit Outfits",
     "qty": 1, "price": 58.63, "rowTotal": 58.63,
     "options": [{"optionId": 4348, "label": "Size", "optionTypeId": 23919, "value": "Large"},
                 {"optionId": 4349, "label": "Color", "optionTypeId": 23922, "value": "Blue"}]},
  ],
}, open(f"{OUT}/cart.json","w"), indent=1)

json.dump({"items": []}, open(f"{OUT}/wishlist.json","w"), indent=1)

terms=[json.loads(l) for l in open(f"{R}/search_terms.jsonl", encoding='utf8')]
json.dump([{"queryId":t['query_id'],"queryText":t['query_text'],
            "numResults":t['num_results'],"popularity":t['popularity']} for t in terms],
          open(f"{OUT}/searchTerms.json","w"), indent=1)

json.dump({
  "storeName": "One Stop Market",
  "welcomeMessage": "Welcome to One Stop Market",
  "copyright": "Copyright © 2013-present Magento, Inc. All rights reserved.",
  "footerNote": "Help Us Keep Magento Healthy",
  "footerNoteLink": {"label": "Report All Bugs", "href": "http://www.magentocommerce.com/bug-tracking"},
  "currency": "USD", "currencySymbol": "$",
  "gridPerPage": 12, "gridPerPageValues": [12, 24, 36],
  "defaultSortBy": "position",
  "storePhone": None,
  "sortOptions": [
    {"value": "position", "label": "Position"},
    {"value": "name", "label": "Product Name"},
    {"value": "price", "label": "Price"},
  ],
  # Source order, verified against /catalogsearch/result/?q=usb+wifi:
  # Product Name, Price, Relevance — with Relevance last and selected.
  "searchSortOptions": [
    {"value": "name", "label": "Product Name"},
    {"value": "price", "label": "Price"},
    {"value": "relevance", "label": "Relevance"},
  ],
  "defaultSearchSortBy": "relevance",
  "footerLinks": [
    {"label": "Privacy and Cookie Policy", "href": "/privacy-policy-cookie-restriction-mode"},
    {"label": "Search Terms", "href": "/search/term/popular/"},
    {"label": "Advanced Search", "href": "/catalogsearch/advanced/"},
    {"label": "Contact Us", "href": "/contact/"},
  ],
}, open(f"{OUT}/storeConfig.json","w"), indent=1)

for f in sorted(os.listdir(OUT)):
    print(f, round(os.path.getsize(f"{OUT}/{f}")/1024,1), "KB")
