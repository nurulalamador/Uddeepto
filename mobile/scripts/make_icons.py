"""Draws the Uddeepto app icons (the website's logo mark: a white "u" in Figtree on a green gradient, with an orange star)
into mobile/assets. Needs fonttools and the sharp package from ../e2e/node_modules.   python scripts/make_icons.py"""
import json, subprocess, tempfile, os, pathlib
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

root = pathlib.Path(__file__).resolve().parent.parent
font = TTFont(root / "node_modules/@expo-google-fonts/figtree/800ExtraBold/Figtree_800ExtraBold.ttf")
glyphs = font.getGlyphSet()
glyph_name = font.getBestCmap()[ord("u")]
bounds = BoundsPen(glyphs)
glyphs[glyph_name].draw(bounds)
gx0, gy0, gx1, gy1 = bounds.bounds


def u_path(cx, cy, height):
    """The "u" glyph as an SVG path, centred on (cx, cy) and `height` units tall."""
    scale = height / (gy1 - gy0)
    width = (gx1 - gx0) * scale
    pen = SVGPathPen(glyphs)
    # font units go up, SVG goes down: flip y, move the glyph so its box is centred on (cx, cy)
    transform = (scale, 0, 0, -scale, cx - width / 2 - gx0 * scale, cy + height / 2 + gy0 * scale)
    glyphs[glyph_name].draw(TransformPen(pen, transform))
    return pen.getCommands()


def star(cx, cy, r):
    """A four-pointed star with concave sides, like the website's sparkle."""
    k = r * 0.22
    return (f"M{cx} {cy - r} Q{cx + k} {cy - k} {cx + r} {cy} Q{cx + k} {cy + k} {cx} {cy + r} "
            f"Q{cx - k} {cy + k} {cx - r} {cy} Q{cx - k} {cy - k} {cx} {cy - r} Z")


def mark(size, zone, rounded=False, background=True, glyph="#ffffff", sparkle="#ffc28b"):
    """The logo on a `size` square. `zone` is the part of the square the artwork may use (adaptive icons keep ~66%)."""
    pad = (size - zone) / 2
    cx, cy = size / 2, size / 2 + zone * 0.03
    u_height = zone * 0.5
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 {size} {size}">',
             '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#42a675"/><stop offset="1" stop-color="#124b36"/></linearGradient></defs>']
    if background:
        radius = size * 0.225 if rounded else 0
        parts.append(f'<rect width="{size}" height="{size}" rx="{radius}" fill="url(#g)"/>')
    parts.append(f'<path d="{u_path(cx - zone * 0.03, cy + zone * 0.02, u_height)}" fill="{glyph}"/>')
    parts.append(f'<path d="{star(pad + zone * 0.80, pad + zone * 0.24, zone * 0.1)}" fill="{sparkle}"/>')
    parts.append("</svg>")
    return "\n".join(parts)


def background_only(size):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}"><defs>'
            '<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#42a675"/><stop offset="1" stop-color="#124b36"/></linearGradient></defs>'
            f'<rect width="{size}" height="{size}" fill="url(#g)"/></svg>')


jobs = {
    "icon.png": (mark(1024, 1024), 1024),                                   # legacy / store icon: full bleed
    "android-icon-foreground.png": (mark(1024, 680, background=False), 1024),  # adaptive icon: artwork inside the safe zone
    "android-icon-background.png": (background_only(1024), 1024),
    "android-icon-monochrome.png": (mark(1024, 680, background=False, glyph="#000000", sparkle="#000000"), 1024),
    "splash-icon.png": (mark(512, 512, rounded=True), 512),
    "favicon.png": (mark(96, 96, rounded=True), 96),
}
work = pathlib.Path(tempfile.mkdtemp())
manifest = []
for name, (svg, size) in jobs.items():
    svg_file = work / (name + ".svg")
    svg_file.write_text(svg, encoding="utf8")
    manifest.append({"svg": str(svg_file), "png": str(root / "assets" / name), "size": size})
script = ("const sharp=require(process.argv[1]);const jobs=JSON.parse(process.argv[2]);"
          "(async()=>{for(const j of jobs){await sharp(j.svg,{density:72}).resize(j.size,j.size).png().toFile(j.png);console.log('wrote',j.png)}})()")
sharp_path = str((root.parent / "e2e/node_modules/sharp").resolve())
subprocess.run(["node", "-e", script, sharp_path, json.dumps(manifest)], check=True)
