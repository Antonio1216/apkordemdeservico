'use strict';
// ACR OS Pro v1.7: authentication and shared workspace. Only for HTTPS reverse proxies.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {calculateTravel} = require('./travel');

function teamApi(options={}) {
  const KEY=String(options.key||'');
  const DBFILE=options.dbfile;
  if(KEY.length<24 || !DBFILE)throw Error('ADMIN_KEY e TEAM_DATA_FILE necessários.');
  const tokenKey=crypto.createHash('sha256').update('ACR-TEAM-V1:'+KEY).digest();
  let data={accounts:[],workspace:{revision:0,clients:[],orders:[],drafts:[],finance:[]},audit:[]};
  try {data=JSON.parse(fs.readFileSync(DBFILE,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  if(!Array.isArray(data.accounts))throw Error('Base de usuarios corrompida.');
  data.workspace||={revision:0,clients:[],orders:[],drafts:[],finance:[]};
  for(const type of ['clients','orders','drafts','finance'])data.workspace[type]||=[];
  data.audit||=[];
  // Coleção separada das OS: a atualização de uma OS não sobrescreve o catálogo.
  data.catalog||={revision:0,services:[],products:[],equipments:[]};
  for(const collection of ['services','products','equipments'])data.catalog[collection]||=[];
  let writeQueue=Promise.resolve();
  async function persist(){const snapshot=JSON.stringify(data);writeQueue=writeQueue.catch(()=>{}).then(async()=>{
    await fs.promises.mkdir(path.dirname(DBFILE),{recursive:true,mode:0o700});
    const temp=DBFILE+'.'+process.pid+'.tmp'; await fs.promises.writeFile(temp,snapshot,{mode:0o600});await fs.promises.rename(temp,DBFILE);
  });await writeQueue;}
  function writeAudit(action,actor){data.audit.push({action,actor,at:new Date().toISOString()});if(data.audit.length>500)data.audit.splice(0,data.audit.length-500);}
  const normalLogin=x=>String(x||'').trim().toLowerCase();
  function validLogin(v){return /^[a-z0-9._-]{3,32}$/.test(v)||(v.length<=254&&/^[a-z0-9._%+-]{1,64}@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(v));}
  function validName(v){return typeof v==='string'&&v.trim().length>=3&&v.length<=140;}
  function validPassword(v){return typeof v==='string'&&v.length>=6&&v.length<=128;}
  // Regras individuais persistidas na conta, nunca no armazenamento do aparelho.
  // A falta de configuração mantém o comportamento padrão dos técnicos atuais.
  const RIGHTS=['ordens','clientes','assinaturas','links','relatorios','financeiro','catalogo'];
  const defaults=a=>a.perfil==='Administrador'
    ? Object.fromEntries(RIGHTS.map(k=>[k,true]))
    : {ordens:true,clientes:true,assinaturas:true,links:true,relatorios:false,financeiro:false,catalogo:false};
  const permissions=a=>{
    const preset=defaults(a);
    if(a.perfil==='Administrador')return preset;
    return Object.fromEntries(RIGHTS.map(k=>[k,typeof a.permissions?.[k]==='boolean'?a.permissions[k]:preset[k]]));
  };
  const can=(a,right)=>Boolean(a)&&(a.perfil==='Administrador'||permissions(a)[right]===true);
  const safe=a=>({id:a.id,nome:a.nome,login:a.login,perfil:a.perfil,active:a.active!==false,permissions:permissions(a)});
  function passwordHash(p,salt){return crypto.scryptSync(p,Buffer.from(salt,'hex'),64,{N:16384,r:8,p:1}).toString('hex');}
  function safeEq(a,b){const x=Buffer.from(a||'','hex'),y=Buffer.from(b||'','hex');return x.length===y.length && x.length>0 && crypto.timingSafeEqual(x,y);}
  function makeToken(acc){const payload=Buffer.from(JSON.stringify({uid:acc.id,rev:acc.rev,exp:Date.now()+8*3600*1000})).toString('base64url');return payload+'.'+crypto.createHmac('sha256',tokenKey).update(payload).digest('base64url');}
  function verifyToken(req){const m=/^Bearer ([A-Za-z0-9_.-]+)$/.exec(String(req.headers.authorization||''));if(!m)return null;
    const [payload,mac]=m[1].split('.');if(!payload||!mac)return null;
    const expected=crypto.createHmac('sha256',tokenKey).update(payload).digest('base64url');
    if(!safeEq(Buffer.from(mac).toString('hex'),Buffer.from(expected).toString('hex')))return null;
    let t;try{t=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));}catch{return null;}
    if(!t.exp||t.exp<Date.now())return null;
    const user=data.accounts.find(a=>a.id===t.uid&&a.active!==false&&a.rev===t.rev);return user||null;
  }
  function send(res,code,obj){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(obj));}
  async function body(req){const chunks=[];let size=0;for await(const part of req){size+=part.length;if(size>2_000_000)throw {status:413,message:'Dados excedem 2 MB.'};chunks.push(part);}try{return JSON.parse(Buffer.concat(chunks).toString());}catch{throw {status:400,message:'JSON inválido.'};}}
  const stateFor=u=>({revision:data.workspace.revision,
    clients:can(u,'clientes')?data.workspace.clients:[],
    orders:can(u,'ordens')?data.workspace.orders:[],
    drafts:can(u,'ordens')?data.workspace.drafts:[],
    ...(can(u,'financeiro')?{finance:data.workspace.finance}:{})
  });
  function validCollection(arr,max){return Array.isArray(arr)&&arr.length<=max&&arr.every(x=>x&&typeof x==='object'&&!Array.isArray(x)&&typeof x.id==='string'&&x.id.length>=1&&x.id.length<=100);}
  const catalogText=(x,max=200)=>typeof x==='string'&&x.length<=max;
  const serialOK=s=>typeof s==='string'&&s.length<=120;
  const ipOK=ip=>!ip||(/^[a-f0-9:.]+$/i.test(ip)&&ip.length<=45);
  const macOK=mac=>!mac||/^(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i.test(mac);
  const idOK=x=>typeof x==='string'&&x.length>=1&&x.length<=100;
  function validateCatalog(input){
    if(!input||typeof input!=='object'||!Number.isInteger(input.revision))return 'Revisão obrigatória.';
    const limits={services:1000,products:2000,equipments:3000};
    for(const [kind,max] of Object.entries(limits)){
      const arr=input[kind];if(!Array.isArray(arr)||arr.length>max)return 'Lista inválida ou muito extensa: '+kind;
      const ids=new Set();
      for(const o of arr){
        if(!o||typeof o!=='object'||Array.isArray(o)||!idOK(o.id)||ids.has(o.id))return 'IDs duplicados ou inválidos.';
        ids.add(o.id);
        if(!catalogText(o.nome,180)||!o.nome.trim()||!catalogText(o.descricao||'',1200))return 'Preencha o nome do item corretamente.';
        if(o.empresaId && (!idOK(o.empresaId)||!data.workspace.clients.some(x=>x.id===o.empresaId)))return 'Empresa vinculada não encontrada no cadastro de Clientes.';
        if(kind!=='equipments'){
          if(!Number.isFinite(o.valor)||o.valor<0||o.valor>100000000)return 'Valor inválido para produto ou serviço.';
          if(!catalogText(o.unidade||'',50)||!catalogText(o.codigo||'',120))return 'Dados de produto/serviço inválidos.';
          if(kind==='products'&&(!Number.isFinite(o.quantidade)||o.quantidade<0||o.quantidade>10000000))return 'Quantidade inválida.';
        }else{
          if(!o.empresaId)return 'Selecione a empresa proprietária do equipamento.';
          if(!catalogText(o.tipo,120)||!o.tipo.trim()||!serialOK(o.serie||'')||!ipOK(o.ip||'')||!macOK(o.mac||''))return 'Tipo, número de série, IP ou MAC inválido.';
          for(const name of ['fabricante','modelo','local','status','observacoes'])if(!catalogText(o[name]||'',name==='observacoes'?1200:160))return 'Campo de equipamento muito extenso.';
        }
      }
    }
    const seen=new Set();
    for(const e of input.equipments){
      const serial=(e.serie||'').trim().toLowerCase();
      if(!serial)continue;
      const key=e.empresaId+'|'+serial;
      if(seen.has(key))return 'Número de série duplicado para a mesma empresa.';
      seen.add(key);
    }
    return null;
  }
  const tries=new Map();
  async function handle(req,res,pathname){
    if(!pathname.startsWith('/api/team/'))return false;
    const p=pathname.substring('/api/team/'.length);
    try{
      if(req.method==='GET'&&p==='status')return send(res,200,{configured:data.accounts.length>0,version:1});
      if(req.method==='POST'&&p==='bootstrap'){
        if(data.accounts.length)return send(res,409,{error:'Administrador já cadastrado no servidor.'});
        const supplied=String(req.headers['x-api-key']||'');const h=x=>crypto.createHash('sha256').update(x).digest();
        if(!crypto.timingSafeEqual(h(supplied),h(KEY)))return send(res,403,{error:'Chave administrativa incorreta.'});
        const b=await body(req),login=normalLogin(b.login),nome=String(b.nome||'').trim(),pwd=b.senha;
        if(!validLogin(login)||!validName(nome)||!validPassword(pwd))return send(res,400,{error:'Informe nome, usuário ou e-mail válido e senha com pelo menos 6 caracteres.'});
        const salt=crypto.randomBytes(16).toString('hex');const acc={id:crypto.randomUUID(),login,nome,perfil:'Administrador',active:true,rev:1,salt,hash:passwordHash(pwd,salt)};
        data.accounts.push(acc);writeAudit('bootstrap',acc.id);await persist();return send(res,201,{token:makeToken(acc),account:safe(acc)});
      }
      // Recovery is disabled unless an independent, random reset token is configured on Render.
      // It requires BOTH the current ADMIN_KEY and that token. Tokens are single-use across restarts.
      if(req.method==='POST'&&p==='recover-admin-password'){
        const resetToken=String(process.env.PASSWORD_RESET_TOKEN||'');
        if(!/^[a-f0-9]{64}$/i.test(resetToken))return send(res,404,{error:'Rota não encontrada.'});
        const digest=x=>crypto.createHash('sha256').update(String(x||'')).digest();
        const equals=(a,b)=>crypto.timingSafeEqual(digest(a),digest(b));
        const suppliedKey=req.headers['x-api-key'],suppliedToken=req.headers['x-password-reset-token'];
        if(typeof suppliedKey!=='string'||typeof suppliedToken!=='string'||
          !equals(suppliedKey,KEY)||!equals(suppliedToken,resetToken))
          return send(res,403,{error:'Credenciais de recuperação inválidas.'});
        const tokenHash=digest(resetToken).toString('hex');
        if(data.usedPasswordResetTokens?.includes(tokenHash))
          return send(res,409,{error:'Este código de recuperação já foi utilizado.'});
        const b=await body(req),login=normalLogin(b.login),senha=b.senha;
        if(!validLogin(login)||!validPassword(senha)||senha.length<12)
          return send(res,400,{error:'Informe login válido e senha de 12 a 128 caracteres.'});
        const acc=data.accounts.find(a=>a.login===login&&a.perfil==='Administrador'&&a.active!==false);
        if(!acc)return send(res,404,{error:'Administrador não encontrado.'});
        // Keep a private, on-disk snapshot before changing any account data.
        await fs.promises.copyFile(DBFILE,DBFILE+'.pre-password-reset-'+Date.now()+'.bak');
        const salt=crypto.randomBytes(16).toString('hex');
        acc.salt=salt;acc.hash=passwordHash(senha,salt);
        acc.rev=(Number.isInteger(acc.rev)?acc.rev:0)+1; // Invalidate all previous sessions.
        data.usedPasswordResetTokens||=[];
        data.usedPasswordResetTokens.push(tokenHash); // Only a hash is stored, never the token.
        writeAudit('admin-password-recovery',acc.id);
        tries.delete(login);
        await persist();
        return send(res,200,{ok:true,login:acc.login,perfil:acc.perfil});
      }
      if(req.method==='POST'&&p==='login'){
        const b=await body(req),login=normalLogin(b.login);const count=tries.get(login)||{n:0,until:0};
        if(count.until>Date.now())return send(res,429,{error:'Muitas tentativas. Aguarde 10 minutos.'});
        const acc=data.accounts.find(a=>a.login===login&&a.active!==false);
        const check=acc?passwordHash(String(b.senha||''),acc.salt):passwordHash(String(b.senha||''),crypto.randomBytes(16).toString('hex'));
        if(!acc||!safeEq(check,acc.hash)){
          count.n++;if(count.n>=5){count.n=0;count.until=Date.now()+10*60_000;}tries.set(login,count);
          return send(res,401,{error:'Usuário ou senha inválidos.'});
        }
        tries.delete(login);return send(res,200,{token:makeToken(acc),account:safe(acc)});
      }
      const actor=verifyToken(req);if(!actor)return send(res,401,{error:'Sessão inválida ou expirada. Entre novamente.'});
      if(req.method==='GET'&&p==='me')return send(res,200,{account:safe(actor)});
      if(req.method==='GET'&&p==='users')return send(res,200,{users:data.accounts.filter(x=>x.active!==false).map(safe)});
      if(p==='catalog'){
        if(!can(actor,'catalogo'))return send(res,403,{error:'Sem permissão para o catálogo e equipamentos.'});
        if(req.method==='GET')return send(res,200,{...data.catalog,companies:data.workspace.clients.map(x=>({id:x.id,nome:x.nome}))});
        if(req.method==='PUT'){
          const b=await body(req),err=validateCatalog(b);
          if(err)return send(res,400,{error:err});
          if(b.revision!==data.catalog.revision)return send(res,409,{error:'Catálogo alterado em outro aparelho. Atualize antes de salvar.',revision:data.catalog.revision});
          data.catalog={revision:data.catalog.revision+1,services:b.services,products:b.products,equipments:b.equipments};
          writeAudit('catalog-update',actor.id);await persist();
          return send(res,200,{...data.catalog,companies:data.workspace.clients.map(x=>({id:x.id,nome:x.nome}))});
        }
      }
      if(req.method==='GET'&&p==='workspace')return send(res,200,stateFor(actor));
      if(req.method==='PUT'&&p==='workspace'){
        const b=await body(req);if(!Number.isInteger(b.revision))return send(res,400,{error:'Revisão obrigatória.'});
        if(b.revision!==data.workspace.revision)return send(res,409,{error:'Outro aparelho atualizou os dados. Sincronize para evitar perda de informações.',revision:data.workspace.revision});
        if(!validCollection(b.clients,1500)||!validCollection(b.orders,3500)||!validCollection(b.drafts,250))return send(res,400,{error:'Lista inválida de clientes ou ordens.'});
        if(can(actor,'financeiro')&&!validCollection(b.finance,3500))return send(res,400,{error:'Lista financeira inválida.'});
        if(can(actor,'financeiro')){
          for(const expense of b.finance){
            if(expense.categoria!=='viagem')continue;
            const t=expense.viagem;
            if(expense.tipo!=='despesa'||!t||typeof t!=='object'||
              !/^\d{4}-\d{2}-\d{2}$/.test(String(expense.data||''))||
              typeof expense.osNumero!=='string'||expense.osNumero.length>120||
              typeof expense.descricao!=='string'||expense.descricao.length>220||
              typeof t.tanqueCompleto!=='boolean'||typeof t.incluirAbastecimento!=='boolean'){
              return send(res,400,{error:'Lançamento de viagem inválido.'});
            }
            try{
              const expected=calculateTravel(t);
              if(!Number.isFinite(expense.valor)||Math.abs(expense.valor-expected.total)>0.001||
                Math.abs(t.kmRodados-expected.kmRodados)>0.001||
                Math.abs(t.custoKm-expected.custoKm)>0.001){
                return send(res,400,{error:'Total de viagem ou km rodados incorreto.'});
              }
            }catch(err){return send(res,400,{error:err.message});}
          }
        }
        if(!can(actor,'clientes')&&b.clients.length)return send(res,403,{error:'Sem permissão para gerenciar clientes.'});
        if(!can(actor,'ordens')&&(b.orders.length||b.drafts.length))return send(res,403,{error:'Sem permissão para gerenciar ordens de serviço.'});
        if(!can(actor,'financeiro')&&Array.isArray(b.finance)&&b.finance.length)return send(res,403,{error:'Sem permissão para gerenciar financeiro.'});
        // Não permita que técnicos eliminem arquivos já finalizados nem clientes existentes.
        if(actor.perfil!=='Administrador'){
          const contains=(previous,next)=>previous.every(x=>next.some(y=>y.id===x.id));
          if(can(actor,'ordens')&&!contains(data.workspace.orders,b.orders))return send(res,403,{error:'Somente administradores podem excluir ordens já finalizadas.'});
          if(can(actor,'clientes')&&!contains(data.workspace.clients,b.clients))return send(res,403,{error:'Somente administradores podem excluir clientes existentes.'});
          if(can(actor,'ordens')&&data.workspace.orders.some(old=>JSON.stringify(old)!==JSON.stringify(b.orders.find(x=>x.id===old.id))))return send(res,403,{error:'Somente administradores podem alterar ordens já finalizadas.'});
        }
        // Não exclua empresa com equipamentos vinculados sem antes transferi-los.
        const kept=new Set((can(actor,'clientes')?b.clients:data.workspace.clients).map(x=>x.id));
        if(data.catalog.equipments.some(x=>!kept.has(x.empresaId)))return send(res,409,{error:'Há equipamento vinculado a empresa removida. Transfira o equipamento antes de excluir a empresa.'});
        data.workspace={revision:data.workspace.revision+1,
          clients:can(actor,'clientes')?b.clients:data.workspace.clients,
          orders:can(actor,'ordens')?b.orders:data.workspace.orders,
          drafts:can(actor,'ordens')?b.drafts:data.workspace.drafts,
          finance:can(actor,'financeiro')?b.finance:data.workspace.finance
        };
        writeAudit('workspace-update',actor.id);await persist();return send(res,200,stateFor(actor));
      }
      if(req.method==='POST'&&p==='users'){
        if(actor.perfil!=='Administrador')return send(res,403,{error:'Somente administrador pode cadastrar usuários.'});
        const b=await body(req),login=normalLogin(b.login),nome=String(b.nome||'').trim(),perfil=b.perfil;
        if(!validLogin(login)||!validName(nome)||!['Administrador','Técnico','Atendimento'].includes(perfil))return send(res,400,{error:'Nome, login ou perfil inválido.'});
        const existing=b.id?data.accounts.find(x=>x.id===b.id):null;
        if(data.accounts.some(x=>x.login===login&&x.id!==existing?.id))return send(res,409,{error:'Login já cadastrado.'});
        if((!existing||b.senha) && !validPassword(b.senha))return send(res,400,{error:'Senha deve ter pelo menos 6 caracteres.'});
        if(existing?.id===actor.id&&perfil!=='Administrador')return send(res,403,{error:'Você não pode remover seu próprio perfil administrador.'});
        if(existing?.perfil==='Administrador'&&perfil!=='Administrador'&&!data.accounts.some(x=>x.id!==existing.id&&x.perfil==='Administrador'&&x.active!==false))return send(res,403,{error:'Mantenha ao menos um administrador.'});
        const a=existing||{id:crypto.randomUUID(),rev:1,active:true};const oldRole=a.perfil;Object.assign(a,{login,nome,perfil});
        if(oldRole&&oldRole!==perfil){a.permissions=defaults(a);a.rev++;}
        if(b.senha){a.salt=crypto.randomBytes(16).toString('hex');a.hash=passwordHash(b.senha,a.salt);a.rev++;}
        if(!existing)data.accounts.push(a);writeAudit(existing?'user-update':'user-create',actor.id);await persist();return send(res,200,{user:safe(a)});
      }
      const access=p.match(/^users\/([0-9a-f-]{36})\/permissions$/i);
      if(req.method==='PUT'&&access){
        if(actor.perfil!=='Administrador')return send(res,403,{error:'Somente administradores podem alterar permissões.'});
        const target=data.accounts.find(x=>x.id===access[1]&&x.active!==false);
        if(!target)return send(res,404,{error:'Usuário não encontrado.'});
        if(target.perfil==='Administrador')return send(res,403,{error:'Administradores possuem todas as permissões; altere o perfil para restringir o usuário.'});
        const incoming=(await body(req)).permissions;
        if(!incoming||typeof incoming!=='object'||Array.isArray(incoming)||!Object.keys(incoming).length||
          Object.keys(incoming).some(k=>!RIGHTS.includes(k)||typeof incoming[k]!=='boolean'))
          return send(res,400,{error:'Permissões inválidas. Informe apenas opções verdadeiras ou falsas.'});
        target.permissions={...permissions(target),...incoming};
        target.rev++; // A sessão anterior perde validade imediatamente.
        writeAudit('user-permissions-update',actor.id);
        await persist();return send(res,200,{user:safe(target)});
      }
      const del=p.match(/^users\/([0-9a-f-]{36})$/i);
      if(req.method==='DELETE'&&del){
        if(actor.perfil!=='Administrador')return send(res,403,{error:'Somente administradores podem remover contas.'});
        const target=data.accounts.find(x=>x.id===del[1]);if(!target)return send(res,404,{error:'Usuário não encontrado.'});
        if(target.id===actor.id)return send(res,403,{error:'Não é permitido excluir a própria conta.'});
        if(target.perfil==='Administrador'&&!data.accounts.some(x=>x.id!==target.id&&x.perfil==='Administrador'&&x.active!==false))return send(res,403,{error:'Não é permitido excluir último administrador.'});
        target.active=false;target.rev++;writeAudit('user-deactivate',actor.id);await persist();return send(res,200,{ok:true});
      }
      return send(res,404,{error:'Rota não encontrada.'});
    }catch(e){console.error('Equipe API',e.message);return send(res,e.status||500,{error:e.status?e.message:'Erro interno no servidor.'});}
  }
  return {handle,getActor:verifyToken,hasPermission:(req,right)=>can(verifyToken(req),right)};
}
module.exports={teamApi};
