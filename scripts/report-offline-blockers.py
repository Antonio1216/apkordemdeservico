#!/usr/bin/env python3
"""Relatório de bloqueios para migração offline. Nunca exporta código ou segredos."""
from pathlib import Path
import json,re,sys
root=Path(sys.argv[1] if len(sys.argv)>1 else 'ospro-eletrica-software')
assets=root/'app/src/main/assets'
if not assets.is_dir():raise SystemExit('Assets Android ausentes')
rules={
 'render':re.compile(r'onrender\.com',re.I),
 'team_api':re.compile(r'/api/team/',re.I),
 'fetch':re.compile(r'\bfetch\s*\('),
 'xhr':re.compile(r'\bXMLHttpRequest\b'),
 'websocket':re.compile(r'\bWebSocket\s*\('),
}
findings=[]
for path in sorted(assets.rglob('*')):
 if path.suffix not in ('.js','.html') or not path.is_file():continue
 counts={k:0 for k in rules}
 lines=path.read_text(encoding='utf-8',errors='replace').splitlines()
 for line in lines:
  for k,rx in rules.items():
   if rx.search(line):counts[k]+=1
 if any(counts.values()):
  findings.append({'file':str(path.relative_to(assets)),'counts':{k:v for k,v in counts.items() if v}})
report={
 'schema':1,
 'branch_goal':'acr-os-pro-novo-local',
 'offline_ready':False,
 'validated_on_android':False,
 'migration_approved':False,
 'findings':findings,
 'note':'Counts only; no source lines, tokens, URLs or user data.'
}
out=root/'offline-blockers.json'
out.write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
print('Arquivos com dependencias a revisar:',len(findings))
for item in findings:print(item['file'],item['counts'])
print('Offline nao validado; relatorio em',out)
