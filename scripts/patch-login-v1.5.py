#!/usr/bin/env python3
from pathlib import Path
import sys
root=Path(sys.argv[1])
assets=root/'app/src/main/assets'
html=assets/'index.html'
js=assets/'app.js'
css=assets/'styles.css'
gradle=root/'app/build.gradle.kts'
def change(s,old,new):
    if old not in s:
        raise RuntimeError('Fragmento nao encontrado: '+old[:140])
    return s.replace(old,new,1)
s=html.read_text(encoding='utf-8')
s=change(s,'<body>',"""<body class="auth-locked">
  <section id="auth-screen" class="auth-screen" aria-labelledby="auth-heading">
    <div class="auth-card">
      <img class="auth-brand" src="brand/acr-logo.jpg" alt="ACR Suporte em T.I">
      <h1 id="auth-heading">Entrar no OS Pro</h1>
      <p id="auth-description">Autenticação local no dispositivo.</p>
      <form id="auth-setup" class="auth-form" hidden>
        <label>Nome completo do administrador <input name="nome" type="text" maxlength="140" autocomplete="name" required></label>
        <label>Usuário de acesso <input name="login" type="text" minlength="3" maxlength="32" autocapitalize="none" autocomplete="username" required></label>
        <label>Senha (mínimo 6 caracteres) <input name="senha" type="password" minlength="6" maxlength="128" autocomplete="new-password" required></label>
        <label>Confirmar senha <input name="confirmar" type="password" minlength="6" maxlength="128" autocomplete="new-password" required></label>
        <button type="submit" class="primary">Criar administrador e entrar</button>
      </form>
      <form id="auth-login" class="auth-form" hidden>
        <label>Usuário <input name="login" type="text" autocapitalize="none" autocomplete="username" required></label>
        <label>Senha <input name="senha" type="password" autocomplete="current-password" required></label>
        <button type="submit" class="primary">Entrar</button>
      </form>
      <p class="auth-message" id="auth-message" role="alert" aria-live="polite"></p>
      <p class="auth-note">Acesso local: contas e senhas não são sincronizadas com o servidor de assinaturas.</p>
    </div>
  </section>""")
s=change(s,'<span id="clock" class="subtle"></span>','<span id="active-user-name" class="subtle" aria-label="Usuário conectado"></span><button id="logout-button" type="button" class="logout-button">Sair</button><span id="clock" class="subtle"></span>')
old='<label>Função <select name="perfil"><option value="Técnico">Técnico</option><option value="Administrador">Administrador</option><option value="Atendimento">Atendimento</option></select></label>'
s=change(s,old,old+"""
        <label>Login de acesso * <input name="login" minlength="3" maxlength="32" required autocapitalize="none" autocomplete="off" placeholder="ex.: maria.ti"></label>
        <label>Senha <input name="senha" type="password" minlength="6" maxlength="128" autocomplete="new-password" placeholder="Obrigatória no primeiro cadastro"></label>""")
