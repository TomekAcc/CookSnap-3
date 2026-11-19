"""Puts a captured app screen (PNG from capture.js) into an existing store slide, keeping the slide's green
background, caption and phone frame exactly as they are. The inside of the frame is found from the slide itself (the
dark ring around the screen), the capture is scaled to its width and pinned to its top edge, and anything below the
frame's bottom curve is cut off.

    python compose.py <template-slide.jpg> <capture.png> <out.jpg>
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

tpl_path, cap_path, out_path = sys.argv[1:4]
tpl = Image.open(tpl_path).convert('RGB')
W, H = tpl.size
a = np.asarray(tpl).astype(int)

dark = a.sum(axis=2) < 190                      # the navy frame is about (15, 23, 42)
lab, _ = ndi.label(dark, structure=np.ones((3, 3)))
row = int(H * 0.5)
xs = [x for x in range(int(W * 0.05), int(W * 0.25)) if dark[row, x]]
ring = lab == lab[row, xs[0]]                   # the frame: dark pixels connected to the left bezel
lab2, _ = ndi.label(~ring)
inner = lab2 == lab2[row, W // 2]               # everything the frame encloses
inner = ndi.binary_erosion(inner, iterations=1) # keep the frame's anti-aliased edge intact
ys, xx = np.where(inner)
x0, x1, y0, y1 = xx.min(), xx.max() + 1, ys.min(), ys.max() + 1

cap = Image.open(cap_path).convert('RGB')
scale = (x1 - x0) / cap.width
cap = cap.resize((x1 - x0, round(cap.height * scale)), Image.LANCZOS)
layer = Image.new('RGB', (W, H), (245, 245, 247))
layer.paste(cap.crop((0, 0, cap.width, min(cap.height, y1 - y0))), (x0, y0))
mask = Image.fromarray((inner * 255).astype(np.uint8), 'L')
tpl.paste(layer, (0, 0), mask)
tpl.save(out_path, quality=93, subsampling=0)
print('screen', x0, y0, x1, y1, 'scale', round(scale, 3), '->', out_path)
