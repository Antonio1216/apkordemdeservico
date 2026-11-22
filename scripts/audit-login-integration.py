#!/usr/bin/env python3
"""Audita pontos de integração do login sem imprimir segredos ou alterar o aplicativo."""
from pathlib import Path
import json,re,sys
root=Path(sys.argv[1] if len(sys.argv)>1 else 'ospro-eletrica-software')
assets=root/'app/src/main/assets'
html=(assets/'index.html').read_text('utf8')
auth=(assets/'auth.js').read_text('utf8')
app=(assets/'app.js').read_text('utf8')
ids=['auth-screen','auth-login','auth-message']
report={
 'screen_ids':{key:bool(re.search(r'id=["\']'+re.escape(key)+r'["\']',html)) for key in ids},
 'remote_endpoints':sorted(set(re.findall(r'/api/[a-zA-Z0-9/_-]+',auth+'\n'+app))),
 'auth_global_exports':sorted(set(re.findall(r'(?:window|globalThis)\.([A-Za-z_$][\w$]*)\s*=',auth))),
 'auth_dom_handlers':sorted(set(re.findall(r'getElementById\(["\']([^"\']+)["\']\)',auth))),
 'app_auth_references':sorted(set(re.findall(r'\bOSAuth\.[A-Za-z_$][\w$]*',app))),
 'local_scripts_present':all((assets/name).exists() for name in ['local-store.js','senha-local.js','local-first-run.js','local-auth-prototype.js']),
 'offline_ready':False,
 'reason':'A tela, sessão e APIs de negócio ainda exigem integração e testes funcionais.'
}
path=root/'offline-login-readiness.json'
path.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print('Diagnóstico de integração:',path)
print('Login offline não ativado; sem exposição de senhas ou tokens.')
