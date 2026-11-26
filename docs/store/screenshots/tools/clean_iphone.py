"""Prepares a REAL iPhone screenshot (1206 x 2622, iPhone 16 Pro) for compose.py.

 1. Replaces the live status bar (real time, battery, mute bell) with a clean one: 9:41, full signal, Wi-Fi, full battery.
 2. The store phone frame is a little shorter than a real iPhone 16 Pro screen (aspect 2.03 vs 2.17). Flat, empty rows are
    removed from the top (status bar zone) and the bottom (below the tab bar labels), and the rest is squashed by ~1-2 %,
    so the whole screen, including the tab bar, fits the frame without being cut off or visibly distorted.

    python clean_iphone.py <screenshot.png> <out.png> [top-rows]
"""
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

src, out = sys.argv[1:3]
TOP_ARG = int(sys.argv[3]) if len(sys.argv) > 3 else 182   # optional: rows to treat as status-bar zone
im = Image.open(src).convert('RGB')
W, H = im.size
assert W == 1206, 'expected an iPhone 16 Pro screenshot 1206 px wide'
a = np.asarray(im).astype(int)

TOP_ZONE = TOP_ARG                      # rows above this hold only the status bar (content scrolls under it, hidden)
bg = tuple(int(v) for v in np.median(a[TOP_ZONE - 8:TOP_ZONE - 2, 4:40].reshape(-1, 3), axis=0))
draw = ImageDraw.Draw(im)
draw.rectangle((0, 0, W, TOP_ZONE), fill=bg)

# ---- clean status bar (drawn 4x, then reduced) ----
SS = 4
bar = Image.new('RGBA', (W * SS, TOP_ZONE * SS), (0, 0, 0, 0))
d = ImageDraw.Draw(bar)
ink = (0, 0, 0, 255)
cy = 98 * SS
font = ImageFont.truetype('/usr/share/fonts/opentype/inter/Inter-SemiBold.otf', 52 * SS)
tw = d.textlength('9:41', font=font)
d.text((200 * SS - tw / 2, cy), '9:41', font=font, fill=ink, anchor='lm')
# signal: 4 bars
for i, h in enumerate((13, 20, 27, 35)):
    x = 862 + i * 14
    d.rounded_rectangle((x * SS, (cy / SS + 17 - h) * SS, (x + 9) * SS, (cy / SS + 17) * SS), radius=3 * SS, fill=ink)
# wifi: three arcs and a dot
wx, wy = 968, cy / SS + 16
for r, w in ((34, 7), (23, 7), (12, 7)):
    d.arc(((wx - r) * SS, (wy - r) * SS, (wx + r) * SS, (wy + r) * SS), 225, 315, fill=ink, width=w * SS)
d.ellipse(((wx - 5) * SS, (wy - 5) * SS, (wx + 5) * SS, (wy + 5) * SS), fill=ink)
# battery: outline, full fill, tip
bx, by, bw, bh = 1020, cy / SS - 19, 74, 38
d.rounded_rectangle((bx * SS, by * SS, (bx + bw) * SS, (by + bh) * SS), radius=11 * SS, outline=(0, 0, 0, 105), width=3 * SS)
d.rounded_rectangle(((bx + 5) * SS, (by + 5) * SS, (bx + bw - 5) * SS, (by + bh - 5) * SS), radius=7 * SS, fill=ink)
d.rounded_rectangle(((bx + bw + 4) * SS, (by + 12) * SS, (bx + bw + 9) * SS, (by + bh - 12) * SS), radius=2 * SS, fill=(0, 0, 0, 105))
bar = bar.resize((W, TOP_ZONE), Image.LANCZOS)
im = im.convert('RGBA')
im.alpha_composite(bar, (0, 0))
im = im.convert('RGB')

# ---- fit the frame's proportions ----
TARGET = round(W * 2619 / 1290)     # 2448 rows at this width
HEAD = 130                         # keep the status bar rows; the flat rows after them (up to TOP_ZONE) can go
cut_top, cut_bottom = TOP_ZONE - HEAD, 76
body = im.crop((0, TOP_ZONE, W, H - cut_bottom))
parts = Image.new('RGB', (W, HEAD + body.height))
parts.paste(im.crop((0, 0, W, HEAD)), (0, 0))
parts.paste(body, (0, HEAD))
parts = parts.resize((W, TARGET), Image.LANCZOS)   # only a ~1 % squash is left
parts.save(out)
print(src, '->', out, parts.size)
