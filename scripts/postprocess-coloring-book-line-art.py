#!/usr/bin/env python3
"""Remove stray color fills from generated coloring-book heroes while preserving dimensions/types."""
from __future__ import annotations

import base64
import re
import subprocess
import tempfile
from io import BytesIO
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BLOG = ROOT / "public" / "blog"
ORIGINALS = ROOT / "dogfood-output" / "coloring-book-hero-originals" / "public" / "blog"


def size_for(path: Path) -> tuple[int, int]:
    if path.suffix.lower() == ".svg":
        m = re.search(r'<svg[^>]*\bwidth="([0-9.]+)"[^>]*\bheight="([0-9.]+)"', path.read_text(errors="ignore"))
        if m:
            return int(float(m.group(1))), int(float(m.group(2)))
    with Image.open(path) as im:
        return im.size


def render_svg(path: Path) -> Image.Image:
    with tempfile.NamedTemporaryFile(suffix=".png") as tmp:
        subprocess.run(["magick", str(path), tmp.name], check=True)
        return Image.open(tmp.name).convert("RGB")


def remove_color_fills(im: Image.Image) -> Image.Image:
    arr = np.array(im.convert("RGB")).astype(np.float32) / 255.0
    mx = arr.max(axis=2)
    mn = arr.min(axis=2)
    sat = np.where(mx == 0, 0, (mx - mn) / mx)
    # Colored Gemini fills should become blank coloring regions. Keep dark ink lines.
    colored_fill = (sat > 0.12) & (mx > 0.28)
    arr[colored_fill] = 1.0
    # Very pale non-ink should also become white paper.
    gray = (0.299 * arr[:, :, 0] + 0.587 * arr[:, :, 1] + 0.114 * arr[:, :, 2])
    gray[gray > 0.78] = 1.0
    # Preserve antialiased ink as neutral grayscale, no color.
    out = np.stack([gray, gray, gray], axis=2)
    return Image.fromarray(np.clip(out * 255, 0, 255).astype(np.uint8), "RGB")


def save(im: Image.Image, dest: Path) -> None:
    suffix = dest.suffix.lower()
    if suffix in {".jpg", ".jpeg"}:
        im.save(dest, "JPEG", quality=95, optimize=True)
    elif suffix == ".webp":
        im.save(dest, "WEBP", quality=95, method=6)
    elif suffix == ".png":
        im.save(dest, "PNG", optimize=True)
    elif suffix == ".svg":
        buf = BytesIO()
        im.save(buf, "PNG", optimize=True)
        b64 = base64.b64encode(buf.getvalue()).decode("ascii")
        w, h = im.size
        dest.write_text(
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img">\n'
            f'  <image href="data:image/png;base64,{b64}" width="{w}" height="{h}"/>\n'
            f'</svg>\n'
        )
    else:
        raise ValueError(dest)


def main() -> None:
    files = sorted(p for p in ORIGINALS.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp", ".svg"})
    for original in files:
        live = BLOG / original.name
        target = size_for(original)
        im = render_svg(live) if live.suffix.lower() == ".svg" else Image.open(live).convert("RGB")
        if im.size != target:
            im = im.resize(target, Image.Resampling.LANCZOS)
        out = remove_color_fills(im)
        save(out, live)
        print(live.relative_to(ROOT), target)


if __name__ == "__main__":
    main()
