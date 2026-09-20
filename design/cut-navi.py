"""Cut the Navi poses out of the character sheet.

The sheet's twelve portraits sit on a regular 4x3 grid, but the hair spills
past the cell edges into its neighbours, so the crop is a fixed window inside
each cell rather than the alpha bounding box -- a bbox picks up the next
portrait's fringe and re-centres the face around it.
"""
import pathlib

from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
SRC = HERE / "navi-sheet.webp"
OUT = HERE.parent / "frontend" / "public" / "mascot"

sheet = Image.open(SRC).convert("RGBA")


def save(img, path):
    """Write a PNG8 with transparency.

    Flat cel shading over a transparent background quantises without a visible
    difference, and it is the difference between 1.1 MB of mascot and 220 KB --
    which matters here because these are the largest images the app ships after
    the URS seal.
    """
    img.quantize(colors=256, method=Image.FASTOCTREE).save(path, optimize=True)
    print(path.name, img.size)


XS = [352, 577, 802, 1027, 1252]          # column edges
YS = [(106, 449), (473, 817), (834, 1187)]  # row edges
INSET = 9        # drops the neighbouring portrait's fringe
HEIGHT = 268     # head, shoulders and the URS badge on the vest

# row, column, and any extra inset needed on one side. "excited" keeps the
# spark drawn above its own left shoulder; "listening" sits next to it and has
# to give that side a wider berth or it inherits half a spark.
FACES = {
    "helpful":   (0, 0, {}),                 # bright, mid-explanation
    "happy":     (0, 2, {}),                 # soft closed-mouth smile
    "idle":      (0, 3, {}),                 # calm and attentive
    "thinking":  (1, 0, {}),                 # finger to chin
    "listening": (1, 1, {"right": 34}),      # alert, caught mid-listen
    "excited":   (1, 2, {"left": -8}),       # wink and a spark
    "working":   (2, 0, {}),                 # concerned, something is wrong
}

for name, (r, c, trim) in FACES.items():
    x0 = XS[c] + INSET + trim.get("left", 0)
    x1 = XS[c + 1] - INSET - trim.get("right", 0)
    y0 = YS[r][0]
    cell = sheet.crop((x0, y0, x1, y0 + HEIGHT))
    w, h = cell.size
    side = max(w, h)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(cell, ((side - w) // 2, (side - h) // 2))
    save(canvas.resize((256, 256), Image.LANCZOS), OUT / f"navi-{name}.png")

# Full figure, left of the sheet. Nothing crowds it, so the bounding box is
# the right frame here.
# 348 rather than the column edge at 352: the first portrait's hair has a
# soft left edge that reaches back over the gap and prints as a grey seam
# down the hero's right side.
hero = sheet.crop((0, 0, 348, 1254))
hero = hero.crop(hero.getbbox())
w, h = hero.size
hero = hero.resize((300, round(300 * h / w)), Image.LANCZOS)
save(hero, OUT / "navi-hero.png")

# The same figure from the head to just below the hands, for phone screens.
# The full hero is three and a half times taller than it is wide, so at any
# width that fits a phone it is 300-460px tall and pushes the page's actual
# buttons below the fold. Cropping rather than shrinking keeps the face, the
# lanyard and the tablet at a size somebody can actually see.
BUST = 0.46
FADE = 0.18   # share of the bust's height that dissolves into the background

bust = hero.crop((0, 0, hero.width, round(hero.height * BUST)))

# Without this the figure stops at a hard horizontal line across the waist,
# which reads as a picture that got cut off rather than a deliberate crop. The
# alpha ramps to nothing over the bottom of the image, so it fades out against
# whatever is behind it -- and works on the dark landing page and a light theme
# alike, which a painted-on gradient would not.
alpha = bust.getchannel("A")
fade_from = round(bust.height * (1 - FADE))
for y in range(fade_from, bust.height):
    scale = 1 - (y - fade_from) / (bust.height - fade_from)
    for x in range(bust.width):
        alpha.putpixel((x, y), round(alpha.getpixel((x, y)) * scale))
bust.putalpha(alpha)

save(bust, OUT / "navi-bust.png")
