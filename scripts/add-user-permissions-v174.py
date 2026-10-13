#!/usr/bin/env python3
"""Adiciona editor de permissoes v1.7.4 ao pacote fonte extraido (apos os patches v1.7.3)."""
from pathlib import Path
import sys

base=Path(sys.argv[1] if len(sys.argv)>1 else 'ospro-eletrica-software')
assets=base/'app/src/main/assets'
def change(path,old,new):
    source=path.read_text(encoding='utf-8')
    if source.count(old)!=1:raise RuntimeError(f'{path.name}: esperado 1 trecho, encontrado {source.count(old)}: {old[:85]}')
    path.write_text(source.replace(old,new,1),encoding='utf-8')
auth=assets/'auth.js'
change(auth,"async function removeUser(id){",
"""async function savePermissions(id,permissions){
  if(!account||account.perfil!=='Administrador')throw Error('Somente administradores podem editar permissões.');
  const result=await request('/api/team/users/'+encodeURIComponent(id)+'/permissions','PUT',{permissions});
  const index=users.findIndex(u=>u.id===id);if(index>=0)users[index]=result.user;
  return result.user;
}
async function removeUser(id){""")
change(auth,"window.OSAuth={ready,get current(){return account;},isAdmin:()=>account?.perfil==='Administrador',list:()=>users.slice(),saveUser,removeUser,logout};",
"""window.OSAuth={ready,get current(){return account;},isAdmin:()=>account?.perfil==='Administrador',
can:(permission)=>account?.perfil==='Administrador'||account?.permissions?.[permission]===true,
getAccount:id=>users.find(x=>x.id===id)||null,
list:()=>users.slice(),saveUser,savePermissions,removeUser,logout};""")
html=assets/'index.html'
change(html,'      <div class="panel"><h2>Usuários cadastrados</h2><div id="user-list" class="stack"></div></div>',
'''      <div class="panel"><h2>Usuários cadastrados</h2><div id="user-list" class="stack"></div></div>
      <div class="panel" id="permissions-panel">
        <h2>Permissões dos usuários</h2>
        <p class="hint">Apenas administradores podem alterar acessos. Escolha o usuário e marque os módulos autorizados. Mudanças passam a valer quando ele entrar novamente.</p>
        <form id="permissions-form">
          <label for="permission-user"><strong>Usuário cadastrado</strong></label>
          <select id="permission-user" required aria-describedby="permission-note"><option value="">Selecione um usuário</option></select>
          <p id="permission-note" class="hint">Selecione uma conta para configurar.</p>
          <div class="permission-grid" role="group" aria-label="Permissões disponíveis">
            <label class="permission-item"><input type="checkbox" data-permission="ordens"><span><strong>Ordens de serviço</strong><small>Criar OS, acessar dados e acompanhar atendimentos</small></span></label>
            <label class="permission-item"><input type="checkbox" data-permission="clientes"><span><strong>Clientes</strong><small>Consultar e cadastrar clientes</small></span></label>
            <label class="permission-item"><input type="checkbox" data-permission="assinaturas"><span><strong>Assinaturas</strong><small>Coletar assinaturas presenciais e gerar PDF</small></span></label>
            <label class="permission-item"><input type="checkbox" data-permission="links"><span><strong>Links de assinatura</strong><small>Gerar, enviar e consultar links remotos</small></span></label>
            <label class="permission-item"><input type="checkbox" data-permission="relatorios"><span><strong>Relatórios</strong><small>Visualizar e exportar relatórios de ordens acessíveis</small></span></label>
            <label class="permission-item"><input type="checkbox" data-permission="financeiro"><span><strong>Financeiro</strong><small>Consultar e lançar receitas e despesas</small></span></label>
          </div>
          <div class="actions"><button type="submit" id="save-user-permissions" class="primary">Salvar permissões</button></div>
          <p role="status" id="permissions-status" class="hint" aria-live="polite"></p>
        </form>
      </div>''')
change(html,'  <script src="app.js" defer></script>',
            '  <script src="app.js" defer></script>\n  <script src="permissions.js" defer></script>')
