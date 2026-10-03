#!/usr/bin/env python3
"""Assemble la synthèse : python3 build.py  ->  ../synthese-chimie-polymerisation.html"""
import base64
import json
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from chem import runs  # noqa: E402
from figures import F  # noqa: E402


def fonts_css():
    faces = json.loads((HERE / 'fonts' / 'fonts.json').read_text())
    out = []
    for f in faces:
        data = base64.b64encode((HERE / 'fonts' / f['file']).read_bytes()).decode()
        out.append(f"@font-face{{font-family:'{f['fam']}';font-style:{f['style']};font-weight:{f['weight']};"
                   f"font-display:block;src:url(data:font/woff2;base64,{data}) format('woff2');unicode-range:{f['ur']};}}")
    return '\n'.join(out)


def chem_html(m):
    s = m.group(1).replace('-', '–')
    html = ''.join(f'<sub>{t}</sub>' if sub else t for t, sub in runs(s))
    return f'<span class="f">{html}</span>'


def build():
    tpl = (HERE / 'template.html').read_text()
    tpl = re.sub(r'⟦([^⟧]*)⟧', chem_html, tpl)
    tpl = tpl.replace('{{FONTS}}', fonts_css())

    def fig(m):
        k = m.group(1)
        if k not in F:
            raise KeyError(f'figure inconnue : {k}')
        return F[k]
    html = re.sub(r'\{\{(\w+)\}\}', fig, tpl)
    out = HERE.parent / 'synthese-chimie-polymerisation.html'
    out.write_text(html)
    print(out, len(html) // 1024, 'Ko')


if __name__ == '__main__':
    build()
