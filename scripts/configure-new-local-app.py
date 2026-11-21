#!/usr/bin/env python3
"""Define identidade Android separada para testes da nova versão local."""
from pathlib import Path
import re,sys
root=Path(sys.argv[1] if len(sys.argv)>1 else 'ospro-eletrica-software')
gradle=root/'app/build.gradle.kts'
text=gradle.read_text(encoding='utf-8')
pattern=r'(?m)^(\s*applicationId\s*=\s*")[^"]+(")'
matches=list(re.finditer(pattern,text))
if len(matches)!=1:raise SystemExit('ERRO: applicationId Android ausente ou ambiguo; nao distribuir APK.')
new_id='br.com.ospro.ordens.local'
text=re.sub(pattern,lambda m:m.group(1)+new_id+m.group(2),text,count=1)
gradle.write_text(text,encoding='utf-8')
assert f'applicationId = "{new_id}"' in text
print('Identidade de instalacao independente:',new_id)
