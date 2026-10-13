/* ACR OS Pro 1.7.6 — despesas de locomoção e viagem (financeiro). */
window.OSAuth.ready.then(()=>{
  'use strict';
  if(!window.OSAuth.can('financeiro'))return;
  const $=s=>document.querySelector(s);
  const form=$('#trip-form'),status=$('#trip-status');
  const amount=(name)=>form.elements.namedItem(name).value;
  const money=x=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(x||0);
  function read(){
    return window.ACRTravel.calculateTravel({
      kmInicial:amount('kmInicial'),kmAtual:amount('kmAtual'),tarifaKm:amount('tarifaKm'),
      abastecimento:amount('abastecimento'),tanqueCompleto:amount('tanqueCompleto')==='sim',
      incluirAbastecimento:form.elements.namedItem('incluirAbastecimento').checked,
      hospedagem:amount('hospedagem'),alimentacao:amount('alimentacao'),
      veiculo:amount('veiculo'),observacoes:amount('observacoes')
    });
  }
  function refresh(){
    try{
      const t=read();
      $('#trip-km-travelled').textContent=t.kmRodados.toLocaleString('pt-BR')+' km';
      $('#trip-km-cost').textContent=money(t.custoKm);
      $('#trip-fuel-cost').textContent=money(t.abastecimento)+(t.incluirAbastecimento?' (incluído)':' (não somado)');
      $('#trip-stay-cost').textContent=money(t.hospedagem);
      $('#trip-food-cost').textContent=money(t.alimentacao);
      $('#trip-total').textContent=money(t.total);
      status.textContent='';status.classList.remove('trip-error');return t;
    }catch(e){
      $('#trip-total').textContent='—';
      status.textContent=e.message;status.classList.add('trip-error');return null;
    }
  }
  function clearForm(){
    form.reset();
    form.elements.namedItem('id').value='';
    form.elements.namedItem('data').value=new Date().toLocaleDateString('en-CA');
    $('#trip-submit').textContent='Salvar despesa de viagem';
    status.textContent='';status.classList.remove('trip-error');
    refresh();
  }
  form.addEventListener('input',refresh);
  form.addEventListener('change',refresh);
  form.addEventListener('submit',e=>{
    e.preventDefault();
    if(!form.reportValidity())return;
    const t=refresh();if(!t)return;
    const id=amount('id');
    const entry={
      id:id||'',tipo:'despesa',categoria:'viagem',
      data:amount('data'),osNumero:amount('osNumero').trim().slice(0,120),
      descricao:'Despesas de viagem · '+(t.veiculo||'Atendimento')+' · '+t.kmRodados+' km',
      forma:'Despesas de viagem',valor:t.total,viagem:t
    };
    try{
      window.OSFinance.saveTravel(entry);
      clearForm();
      status.textContent='Despesa registrada. Sincronização com o servidor em andamento.';
      status.classList.remove('trip-error');
    }catch(err){status.textContent=err.message;status.classList.add('trip-error');}
  });
  $('#trip-clear').onclick=clearForm;
  document.addEventListener('click',e=>{
    const target=e.target.closest('[data-edit-trip]');if(!target)return;
    const entry=window.OSFinance.findTravel(target.dataset.editTrip);
    if(!entry)return;
    const t=entry.viagem;
    const values={
      id:entry.id,data:entry.data,osNumero:entry.osNumero||'',veiculo:t.veiculo||'',
      kmInicial:t.kmInicial,kmAtual:t.kmAtual,tarifaKm:t.tarifaKm,
      abastecimento:t.abastecimento,tanqueCompleto:t.tanqueCompleto?'sim':'nao',
      hospedagem:t.hospedagem,alimentacao:t.alimentacao,observacoes:t.observacoes||''
    };
    for(const [name,value] of Object.entries(values))form.elements.namedItem(name).value=String(value);
    form.elements.namedItem('incluirAbastecimento').checked=t.incluirAbastecimento!==false;
    $('#trip-submit').textContent='Salvar alterações da despesa';
    form.scrollIntoView({behavior:'smooth',block:'start'});
    status.textContent='Editando viagem vinculada à OS '+(entry.osNumero||'não informada')+'.';
    refresh();
  });
  clearForm();
});
