#!/usr/bin/env python3
"""Downscale to 1000px and hard-compress every submission image, then rewrite images.json.

The container ships originals at up to 6000px and tens of megabytes; the mock
only ever paints them into a 500px box (`MAX_IMAGE_BOX` in Submission.jsx) or a
70/140px thumbnail. The brief for this pass, decided by the orchestrator, is
explicit: **keep the ~1000px long edge, do not try to preserve perceptual
detail.** So quality goes low and stays low.

**File names and extensions are never changed** — `submissions.image` carries the
container's `images.file_name` and two of them are anchor routes
(`/submission_images/361ec602….jpg`, `…73199932….gif`), so re-containering to
.webp would break the contract. The *encoder* is chosen by content, not by
extension, which is how the 2026-08-06 pass already shipped 45 `.png` files
holding JPEG bytes: browsers sniff image content and ignore the declared type,
and those 45 have been rendering correctly ever since.

    .jpg          long edge -> 1000, JPEG q=JPEG_QUALITY, progressive, 4:2:0
    .png opaque   long edge -> 1000, JPEG q=JPEG_QUALITY  (a photo saved as PNG
                  costs ~20x what it needs to; 295 of these were 372 MB)
    .png w/ alpha long edge -> 1000, adaptive-palette PNG8 so transparency lives
    .gif          long edge -> 1000, GIF_FRAMES frames sampled evenly, 64 colours
                  — animation is preserved, frame count is not
    thumbs        re-encoded in place at the source's own 70/140 outbound crop

`images.json` is rewritten from what is actually on disk afterwards, so its
`w`/`h`/`full`/`thumb1x`/`thumb2x` can never drift from the files.

    python3 assets/dumps/compress_images.py            # uses /tmp/pwvenv/bin/python
    python3 assets/dumps/compress_images.py --dry-run
"""

import argparse
import json
import os
import sys

from PIL import Image, ImageFile, ImageSequence

Image.MAX_IMAGE_PIXELS = None
# A handful of the container's uploads are byte-truncated; render what is there
# rather than dropping the file and leaving a broken <img> on an anchored post.
ImageFile.LOAD_TRUNCATED_IMAGES = True

HERE = os.path.dirname(os.path.abspath(__file__))
MOCK = os.path.dirname(os.path.dirname(HERE))
PUBLIC = os.path.join(MOCK, "public")
FULL = os.path.join(PUBLIC, "submission_images")
THUMB = {"1x": os.path.join(PUBLIC, "media/cache/submission_thumbnail_1x"),
         "2x": os.path.join(PUBLIC, "media/cache/submission_thumbnail_2x")}

MAX_EDGE = 1000
JPEG_QUALITY = 30
THUMB_QUALITY = 45
PNG_COLORS = 128
GIF_FRAMES = 4          # evenly sampled; matches the 2026-08-06 pass
GIF_COLORS = 64
SMALL_ENOUGH = 200 * 1024   # --only-oversized: already-processed files land far below this
ALPHA_MIN = 250         # a PNG whose minimum alpha is >= this is effectively opaque


def open_image(path):
    im = Image.open(path)
    im.load()
    return im


def fit(size, max_edge):
    w, h = size
    if max(w, h) <= max_edge:
        return None
    scale = max_edge / max(w, h)
    return (max(1, round(w * scale)), max(1, round(h * scale)))


def save_jpeg(im, path, quality):
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGB")
    elif im.mode != "RGB":
        im = im.convert("RGB")
    im.save(path, "JPEG", quality=quality, optimize=True,
            progressive=True, subsampling=2)


def has_alpha(im):
    """True only if the alpha channel actually carries transparency."""
    if im.mode == "P" and "transparency" not in im.info:
        return False
    if im.mode not in ("RGBA", "LA", "PA") and "transparency" not in im.info:
        return False
    alpha = im.convert("RGBA").getchannel("A")
    return alpha.getextrema()[0] < ALPHA_MIN


