#!/usr/bin/env python3
"""Add recovery and Microsoft Authenticator UI to the unpacked Android source."""
from pathlib import Path
import shutil
import sys

root=Path(sys.argv[1])
assets=root/"app/src/main/assets"
here=Path(__file__).resolve().parent
auth=assets/"auth.js"
app=assets/"app.js"
html=assets/"index.html"
t=auth.read_text(encoding="utf-8")
needle="async function reloadWorkspace(){"
if t.count(needle)!=1:
    raise RuntimeError("Não foi possível localizar auth.js: reloadWorkspace")
t=t.replace(needle,'''async function totpStatus(){return request('/api/team/admin-totp/status');}
async function totpSetup(senha){return request('/api/team/admin-totp/setup','POST',{senha});}
async function totpConfirm(code){return request('/api/team/admin-totp/confirm','POST',{code});}
''' +needle)
needle="fetchLicenses,saveLicenses,fetchRhidMonitor};"
if t.count(needle)!=1:
    raise RuntimeError("Não foi possível localizar export OSAuth da versão 1.7.9")
t=t.replace(needle,"fetchLicenses,saveLicenses,fetchRhidMonitor,totpStatus,totpSetup,totpConfirm};")
auth.write_text(t,encoding="utf-8")
t=app.read_text(encoding="utf-8")
old="login:f.login,perfil:f.perfil,senha:f.senha"
if old in t:
    t=t.replace(old,"login:f.login,perfil:f.perfil,senha:f.senha,email:f.email",1)
elif "email:f.email" not in t:
    raise RuntimeError("A tela de usuários deve transmitir o e-mail de recuperação")
app.write_text(t,encoding="utf-8")
t=html.read_text(encoding="utf-8")
if '</body>' not in t:
    raise RuntimeError("index.html sem body")
t=t.replace('</body>','  <script src="recovery-ui.js" defer></script>\n</body>',1)
html.write_text(t,encoding="utf-8")
shutil.copyfile(here/"recovery-ui-v180.js",assets/"recovery-ui.js")
print("Recuperação por e-mail e Microsoft Authenticator integrada no Android.")
