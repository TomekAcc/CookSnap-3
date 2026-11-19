"""Puts a captured app screen (PNG from capture.js) into an existing store slide, keeping the slide's green
background, caption and phone frame exactly as they are. The inside of the frame is found from the slide itself (the
dark ring around the screen), the capture is scaled to its width and pinned to its top edge, and anything below the
frame's bottom curve is cut off.

    python compose.py <template-slide.jpg> <capture.png> <out.jpg>
"""
import sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

tpl_path, cap_path, out_path = sys.argv[1:4]
tpl = Image.open(tpl_path).convert('RGB')
W, H = tpl.size
a = np.asarray(tpl).astype(int)

import os
MASK = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'frame-mask.png')
ring_ref = None
if os.path.exists(MASK) and Image.open(MASK).size == (W, H):
    # The phone frame sits in the same place on every slide. The saved mask (made from a slide whose screen touches nothing
    # dark) is used so dark content of an OLD screen that touches the frame cannot be mistaken for part of the frame.
    inner = np.asarray(Image.open(MASK).convert('L')) > 127
else:
    dark = a.sum(axis=2) < 190                  # the navy frame is about (15, 23, 42)
    lab, _ = ndi.label(dark, structure=np.ones((3, 3)))
    row = int(H * 0.5)
    xs = [x for x in range(int(W * 0.05), int(W * 0.25)) if dark[row, x]]
    ring = lab == lab[row, xs[0]]               # the frame: dark pixels connected to the left bezel
    lab2, _ = ndi.label(~ring)
    inner = lab2 == lab2[row, W // 2]           # everything the frame encloses
    Image.fromarray((inner * 255).astype(np.uint8), 'L').save(MASK)   # keep it for the next slides
ys, xx = np.where(inner)
FRAME = 19                                        # thickness of the frame ring in slide pixels
x0, x1, y0, y1 = xx.min(), xx.max() + 1, ys.min(), ys.max() + 1

cap = Image.open(cap_path).convert('RGB')
scale = (x1 - x0) / cap.width
cap = cap.resize((x1 - x0, round(cap.height * scale)), Image.LANCZOS)
layer = Image.new('RGB', (W, H), (245, 245, 247))
layer.paste(cap.crop((0, 0, cap.width, min(cap.height, y1 - y0))), (x0, y0))
mask = Image.fromarray((inner * 255).astype(np.uint8), 'L')
tpl.paste(layer, (0, 0), mask)

# Make the phone read as a modern iPhone: Dynamic Island, home indicator and side buttons (generic shapes, no brand marks).
SS = 3
ov = Image.new('RGBA', (W * SS, H * SS), (0, 0, 0, 0))
d = ImageDraw.Draw(ov)
ppt = (x1 - x0) / 430.0                          # slide pixels per phone point
cx = (x0 + x1) / 2
box = lambda a, b, c, e, r, fill: d.rounded_rectangle((a * SS, b * SS, c * SS, e * SS), radius=r * SS, fill=fill)
box(cx - 63 * ppt, y0 + 11 * ppt, cx + 63 * ppt, y0 + 48 * ppt, 18.5 * ppt, (0, 0, 0, 255))              # Dynamic Island 126 x 37 pt
box(cx - 67 * ppt, y1 - 13 * ppt, cx + 67 * ppt, y1 - 8 * ppt, 2.5 * ppt, (15, 23, 42, 235))               # home indicator 134 x 5 pt
for a, b in ((1000, 1090), (1180, 1340), (1385, 1545)):                                                    # action, volume up, volume down
    box(x0 - FRAME - 10, a, x0 - FRAME + 4, b, 5, (15, 23, 42, 255))
box(x1 + FRAME - 4, 1250, x1 + FRAME + 10, 1470, 5, (15, 23, 42, 255))                                           # power
ov = ov.resize((W, H), Image.LANCZOS)
tpl = Image.alpha_composite(tpl.convert('RGBA'), ov).convert('RGB')
tpl.save(out_path, quality=93, subsampling=0)
print('screen', x0, y0, x1, y1, 'scale', round(scale, 3), '->', out_path)
