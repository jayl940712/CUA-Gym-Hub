#!/usr/bin/env python3
"""Re-encode the backfilled catalog images into public/media/.

The raw gallery pulled out of the container is 275 MB across 8 613 files at
500x500 q~85. Committing that as-is is not affordable, and the mock never
displays a catalog image above 500 px (`.gallery-main img { max-height:560px }`,
`.product-image-container { max-width:240px }`, thumbs 78x98, cart 100px).

Following the precedent in commit 47e680d78 (classifieds, 9.5x): a small
Gaussian pre-blur before encoding buys far more than quality alone, because at
these bitrates the encoder otherwise spends its budget on JPEG-era ringing in
the Amazon source photos.

  tier A  PDP-anchored products   500x500  q72  blur 0.4   (full gallery)
  tier B  grid/category depth     320x320  q64  blur 0.7   (main image only)

Measured on a 60-file sample: quality alone caps out near 2x, and 400px/q70
would still land the 8 613 files at 134 MB. 320 px is the knee — it is still
1.33x the 240 px the grid tile displays (the dominant view for tier B), and
4.1x the 78 px gallery thumb, while cutting the set to ~78 MB. A tier-B product
opened as a PDP upsamples ~1.6x in the 500 px slot and reads soft; that is the
deliberate trade, recorded in DEV.part-F.md.

The 1 105 products already seeded are NOT re-encoded — they keep their original
500x500 files, so no existing PDP loses quality.

Output stays .jpg at the same path, so `image`/`smallImage`/`thumbnail`/
`gallery` in products.json are untouched and nothing has to be renamed.

Run with the venv python — PIL is not installed system-wide:
    /tmp/pwvenv/bin/python assets/dumps/vwa_images.py
"""
import glob, json, os, sys
from PIL import Image, ImageFilter

MOCK = "/webarena/CUA-Gym-Hub/websites/webarena_shopping_mock"
DUMPS = f"{MOCK}/assets/dumps"
SRC = os.environ.get("VWA_MEDIA_SRC", "/tmp/vwa_media")
DST = f"{MOCK}/public/media/catalog/product"

TIER = {"A": (500, 72, 0.4), "B": (320, 64, 0.7)}


def main():
    # Union across every dump generation (see vwa_backfill.ROUND).
    tier_a = set()
    for f in sorted(glob.glob(f"{DUMPS}/vwa_tiers.json") + glob.glob(f"{DUMPS}/vwa_tiers.*.json")):
        tier_a |= set(json.load(open(f))["tierA"])
    products = {p["id"]: p for p in json.load(open(f"{MOCK}/src/data/products.json"))}

    # Map every media path to the tier of the product that owns it.
    path_tier = {}
    for pid, p in products.items():
        t = "A" if pid in tier_a else "B"
        for v in set(p["gallery"]) | {p["image"], p["smallImage"], p["thumbnail"]}:
            if v and v != "no_selection":
                path_tier.setdefault(v, t)
                if t == "A":
                    path_tier[v] = "A"

    todo = [l.strip() for l in open(f"{DUMPS}/vwa_media_list.txt") if l.strip()]
    src_bytes = out_bytes = 0
    done = failed = missing = 0
    for rel in todo:
        s = os.path.join(SRC, rel.lstrip("/"))
        d = os.path.join(DST, rel.lstrip("/"))
        if not os.path.exists(s):
            missing += 1
            continue
        size, quality, blur = TIER[path_tier.get(rel, "B")]
        try:
            im = Image.open(s)
            im.load()
            if im.mode not in ("RGB", "L"):
                im = im.convert("RGB")
            if max(im.size) > size:
                im.thumbnail((size, size), Image.LANCZOS)
            if blur:
                im = im.filter(ImageFilter.GaussianBlur(blur))
            os.makedirs(os.path.dirname(d), exist_ok=True)
            im.save(d, "JPEG", quality=quality, optimize=True, progressive=True)
        except Exception as e:
            failed += 1
            print("FAIL", rel, e, file=sys.stderr)
            continue
        src_bytes += os.path.getsize(s)
        out_bytes += os.path.getsize(d)
        done += 1
        if done % 1000 == 0:
            print(f"  {done}/{len(todo)}  {src_bytes/1e6:.0f} -> {out_bytes/1e6:.0f} MB",
                  flush=True)

    print(f"encoded {done}, failed {failed}, missing {missing}")
    print(f"{src_bytes/1e6:.1f} MB -> {out_bytes/1e6:.1f} MB "
          f"({src_bytes / max(out_bytes, 1):.1f}x)")


if __name__ == "__main__":
    main()
