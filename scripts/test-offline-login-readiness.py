#!/usr/bin/env python3
"""Valida o contrato do login offline sem habilitar bypass nem criar administrador."""
from pathlib import Path
import json,sys
root=Path(sys.argv[1] if len(sys.argv)>1 else 'ospro-eletrica-software')
assets=root/'app/src/main/assets'
report=json.loads((root/'auth-local-integration-report.json').read_text('utf8'))
expected={'auth-screen','auth-login','auth-message'}
ids=set(report.get('login_ui_ids',[]))
assert expected.issubset(ids),f'Campos de login ausentes: {expected-ids}'
assert '/api/team/login' in report.get('remote_login_routes',[])
assert report.get('script_load_order',[]).index('local-auth-prototype.js')<report['script_load_order'].index('auth.js')
assert report.get('offline_login_implemented') is False
assert report.get('migration_approved') is False
auth=(assets/'auth.js').read_text('utf8')
assert '/api/team/login' in auth
proto=(assets/'local-auth-prototype.js').read_text('utf8')
assert 'Provisionamento bloqueado até migração autenticada e validada.' in proto
print('OK: campos e dependências identificados; login remoto permanece ativo.')
print('BLOQUEIO SEGURO: não criar admin local antes de migração autorizada ou instalação nova comprovada.')
