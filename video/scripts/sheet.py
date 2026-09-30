"""Tile rendered stills into one contact sheet: python scripts/sheet.py out.png a.png b.png ..."""
import sys
from PIL import Image, ImageDraw
out, files = sys.argv[1], sys.argv[2:]
w, h, cols = 960, 540, 2
rows = -(-len(files) // cols)
sheet = Image.new("RGB", (w * cols, h * rows), "black")
for i, f in enumerate(files):
    im = Image.open(f).convert("RGB").resize((w, h))
    ImageDraw.Draw(im).text((10, 8), f.split("/")[-1], fill="yellow")
    sheet.paste(im, ((i % cols) * w, (i // cols) * h))
sheet.save(out)
