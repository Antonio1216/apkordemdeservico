#!/usr/bin/env python3
"""Gate fail-closed: never label an offline APK production-ready prematurely."""
from pathlib import Path
import sys
root=Path(sys.argv[1]) if len(sys.argv)>1 else Path('ospro-eletrica-software')
assets=root/'app/src/main/assets'
auth=(assets/'auth.js').read_text(encoding='utf-8')
app=(assets/'app.js').read_text(encoding='utf-8')
html=(assets/'index.html').read_text(encoding='utf-8')
checks={
  'local_store_loaded': 'src="local-store.js"' in html,
  'local_password_loaded': 'src="senha-local.js"' in html,
  'remote_team_api_remaining': '/api/team/' in auth,
  'remote_app_requests_remaining': 'fetch(' in app,
  'offline_login_end_to_end_tested': False,
  'users_and_permissions_migrated': False,
  'offline_crud_end_to_end_tested': False,
  'data_restore_verified_on_device': False,
  'original_signer_verified': False
}
for key,value in checks.items(): print(f'{key}={value}')
if checks['remote_team_api_remaining'] or checks['remote_app_requests_remaining'] or not all(checks[k] for k in ('offline_login_end_to_end_tested','users_and_permissions_migrated','offline_crud_end_to_end_tested','data_restore_verified_on_device','original_signer_verified')):
 print('BLOQUEADO: APK offline definitivo ainda não validado.')
 sys.exit(2)
print('APROVADO: requisitos completos.')
