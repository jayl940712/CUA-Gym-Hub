#!/usr/bin/env python3
"""Extract Osclass listing photos out of the `classifieds` container and re-encode
them small enough to ship with the mock.

Run with the PIL-enabled interpreter:

    /tmp/pwvenv/bin/python assets/extract-images.py           # both tiers
    /tmp/pwvenv/bin/python assets/extract-images.py --tier b  # anchors only (fast)

Source (measured): 84,149 items, one photo each, 73 GB on disk as PNG.
Output (measured over the full tree):
  Tier A  public/img/t/<id//1000>/<id>.webp   144x120 q6  blur 0.6  ~734 B  -> 61.8 MB total
  Tier B  public/img/m/<id//1000>/<id>.webp   550x413 q8  blur 0.8  ~5.6 KB -> 8.5 MB for 1,530 items

The pre-encode Gaussian blur is load-bearing, not cosmetic: at these bitrates WebP
spends most of its budget on sensor noise and JPEG-era ringing in the source photos.
Low-passing first buys ~20% off the file at visibly *better* quality than reaching
the same size by dropping `quality` alone. Tier A is sized for the 95 px list-view
thumb and the 75 px item strip; the 226 px gallery tile upscales it ~1.6x.

Tier A backs every listing card, gallery tile and related-listing thumb.
Tier B backs the item-detail main photo for anchor-reachable items; item pages
outside Tier B fall back to the Tier A image upscaled (see DESIGN.md).
"""
import argparse, io, os, subprocess, sys, tarfile, time
from concurrent.futures import ProcessPoolExecutor

from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTAINER = "classifieds"
UPLOADS = "/usr/src/myapp/oc-content/uploads"
BATCH = 2000


def item_paths():
    """id -> (dir, ext) straight from oc_t_item_resource; two schemes coexist."""
    out = subprocess.run(
        ["docker", "exec", "classifieds_db", "mysql", "-uroot", "-ppassword", "osclass", "-Nse",
         "SELECT fk_i_item_id, s_path, s_extension FROM oc_t_item_resource ORDER BY fk_i_item_id"],
        capture_output=True, text=True, check=True).stdout
    res = {}
    for line in out.strip().split("\n"):
        iid, path, ext = line.split("\t")
        res[int(iid)] = (path.rstrip("/").split("/")[-1], ext)
    return res


def fetch(members):
    """tar a batch of files out of the container; yield (name, bytes)."""
    listing = "\n".join(members)
    p = subprocess.run(
        ["docker", "exec", "-i", CONTAINER, "sh", "-c",
         "cd %s && tar -cf - -T - 2>/dev/null" % UPLOADS],
        input=listing.encode(), capture_output=True)
    with tarfile.open(fileobj=io.BytesIO(p.stdout)) as tf:
        for m in tf.getmembers():
            if m.isfile():
                yield m.name, tf.extractfile(m).read()


def encode(job):
    name, blob, dest, size, quality, blur = job
    try:
        im = Image.open(io.BytesIO(blob)).convert("RGB")
        if im.size != size:
            im = im.resize(size, Image.LANCZOS)
        if blur:
            im = im.filter(ImageFilter.GaussianBlur(blur))
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        im.save(dest, "WEBP", quality=quality, method=6)
        return 1
    except Exception as e:  # noqa: BLE001 - a corrupt source image must not kill the run
        print("  !! %s: %s" % (name, e), file=sys.stderr)
        return 0


def run(ids, paths, suffix, out_sub, size, quality, blur, label):
    outdir = os.path.join(ROOT, "public", "img", out_sub)
    todo = [i for i in ids if not os.path.exists(
        os.path.join(outdir, str(i // 1000), "%d.webp" % i))]
    print("%s: %d items (%d already done)" % (label, len(todo), len(ids) - len(todo)), flush=True)
    t0, done = time.time(), 0
    with ProcessPoolExecutor() as pool:
        for start in range(0, len(todo), BATCH):
            chunk = todo[start:start + BATCH]
            members, dests = [], {}
            for i in chunk:
                d, ext = paths[i]
                m = "%s/%d%s.%s" % (d, i, suffix, ext)
                members.append(m)
                dests[m] = os.path.join(outdir, str(i // 1000), "%d.webp" % i)
            jobs = [(n, b, dests[n], size, quality, blur) for n, b in fetch(members) if n in dests]
            done += sum(pool.map(encode, jobs, chunksize=32))
            el = time.time() - t0
            print("  %6d/%d  %.0fs elapsed, ~%.0fs left"
                  % (done, len(todo), el, el / max(done, 1) * (len(todo) - done)), flush=True)
    print("%s done: %d files" % (label, done), flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tier", choices=["a", "b", "both"], default="both")
    ap.add_argument("--tier-b-ids", default=os.path.join(ROOT, "assets", "tier_b_ids.txt"))
    args = ap.parse_args()

    paths = item_paths()
    print("resources: %d" % len(paths), flush=True)

    if args.tier in ("b", "both"):
        ids = [int(x) for x in open(args.tier_b_ids).read().split() if int(x) in paths]
        run(ids, paths, "", "m", (550, 413), 8, 0.8, "TIER B (item-detail main photo)")

    if args.tier in ("a", "both"):
        ids = sorted(paths)
        run(ids, paths, "_thumbnail", "t", (144, 120), 6, 0.6, "TIER A (all thumbnails)")


if __name__ == "__main__":
    main()
