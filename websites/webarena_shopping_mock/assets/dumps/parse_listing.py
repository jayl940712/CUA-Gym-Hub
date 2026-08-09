import re,html,json,sys,os,glob

def txt(s):
    s=re.sub(r'<script.*?</script>','',s,flags=re.S)
    s=re.sub(r'<[^>]+>',' ',s)
    return html.unescape(re.sub(r'\s+',' ',s)).strip()

def parse(path):
    s=open(path,encoding='utf8',errors='replace').read()
    out={'file':os.path.basename(path)}
    m=re.search(r'<span class="base" data-ui-id="page-title-wrapper"[^>]*>(.*?)</span>',s,re.S)
    out['title']=txt(m.group(1)) if m else None
    m=re.search(r'<p class="toolbar-amount"[^>]*>(.*?)</p>',s,re.S)
    out['toolbar_amount']=txt(m.group(1)) if m else None
    prods=[]
    m=re.search(r'<ol class="products list items product-items">(.*?)</ol>',s,re.S)
    if m:
        for it in re.split(r'(?=<li class="item product product-item")',m.group(1))[1:]:
            pid=re.search(r'id="product-item-info_(\d+)"',it)
            link=re.search(r'class="product-item-link"\s*\n?\s*href="([^"]+)"[^>]*>\s*(.*?)\s*</a>',it,re.S)
            price=re.search(r'data-price-amount="([\d.]+)"',it)
            rating=re.search(r'id="rating-result_\d+"\s*\n?\s*title="(\d+)%"',it)
            nrev=re.search(r'#reviews">(\d+)\s',it)
            sku=re.search(r'data-product-sku="([^"]+)"',it)
            img=re.search(r'class="product-image-photo"\s*\n?\s*src="([^"]+)"',it)
            prods.append({
              'id':int(pid.group(1)) if pid else None,
              'url_key':link.group(1).rsplit('/',1)[-1].replace('.html','') if link else None,
              'name':html.unescape(txt(link.group(2))) if link else None,
              'price':float(price.group(1)) if price else None,
              'rating_pct':int(rating.group(1)) if rating else None,
              'review_count':int(nrev.group(1)) if nrev else 0,
              'sku':sku.group(1) if sku else None,
              'image':img.group(1).split('/product/')[-1] if img else None,
            })
    out['products']=prods
    # sorter
    m=re.search(r'<select data-role="sorter"[^>]*>(.*?)</select>',s,re.S)
    out['sorter']=re.findall(r'value="([^"]+)"',m.group(1)) if m else []
    m=re.search(r'<select data-role="limiter"[^>]*>(.*?)</select>',s,re.S)
    out['limiter']=re.findall(r'value="([^"]+)"',m.group(1)) if m else []
    # layered nav
    filters=[]
    for fm in re.finditer(r'<div class="filter-options-title">(.*?)</div>\s*<div class="filter-options-content">(.*?)(?=<div class="filter-options-title">|</div>\s*</div>\s*</div>)',s,re.S):
        name=txt(fm.group(1)); body=fm.group(2)
        opts=[]
        for om in re.finditer(r'href="([^"]+)"[^>]*>(.*?)</a>',body,re.S):
            opts.append({'href':om.group(1).replace('http://10.186.197.203:7770',''),'label':txt(om.group(2))})
        if name: filters.append({'name':name,'options':opts[:40]})
    out['filters']=filters
    # pagination
    out['pages']=sorted(set(re.findall(r'[?&]p=(\d+)',s)))
    return out

if __name__=='__main__':
    res=[parse(p) for p in sorted(glob.glob(sys.argv[1]))]
    json.dump(res,open(sys.argv[2],'w'),indent=1)
    for r in res:
        print(r['file'][:60], '|', r['title'], '|', r['toolbar_amount'], '|', len(r['products']))
