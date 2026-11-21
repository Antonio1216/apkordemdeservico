#!/usr/bin/env python3
"""Auditoria estática do login Android; não altera autenticação nem divulga credenciais."""
from pathlib import Path
import re
import sys
root=Path(sys.argv[1]) if len(sys.argv)>1 else Path('ospro-eletrica-software')
assets=root/'app/src/main/assets'
auth=assets/'auth.js'
html=assets/'index.html'
if not auth.is_file() or not html.is_file():
    raise SystemExit('Arquivos de autenticação Android não encontrados')
source=auth.read_text(encoding='utf-8')
markup=html.read_text(encoding='utf-8')
checks={
  'Login usa API remota':bool(re.search(r'/api/team/(?:login|auth|session)',source,re.I)),
  'Referências genéricas à API da equipe':source.count('/api/team/'),
  'Chamadas fetch em auth.js':len(re.findall(r'\bfetch\s*\(',source)),
  'Armazenamento local incluído no HTML':'src="local-store.js"' in markup,
  'Repositórios locais incluídos no HTML':'src="local-modules.js"' in markup,
  'Autenticação original incluída no HTML':'src="auth.js"' in markup,
  'Métodos de autenticação mencionados':sorted(set(re.findall(r'\b(?:login|logout|refreshSession|reloadWorkspace|request|hasPermission)\b',source)))
}
print('AUDITORIA DE AUTENTICAÇÃO — SEM DADOS SENSÍVEIS')
for key,value in checks.items(): print(f'{key}: {value}')
print('RESULTADO: inventário estático; login offline ainda NÃO validado.')
