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
shutil.copyfile(Path(__file__).with_name('senha-local-v1.js'), assets / 'senha-local.js')
markup = html.read_text(encoding='utf-8')
tag = '  <script src="local-store.js" defer></script>\n  <script src="local-modules.js" defer></script>\n  <script src="senha-local.js" defer></script>'
if 'src="local-modules.js"' not in markup:
    if '</body>' not in markup:
        raise SystemExit('index.html sem fechamento de body.')
    anchor = '<script src="auth.js" defer></script>'
    if anchor not in markup:
        raise SystemExit('Script auth.js não encontrado para garantir a ordem de carregamento.')
    markup = markup.replace(anchor, tag + '\n  ' + anchor, 1)
    html.write_text(markup, encoding='utf-8')
if 'src="senha-local.js"' not in markup and 'src="senha-local.js"' not in html.read_text(encoding='utf-8'):
    raise SystemExit('Módulo de senha local não incluído no HTML.')
print('Camada local e verificador de senhas incluídos; login offline ainda NÃO ativado.')
