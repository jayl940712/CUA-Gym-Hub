#!/usr/bin/env python3
"""Copy the submission images the expanded seed needs out of the `forum` container.

Read-only: one `tar -cf -` inside the container, streamed out and unpacked here.
Per-file `docker cp` would be ~1,900 process spawns; the tar stream is one.

    /var/www/html/public/submission_images/<name>   ->  public/submission_images/

**Thumbnails are generated here, not copied.** LiipImagine builds
`media/cache/submission_thumbnail_{1x,2x}` lazily on first request, so the
container's cache holds only 5 files — pulling it gets you nothing. The filter
chain is reproduced from `config/packages/liip_imagine.yaml`:

    thumbnail: { size: [70, 70] / [140, 140], mode: outbound, allow_upscale: true }
    quality: 60, plus auto_rotate and strip

`mode: outbound` is cover-and-centre-crop. Verified against the 769 thumbnails
the previous round already produced: mean absolute difference 4-12/255, i.e.
resampling noise, not a different crop.

    python3 assets/dumps/fetch_images.py
"""

import json
import os
import subprocess
import sys
import tarfile
import threading

from PIL import Image, ImageOps

Image.MAX_IMAGE_PIXELS = None

HERE = os.path.dirname(os.path.abspath(__file__))
MOCK = os.path.dirname(os.path.dirname(HERE))
PUBLIC = os.path.join(MOCK, "public")
FULL = os.path.join(PUBLIC, "submission_images")
THUMBS = [("1x", 70), ("2x", 140)]

CONTAINER = "forum"
REMOTE_FULL = "/var/www/html/public/submission_images"
THUMB_QUALITY = 60


class _Feeder:
    """Write the file list to the child's stdin on a thread while reading stdout."""

    def __init__(self, proc, payload):
        self.proc = proc

        def feed():
            try:
                proc.stdin.write(payload)
                proc.stdin.close()
            except BrokenPipeError:
                pass
        threading.Thread(target=feed, daemon=True).start()

    def read(self, size=-1):
        return self.proc.stdout.read(size)


def pull(names):
    os.makedirs(FULL, exist_ok=True)
    todo = [n for n in names if not os.path.exists(os.path.join(FULL, n))]
    if not todo:
        print("submission_images    up to date")
        return
    proc = subprocess.Popen(
        ["docker", "exec", "-i", CONTAINER, "tar", "-cf", "-",
         "--ignore-failed-read", "-C", REMOTE_FULL, "-T", "-"],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    written = 0
    with tarfile.open(fileobj=_Feeder(proc, "\n".join(todo).encode()), mode="r|") as tar:
        for member in tar:
            if not member.isfile():
                continue
            src = tar.extractfile(member)
            if src is None:
                continue
            with open(os.path.join(FULL, os.path.basename(member.name)), "wb") as fh:
                fh.write(src.read())
            written += 1
    proc.wait()
    print("submission_images    +%d files" % written)


def outbound(im, edge):
    """LiipImagine `mode: outbound` — scale to cover, then centre-crop to square."""
    return ImageOps.fit(im, (edge, edge), method=Image.LANCZOS, centering=(0.5, 0.5))


def make_thumbs(names, force=False):
    for density, edge in THUMBS:
        out_dir = os.path.join(PUBLIC, "media/cache/submission_thumbnail_%s" % density)
        os.makedirs(out_dir, exist_ok=True)
        made = 0
        for name in names:
            src = os.path.join(FULL, name)
            dst = os.path.join(out_dir, name)
            if not os.path.exists(src) or (os.path.exists(dst) and not force):
                continue
            try:
                with Image.open(src) as im:
                    im = ImageOps.exif_transpose(im)   # auto_rotate
                    ext = name.rsplit(".", 1)[-1].lower()
                    thumb = outbound(im.convert("RGBA" if ext == "png" else "RGB"), edge)
                    if ext in ("jpg", "jpeg"):
                        thumb.save(dst, "JPEG", quality=THUMB_QUALITY, optimize=True)
                    elif ext == "png":
                        thumb.save(dst, "PNG", optimize=True)
                    else:                              # gif -> still first frame
                        thumb.convert("P", palette=Image.ADAPTIVE).save(dst, "GIF")
                made += 1
            except Exception as exc:                   # noqa: BLE001
                print("   thumb FAILED %s: %s" % (name, str(exc)[:70]))
        print("thumbnail_%-2s         +%d files" % (density, made))


def main():
    names = json.load(open(os.path.join(HERE, "images_expanded.json")))
    print("images wanted        : %d" % len(names))
    pull(names)
    make_thumbs(names)
    return 0


if __name__ == "__main__":
    sys.exit(main())
