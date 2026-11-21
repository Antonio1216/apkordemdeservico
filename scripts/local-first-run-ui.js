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
  async function init() {
    await ready();
    const setup=globalThis.ACRLocalFirstRun;
    if (!setup || !(await setup.needsSetup())) return;
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
        message.textContent='Administrador criado. Reinicie o aplicativo para continuar a configuração local.';
        form.reset();
        form.querySelectorAll('input').forEach(input=>input.disabled=true);
      } catch(error) {
        message.textContent=error?.message||'Falha ao configurar administrador.';
        button.disabled=false;
      }
    });
  }
  init().catch(error=>console.error('Configuração local indisponível:',error?.message));
})();