s=change(s,'O cadastro registra perfis, mas esta edição local não implementa login multiusuário nem sincronização entre dispositivos.','Apenas administradores criam acessos. Ao editar, deixe a senha vazia para mantê-la. Os logins são locais e não são sincronizados entre aparelhos.')
s=change(s,'Exporte dados locais em JSON. As fotos anexadas ficam no banco de imagens local e são incluídas no backup.','Exporte os dados locais em JSON. As fotos são incluídas; contas e senhas NÃO entram no backup.')
s=change(s,'<script src="app.js" defer></script>','<script src="auth.js" defer></script>\n  <script src="app.js" defer></script>')
html.write_text(s,encoding='utf-8')
s=css.read_text(encoding='utf-8')+"""
/* ACR OS Pro 1.5 - controle de acesso local */
body.auth-locked .skip,body.auth-locked .app-header,body.auth-locked .top-nav,body.auth-locked main,body.auth-locked #toast{display:none!important}
.auth-screen[hidden],.auth-form[hidden]{display:none!important}
.auth-screen{min-height:100vh;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px 14px;background:linear-gradient(135deg,#102d4e,#0c65a5 70%,#1aa3dc)}
.auth-card{background:#fff;max-width:460px;width:100%;border-radius:16px;padding:clamp(20px,4vw,32px);box-shadow:0 18px 55px #021a3680}
.auth-brand{display:block;width:min(100%,310px);max-height:135px;object-fit:contain;margin:0 auto 14px}
.auth-card h1{font-size:clamp(23px,3vw,30px);margin:0 0 8px;color:#102d4e}
.auth-card p{line-height:1.5;color:#526479}
.auth-form{display:grid;gap:13px;margin-top:17px}
.auth-form label{font-size:14px}.auth-form input{margin-top:5px}
.auth-form button{border-radius:9px;padding:14px 16px;border:0;min-height:49px;font-weight:750}
.auth-message.auth-error{padding:12px;background:#fff0ef;border-radius:7px;color:#a62b2b;font-weight:650}
.auth-note{font-size:12px}
.logout-button{border:1px solid #8ca4bd;border-radius:8px;background:transparent;color:#fff;padding:9px 13px;font-weight:700}
.logout-button:hover{background:#355b80}
.top-nav button[hidden],.stat[hidden]{display:none!important}
@media(max-width:640px){.head-actions{gap:7px}.head-actions #active-user-name{display:none}.logout-button{padding:9px}}
"""
css.write_text(s,encoding='utf-8')
s=js.read_text(encoding='utf-8')
s=change(s,"(() => {\n  'use strict';","window.OSAuth.ready.then(() => {\n  'use strict';")
needle='  db.current.signatures ||= {cliente:null,tecnico:null}; db.current.photos ||= [];'
s=change(s,needle,needle+"""
  function syncAuthUsers(){
    for(const a of window.OSAuth.list()){
      const user=db.users.find(x=>x.id===a.id);
      if(user)Object.assign(user,{nome:a.nome,login:a.login,perfil:a.perfil});
      else db.users.push({id:a.id,nome:a.nome,login:a.login,perfil:a.perfil,email:'',telefone:''});
    }
  }
  syncAuthUsers();
  const isAdmin=()=>window.OSAuth.isAdmin();
  function updatePermissions(){
    for(const name of ['usuarios','financeiro','config']){
      const button=document.querySelector('[data-tab="'+name+'"]');
      if(button)button.hidden=!isAdmin();
    }
    document.querySelectorAll('.stat').forEach(el=>{
      if(el.querySelector('#stat-income,#stat-expense,#stat-balance'))el.hidden=!isAdmin();
    });
    document.querySelector('#active-user-name').textContent=window.OSAuth.current.nome+' · '+window.OSAuth.current.perfil;
    document.querySelector('#logout-button').onclick=()=>window.OSAuth.logout();
  }
""")
needle="  const save = () => { try{localStorage.setItem(KEY,JSON.stringify(db));}catch(e){alert('Não foi possível salvar. O armazenamento do aparelho pode estar cheio. Faça backup.'); throw e;} };"
s=change(s,needle,needle+'\n  save();')
s=change(s,'function tab(name){activeTab=name;',"function tab(name){if(['usuarios','financeiro','config'].includes(name)&&!isAdmin()){toast('Acesso restrito ao administrador.',true);return;}activeTab=name;")
s=change(s,"attachForm('#client-form','Cliente','clients',renderClients);attachForm('#user-form','Usuário','users',renderUsers);","""attachForm('#client-form','Cliente','clients',renderClients);
  $('#user-form').addEventListener('submit',async e=>{
    e.preventDefault();
    if(!isAdmin()){toast('Apenas administradores podem cadastrar usuários.',true);return;}
    const form=e.currentTarget;if(!form.reportValidity())return;
    const f=formData(form),button=form.querySelector('[type="submit"]');button.disabled=true;
    try{
      const id=f.id||uid();
      const saved=await window.OSAuth.saveUser({id,nome:f.nome,login:f.login,perfil:f.perfil,senha:f.senha});
      const item=db.users.find(u=>u.id===saved.id);
      const info={id:saved.id,nome:saved.nome,login:saved.login,perfil:saved.perfil,email:f.email,telefone:f.telefone};
      if(item)Object.assign(item,info);else db.users.push(info);
      save();form.reset();renderAll();toast('Usuário e acesso salvos com sucesso.');
    }catch(err){toast(err.message||'Não foi possível cadastrar o usuário.',true);}
    finally{button.disabled=false;}
  });""")
