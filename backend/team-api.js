'use strict';
// ACR OS Pro v1.7: authentication and shared workspace. Only for HTTPS reverse proxies.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {calculateTravel} = require('./travel');
const LicenseModel = require('./license-utils');
const RHiDMonitor = require('./rhid-monitor');
const Recovery = require('./recovery');
const {serviceDesk}=require('./service-desk');

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
  // Relacionamentos preservados separadamente para não se perderem na sincronização de OS do APK.
  data.companyLinks||={};
  if(typeof data.companyLinks!=='object'||Array.isArray(data.companyLinks))throw Error('Vínculos de empresas inválidos.');
  data.audit||=[];
  // Licenças possuem revisão independente: atualizações das OS não sobrescrevem este cadastro.
  data.licenses||={revision:0,items:[]};
  if(!Array.isArray(data.licenses.items))throw Error('Base de licenças corrompida.');
  if(!Number.isInteger(data.licenses.revision))data.licenses.revision=0;
  // Apenas histórico de alterações de conectividade; sem dados pessoais do RHiD.
  data.rhidMonitor||={statuses:{},events:[]};
  if(!Array.isArray(data.rhidMonitor.events))data.rhidMonitor.events=[];
  if(!data.rhidMonitor.statuses||typeof data.rhidMonitor.statuses!=='object')data.rhidMonitor.statuses={};
  let rhidCache=null,rhidInFlight=null;
  // Coleção separada das OS: a atualização de uma OS não sobrescreve o catálogo.
  data.catalog||={revision:0,services:[],products:[],equipments:[]};
  for(const collection of ['services','products','equipments'])data.catalog[collection]||=[];
  const pendingTotp=new Map(),emailRequests=new Map(),adminTotpAttempts=new Map();
  const genericEmailMessage='Se o e-mail estiver cadastrado em uma conta comum e o envio estiver habilitado, você receberá um link em instantes.';
  function allowedAttempt(map,key,max,windowMs){
    const now=Date.now(),state=map.get(key);
    if(map.size>5000)map.clear();
    if(!state||state.until<=now){map.set(key,{n:1,until:now+windowMs});return true;}
    if(state.n>=max)return false;
    state.n++;return true;
  }
  function configuredPublicBase(){
    const root=String(process.env.PUBLIC_BASE_URL||'').replace(/\/+$/,'');
    if(!/^https:\/\/[a-z0-9.-]+(?::443)?$/i.test(root)&&!/^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(root))
      throw Error('PUBLIC_BASE_URL inválida para recuperação.');
    return root;
  }
  function validEmail(value){
    return typeof value==='string'&&value.length<=254&&/^[a-z0-9._%+-]{1,64}@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(value);
  }
  function digestToken(value){return crypto.createHash('sha256').update(value).digest('hex');}
  function passwordChange(account,senha){
    const salt=crypto.randomBytes(16).toString('hex');
    account.salt=salt;account.hash=passwordHash(senha,salt);
    account.rev=(Number.isInteger(account.rev)?account.rev:0)+1;
    delete account.emailReset;
    tries.delete(account.login);
  }
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
  const RIGHTS=['ordens','clientes','assinaturas','links','relatorios','financeiro','catalogo','licencas','rhid','chamados'];
  const defaults=a=>a.perfil==='Administrador'
    ? Object.fromEntries(RIGHTS.map(k=>[k,true]))
    : {ordens:true,clientes:true,assinaturas:true,links:true,relatorios:false,financeiro:false,catalogo:false,licencas:false,rhid:false,chamados:a.perfil==='Técnico'};
  const permissions=a=>{
    const preset=defaults(a);
    if(a.perfil==='Administrador')return preset;
    return Object.fromEntries(RIGHTS.map(k=>[k,typeof a.permissions?.[k]==='boolean'?a.permissions[k]:preset[k]]));
  };
  const can=(a,right)=>Boolean(a)&&(a.perfil==='Administrador'||permissions(a)[right]===true);
  const scopeFor=a=>a.perfil==='Técnico'&&typeof a.empresaId==='string' ? (a.empresaId||'__SEM_EMPRESA__') : null;
  const isScoped=a=>scopeFor(a)!==null;
  const companyIds=()=>new Set(data.workspace.clients.map(x=>x.id));
  const companyById=id=>data.workspace.clients.find(x=>x.id===id);
  const companyName=x=>String(x?.nome||x?.razaoSocial||'Empresa');
  const normCompany=x=>String(x||'').trim().replace(/\s+/g,' ');
  const isContractor=id=>Object.values(data.companyLinks).includes(id);
  function safeCompany(c){
    const terceirizadaId=data.companyLinks[c.id]||'';
    return {id:c.id,nome:companyName(c),
      tipoEmpresa:terceirizadaId?'cliente-final':isContractor(c.id)?'terceirizada':'independente',
      terceirizadaId,
      terceirizadaNome:terceirizadaId?companyName(companyById(terceirizadaId)):''};
  }
  const belongsCompany=(record,id)=>{
    const direct=[record?.empresaId,record?.clienteId,record?.clientId,record?.companyId].find(x=>typeof x==='string'&&x);
    if(direct)return direct===id;
    const label=[record?.cliente,record?.clienteNome,record?.clientName,record?.empresa].find(x=>typeof x==='string'&&x.trim());
    if(!label)return false;
    const matching=data.workspace.clients.filter(x=>[x.nome,x.razaoSocial].some(n=>typeof n==='string'&&n.trim().toLowerCase()===label.trim().toLowerCase()));
    return matching.length===1&&matching[0].id===id;
  };
  const safe=a=>({id:a.id,nome:a.nome,login:a.login,email:a.email||'',perfil:a.perfil,active:a.active!==false,
    empresaId:scopeFor(a)||'',permissions:permissions(a)});
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
  const stateFor=u=>{
    const scope=scopeFor(u),filter=a=>scope===null?a:a.filter(x=>belongsCompany(x,scope));
    return {revision:data.workspace.revision,
      clients:can(u,'clientes')?(scope===null?data.workspace.clients:data.workspace.clients.filter(x=>x.id===scope)):[],
      orders:can(u,'ordens')?filter(data.workspace.orders):[],
      drafts:can(u,'ordens')?filter(data.workspace.drafts):[],
      ...(can(u,'financeiro')?{finance:filter(data.workspace.finance)}:{})};
  };
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
  const desk=serviceDesk({data,dbfile:DBFILE,persist,send,body,writeAudit,scopeFor});
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
      if(p.startsWith('customer/'))return desk.publicHandle(req,res,p);
      // Public email recovery for non-admins only. Generic replies prevent account enumeration.
      if(req.method==='POST'&&p==='password-reset/request'){
        const b=await body(req),email=normalLogin(b.email);
        const key=String(req.socket.remoteAddress||'')+'|'+email.slice(0,254);
        if(!allowedAttempt(emailRequests,key,3,15*60_000))
          return send(res,200,{message:genericEmailMessage});
        const a=validEmail(email)?data.accounts.find(x=>x.active!==false&&x.perfil!=='Administrador'&&(x.email===email||(!x.email&&x.login===email))):null;
        if(a&&process.env.RESEND_API_KEY&&process.env.PASSWORD_RESET_FROM_EMAIL){
          const token=crypto.randomBytes(32).toString('base64url');
          const previous=a.emailReset;
          a.emailReset={hash:digestToken(token),expires:Date.now()+15*60_000};
          try{
            const link=configuredPublicBase()+'/password-reset#token='+encodeURIComponent(token);
            await Recovery.sendResetMail({to:email,link});
            writeAudit('user-password-reset-email-request',a.id);
            await persist();
          }catch{
            if(previous)a.emailReset=previous;else delete a.emailReset;
            // Never print a token, address or mail provider response to logs.
          }
        }
        return send(res,200,{message:genericEmailMessage});
      }
      if(req.method==='POST'&&p==='password-reset/confirm'){
        const b=await body(req),token=b.token,senha=b.senha;
        if(!allowedAttempt(emailRequests,'confirm|'+String(req.socket.remoteAddress||''),15,15*60_000))
          return send(res,429,{error:'Muitas tentativas. Aguarde 15 minutos.'});
        if(typeof token!=='string'||!/^[A-Za-z0-9_-]{42,44}$/.test(token)||!validPassword(senha)||senha.length<12)
          return send(res,400,{error:'Link inválido ou senha fora do padrão (mínimo de 12 caracteres).'});
        const hashed=digestToken(token);
        const acc=data.accounts.find(a=>a.perfil!=='Administrador'&&a.active!==false&&a.emailReset?.hash===hashed&&a.emailReset.expires>Date.now());
        if(!acc)return send(res,400,{error:'Link inválido ou expirado. Solicite outro.'});
        passwordChange(acc,senha);
        writeAudit('user-password-reset-email-complete',acc.id);
        await persist();
        return send(res,200,{ok:true});
      }
      // A verified Microsoft Authenticator TOTP may recover ONLY an enrolled administrator.
      if(req.method==='POST'&&p==='admin-totp/recover'){
        const b=await body(req),login=normalLogin(b.login),senha=b.senha,code=b.code;
        const key='totp|'+String(req.socket.remoteAddress||'')+'|'+login.slice(0,254);
        if(!allowedAttempt(adminTotpAttempts,key,5,10*60_000))
          return send(res,429,{error:'Muitas tentativas. Aguarde 10 minutos.'});
        if(!validLogin(login)||!validPassword(senha)||senha.length<12||typeof code!=='string'||!/^\d{6}$/.test(code))
          return send(res,400,{error:'Informe login, código de seis dígitos e nova senha de 12 a 128 caracteres.'});
        const acc=data.accounts.find(a=>a.login===login&&a.perfil==='Administrador'&&a.active!==false&&a.totp?.secret);
        if(!acc)return send(res,403,{error:'Recuperação por autenticador indisponível ou inválida.'});
        let step=-1;
        try{step=Recovery.verifyTotp(Recovery.decrypt(acc.totp.secret,KEY),code,Date.now(),acc.totp.lastStep??-1);}catch{}
        if(step<0)return send(res,403,{error:'Código inválido ou já utilizado.'});
        // Prevent TOTP replay even if concurrent requests arrive.
        acc.totp.lastStep=step;
        passwordChange(acc,senha);
        writeAudit('admin-password-reset-totp',acc.id);
        await persist();
        return send(res,200,{ok:true});
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
      // Enrollment is available only to a logged-in admin who re-enters their password.
      if(p==='admin-totp/status'&&req.method==='GET'){
        if(actor.perfil!=='Administrador')return send(res,403,{error:'Apenas o administrador pode configurar o autenticador.'});
        return send(res,200,{enabled:Boolean(actor.totp?.secret)});
      }
      if(p==='admin-totp/setup'&&req.method==='POST'){
        if(actor.perfil!=='Administrador')return send(res,403,{error:'Acesso restrito ao administrador.'});
        if(actor.totp?.secret)return send(res,409,{error:'Autenticador já ativado. Para trocar, solicite um procedimento seguro ao suporte.'});
        const b=await body(req);
        const key='setup|'+String(req.socket.remoteAddress||'')+'|'+actor.id;
        if(!allowedAttempt(adminTotpAttempts,key,5,10*60_000))return send(res,429,{error:'Muitas tentativas. Aguarde 10 minutos.'});
        const check=passwordHash(String(b.senha||''),actor.salt);
        if(!safeEq(check,actor.hash))return send(res,403,{error:'Senha do administrador incorreta.'});
        const secret=Recovery.base32(crypto.randomBytes(20));
        pendingTotp.set(actor.id,{secret,expires:Date.now()+10*60_000});
        const issuer='ACR OS Pro';
        const uri='otpauth://totp/'+encodeURIComponent(issuer+':'+actor.login)+'?secret='+secret+'&issuer='+encodeURIComponent(issuer)+'&algorithm=SHA1&digits=6&period=30';
        return send(res,200,{secret,otpauth:uri,expiresInSeconds:600});
      }
      if(p==='admin-totp/confirm'&&req.method==='POST'){
        if(actor.perfil!=='Administrador')return send(res,403,{error:'Acesso restrito ao administrador.'});
        if(actor.totp?.secret)return send(res,409,{error:'Autenticador já ativado.'});
        const key='activate|'+String(req.socket.remoteAddress||'')+'|'+actor.id;
        if(!allowedAttempt(adminTotpAttempts,key,5,10*60_000))return send(res,429,{error:'Muitas tentativas. Aguarde 10 minutos.'});
        const pending=pendingTotp.get(actor.id);
        if(!pending||pending.expires<Date.now())return send(res,400,{error:'Configuração expirada. Inicie novamente.'});
        const b=await body(req);
        const used=Recovery.verifyTotp(pending.secret,b.code);
        if(used<0)return send(res,403,{error:'Código do autenticador inválido.'});
        actor.totp={secret:Recovery.encrypt(pending.secret,KEY),lastStep:used};
        pendingTotp.delete(actor.id);
        writeAudit('admin-totp-enable',actor.id);
        await persist();
        return send(res,200,{enabled:true});
      }
      if(req.method==='GET'&&p==='me')return send(res,200,{account:safe(actor)});
      if(req.method==='GET'&&p==='companies'){
        if(actor.perfil!=='Administrador')return send(res,403,{error:'Lista de empresas restrita ao administrador.'});
        return send(res,200,{companies:data.workspace.clients.map(safeCompany)});
      }
      if(req.method==='POST'&&p==='companies'){
        if(actor.perfil!=='Administrador')return send(res,403,{error:'Somente o administrador pode cadastrar empresas.'});
        const b=await body(req),nome=typeof b.nome==='string'?b.nome.trim().replace(/\s+/g,' '):'';
        if(nome.length<3||nome.length>180)return send(res,400,{error:'Informe o nome da empresa (3 a 180 caracteres).'});
        if(data.workspace.clients.length>=1500)return send(res,409,{error:'Limite de empresas cadastradas atingido.'});
        if(data.workspace.clients.some(x=>String(x.nome||x.razaoSocial||'').trim().toLocaleLowerCase('pt-BR')===nome.toLocaleLowerCase('pt-BR')))
          return send(res,409,{error:'Essa empresa já está cadastrada.'});
        const company={id:crypto.randomUUID(),nome,razaoSocial:nome};
        data.workspace.clients.push(company);
        data.workspace.revision++;
        writeAudit('company-create',actor.id);
        await persist();
        return send(res,201,{company,revision:data.workspace.revision});
      }
      if(req.method==='POST'&&p==='companies/link'){
        if(actor.perfil!=='Administrador')return send(res,403,{error:'Somente o administrador vincula terceirizadas e clientes finais.'});
        const b=await body(req);
        const resolve=(id,name,label)=>{
          if(id!==undefined&&id!==null&&id!==''){
            if(typeof id!=='string'||id.length>100)throw {status:400,message:'ID inválido para '+label+'.'};
            const company=companyById(id);
            if(!company)throw {status:400,message:label+' não encontrada.'};
            return {company};
          }
          const nome=normCompany(name);
          if(nome.length<3||nome.length>180)throw {status:400,message:'Informe '+label+' (3 a 180 caracteres).'};
          if(data.workspace.clients.some(x=>companyName(x).toLocaleLowerCase('pt-BR')===nome.toLocaleLowerCase('pt-BR')))
            throw {status:409,message:label+' já está cadastrada. Selecione o cadastro existente.'};
          return {company:{id:crypto.randomUUID(),nome,razaoSocial:nome},create:true};
        };
        const outsourcing=resolve(b.terceirizadaId,b.terceirizadaNome,'a empresa terceirizada');
        const final=resolve(b.clienteFinalId,b.clienteFinalNome,'o cliente final');
        if(outsourcing.company.id===final.company.id||
           companyName(outsourcing.company).toLocaleLowerCase('pt-BR')===companyName(final.company).toLocaleLowerCase('pt-BR'))
          return send(res,400,{error:'Terceirizada e cliente final devem ser empresas diferentes.'});
        if(data.companyLinks[outsourcing.company.id])
          return send(res,409,{error:'Esta terceirizada já é cliente final de outra empresa. Cadastre outra empresa terceirizada.'});
        if(isContractor(final.company.id))
          return send(res,409,{error:'Este cliente final já atua como terceirizada de outros clientes. Selecione outro cliente.'});
        const creates=Number(Boolean(outsourcing.create))+Number(Boolean(final.create));
        if(data.workspace.clients.length+creates>1500)
          return send(res,409,{error:'Limite de empresas cadastradas atingido.'});
        if(outsourcing.create)data.workspace.clients.push(outsourcing.company);
        if(final.create)data.workspace.clients.push(final.company);
        data.companyLinks[final.company.id]=outsourcing.company.id;
        data.workspace.revision++;
        writeAudit('company-outsourcing-link',actor.id);
        await persist();
        return send(res,200,{terceirizada:safeCompany(outsourcing.company),
          clienteFinal:safeCompany(final.company),revision:data.workspace.revision});
      }
      if(req.method==='GET'&&p==='users'){
        const scope=scopeFor(actor);
        return send(res,200,{users:data.accounts.filter(x=>x.active!==false&&(scope===null||x.id===actor.id||
          x.perfil==='Técnico'&&x.empresaId===scope)).map(safe)});
      }
      if(p==='tickets'||p.startsWith('tickets/')||p==='customer-portals'){
        if(actor.perfil!=='Administrador'&&actor.perfil!=='Técnico')return send(res,403,{error:'Chamados disponíveis apenas para técnicos e administradores.'});
        return desk.authenticatedHandle(req,res,p,actor);
      }
      if(p==='rhid-monitor' && req.method==='GET'){
        if(!can(actor,'rhid'))return send(res,403,{error:'Sem permissão para monitorar equipamentos RHiD.'});
        if(!process.env.RHID_API_TOKEN?.trim()&&!(process.env.RHID_LOGIN_EMAIL?.trim()&&process.env.RHID_LOGIN_PASSWORD)){
          return send(res,200,{configured:false,devices:[],summary:{total:0,online:0,offline:0,unknown:0},
            events:[],updatedAt:null,message:'Configure RHID_LOGIN_EMAIL e RHID_LOGIN_PASSWORD no Render para ativar o login automático (ou RHID_API_TOKEN temporário).'});
        }
        const load=async()=>{
          const result=await RHiDMonitor.readDevices();
          const sampledAt=new Date().toISOString();
          const devices=RHiDMonitor.associate(result.devices,data.catalog.equipments,data.workspace.clients);
          const current=Object.fromEntries(devices.map(d=>[d.id,{status:d.status,serie:d.serie}]));
          const events=[];
          for(const d of devices){
            const previous=data.rhidMonitor.statuses[d.id];
            if(previous&&previous.status!==d.status){
              events.push({id:d.id,nome:d.nome,serie:d.serie,antes:previous.status,depois:d.status,em:sampledAt});
            }
          }
          data.rhidMonitor.statuses=current;
          if(events.length){
            data.rhidMonitor.events.push(...events);
            data.rhidMonitor.events=data.rhidMonitor.events.slice(-500);
          }
          await persist();
          return {configured:true,devices,summary:RHiDMonitor.summary(devices),updatedAt:sampledAt};
        };
        // Reuse concurrent requests and throttle external calls to at most once a minute.
        if(!rhidCache||Date.now()-rhidCache.at>60_000){
          if(!rhidInFlight){
            rhidInFlight=load().then(value=>{rhidCache={at:Date.now(),value};return value;})
              .finally(()=>{rhidInFlight=null;});
          }
          try{await rhidInFlight;}catch(e){
            // Neither token nor upstream body is ever emitted in HTTP response or logs.
            return send(res,502,{error:'Não foi possível consultar o RHiD. Confira token, permissão de API e endereço da integração no Render.'});
          }
        }
        const sc=scopeFor(actor);
        const selected=sc===null?rhidCache.value.devices:rhidCache.value.devices.filter(x=>x.empresaId===sc);
        return send(res,200,{...rhidCache.value,devices:selected,summary:RHiDMonitor.summary(selected),
          events:sc===null?data.rhidMonitor.events.slice(-50).reverse():[]});
      }
      if(p==='licenses'){
        if(!can(actor,'licencas'))return send(res,403,{error:'Sem permissão para gerenciar licenças de software.'});
        const safeLicenses=()=>{
          const scope=scopeFor(actor);
          return {revision:data.licenses.revision,items:scope===null?data.licenses.items:data.licenses.items.filter(x=>x.empresaId===scope),
            companies:data.workspace.clients.filter(x=>scope===null||x.id===scope).map(x=>({id:x.id,nome:x.nome||x.razaoSocial||'Empresa'}))};
        };
        if(req.method==='GET')return send(res,200,safeLicenses());
        if(req.method==='PUT'){
          if(isScoped(actor))return send(res,403,{error:'Técnico delegado não pode modificar licenças de outras empresas.'});
          const b=await body(req);
          if(!b||!Number.isInteger(b.revision)||!Array.isArray(b.items)||b.items.length>2500)
            return send(res,400,{error:'Lista de licenças inválida (até 2.500 itens).'});
          if(b.revision!==data.licenses.revision)return send(res,409,{error:'Licenças alteradas em outro aparelho. Atualize antes de salvar.',revision:data.licenses.revision});
          const ids=new Set();
          for(const item of b.items){
            try{
              if(ids.has(item?.id))throw Error('IDs duplicados de licença.');
              LicenseModel.validate(item);
              ids.add(item.id);
              if(item.empresaId&&!data.workspace.clients.some(x=>x.id===item.empresaId))
                throw Error('Empresa vinculada não encontrada no cadastro de Clientes.');
            }catch(error){return send(res,400,{error:error.message});}
          }
          data.licenses={revision:data.licenses.revision+1,items:b.items};
          writeAudit('licenses-update',actor.id);await persist();
          return send(res,200,safeLicenses());
        }
      }
      if(p==='catalog'){
        if(!can(actor,'catalogo'))return send(res,403,{error:'Sem permissão para o catálogo e equipamentos.'});
        if(req.method==='GET'){
          const scope=scopeFor(actor),filter=a=>scope===null?a:a.filter(x=>x.empresaId===scope);
          return send(res,200,{revision:data.catalog.revision,
            services:filter(data.catalog.services),products:filter(data.catalog.products),equipments:filter(data.catalog.equipments),
            companies:data.workspace.clients.filter(x=>scope===null||x.id===scope).map(x=>({id:x.id,nome:x.nome}))});
        }
        if(req.method==='PUT'){
          if(isScoped(actor))return send(res,403,{error:'Técnico delegado não pode alterar o catálogo corporativo.'});
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
        // Empresa delegada: validar tudo e fazer merge apenas da sua empresa.
        // Nunca permitir que um PUT parcial apague dados de outras empresas.
        if(isScoped(actor)){
          const company=scopeFor(actor);
          if(!companyIds().has(company))return send(res,403,{error:'Seu perfil ainda não possui uma empresa válida atribuída.'});
          const ownClients=can(actor,'clientes')?data.workspace.clients.filter(x=>x.id===company):[];
          if(b.clients.length!==ownClients.length||b.clients.some(x=>!ownClients.some(y=>y.id===x.id&&JSON.stringify(y)===JSON.stringify(x))))
            return send(res,403,{error:'Técnico não pode alterar o cadastro das empresas.'});
          if(!can(actor,'ordens')&&(b.orders.length||b.drafts.length))
            return send(res,403,{error:'Sem permissão para ordens de serviço.'});
          if(b.orders.some(x=>!belongsCompany(x,company))||b.drafts.some(x=>!belongsCompany(x,company)))
            return send(res,403,{error:'Ordem ou rascunho de outra empresa, ou sem empresa identificada.'});
          if(Array.isArray(b.finance)&&b.finance.length)
            return send(res,403,{error:'Lançamentos financeiros são restritos à gestão administrativa neste perfil.'});
          const oldOrders=data.workspace.orders.filter(x=>belongsCompany(x,company));
          if(oldOrders.some(old=>!b.orders.some(x=>x.id===old.id&&JSON.stringify(x)===JSON.stringify(old))))
            return send(res,403,{error:'Técnicos não podem excluir nem alterar OS finalizadas.'});
          const nextOrders=data.workspace.orders.filter(x=>!belongsCompany(x,company)).concat(b.orders);
          const nextDrafts=data.workspace.drafts.filter(x=>!belongsCompany(x,company)).concat(b.drafts);
          const seen=new Set();
          if(nextOrders.some(x=>seen.has(x.id)||!seen.add(x.id)))return send(res,409,{error:'Número interno da ordem duplicado.'});
          data.workspace={...data.workspace,revision:data.workspace.revision+1,orders:nextOrders,drafts:nextDrafts};
          writeAudit('workspace-update-company',actor.id);
          await persist();return send(res,200,stateFor(actor));
        }
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
        if(Object.entries(data.companyLinks).some(([cliente,terceirizada])=>!kept.has(cliente)||!kept.has(terceirizada)))
          return send(res,409,{error:'Existem vínculos entre terceirizadas e clientes finais. Não remova as empresas vinculadas pelo cadastro antigo.'});
        if(data.catalog.equipments.some(x=>!kept.has(x.empresaId)))return send(res,409,{error:'Há equipamento vinculado a empresa removida. Transfira o equipamento antes de excluir a empresa.'});
        if(data.licenses.items.some(x=>x.empresaId&&!kept.has(x.empresaId)))return send(res,409,{error:'Há licença vinculada à empresa removida. Transfira a licença antes de excluir a empresa.'});
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
        const a=existing||{id:crypto.randomUUID(),rev:1,active:true};const oldRole=a.perfil;
        const email=b.email===undefined?(existing?.email|| (validEmail(login)?login:'')):normalLogin(b.email);
        if(email&&!validEmail(email))return send(res,400,{error:'E-mail de recuperação inválido.'});
        Object.assign(a,{login,nome,perfil,email});
        if(oldRole&&oldRole!==perfil){a.permissions=defaults(a);a.rev++;delete a.emailReset;delete a.totp;pendingTotp.delete(a.id);}
        if(b.senha){a.salt=crypto.randomBytes(16).toString('hex');a.hash=passwordHash(b.senha,a.salt);a.rev++;}
        if(!existing)data.accounts.push(a);writeAudit(existing?'user-update':'user-create',actor.id);await persist();return send(res,200,{user:safe(a)});
      }
      const delegated=p.match(/^users\/([0-9a-f-]{36})\/company$/i);
      if(req.method==='PUT'&&delegated){
        if(actor.perfil!=='Administrador')return send(res,403,{error:'Apenas o administrador pode delegar técnicos.'});
        const target=data.accounts.find(x=>x.id===delegated[1]&&x.active!==false&&x.perfil==='Técnico');
        if(!target)return send(res,404,{error:'Técnico não encontrado.'});
        const b=await body(req);
        if(typeof b.empresaId!=='string'||b.empresaId&& !companyIds().has(b.empresaId))
          return send(res,400,{error:'Selecione uma empresa cadastrada, ou sem empresa para bloquear o técnico.'});
        target.empresaId=b.empresaId;
        target.rev++; // Redefinir acesso imediatamente.
        writeAudit('technician-company-delegate',actor.id);
        await persist();return send(res,200,{user:safe(target)});
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
  return {handle,getActor:verifyToken,hasPermission:(req,right)=>{const actor=verifyToken(req);return can(actor,right)&&(!isScoped(actor)||!['links','assinaturas'].includes(right));}};
}
module.exports={teamApi};
