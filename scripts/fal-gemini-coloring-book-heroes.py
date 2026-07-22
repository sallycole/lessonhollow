#!/usr/bin/env python3
"""Use fal.ai Gemini image edit to recreate blog hero images as coloring-book pages.

Inputs are the original hero/featured images backed up under dogfood-output/coloring-book-hero-originals.
Outputs overwrite public/blog files, preserving filename, extension, and original dimensions.
For SVG outputs, the generated raster is embedded inside an SVG wrapper so the file type remains .svg.
"""
from __future__ import annotations

import base64
import mimetypes
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from io import BytesIO
from pathlib import Path
from urllib.request import urlopen

import fal_client
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BLOG = ROOT / "public" / "blog"
ORIGINALS = ROOT / "dogfood-output" / "coloring-book-hero-originals" / "public" / "blog"
OUT_REPORT = ROOT / "dogfood-output" / "fal-gemini-coloring-book-heroes"
RASTER_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
SVG_EXTS = {".svg"}
MODEL = "fal-ai/gemini-3-pro-image-preview/edit"

PROMPT = """
Recreate the provided image as a polished printable children's coloring-book page.
Keep the same scene, composition, camera angle, main subjects, props, and overall framing.
Use clean confident black outlines on a pure white background.
Use large colorable enclosed areas, simplified but recognizable details, and no messy edge-detection artifacts.
Do not include color, grayscale shading, gradients, halftone dots, crosshatching, readable text labels, captions, watermarks, or borders.
If the source image contains words, do not transcribe the words. Replace text with blank rounded lines, simple placeholder strokes, or empty panels.
Make it look hand-drawn by an illustrator for a high-quality coloring book, not an automatic trace.
Preserve the original aspect ratio.
""".strip()


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(errors="ignore").splitlines():
        s = line.strip()
        if not s or s.startswith("#") or "=" not in s:
            continue
        key, val = s.split("=", 1)
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        os.environ.setdefault(key, val)


def ensure_fal_key() -> None:
    # Lesson Hollow has an active key in .env.local; Hermes .env currently has the key commented out.
    load_env_file(ROOT / ".env.local")
    load_env_file(Path("/home/sal/.hermes/.env"))
    if not os.environ.get("FAL_KEY"):
        raise RuntimeError("FAL_KEY not found in environment or .env files")


def files_to_convert() -> list[Path]:
    files: set[Path] = set()
    if ORIGINALS.exists():
        files.update(
            p for p in ORIGINALS.iterdir()
            if p.is_file() and p.suffix.lower() in (RASTER_EXTS | SVG_EXTS)
        )
    for md in (ROOT / "content" / "blog").glob("*.md"):
        text = md.read_text()
        for match in re.finditer(r'(?m)^featuredImage:\s*["\']?([^"\'\n]+)', text):
            raw = match.group(1).strip()
            if raw.startswith("/blog/"):
                original = ORIGINALS / Path(raw).name
                if original.exists():
                    files.add(original)
    return sorted(files, key=lambda p: p.name)


def image_size(path: Path) -> tuple[int, int]:
    if path.suffix.lower() in SVG_EXTS:
        text = path.read_text(errors="ignore")
        m = re.search(r'<svg[^>]*\bwidth="([0-9.]+)"[^>]*\bheight="([0-9.]+)"', text)
        if m:
            return int(float(m.group(1))), int(float(m.group(2)))
        png = render_svg_to_temp_png(path)
        try:
            with Image.open(png) as im:
                return im.size
        finally:
            png.unlink(missing_ok=True)
    with Image.open(path) as im:
        return im.size


def render_svg_to_temp_png(path: Path) -> Path:
    tmp = Path(tempfile.mkstemp(suffix=".png")[1])
    subprocess.run(["magick", str(path), str(tmp)], check=True)
    return tmp


def upload_source(path: Path) -> str:
    if path.suffix.lower() in SVG_EXTS:
        png = render_svg_to_temp_png(path)
        try:
            return fal_client.upload_file(str(png))
        finally:
            png.unlink(missing_ok=True)
    return fal_client.upload_file(str(path))


def generated_url(result: dict) -> str:
    images = result.get("images") or []
    if not images:
        raise RuntimeError(f"No images in fal result: {result}")
    return images[0]["url"]


def download_image(url: str) -> bytes:
    with urlopen(url, timeout=120) as resp:
        return resp.read()


def fit_to_size(image_bytes: bytes, size: tuple[int, int]) -> Image.Image:
    im = Image.open(BytesIO(image_bytes)).convert("RGB")
    target_w, target_h = size
    scale = max(target_w / im.width, target_h / im.height)
    im = im.resize((round(im.width * scale), round(im.height * scale)), Image.Resampling.LANCZOS)
    left = (im.width - target_w) // 2
    top = (im.height - target_h) // 2
    return im.crop((left, top, left + target_w, top + target_h))


def save_preserving_type(im: Image.Image, dest: Path) -> None:
    suffix = dest.suffix.lower()
    if suffix in {".jpg", ".jpeg"}:
        im.save(dest, format="JPEG", quality=95, optimize=True)
    elif suffix == ".png":
        im.save(dest, format="PNG", optimize=True)
    elif suffix == ".webp":
        im.save(dest, format="WEBP", quality=95, method=6)
    elif suffix == ".svg":
        buf = BytesIO()
        im.save(buf, format="PNG", optimize=True)
        b64 = base64.b64encode(buf.getvalue()).decode("ascii")
        w, h = im.size
        dest.write_text(
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img">\n'
            f'  <image href="data:image/png;base64,{b64}" width="{w}" height="{h}"/>\n'
            f'</svg>\n'
        )
    else:
        raise ValueError(dest)


def convert_one(source: Path, index: int, total: int) -> None:
    dest = BLOG / source.name
    size = image_size(source)
    print(f"[{index}/{total}] {source.name} {size}", flush=True)
    upload_url = upload_source(source)
    out_format = "jpeg" if source.suffix.lower() in {".jpg", ".jpeg", ".svg"} else source.suffix.lower().lstrip(".")
    result = fal_client.subscribe(
        MODEL,
        arguments={
            "prompt": PROMPT,
            "image_urls": [upload_url],
            "num_images": 1,
            "aspect_ratio": "auto",
            "output_format": out_format,
        },
        with_logs=False,
        client_timeout=600,
    )
    url = generated_url(result)
    raw = download_image(url)
    im = fit_to_size(raw, size)
    save_preserving_type(im, dest)
    (OUT_REPORT / f"{source.stem}.url.txt").write_text(url + "\n")
    print(f"  -> {dest.relative_to(ROOT)}", flush=True)


def main() -> int:
    ensure_fal_key()
    OUT_REPORT.mkdir(parents=True, exist_ok=True)
    files = files_to_convert()
    if len(sys.argv) > 1:
        wanted = set(sys.argv[1:])
        files = [p for p in files if p.name in wanted or str(p) in wanted or str(BLOG / p.name) in wanted]
    print(f"Using {MODEL}; converting {len(files)} images", flush=True)
    for idx, source in enumerate(files, 1):
        last_err: Exception | None = None
        for attempt in range(1, 4):
            try:
                convert_one(source, idx, len(files))
                break
            except Exception as exc:  # noqa: BLE001
                last_err = exc
                print(f"  attempt {attempt} failed for {source.name}: {exc}", file=sys.stderr, flush=True)
                time.sleep(5 * attempt)
        else:
            raise RuntimeError(f"Failed {source.name}: {last_err}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
