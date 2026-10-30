#!/usr/bin/env python3
from pathlib import Path
import re,sys
root=Path(sys.argv[1])
assets=root/'app/src/main/assets'
html=assets/'index.html';js=assets/'app.js';css=assets/'styles.css';gradle=root/'app/build.gradle.kts'
def replace(path,old,new):
    text=path.read_text('utf8')
    if text.count(old)!=1:raise RuntimeError(f'Trecho esperado ausente/duplicado: {path}: {old[:60]}')
    path.write_text(text.replace(old,new),'utf8')
replace(html,'<div class="stat"><span>Ordens finalizadas</span><b id="stat-os">0</b><small>histórico compartilhado</small></div>',
'<button class="stat stat-action" id="open-finished-orders" type="button" aria-label="Consultar ordens finalizadas"><span>Ordens finalizadas</span><b id="stat-os">0</b><small>Toque para abrir o histórico</small></button>')
replace(html,
'<div class="panel"><h2>Histórico de ordens</h2><p class="hint">As OS finalizadas permanecem arquivadas após gerar o PDF.</p><div id="os-history" class="stack"></div></div>',
'''<div class="panel" id="finished-orders-panel"><h2>Histórico de ordens</h2>
<p class="hint">Toque em uma ordem finalizada para consultar seus dados. Se precisar continuar o serviço, abra uma nova OS vinculada à original.</p>
<div id="os-history" class="stack"></div>
<section id="archived-order-details" class="archived-details" aria-label="Detalhes da ordem finalizada" tabindex="-1" hidden>
<h3>Dados da OS finalizada</h3><div id="archived-order-content"></div>
<div class="actions"><button id="continue-archived-order" type="button" class="primary">Reabrir para novo atendimento</button>
<button id="close-archived-order" type="button" class="outline">Fechar detalhes</button></div>
<p class="hint">A OS original continua arquivada. A continuação terá novo número, sem reaproveitar assinaturas, fotos ou links.</p>
</section></div>''')
replace(js,"  $('#quick-os').hidden=!can('ordens');$('#go-os').hidden=!can('ordens');",
"  $('#quick-os').hidden=!can('ordens');$('#go-os').hidden=!can('ordens');$('#open-finished-orders').hidden=!can('ordens');")
insert = '''
  // Historico clicavel com consulta de OS encerradas, sem alterar a original.
  let selectedArchivedId='';
  function closeArchived(){
    selectedArchivedId='';
    $('#archived-order-details').hidden=true;
    $('#archived-order-content').textContent='';
  }
  function openArchived(id){
    if(!can('ordens'))return toast('Acesso ao historico nao autorizado.',true);
    const o=db.orders.find(x=>x.id===id);
    if(!o)return toast('Ordem nao encontrada.',true);
    selectedArchivedId=id;
    const rows=[
      ['Numero',o.numero],['Cliente',findClient(o.clienteId)?.nome||'Nao encontrado'],
      ['Tecnico',findTech(o.tecnicoId)?.nome||'Nao informado'],
      ['Abertura',showDate(o.abertura)],['Finalizacao',showDate(o.closedAt)],
      ['Status',o.status||'Finalizada'],['Titulo',o.titulo||''],
      ['Solicitacao',o.descricao||''],['Diagnostico',o.diagnostico||''],
      ['Execucao',o.execucao||''],['Materiais',o.materiais||''],
      ['Valor total',money(orderTotal(o))],
      ['Assinatura cliente',o.signatures?.cliente?'Registrada e preservada':'Nao registrada'],
      ['Assinatura tecnico',o.signatures?.tecnico?'Registrada e preservada':'Nao registrada']
    ];
    if(o.reopenedFrom)rows.push(['Continuidade de',o.reopenedFrom.numero||'']);
    $('#archived-order-content').innerHTML=rows.map(([label,value])=>'<p><strong>'+escape(label)+':</strong> '+escape(value)+'</p>').join('');
    $('#archived-order-details').hidden=false;
    tab('ordens');
    $('#archived-order-details').scrollIntoView({block:'start'});
    $('#archived-order-details').focus({preventScroll:true});
  }
  function enableArchivedRows(parent,orders){
    [...parent.querySelectorAll('.item')].forEach((row,index)=>{
      const id=orders[index]?.id;
      if(!id)return;
      row.classList.add('archived-row');
      row.setAttribute('role','button');
      row.setAttribute('tabindex','0');
      row.setAttribute('aria-label','Abrir ordem '+(orders[index].numero||''));
      row.addEventListener('click',()=>openArchived(id));
      row.addEventListener('keydown',e=>{
        if(e.key==='Enter'||e.key===' '){e.preventDefault();openArchived(id);}
      });
    });
  }
  const originalRenderDashboard=renderDashboard;
  renderDashboard=function(){
    originalRenderDashboard();
    enableArchivedRows($('#recent-list'),db.orders.slice(0,5));
    enableArchivedRows($('#os-history'),db.orders);
    if(selectedArchivedId&&!db.orders.some(x=>x.id===selectedArchivedId))closeArchived();
  };
  $('#open-finished-orders').onclick=()=>{
    if(!can('ordens'))return toast('Sem acesso as ordens.',true);
    tab('ordens');
    $('#finished-orders-panel').scrollIntoView({block:'start'});
  };
  $('#close-archived-order').onclick=closeArchived;
  $('#continue-archived-order').onclick=()=>{
    if(!can('ordens'))return toast('Sem permissao para criar ordens.',true);
    const original=db.orders.find(x=>x.id===selectedArchivedId);
    if(!original)return toast('Ordem nao encontrada.',true);
    if(!confirm('Criar nova ordem vinculada a '+original.numero+'? A OS finalizada e as assinaturas serao preservadas.'))return;
    if(!newOrderPrompt())return;
    Object.assign(db.current,{
      clienteId:original.clienteId,tecnicoId:original.tecnicoId,
      tipo:original.tipo||'Eletrica',prioridade:original.prioridade||'Normal',
      status:'Em andamento',titulo:original.titulo||'',
      descricao:'Continuacao da OS '+original.numero+' - '+(original.descricao||'').slice(0,1200),
      reopenedFrom:{id:original.id,numero:original.numero,closedAt:original.closedAt},
      updatedAt:now()
    });
    // Nova OS: assinaturas, evidencias, PDF e valores anteriores nao sao copiados.
    closeArchived();save();syncOrderForm();renderDashboard();tab('ordens');
    toast('Nova OS vinculada a original. Preencha os dados e colete novas assinaturas.');
  };
'''
needle="  function attachForm(formId,fieldName,collection,render){"
replace(js,needle,insert+needle)
css.write_text(css.read_text('utf8')+'''
/* ACR OS Pro 1.7.11 - ordens finalizadas clicaveis */
.stat-action{width:100%;font:inherit;text-align:left;cursor:pointer}
.stat-action:hover,.archived-row:hover{border-color:#4675a5;background:#eef5fc}
.archived-row{cursor:pointer;touch-action:manipulation}
.archived-row:focus-visible{outline:3px solid var(--gold);outline-offset:3px}
.archived-details{margin-top:20px;padding:18px;border:2px solid #3f729f;border-radius:11px;background:#f6faff;scroll-margin-top:20px}
.archived-details h3{color:var(--navy);margin-top:0}
#archived-order-content p{white-space:pre-wrap;overflow-wrap:anywhere;margin:8px 0}
''','utf8')
replace(js,"window.OSProVersion = '1.7.10';","window.OSProVersion = '1.7.11';")
replace(gradle,'versionName = "1.7.10"','versionName = "1.7.11"')
g=gradle.read_text('utf8')
match=re.search(r'versionCode\\s*=\\s*(\\d+)',g)
if not match:raise RuntimeError('versionCode nao encontrado')
g=g[:match.start(1)]+str(int(match.group(1))+1)+g[match.end(1):]
gradle.write_text(g,'utf8')
print('Painel de OS finalizadas clicavel e continuacao vinculada disponiveis.')
