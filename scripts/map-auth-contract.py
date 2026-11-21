#!/usr/bin/env python3
"""Read-only metadata report of Android authentication; never export source or secrets."""
from pathlib import Path
import re,sys,json
root=Path(sys.argv[1] if len(sys.argv)>1 else 'ospro-eletrica-software')
assets=root/'app/src/main/assets'
auth=(assets/'auth.js').read_text(encoding='utf-8')
html=(assets/'index.html').read_text(encoding='utf-8')
app=(assets/'app.js').read_text(encoding='utf-8')
def summarize(source):
    patterns={
      'login_functions':r'\b(?:async\s+)?function\s+(login|logout|request|reloadWorkspace|ready|saveUser|removeUser)\b',
      'api_calls':r'\bfetch\s*\(|\bXMLHttpRequest\b',
      'team_routes':r'/api/team/[a-zA-Z/-]+',
      'browser_storage':r'\b(?:localStorage|sessionStorage)\.',
      'auth_exports':r'\b(?:window|globalThis)\.OSAuth\b',
    }
    result={}
    for label,pattern in patterns.items():
        found=[i for i,line in enumerate(source.splitlines(),1) if re.search(pattern,line)]
        result[label]={'count':len(found),'line_numbers':found[:100]}
    return result
def declarations(source):
    # Function names and line numbers only; never include function bodies.
    pattern = re.compile(r'\\b(?:async\\s+)?function\\s+([A-Za-z_$][\\w$]*)\\s*\\(')
    return [{'name':m.group(1),'line':source.count('\\n',0,m.start())+1}
            for m in pattern.finditer(source)][:150]

scripts=re.findall(r"""<script[^>]+src=["']([^"']+)["']""", html)
report={
 'authentication_source':'auth.js',
 'auth':summarize(auth),
 'auth_function_declarations':declarations(auth),
 'app':summarize(app),
 'script_load_order':[x for x in scripts if x in ('local-store.js','local-modules.js','senha-local.js','local-auth-prototype.js','auth.js','app.js')],
 'offline_login_implemented':False,
 'offline_login_validated_on_device':False,
 'migration_approved':False,
 'note':'Only structural metadata; no source code, user records, credentials or tokens.'
}
output=root/'auth-local-integration-report.json'
output.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('Mapa de autenticação gerado sem dados sensíveis:',output)
print('Login offline ainda não ativado.')
