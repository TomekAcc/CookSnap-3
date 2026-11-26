# CookSnap icon, drawn as vector. Everything in a 1024 x 1024 box. Variants share one geometry.
# Shape: a fridge in a camera viewfinder with a gold scan line that fills the gap in the fridge doors exactly (no extra
# margin around it). Measured from the approved raster design, then redrawn as plain shapes.
import sys, os
EMERALD = '#10B981'  # the app's main green (EMERALD[500]): the "Snap" in the wordmark
GOLD = '#FFD60A'     # the scan line

def svg(bg=EMERALD, body='#FFFFFF', line=GOLD, brack='#FFFFFF', transparent=False, line_margin=0):
    """line_margin > 0 cuts a transparent gap around the line (used by the single-colour Android icon, where a
    white line on a white fridge would disappear)."""
    def corner(sx, sy):  # one bracket, drawn for the top-left corner and mirrored
        t = f'translate({1024 if sx < 0 else 0} {1024 if sy < 0 else 0}) scale({sx} {sy})'
        return f'<path transform="{t}" d="M95 254V150A55 55 0 0 1 150 95H254"/>'
    gap_y, gap_h = 498 - line_margin, 51 + 2 * line_margin
    bgrect = '' if transparent else f'<rect width="1024" height="1024" fill="{bg}"/>'
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
<defs>
<mask id="cut" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">
<rect width="1024" height="1024" fill="#fff"/>
<rect x="296" y="397" width="432" height="23" fill="#000"/>
<rect x="296" y="{gap_y}" width="432" height="{gap_h}" fill="#000"/>
<rect x="354" y="238" width="37" height="123" rx="18.5" fill="#000"/>
<rect x="354" y="466" width="37" height="133" rx="18.5" fill="#000"/>
</mask>
</defs>
{bgrect}
<g fill="none" stroke="{brack}" stroke-width="53" stroke-linecap="round" stroke-linejoin="round">{corner(1,1)}{corner(-1,1)}{corner(1,-1)}{corner(-1,-1)}</g>
<rect x="304" y="160" width="416" height="697" rx="45" fill="{body}" mask="url(#cut)"/>
<rect x="118" y="498" width="787" height="51" rx="25.5" fill="{line}"/>
</svg>
'''

if __name__ == '__main__':
    sys.dont_write_bytecode = True
    out = sys.argv[1] if len(sys.argv) > 1 else '.'
    os.makedirs(out, exist_ok=True)
    open(out + '/icon-light.svg', 'w').write(svg())
    open(out + '/icon-dark.svg', 'w').write(svg(bg='#064E3B'))
    open(out + '/icon-tinted.svg', 'w').write(svg(bg='#000000', line='#AAAAAA'))
    open(out + '/icon-glyph.svg', 'w').write(svg(transparent=True))                       # colour glyph, transparent
    open(out + '/icon-glyph-mono.svg', 'w').write(svg(transparent=True, line='#FFFFFF', line_margin=18))  # Android themed icon
