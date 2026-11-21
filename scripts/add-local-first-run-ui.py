#!/usr/bin/env python3
"""Adiciona a tela de configuração somente na nova variante Android."""
from pathlib import Path
import shutil,sys
root=Path(sys.argv[1] if len(sys.argv)>1 else 'ospro-eletrica-software')
assets=root/'app/src/main/assets'
html=assets/'index.html'
source=Path(__file__).with_name('local-first-run-ui.js')
shutil.copyfile(source,assets/'local-first-run-ui.js')
markup=html.read_text(encoding='utf-8')
anchor='<script src="auth.js" defer></script>'
tag='<script src="local-first-run-ui.js" defer></script>'
if markup.count(anchor)!=1:raise SystemExit('Ponto de inserção do login não encontrado.')
markup=markup.replace(tag,'')
markup=markup.replace(anchor,tag+'\n  '+anchor,1)
if markup.count(tag)!=1:raise SystemExit('Tela local duplicada.')
html.write_text(markup,encoding='utf-8')
print('Tela experimental de primeiro acesso instalada somente na nova variante.')
