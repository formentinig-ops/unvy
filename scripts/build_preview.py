#!/usr/bin/env python3
"""Costruisce l'anteprima dell'app (un solo file HTML) per il pannello Artifact di Claude.

Uso: python3 scripts/build_preview.py SNAPSHOT.json OUT_DIR [REGOLAMENTO.pdf]

- SNAPSHOT.json: fotografia dei dati presa da Supabase (PRIVATA: non metterla nel repository)
- OUT_DIR: cartella dove scrivere index.html e le icone (fuori dal repository)
L'anteprima usa gli stessi index.html, styles.css e app.js dell'app vera, con il finto
backend di scripts/preview_mock.js al posto di Supabase.
"""
import base64
import datetime as dt
import json
import os
import re
import shutil
import sys

ROOT = os.path.join(os.path.dirname(__file__), '..')
rd = lambda p: open(os.path.join(ROOT, p), encoding='utf-8').read()


def main():
    snap_path, out = sys.argv[1], sys.argv[2]
    pdf = sys.argv[3] if len(sys.argv) > 3 else None
    snap = json.load(open(snap_path, encoding='utf-8'))
    snap['snapAt'] = dt.datetime.now().isoformat(timespec='seconds')
    html = rd('index.html')
    css = rd('styles.css')
    app = rd('app.js')
    mock = rd('scripts/preview_mock.js')
    fip = rd('data/fipav.json')
    doc = 'null'
    if pdf:
        doc = json.dumps({'nome': 'Regolamento', 'mime': 'application/pdf', 'b64': base64.b64encode(open(pdf, 'rb').read()).decode()})
    fip_safe = fip.replace('</', '<\\/')
    j = lambda o: json.dumps(o, ensure_ascii=False).replace('</', '<\\/')
    head = (
        '<script>window.UNVY_CONFIG={url:"https://anteprima.unvy",key:"anteprima",fipav:"",vapid:""};'
        f'window.UNVY_SNAPSHOT={j(snap)};window.UNVY_FIPAV={fip_safe};window.UNVY_DOC={doc};</script>\n'
        f'<script>{mock}</script>\n<script>{app}</script>'
    )
    html = html.replace('<link rel="stylesheet" href="styles.css">', f'<style>{css}</style>')
    html = re.sub(r'<script src="config.js"></script>\s*<script src="app.js"></script>', lambda m: head, html)
    html = html.replace('<link rel="manifest" href="manifest.webmanifest">', '')
    os.makedirs(os.path.join(out, 'icons'), exist_ok=True)
    for f in ('logo-crop.png', 'icon-192.png', 'apple-touch-icon.png'):
        shutil.copy(os.path.join(ROOT, 'icons', f), os.path.join(out, 'icons', f))
    open(os.path.join(out, 'index.html'), 'w', encoding='utf-8').write(html)
    print('Anteprima scritta in', os.path.join(out, 'index.html'), len(html) // 1024, 'KB')


if __name__ == '__main__':
    main()