s=change(s,"function renderUsers(){$('#user-list').innerHTML=db.users.map(x=>rowEntity(x,'users')).join('')||'<div class=\"empty\">Nenhum usuário cadastrado.</div>';}",'''function renderUsers(){
    if(!isAdmin())return;
    $('#user-list').innerHTML=db.users.map(x=>{
      const account=window.OSAuth.getAccount(x.id);
      return '<div class="item"><div><strong>'+escape(x.nome)+'</strong><small>'+escape(x.login||'Sem acesso configurado')+' · '+escape(x.perfil||'Técnico')+' · '+(account?'Login ativo':'Somente cadastro técnico')+'</small></div><div class="item-side"><button type="button" data-edit="users" data-id="'+escape(x.id)+'">Editar</button><button type="button" class="danger" data-delete="users" data-id="'+escape(x.id)+'">Excluir</button></div></div>';
    }).join('')||'<div class="empty">Nenhum usuário cadastrado.</div>';
  }''')
s=change(s,"if(edit){const type=edit.dataset.edit,record=db[type].find(x=>x.id===edit.dataset.id);if(!record)return;const form=type==='clients'?$('#client-form'):$('#user-form');setForm(form,record);tab(type==='clients'?'clientes':'usuarios');form.scrollIntoView({behavior:'smooth'});}if(del){const type=del.dataset.delete,id=del.dataset.id;","if(edit){const type=edit.dataset.edit,record=db[type].find(x=>x.id===edit.dataset.id);if(!record)return;if(type==='users'&&!isAdmin())return;const form=type==='clients'?$('#client-form'):$('#user-form');setForm(form,record);if(type==='users')form.elements.namedItem('senha').value='';tab(type==='clients'?'clientes':'usuarios');form.scrollIntoView({behavior:'smooth'});}if(del){const type=del.dataset.delete,id=del.dataset.id;if(type==='users'&&!isAdmin()){toast('Acesso restrito ao administrador.',true);return;}")
s=change(s,"if(!confirm('Confirma a exclusão deste cadastro?'))return;db[type]=db[type].filter(x=>x.id!==id);save();renderAll();","if(!confirm('Confirma a exclusão deste cadastro?'))return;if(type==='users'){try{window.OSAuth.removeUser(id);}catch(err){toast(err.message,true);return;}}db[type]=db[type].filter(x=>x.id!==id);save();renderAll();")
s=change(s,"db=back.db;save();setForm($('#settings-form'),db.settings);","db=back.db;db.users||=[];syncAuthUsers();save();setForm($('#settings-form'),db.settings);")
s=change(s,"setForm($('#settings-form'),db.settings);syncOrderForm();renderAll();renderLogo();applyPrefs();","setForm($('#settings-form'),db.settings);syncOrderForm();updatePermissions();renderAll();renderLogo();applyPrefs();")
s=change(s,"window.OSProVersion = '1.4.0';","window.OSProVersion = '1.5.0';")
if not s.rstrip().endswith('})();'):
    raise RuntimeError('Final da inicialização JS inesperado')
s=s.rstrip()[:-5]+'});'+chr(10)
js.write_text(s,encoding='utf-8')
s=gradle.read_text(encoding='utf-8')
s=change(s,'versionCode = 4','versionCode = 5')
s=change(s,'versionName = "1.4.0"','versionName = "1.5.0"')
gradle.write_text(s,encoding='utf-8')
(root/'README-ACR-1.5.txt').write_text("""ACR SUPORTE EM T.I — OS PRO v1.5
LOGIN E CADASTRO LOCAIS DE USUARIOS
- Primeiro acesso: crie o administrador sem senha predefinida.
- Depois de entrar: Usuarios > Cadastrar usuario com nome, login, senha e perfil.
- Senhas protegidas por PBKDF2-SHA256 com salt individual e 210 mil iteracoes.
- Administrador tem acesso completo. Tecnico e Atendimento acessam Painel, OS, Assinaturas e Clientes.
- O login NAO criptografa dados locais e NAO sincroniza usuarios com o servidor de assinatura.
- Backups JSON incluem dados de OS, mas nao armazenam senhas nem hashes.
- Anote a senha do administrador: nao existe recuperacao remota nesta versao.
- Faca backup de suas OS antes de remover o aplicativo antigo.
""",encoding='utf-8')
print('Login ACR v1.5 aplicado com sucesso')
