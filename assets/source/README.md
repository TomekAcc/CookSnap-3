# App icon sources

`icon-*.svg` are the vector masters of the CookSnap icon (a fridge in a camera viewfinder with a gold scan line that fills
the gap between the fridge doors), drawn by hand in code, so the artwork belongs to the project without any AI-generated
image in the final files. The shape was measured from the approved design and redrawn as plain shapes.

- `build-icon-svgs.py` regenerates the SVGs from one set of numbers (`python3 assets/source/build-icon-svgs.py assets/source`).
- `render-icon-pngs.js` renders them to the PNGs in `assets/` (`NODE_PATH=<dir with playwright> node assets/source/render-icon-pngs.js`):
  icon, icon-dark, icon-tinted (1024 px, no alpha, for the stores), favicon, splash-icon (rounded corners), and the Android
  adaptive-icon / android-icon-foreground / android-icon-monochrome with the logo inside the 66% safe zone.

Colours: emerald #10B981 (the app accent, the "Snap" in the wordmark) as the background, white fridge and viewfinder, gold #FFD60A
for the scan line. The dark variant has a #064E3B background (same gold line); the tinted variant is black with a grey line (iOS
colours it itself). The Android monochrome icon keeps a transparent gap around the line so it stays visible as one colour.