def save_png(im, path):
    """PNG8 with an adaptive palette — only used when transparency is real.

    `method` matters: MEDIANCUT/MAXCOVERAGE reject RGBA outright ("Fast Octree
    and libimagequant are the only valid methods"), which silently skipped every
    transparent PNG and every GIF on the first pass.
    """
    quantized = im.convert("RGBA").quantize(colors=PNG_COLORS, method=Image.FASTOCTREE)
    quantized.save(path, "PNG", optimize=True)


def save_gif(path, target):
    """Keep the animation, drop most of the frames — GIFs here are up to 90 MB each."""
    im = Image.open(path)
    frames = list(ImageSequence.Iterator(im))
    total = len(frames)
    if total > GIF_FRAMES:
        step = total / GIF_FRAMES
        frames = [frames[min(total - 1, int(i * step))] for i in range(GIF_FRAMES)]
    duration = im.info.get("duration", 100) or 100
    if total > GIF_FRAMES:
        duration = int(duration * total / GIF_FRAMES)   # keep the loop's wall time
    out, new_size = [], None
    for frame in frames:
        rgba = frame.convert("RGBA")
        if new_size is None:
            new_size = fit(rgba.size, target) or rgba.size
        out.append(rgba.resize(new_size, Image.LANCZOS)
                   .quantize(colors=GIF_COLORS, method=Image.FASTOCTREE))
    head, rest = out[0], out[1:]
    # GIF stores per-frame delay as a uint16 of centiseconds; stretching the
    # duration to keep the loop's wall time can overflow it.
    head.save(path, "GIF", save_all=True, append_images=rest,
              loop=im.info.get("loop", 0), duration=min(duration, 65535),
              optimize=True, disposal=2)


def compress_full(path):
    # Dispatch on the *decoded* format, not the extension: 45 `.png` files hold
    # JPEG bytes from the previous pass, and re-wrapping those as real PNG would
    # inflate them ~20x.
    im = open_image(path)
    fmt = (im.format or "").upper()
    if fmt == "GIF":
        im.close()
        save_gif(path, MAX_EDGE)
        return
    new = fit(im.size, MAX_EDGE)
    if new:
        im = im.resize(new, Image.LANCZOS)
    if fmt == "PNG" and has_alpha(im):
        save_png(im, path)
    else:
        save_jpeg(im, path, JPEG_QUALITY)


def compress_thumb(path):
    im = open_image(path)
    fmt = (im.format or "").upper()
    if fmt == "GIF":
        return                      # 70px GIFs are already ~2 KB
    if fmt == "PNG" and has_alpha(im):
        save_png(im, path)
    else:
        save_jpeg(im, path, THUMB_QUALITY)


def decoded_format(path):
    try:
        with Image.open(path) as im:
            return (im.format or "").upper()
    except Exception:                                 # noqa: BLE001
        return ""


def already_compressed(path):
    """True when a file is plainly the output of a previous run of this script."""
    if os.path.getsize(path) > SMALL_ENOUGH:
        return False
    try:
        with Image.open(path) as im:
            return max(im.size) <= MAX_EDGE
    except Exception:                                 # noqa: BLE001
        return False


def walk(directory, fn, label, dry_run, formats=None, only_oversized=False):
    names = sorted(n for n in os.listdir(directory) if not n.startswith("."))
    if formats:
        names = [n for n in names
                 if decoded_format(os.path.join(directory, n)) in formats]
    if only_oversized:
        names = [n for n in names
                 if not already_compressed(os.path.join(directory, n))]
    before = after = 0
    failed = []
    for i, name in enumerate(names):
        path = os.path.join(directory, name)
        if not os.path.isfile(path):
            continue
        size = os.path.getsize(path)
        before += size
        if dry_run:
            after += size
            continue
        try:
            fn(path)
        except Exception as exc:                      # noqa: BLE001 — report, don't abort
            failed.append((name, str(exc)[:80]))
        after += os.path.getsize(path)
        if (i + 1) % 250 == 0:
            print("  %s %d/%d" % (label, i + 1, len(names)), flush=True)
    n = max(1, len([x for x in names if os.path.isfile(os.path.join(directory, x))]))
    print("%-14s %5d files  %8.1f MB -> %8.1f MB   mean %6.1f KB -> %6.1f KB"
          % (label, n, before / 1e6, after / 1e6, before / n / 1024, after / n / 1024))
    for name, err in failed:
        print("   FAILED %s: %s" % (name, err))
    return before, after, failed


