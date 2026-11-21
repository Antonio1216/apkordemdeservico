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
shutil.copyfile(Path(__file__).with_name('local-password-v1.js'), assets / 'senha-local.js')
shutil.copyfile(Path(__file__).with_name('local-auth-prototype.js'), assets / 'local-auth-prototype.js')
markup = html.read_text(encoding='utf-8')
anchor = '<script src="auth.js" defer></script>'
if anchor not in markup:
    raise SystemExit('Script auth.js não encontrado; integração interrompida.')
modules = ['local-store.js', 'local-modules.js', 'senha-local.js', 'local-auth-prototype.js']
# Reconciliar instalação parcial sem duplicar scripts.
import re
for module in modules:
    markup = re.sub(r'<script\\s+src=["\\']' + re.escape(module) + r'["\\']\\s+defer\\s*></script>\\s*', '', markup)
tags = '\\n'.join('  <script src="' + module + '" defer></script>' for module in modules)
markup = markup.replace(anchor, tags + '\\n  ' + anchor, 1)
html.write_text(markup, encoding='utf-8')
if any(markup.count('src="' + module + '"') != 1 for module in modules):
    raise SystemExit('Módulos locais duplicados ou ausentes.')
print('Camada local instalada de modo idempotente; login offline NÃO ativado.')
