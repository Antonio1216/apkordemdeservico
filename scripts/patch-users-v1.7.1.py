#!/usr/bin/env python3
from pathlib import Path
import sys

root=Path(sys.argv[1])
assets=root/'app/src/main/assets'
js=assets/'app.js'
html=assets/'index.html'
gradle=root/'app/build.gradle.kts'

text=js.read_text(encoding='utf-8')
old='const account=window.OSAuth.getAccount(x.id);'
new='const account=window.OSAuth.list().find(a=>a.id===x.id);'
if old not in text and new not in text:
    raise RuntimeError('Tela de usuarios diferente da versao esperada')
text=text.replace(old,new)
text=text.replace("window.OSProVersion = '1.7.0'","window.OSProVersion = '1.7.1'")
js.write_text(text,encoding='utf-8')

text=html.read_text(encoding='utf-8')
text=text.replace('Cadastre responsáveis e administradores locais.','Gerencie as contas centralizadas no servidor da equipe.')
text=text.replace('Os logins valem apenas neste aparelho; não há sincronização entre celulares.','Os logins são centralizados: cada conta pode acessar outros celulares conectados ao mesmo servidor HTTPS.')
html.write_text(text,encoding='utf-8')

text=gradle.read_text(encoding='utf-8')
if 'versionName = "1.7.0"' in text:
    text=text.replace('versionCode = 9','versionCode = 10').replace('versionName = "1.7.0"','versionName = "1.7.1"')
elif 'versionName = "1.7.1"' not in text:
    raise RuntimeError('Versao Android inesperada')
gradle.write_text(text,encoding='utf-8')

assert new in js.read_text(encoding='utf-8')
assert 'não há sincronização entre celulares' not in html.read_text(encoding='utf-8')
print('Usuarios centralizados corrigidos para v1.7.1')