css=assets/'styles.css'
css.write_text(css.read_text(encoding='utf-8')+'''
/* Permissoes individuais - ACR 1.7.4, tablet e acessibilidade */
.permission-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:16px 0}
.permission-item{display:flex;align-items:flex-start;gap:12px;background:#f3f7fc;border:1px solid #b7c9da;border-left:4px solid #d8a02e;border-radius:10px;padding:16px;cursor:pointer;min-height:80px}
.permission-item:has(input:checked){background:#e7f5eb;border-color:#6ea587;border-left-color:#237a50}
.permission-item:has(input:disabled){opacity:.68;cursor:not-allowed}
.permission-item input{width:22px;height:22px;flex:0 0 22px;margin:1px 0 0;accent-color:#175788}
.permission-item span{display:block;min-width:0}
.permission-item strong{display:block;color:#102d4e;font-size:15px}
.permission-item small{display:block;color:#465b6c;line-height:1.4;font-size:12px;margin-top:3px}
.permission-item:focus-within{outline:3px solid #db9c20;outline-offset:2px}
#permission-user{margin:10px 0;width:100%;min-height:50px}
#permissions-status{font-weight:700}
@media(max-width:640px){.permission-grid{grid-template-columns:1fr}}
''',encoding='utf-8')
app=assets/'app.js'
change(app,"  const isAdmin=()=>window.OSAuth.isAdmin();",
           "  const isAdmin=()=>window.OSAuth.isAdmin();\n  const can=permission=>window.OSAuth.can(permission);")
change(app,'''    for(const name of ['usuarios','financeiro','config','relatorios']){
      const nav=document.querySelector(`[data-tab="${name}"]`);
      if(nav)nav.hidden=!isAdmin();
    }''',
'''    for(const name of ['usuarios','financeiro','config','relatorios','ordens','clientes','assinaturas']){
      const nav=document.querySelector(`[data-tab="${name}"]`);
      if(nav)nav.hidden=!((name==='usuarios'||name==='config')?isAdmin():can(name));
    }''')
change(app,"el.hidden=!isAdmin();","el.hidden=!can('financeiro');")
change(app,"if(isAdmin())db.finance=clone(team.initial.finance||[]);else db.finance=[];","if(can('financeiro'))db.finance=clone(team.initial.finance||[]);else db.finance=[];")
change(app,"...(isAdmin()?{finance:db.finance}:{})","...(can('financeiro')?{finance:db.finance}:{})")
change(app,"if(isAdmin())db.finance=clone(current.finance||[]);else db.finance=[];","if(can('financeiro'))db.finance=clone(current.finance||[]);else db.finance=[];")
change(app,'''function tab(name){if(['usuarios','financeiro','config','relatorios'].includes(name)&&!isAdmin()){toast('Acesso restrito ao administrador.',true);return;}''',
'''function tab(name){if((name==='usuarios'||name==='config')?!isAdmin():(['financeiro','relatorios','ordens','clientes','assinaturas'].includes(name)&&!can(name))){toast('Você não tem permissão para acessar esta área.',true);return;}''')
change(app,"  $('#quick-os').onclick=()=>{newOrderPrompt();tab('ordens');};$('#go-os').onclick=()=>tab('ordens');$('#go-sign').onclick=()=>tab('assinaturas');$('#to-sign').onclick=()=>{saveOrderForm(false);tab('assinaturas');};",
"""  $('#quick-os').hidden=!can('ordens');$('#go-os').hidden=!can('ordens');
  $('#go-sign').hidden=!can('assinaturas');$('#to-sign').hidden=!can('assinaturas');
  $('#create-link').hidden=!can('links');$('#share-link').hidden=!can('links');$('#check-link').hidden=!can('links');
  $('#quick-os').onclick=()=>{if(!can('ordens'))return;newOrderPrompt();tab('ordens');};$('#go-os').onclick=()=>tab('ordens');$('#go-sign').onclick=()=>tab('assinaturas');$('#to-sign').onclick=()=>{if(!can('assinaturas'))return;saveOrderForm(false);tab('assinaturas');};""")
