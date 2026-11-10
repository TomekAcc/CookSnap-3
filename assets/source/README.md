# App icon sources

`icon-*.svg` are the vector masters of the CookSnap icon (a fridge in a camera viewfinder with an amber scan line),
drawn by hand in code, so the artwork belongs to the project without any AI-generated image in the final files.
`build-icon-svgs.py` regenerates the SVGs from one set of numbers. The PNGs in `assets/` (icon, icon-dark,
icon-tinted, adaptive-icon, android-icon-*, splash-icon, favicon) are renders of these files at their final sizes:
1024 px for the stores, with the Android foreground scaled to the 66% safe zone. Colours: emerald #10B981 (the app accent, the "Snap" in the wordmark), white, and the navy of the "Cook" in the wordmark (#0F172A) for the scan line; the dark variant has a #064E3B background and an emerald-400 scan line.
