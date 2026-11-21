/* Cadastros locais isolados: clientes e equipamentos, sem API remota. */
(() => {
 'use strict';
 const specs=Object.freeze({
  clients:{module:'workspace',field:'clients',permission:'ordens',required:['name'],optional:['document','phone','email']},
  equipments:{module:'catalog',field:'equipments',permission:'equipamentos',required:['name','type'],optional:['brand','model','serial','company']}
 });
 const clean=(v,max=180)=>typeof v==='string'?v.trim().slice(0,max):'';
 function spec(kind){if(!Object.hasOwn(specs,kind))throw Error('Cadastro desconhecido.');return specs[kind]}
 function authorize(kind){const session=globalThis.ACRLocalSession,s=spec(kind);const u=session?.getUser();if(!u||!session.hasPermission(s.permission))throw Error('Acesso local não autorizado.');return u.login}
 function recheck(kind,login){if(authorize(kind)!==login)throw Error('Sessão alterada; operação cancelada.')}
 function fields(kind,input){
  const s=spec(kind);
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Cadastro inválido.');
  const result={};
  for(const key of [...s.required,...s.optional])result[key]=clean(input[key]);
  if(s.required.some(k=>!result[k]))throw Error('Preencha os campos obrigatórios.');
  return result;
 }
 async function list(kind){
  const login=authorize(kind),s=spec(kind);
  const data=await globalThis.ACRLocalModules.read(s.module);recheck(kind,login);
  if(!Array.isArray(data[s.field]))throw Error('Cadastro local inválido.');
  return structuredClone(data[s.field]);
 }
 async function save(kind,input,id=null){
  const login=authorize(kind),s=spec(kind),dataFields=fields(kind,input);
  const modules=globalThis.ACRLocalModules;
  const data=await modules.read(s.module);recheck(kind,login);
  if(!Array.isArray(data[s.field]))throw Error('Cadastro local inválido.');
  const now=new Date().toISOString();
  let result;
  if(id===null){
   const newId=globalThis.crypto?.randomUUID?.();
   if(!newId)throw Error('Identificador seguro indisponível.');
   result={id:newId,...dataFields,createdAt:now,updatedAt:now,createdBy:login};
   data[s.field].push(result);
  }else{
   if(typeof id!=='string'||!id)throw Error('Identificador inválido.');
   const i=data[s.field].findIndex(item=>item.id===id);
   if(i<0)throw Error('Registro não encontrado.');
   result={...data[s.field][i],...dataFields,updatedAt:now};
   data[s.field][i]=result;
  }
  recheck(kind,login);
  await modules.save(s.module,data,data.revision);
  return structuredClone(result);
 }
 Object.defineProperty(globalThis,'ACRLocalRegistry',{value:Object.freeze({list,save}),configurable:false,writable:false});
})();
