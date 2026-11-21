#!/usr/bin/env python3
"""Extract only the Android auth API surface for safe offline integration review."""
from pathlib import Path
import re,sys,json
root=Path(sys.argv[1] if len(sys.argv)>1 else 'ospro-eletrica-software')
source=(root/'app/src/main/assets/auth.js').read_text(encoding='utf-8')
patterns=[
 r'\b(?:async\s+)?function\s+(?:login|logout|request|reloadWorkspace|ready|saveUser|removeUser)\b',
 r'\bwindow\.OSAuth\s*=',
 r'\b(?:sessionStorage|localStorage)\.',
 r'\b(?:fetch|XMLHttpRequest)\s*\(',
 r'\b/api/team/[a-zA-Z/-]+'
]
lines=source.splitlines()
matches=[]
for i,line in enumerate(lines,1):
 if any(re.search(pattern,line) for pattern in patterns):
  # Do not print actual code, credentials, URLs, or tokens.
  labels=[name for name,pat in [('login','login'),('logout','logout'),('request','request'),('reloadWorkspace','reloadWorkspace'),('OSAuth','window.OSAuth'),('browser-storage','Storage'),('HTTP','fetch('),('team-API','/api/team/')] if pat.lower() in line.lower()]
  matches.append({'line':i,'categories':labels or ['authentication']})
report={'file':'auth.js','line_count':len(lines),'matches':matches,'offline_login_implemented':False,'note':'Metadata only; no passwords, code bodies or API secrets.'}
output=root/'auth-local-integration-report.json'
output.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('Auditoria do contrato de autenticação concluída:',len(matches),'referências.')
print('Relatório:',output)
