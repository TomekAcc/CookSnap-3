# CookSnap icon, drawn as vector. Everything in a 1024 x 1024 box. Variants share one geometry.
import sys, os
EMERALD='#10B981'
def svg(bg=EMERALD, body='#FFFFFF', line='#FFC800', brack='#FFFFFF', transparent=False):
    bgrect='' if transparent else f'<rect width="1024" height="1024" fill="{bg}"/>'
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
<defs>
<mask id="cut" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">
<rect width="1024" height="1024" fill="#fff"/>
<rect x="320" y="404" width="384" height="76" fill="#000"/>
<rect x="384" y="304" width="26" height="68" rx="13" fill="#000"/>
<rect x="384" y="520" width="26" height="130" rx="13" fill="#000"/>
</mask>
</defs>
{bgrect}
<g fill="none" stroke="{brack}" stroke-width="56" stroke-linecap="round" stroke-linejoin="round">
<path d="M150 296V206A56 56 0 0 1 206 150H296"/>
<path d="M874 296V206A56 56 0 0 0 818 150H728"/>
<path d="M150 728V818A56 56 0 0 0 206 874H296"/>
<path d="M874 728V818A56 56 0 0 1 818 874H728"/>
</g>
<rect x="342" y="262" width="340" height="500" rx="62" fill="{body}" mask="url(#cut)"/>
<rect x="212" y="422" width="600" height="40" rx="20" fill="{line}"/>
</svg>
'''
if __name__=='__main__':
    out=sys.argv[1]; os.makedirs(out,exist_ok=True)
    open(out+'/light.svg','w').write(svg())
    open(out+'/dark.svg','w').write(svg(bg='#064E3B'))
    open(out+'/tinted.svg','w').write(svg(bg='#000000',line='#AAAAAA'))
    open(out+'/glyph-color.svg','w').write(svg(transparent=True))
    open(out+'/glyph-white.svg','w').write(svg(transparent=True,line='#FFFFFF'))
