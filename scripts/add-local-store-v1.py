#!/usr/bin/env python3
"""Inclui a camada IndexedDB no APK sem alterar o fluxo de login existente."""
from pathlib import Path
import shutil
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else 'ospro-eletrica-software')
assets = root / 'app/src/main/assets'
source = Path(__file__).with_name('local-store-v1.js')
target = assets / 'local-store.js'
html = assets / 'index.html'
if not source.is_file() or not html.is_file():
    raise SystemExit('Fontes do APK não encontradas.')
shutil.copyfile(source, target)
shutil.copyfile(Path(__file__).with_name('local-modules-v1.js'), assets / 'local-modules.js')
markup = html.read_text(encoding='utf-8')
tag = '  <script src="local-store.js" defer></script>\n  <script src="local-modules.js" defer></script>'
if 'src="local-modules.js"' not in markup:
    if '</body>' not in markup:
        raise SystemExit('index.html sem fechamento de body.')
    markup = markup.replace('</body>', tag + '\n</body>', 1)
    html.write_text(markup, encoding='utf-8')
print('Camada local instalada; módulos e autenticação ainda precisam de adaptação.')
