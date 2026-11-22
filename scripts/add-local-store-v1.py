#!/usr/bin/env python3
"""Inclui a camada IndexedDB no APK sem alterar o fluxo de login existente."""
from pathlib import Path
import shutil
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else 'ospro-eletrica-software')
assets = root / 'app/src/main/assets'
source = Path(__file__).with_name('local-store-v1.js')
target = assets / 'local-store.js'
html = assets / 'index.html'
if not source.is_file() or not html.is_file():
    raise SystemExit('Fontes do APK não encontradas.')
shutil.copyfile(source, target)
shutil.copyfile(Path(__file__).with_name('local-modules-v1.js'), assets / 'local-modules.js')
shutil.copyfile(Path(__file__).with_name('local-password-v1.js'), assets / 'senha-local.js')
shutil.copyfile(Path(__file__).with_name('local-auth-prototype.js'), assets / 'local-auth-prototype.js')
shutil.copyfile(Path(__file__).with_name('local-first-run-v1.js'), assets / 'local-first-run.js')
shutil.copyfile(Path(__file__).with_name('local-login-ui-v1.js'), assets / 'local-login-ui.js')
shutil.copyfile(Path(__file__).with_name('local-session-v1.js'), assets / 'local-session.js')
shutil.copyfile(Path(__file__).with_name('local-permissions-v1.js'), assets / 'local-permissions.js')
markup = html.read_text(encoding='utf-8')
anchor = '<script src="auth.js" defer></script>'
if anchor not in markup:
    raise SystemExit('Script auth.js não encontrado; integração interrompida.')
modules = ['local-store.js', 'local-modules.js', 'senha-local.js', 'local-first-run.js', 'local-auth-prototype.js', 'local-session.js', 'local-permissions.js', 'local-login-ui.js']
# Reconciliar instalação parcial sem regex ou scripts duplicados.
for module in modules:
    tag = '<script src="' + module + '" defer></script>'
    markup = markup.replace(tag, '')
tags = '\n'.join('  <script src="' + module + '" defer></script>' for module in modules)
markup = markup.replace(anchor, tags + '\n  ' + anchor, 1)
# Interface isolada de testes; não altera autenticação principal nem concede sessão.
panel = '''<section id="local-auth-panel" aria-labelledby="local-auth-title" style="margin:1rem auto;max-width:34rem;padding:1rem;border:1px solid #aac0d0;border-radius:12px;background:#fff;color:#17334b">
<h2 id="local-auth-title">Acesso local — preparação</h2>
<p>Cadastro e verificação local em testes. O acesso às OS e ao Financeiro ainda não está liberado por esta tela.</p>
<form id="local-auth-setup" hidden>
<label>Nome completo <input name="nome" autocomplete="name" required minlength="3"></label>
<label>Usuário <input name="login" autocomplete="username" required minlength="3"></label>
<label>Senha (mínimo 12 caracteres) <input name="senha" type="password" autocomplete="new-password" required minlength="12"></label>
<label>Confirmar senha <input name="confirmar" type="password" autocomplete="new-password" required minlength="12"></label>
<button type="submit">Criar administrador local</button>
</form>
<form id="local-auth-login" hidden>
<label>Usuário <input name="login" autocomplete="username" required></label>
<label>Senha <input name="senha" type="password" autocomplete="current-password" required></label>
<button type="submit">Verificar credenciais locais</button>
</form>
<button id="local-auth-signout" type="button" hidden>Encerrar sessão local</button>\n<p id="local-auth-message" role="status" aria-live="polite"></p>
</section>'''
if markup.count('id="local-auth-panel"') == 0:
    markup = markup.replace('</body>', panel + '\\n</body>', 1)
if markup.count('id="local-auth-panel"') != 1:
    raise SystemExit('Painel de autenticação local duplicado ou ausente.')
html.write_text(markup, encoding='utf-8')
if any(markup.count('src="' + module + '"') != 1 for module in modules):
    raise SystemExit('Módulos locais duplicados ou ausentes.')
print('Camada local instalada de modo idempotente; login offline NÃO ativado.')