def rebuild_manifest():
    """images.json, regenerated from disk so w/h/full/thumb1x/thumb2x cannot drift."""
    manifest = {}
    for name in sorted(os.listdir(FULL)):
        path = os.path.join(FULL, name)
        if not os.path.isfile(path) or name.endswith(".txt"):
            continue
        try:
            with Image.open(path) as im:
                w, h = im.size
        except Exception:
            continue
        manifest[name] = {
            "w": w, "h": h, "full": True,
            "thumb1x": os.path.exists(os.path.join(THUMB["1x"], name)),
            "thumb2x": os.path.exists(os.path.join(THUMB["2x"], name)),
        }
    path = os.path.join(MOCK, "src", "data", "images.json")
    with open(path, "w") as fh:
        json.dump(manifest, fh, ensure_ascii=False, indent=1)
        fh.write("\n")
    print("images.json    %5d entries  %.1f KB  (thumb1x %d, thumb2x %d)"
          % (len(manifest), os.path.getsize(path) / 1024,
             sum(1 for v in manifest.values() if v["thumb1x"]),
             sum(1 for v in manifest.values() if v["thumb2x"])))
    return manifest


def prune():
    """Delete image files no submission references — re-selection leaves orphans."""
    subs = json.load(open(os.path.join(MOCK, "src", "data", "submissions.json")))
    wanted = {s["image"] for s in subs if s.get("image")}
    removed = freed = 0
    for directory in [FULL] + list(THUMB.values()):
        if not os.path.isdir(directory):
            continue
        for name in os.listdir(directory):
            if name in wanted or name.endswith(".txt") or name.startswith("."):
                continue
            path = os.path.join(directory, name)
            if os.path.isfile(path):
                freed += os.path.getsize(path)
                os.remove(path)
                removed += 1
    print("prune          %5d orphan files removed, %.1f MB freed" % (removed, freed / 1e6))
    missing = sorted(w for w in wanted if not os.path.exists(os.path.join(FULL, w)))
    if missing:
        print("   WARNING %d referenced images are not on disk, e.g. %s"
              % (len(missing), missing[:3]))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--prune", action="store_true",
                    help="delete files no submission references, then rebuild the manifest")
    ap.add_argument("--skip-full", action="store_true")
    ap.add_argument("--skip-thumbs", action="store_true")
    ap.add_argument("--only-oversized", action="store_true",
                    help="skip files already <=MAX_EDGE and under SMALL_ENOUGH bytes, "
                         "so a re-run only touches newly fetched originals")
    ap.add_argument("--formats", default="",
                    help="comma-separated decoded formats to touch, e.g. GIF,PNG")
    args = ap.parse_args()

    if args.prune:
        prune()
        rebuild_manifest()
        return 0

    formats = {f.strip().upper() for f in args.formats.split(",") if f.strip()} or None
    total_before = total_after = 0
    if not args.skip_full:
        b, a, _ = walk(FULL, compress_full, "full", args.dry_run, formats,
                       args.only_oversized)
        total_before += b
        total_after += a
    for density in ("1x", "2x"):
        if args.skip_thumbs:
            break
        if os.path.isdir(THUMB[density]):
            b, a, _ = walk(THUMB[density], compress_thumb, "thumb_" + density,
                           args.dry_run, formats)
            total_before += b
            total_after += a
    print("TOTAL          %8.1f MB -> %8.1f MB  (%.1fx)"
          % (total_before / 1e6, total_after / 1e6,
             total_before / max(1, total_after)))
    if not args.dry_run:
        rebuild_manifest()
    return 0


if __name__ == "__main__":
    sys.exit(main())
