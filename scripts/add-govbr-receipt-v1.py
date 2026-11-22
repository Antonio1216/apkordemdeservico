#!/usr/bin/env python3
"""Instala interface de importação GOV.BR no Financeiro, sem alterar registros existentes."""
from pathlib import Path
import shutil,sys
root=Path(sys.argv[1] if len(sys.argv)>1 else 'ospro-eletrica-software')
assets=root/'app/src/main/assets'
html=assets/'index.html'
markup=html.read_text(encoding='utf-8')
if 'id="financeiro"' not in markup:
    raise SystemExit('Aba Financeiro não encontrada. Nenhuma alteração aplicada.')
tag='<script src="govbr-receipt.js" defer></script>'
if tag not in markup:
    if '</body>' not in markup:raise SystemExit('HTML sem fechamento do body.')
    markup=markup.replace('</body>','  '+tag+'\n</body>',1)
    html.write_text(markup,encoding='utf-8')
shutil.copyfile(Path(__file__).with_name('govbr-receipt-v1.js'),assets/'govbr-receipt.js')
print('Interface GOV.BR instalada. Compartilhamento usa Web Share quando disponível; sem envio automático.')
