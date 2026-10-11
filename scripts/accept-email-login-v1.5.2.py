#!/usr/bin/env python3
"""ACR OS Pro v1.5.2: aceitar identificador local OU email no cadastro e login."""
from pathlib import Path
import re
import sys

root = Path(sys.argv[1])
assets = root / "app/src/main/assets"
auth_file = assets / "auth.js"
html_file = assets / "index.html"
gradle_file = root / "app/build.gradle.kts"
js_file = assets / "app.js"

email_check = r"v.length<=254 && /^[a-z0-9._%+-]{1,64}@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(v)"
auth = auth_file.read_text(encoding="utf-8")
if "Informe um usuário (3 a 32 caracteres) ou um e-mail válido." not in auth:
    new_validation = (
        "  function validateLogin(value){\n"
        "    const v=normalizeLogin(value);\n"
        "    const username=/^[a-z0-9._-]{3,32}$/.test(v);\n"
        f"    const email={email_check};\n"
        "    if(!username && !email)throw Error('Informe um usuário (3 a 32 caracteres) ou um e-mail válido.');\n"
        "    return v;\n"
        "  }"
    )
    auth, count = re.subn(r"(?m)^\s*function validateLogin\(value\)\{[^\n]*\}$", lambda _: new_validation, auth, count=1)
    if count != 1:
        new_validation = new_validation.replace("validateLogin(value)", "loginValid(str)").replace("normalizeLogin(value)", "normalize(str)")
        auth, count = re.subn(r"(?m)^\s*function loginValid\(str\)\{[^\n]*\}$", lambda _: new_validation, auth, count=1)
    if count != 1:
        raise RuntimeError("Validador antigo nao encontrado: revisao manual necessaria.")
    auth_file.write_text(auth,encoding="utf-8")

html = html_file.read_text(encoding="utf-8")
html = html.replace('Usuário de acesso <input name="login"', 'Usuário ou e-mail de acesso <input name="login"')
html = html.replace('Usuário <input name="login"', 'Usuário ou e-mail <input name="login"')
html = html.replace('Login de acesso * <input name="login"', 'Login ou e-mail de acesso * <input name="login"')
html = re.sub(r'(<input[^>]*name="login"[^>]*?)maxlength="32"', r'\g<1>maxlength="254"', html)
html = html.replace('placeholder="ex.: maria.ti"', 'placeholder="ex.: maria.ti ou nome@empresa.com"')
html_file.write_text(html,encoding="utf-8")

gradle = gradle_file.read_text(encoding="utf-8")
if 'versionName = "1.5.1"' in gradle:
    gradle = gradle.replace('versionName = "1.5.1"', 'versionName = "1.5.2"')
    gradle = gradle.replace('versionCode = 6', 'versionCode = 7')
elif 'versionName = "1.5.2"' not in gradle:
    raise RuntimeError("Versao inesperada de build.gradle.kts.")
gradle_file.write_text(gradle,encoding="utf-8")

appjs=js_file.read_text(encoding="utf-8")
if "OSProVersion = '1.5.1'" in appjs:
    js_file.write_text(appjs.replace("OSProVersion = '1.5.1'", "OSProVersion = '1.5.2'"),encoding="utf-8")

assert "const email=v.length<=254" in auth_file.read_text()
assert 'Usuário ou e-mail de acesso' in html and 'maxlength="254"' in html
assert 'versionName = "1.5.2"' in gradle
print("OS Pro v1.5.2: email e nome de usuario aceitos; senha minima de 6 preservada.")
