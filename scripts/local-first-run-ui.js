/* Tela independente para configurar primeiro administrador local.
 * Não modifica a tela de login legado. Ativação explícita somente na nova branch.
 */
(() => {
  'use strict';
  const ready = () => new Promise(resolve => {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',resolve,{once:true});
    else resolve();
  });
  function node(tag,attrs={},value='') {
    const el=document.createElement(tag);
    for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);
    if(value)el.textContent=value;
    return el;
  }
  function applyLocalLayout() {
    if(document.getElementById('acr-local-style'))return;
    const style=node('style',{id:'acr-local-style'});
    style.textContent=`
      html,body{margin:0!important;min-height:100%!important;background:#eef3f9!important;color:#162e49!important;font-family:system-ui,Arial,sans-serif!important}
      #acr-local-login,#acr-local-setup{position:fixed!important;inset:0!important;z-index:2147483647!important;overflow-y:auto!important;overscroll-behavior:contain!important;width:100%!important;max-width:none!important;min-height:100dvh!important;max-height:100dvh!important;margin:0!important;border-radius:0!important;box-sizing:border-box!important;background:#eef3f9!important}
      #acr-local-login::before,#acr-local-setup::before{content:"";position:fixed;inset:0;z-index:-1;background:#eef3f9}
      #acr-local-login:not(.acr-authenticated),#acr-local-setup{padding:clamp(20px,5vw,36px)!important}
      #acr-local-login:not(.acr-authenticated)>h2,#acr-local-login:not(.acr-authenticated)>p,#acr-local-login:not(.acr-authenticated)>form,#acr-local-setup>h2,#acr-local-setup>p,#acr-local-setup>form{max-width:480px;margin-left:auto;margin-right:auto}
      #acr-local-login.acr-authenticated{padding:0!important}
      #acr-local-login.acr-authenticated>header,#acr-local-login.acr-authenticated>nav,#acr-local-login.acr-authenticated>section,#acr-local-login.acr-authenticated>form{max-width:900px;margin-left:auto!important;margin-right:auto!important}
      body > :not(script):not(style):not(#acr-local-login):not(#acr-local-setup){display:none!important}
      #acr-local-login,#acr-local-setup{border:0!important;box-shadow:none!important;color:#162e49!important}
      #acr-local-login h2,#acr-local-setup h2{margin:0 0 10px;font-size:clamp(22px,4vw,30px);color:#124c86}
      #acr-local-login h3{font-size:19px;color:#124c86}
      #acr-local-login input,#acr-local-login textarea,#acr-local-login select,#acr-local-setup input{min-height:44px;border:1px solid #b7c9da;border-radius:9px;background:#fff;color:#152c42;font-size:16px;padding:10px;max-width:100%}
      #acr-local-login button,#acr-local-setup button{min-height:42px;margin:6px 7px 6px 0;padding:9px 15px;border:0;border-radius:9px;background:#145d9d;color:white;font-size:15px;font-weight:600;cursor:pointer}
      #acr-local-login button:disabled,#acr-local-setup button:disabled{opacity:.55}
      #acr-local-login section[id^="acr-local-"]{border:0!important;margin-top:12px!important;padding:12px!important;background:#f6f9fd;border-radius:14px}
      #acr-local-login ul{padding-left:22px;overflow-wrap:anywhere}
      #acr-local-login pre{font-size:12px;max-height:240px;overflow:auto;background:#edf3f8;padding:12px;border-radius:10px}
      #acr-local-nav{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}
      #acr-local-nav button{background:#e1eaf5;color:#174d7e;margin:0}
      #acr-local-nav button[aria-selected="true"]{background:#145d9d;color:white}
      #acr-local-login .acr-hidden{display:none!important}
      #acr-local-login.acr-authenticated{padding:0!important;overflow:hidden}
      #acr-local-login.acr-authenticated > h2,#acr-local-login.acr-authenticated > p{display:none}
      #acr-local-login.acr-authenticated > form{padding:0 20px;margin:0}
      #acr-local-login.acr-authenticated > form > label,#acr-local-login.acr-authenticated > form > button[type="submit"],#acr-local-login.acr-authenticated > form > pre{display:none!important}
      #acr-local-login.acr-authenticated > form > p[role="status"]{display:none}
      #acr-local-login.acr-authenticated > form > button{background:transparent;color:#42617e;font-size:13px;padding:6px 8px;min-height:36px}
      #acr-local-login.acr-authenticated > form > button:nth-of-type(3){display:none!important}
      #acr-local-header{background:linear-gradient(115deg,#08345c,#1168a7);color:white;padding:24px 22px}
      #acr-local-header strong{font-size:22px;letter-spacing:-.5px}
      #acr-local-header small{display:block;margin-top:4px;color:#d6eafa;font-size:13px}
      #acr-local-nav{padding:12px 18px;margin:0!important;background:#fff;border-bottom:1px solid #e5edf4;display:grid!important;grid-template-columns:repeat(auto-fit,minmax(115px,1fr));gap:8px!important}
      #acr-local-nav button{border:1px solid #d7e4f0!important;border-radius:11px!important;padding:10px!important;text-align:center;font-size:13px!important}
      #acr-local-login section[id^="acr-local-"]{margin:16px 18px!important;padding:18px!important;background:#fff!important;border:1px solid #e5edf4!important;border-radius:14px!important}
      #acr-local-login.acr-authenticated{background:#f5f8fc!important}
      #acr-local-login section h3{margin:0 0 12px!important}
      #acr-local-login label{font-weight:600;font-size:13px;color:#37516a}
      #acr-local-login button{transition:background .15s}
      #acr-local-login ul{list-style:none;padding:0}
      #acr-local-login li{padding:12px;margin:8px 0;background:#f2f6fb;border-radius:10px}
      #acr-local-login input:focus,#acr-local-login select:focus,#acr-local-login textarea:focus{outline:2px solid #3889c8;outline-offset:1px}
      #acr-local-registry > section+section{border-top:1px solid #e4edf5;padding-top:18px;margin-top:22px}
      #acr-local-login [hidden],#acr-local-setup [hidden]{display:none!important}
      @media(max-width:520px){#acr-local-login button{font-size:14px}#acr-local-login section[id^="acr-local-"]{margin:10px!important;padding:14px!important}}
    `;
    document.head.append(style);
  }
  function setupNavigation(section) {
    const targets=[['acr-local-orders','Ordens de serviço'],['acr-local-registry','Cadastros']];
    const available=targets.filter(([id])=>document.getElementById(id));
    if(!available.length)return;
    const nav=node('nav',{id:'acr-local-nav','aria-label':'Seções locais'});
    const panels=available.map(([id,label])=>({panel:document.getElementById(id),button:node('button',{type:'button'},label)}));
    panels.forEach(({panel,button},i)=>{
      button.addEventListener('click',()=>panels.forEach(({panel:p,button:b},j)=>{
        p.classList.toggle('acr-hidden',i!==j);b.setAttribute('aria-selected',String(i===j));
      }));
      nav.append(button);
    });
    section.insertBefore(nav,panels[0].panel);
    panels[0].button.click();
  }
  function renderLocalLogin() {
    applyLocalLayout();
    if (document.getElementById('acr-local-login')) return;
    const session=globalThis.ACRLocalSession;
    if (!session) throw Error('Sessão local indisponível.');
    document.getElementById('acr-local-setup')?.remove();
    const section=node('section',{id:'acr-local-login','aria-label':'Login local independente'});
    section.style.cssText='max-width:440px;margin:16px auto;padding:20px;border:2px solid #245d92;border-radius:12px;background:#fff;color:#172b4d;position:relative;z-index:20';
    section.append(node('h2',{},'Entrar no ACR OS Pro Local'));
    section.append(node('p',{},'Versão local de testes • dados salvos neste dispositivo.'));
    const form=node('form');
    const loginLabel=node('label',{},'Usuário');
    const login=node('input',{name:'login',autocomplete:'username',required:''});
    const passwordLabel=node('label',{},'Senha');
    const secret=node('input',{type:'password',name:'password',autocomplete:'current-password',required:''});
    for (const [label,input] of [[loginLabel,login],[passwordLabel,secret]]) {
      label.style.cssText='display:block;margin-top:12px';
      input.style.cssText='display:block;width:100%;box-sizing:border-box;padding:10px;margin-top:4px';
      label.append(input);form.append(label);
    }
    const button=node('button',{type:'submit'},'Entrar localmente');
    const logout=node('button',{type:'button'},'Sair da sessão local');
    logout.hidden=true;
    const status=node('p',{role:'status','aria-live':'polite'});
    const inspect=node('button',{type:'button'},'Consultar dados locais');
    inspect.hidden=true;
    const report=node('pre',{'aria-live':'polite'});
    report.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere';
    form.append(button,logout,inspect,status,report);
    section.append(form);
    document.body.prepend(section);
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      button.disabled=true;
      status.textContent='Verificando credenciais locais…';
      try {
        const user=await session.signIn(login.value,secret.value);
        status.textContent='Sessão local autenticada.';
        section.classList.add('acr-authenticated');
        const header=node('header',{id:'acr-local-header'});
        header.append(node('strong',{},'ACR OS Pro Local'),node('small',{},'Painel local • '+user.login));
        section.prepend(header);
        secret.value='';
        button.hidden=true;logout.hidden=false;inspect.hidden=false;
        if(session.hasPermission('ordens'))globalThis.ACRLocalOrdersUI?.mount(section);
        globalThis.ACRLocalRegistryUI?.mount(section);
        setupNavigation(section);
      } catch(error) {
        status.textContent=error?.message||'Não foi possível autenticar.';
      } finally {button.disabled=false;}
    });
    inspect.addEventListener('click',async()=>{
      inspect.disabled=true;
      try {
        const summary=await globalThis.ACRLocalDiagnostics.snapshot();
        report.textContent=JSON.stringify(summary,null,2);
      } catch(error) {report.textContent=error?.message||'Consulta indisponível.';}
      finally {inspect.disabled=false;}
    });
    logout.addEventListener('click',()=>{
      session.signOut();
      globalThis.ACRLocalOrdersUI?.unmount();
      globalThis.ACRLocalRegistryUI?.unmount();
      document.getElementById('acr-local-nav')?.remove();
      document.getElementById('acr-local-header')?.remove();
      section.classList.remove('acr-authenticated');
      login.value='';secret.value='';
      button.hidden=false;logout.hidden=true;inspect.hidden=true;report.textContent='';
      status.textContent='Sessão local encerrada.';
    });
  }
  async function init() {
    await ready();
    applyLocalLayout();
    const setup=globalThis.ACRLocalFirstRun;
    if (!setup) return;
    const isFirstRun = await setup.needsSetup();
    if (!isFirstRun) { document.getElementById('acr-local-setup')?.remove(); renderLocalLogin(); return; }
    const section=node('section',{id:'acr-local-setup','aria-label':'Configurar administrador local'});
    section.style.cssText='max-width:440px;margin:16px auto;padding:20px;border:2px solid #245d92;border-radius:12px;background:#fff;color:#172b4d;position:relative;z-index:20';
    const title=node('h2',{},'Configurar ACR OS Pro Local');
    const description=node('p',{},'Somente para uma instalação nova. Não recupera contas ou dados do aplicativo antigo.');
    const form=node('form');
    const loginLabel=node('label',{},'Usuário administrador');
    const login=node('input',{name:'login',autocomplete:'username',required:'',minlength:'3',maxlength:'100'});
    const passwordLabel=node('label',{},'Senha (mínimo 12 caracteres)');
    const secret=node('input',{type:'password',name:'secret',autocomplete:'new-password',required:'',minlength:'12'});
    const repeatLabel=node('label',{},'Confirmar senha');
    const repeat=node('input',{type:'password',name:'repeat',autocomplete:'new-password',required:'',minlength:'12'});
    const consentLabel=node('label');
    const consent=node('input',{type:'checkbox',required:''});
    consentLabel.append(consent,document.createTextNode(' Confirmo que esta é uma instalação nova e que os dados antigos não serão migrados automaticamente.'));
    const button=node('button',{type:'submit'},'Criar administrador local');
    const message=node('p',{role:'status','aria-live':'polite'});
    for(const [label,input] of [[loginLabel,login],[passwordLabel,secret],[repeatLabel,repeat]]) {
      label.style.display='block';label.style.marginTop='12px';
      input.style.cssText='display:block;width:100%;box-sizing:border-box;padding:10px;margin-top:4px';
      label.append(input);form.append(label);
    }
    consentLabel.style.cssText='display:block;margin:16px 0';
    form.append(consentLabel,button,message);
    section.append(title,description,form);
    document.body.prepend(section);
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      if(secret.value!==repeat.value){message.textContent='As senhas não coincidem.';return;}
      button.disabled=true;
      try {
        await setup.initialize({login:login.value,secret:secret.value,confirmNewInstallation:consent.checked});
        message.textContent='Administrador criado. Entre com seu usuário e senha no login local.';
        form.reset();
        form.querySelectorAll('input').forEach(input=>input.disabled=true);
        section.remove();
        renderLocalLogin();
      } catch(error) {
        message.textContent=error?.message||'Falha ao configurar administrador.';
        button.disabled=false;
      }
    });
  }
  init().catch(error=>console.error('Configuração local indisponível:',error?.message));
})();