change(app,'''function attachForm(formId,fieldName,collection,render){const form=$(formId);form.addEventListener('submit',e=>{e.preventDefault();if(!form.reportValidity())return;''',
'''function attachForm(formId,fieldName,collection,render){const form=$(formId);form.addEventListener('submit',e=>{e.preventDefault();if(collection==='clients'&&!can('clientes'))return toast('Sem permissão para cadastrar clientes.',true);if(!form.reportValidity())return;''')
change(app,"const account=window.OSAuth.getAccount(x.id);","const account=window.OSAuth.getAccount(x.id);")
change(app,"  $('#create-link').onclick=async()=>{saveOrderForm(false);",
           "  $('#create-link').onclick=async()=>{if(!can('links'))return toast('Sem permissão para gerar links.',true);saveOrderForm(false);")
change(app,"  $('#check-link').onclick=async()=>{const r=db.current.remote;",
           "  $('#check-link').onclick=async()=>{if(!can('links'))return toast('Sem permissão para consultar links.',true);const r=db.current.remote;")
change(app,"  async function generatePdf(finalize){if(pendingPdf)return;",
           "  async function generatePdf(finalize){if(!can('assinaturas'))return toast('Sem permissão para gerar PDF e assinaturas.',true);if(pendingPdf)return;")
change(app,"  $('#finance-form').onsubmit=e=>{e.preventDefault();",
           "  $('#finance-form').onsubmit=e=>{e.preventDefault();if(!can('financeiro'))return toast('Sem permissão para financeiro.',true);")
change(app,"  document.addEventListener('click',e=>{const b=e.target.closest('[data-del-fin]');if(!b||!confirm",
           "  document.addEventListener('click',e=>{const b=e.target.closest('[data-del-fin]');if(!can('financeiro')||!b||!confirm")
change(app,"  function renderAll(){updateSelections();",
           "  function renderAll(){updateSelections();")
change(app,"  window.OSProVersion = '1.7.0';","  window.OSProVersion = '1.7.4';")
(assets/'permissions.js').write_text("""/* ACR OS Pro - Permissoes individuais administradas no servidor */
window.OSAuth.ready.then(()=>{
  'use strict';
  if(!window.OSAuth.isAdmin())return;
  const $=s=>document.querySelector(s);
  const select=$('#permission-user'),form=$('#permissions-form'),status=$('#permissions-status');
  const fields=[...form.querySelectorAll('[data-permission]')];
  const button=$('#save-user-permissions');
  function options(){
    const selected=select.value;
    select.replaceChildren(new Option('Selecione um usuário',''));
    for(const user of window.OSAuth.list())select.add(new Option(user.nome+' · '+user.perfil,user.id));
    if(window.OSAuth.list().some(u=>u.id===selected))select.value=selected;
    redraw();
  }
  function redraw(){
    const user=window.OSAuth.getAccount(select.value);
    const admin=user?.perfil==='Administrador';
    for(const f of fields){f.checked=Boolean(user?.permissions?.[f.dataset.permission]);f.disabled=!user||admin;}
    button.disabled=!user||admin;
    $('#permission-note').textContent=!user?'Selecione uma conta para configurar.':admin?'Administradores têm acesso total. Para limitar, altere o perfil do usuário para Técnico ou Atendimento.':'Marque para permitir e desmarque para bloquear.';
  }
  select.onchange=()=>{status.textContent='';redraw();};
  form.onsubmit=async e=>{
    e.preventDefault();
    const user=window.OSAuth.getAccount(select.value);
    if(!user||user.perfil==='Administrador')return;
    const permissions=Object.fromEntries(fields.map(f=>[f.dataset.permission,f.checked]));
    button.disabled=true;status.textContent='Salvando acessos no servidor...';
    try{
      await window.OSAuth.savePermissions(user.id,permissions);
      status.textContent='Permissões salvas. A sessão antiga desse usuário foi encerrada; ele deve entrar novamente.';
      options();
    }catch(error){status.textContent='Falha ao salvar: '+error.message;button.disabled=false;}
  };
  const observer=new MutationObserver(()=>options());
  const list=$('#user-list');
  observer.observe(list,{childList:true});
  options();
});
""",encoding='utf-8')
gradle=base/'app/build.gradle.kts'
change(gradle,'versionName = "1.7.3"','versionName = "1.7.4"')
change(gradle,'versionCode = 12','versionCode = 13')
print('ACR OS Pro v1.7.4: editor de permissoes e interface protegida adicionados.')
