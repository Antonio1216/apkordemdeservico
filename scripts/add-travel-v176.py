#!/usr/bin/env python3
"""ACR OS Pro 1.7.5 -> 1.7.6: despesas por km, combustível, hospedagem e alimentação."""
from pathlib import Path
import sys,shutil
root=Path(sys.argv[1] if len(sys.argv)>1 else "ospro-eletrica-software")
assets=root/"app/src/main/assets"
def once(filename,old,new):
    value=filename.read_text(encoding="utf-8")
    times=value.count(old)
    if times!=1:raise RuntimeError(f"{filename.name}: trecho esperado 1 vez; encontrado {times}: {old[:90]}")
    filename.write_text(value.replace(old,new,1),encoding="utf-8")
html=assets/"index.html"
travel_html='''      <div class="panel" id="trip-expenses-panel">
        <h2>Despesas de locomoção e viagem</h2>
        <p class="hint">Registre a quilometragem inicial e atual do odômetro, abastecimento, hospedagem e alimentação. A despesa será registrada no Financeiro e poderá ser vinculada à OS.</p>
        <form id="trip-form">
          <input type="hidden" name="id">
          <div class="form-grid">
            <label>Data da viagem * <input name="data" type="date" required></label>
            <label>Ordem de serviço vinculada <input name="osNumero" maxlength="120" placeholder="Ex.: OS-2026-00001"></label>
            <label class="wide">Veículo / placa <input name="veiculo" maxlength="120" placeholder="Ex.: Fiorino ABC-1D23"></label>
            <label>Quilometragem inicial (km) * <input name="kmInicial" type="number" min="0" max="99999999" step="0.1" required placeholder="Ex.: 10250"></label>
            <label>Quilometragem atual (km) * <input name="kmAtual" type="number" min="0" max="99999999" step="0.1" required placeholder="Ex.: 10312"></label>
            <label>Valor por km rodado (R$) <input name="tarifaKm" type="number" min="0" max="10000" step="0.01" value="0" placeholder="Ex.: 1.20"></label>
            <label>Valor do abastecimento (R$) <input name="abastecimento" type="number" min="0" step="0.01" value="0"></label>
            <label>Completou o tanque? <select name="tanqueCompleto"><option value="nao">Não, abastecimento parcial</option><option value="sim">Sim, tanque completo</option></select></label>
            <label class="wide travel-fuel-option"><input type="checkbox" name="incluirAbastecimento" checked> Somar abastecimento ao total de despesas
              <small>Desmarque se o valor por km já incluir combustível, evitando somar o mesmo custo duas vezes.</small></label>
            <label>Hospedagem (R$) <input name="hospedagem" type="number" min="0" step="0.01" value="0"></label>
            <label>Alimentação (R$) <input name="alimentacao" type="number" min="0" step="0.01" value="0"></label>
            <label class="wide">Observações <textarea name="observacoes" maxlength="1000" rows="3" placeholder="Destino, posto do abastecimento, notas..."></textarea></label>
          </div>
          <div class="travel-calc" aria-live="polite">
            <h3>Resumo da viagem</h3>
            <div><span>Quilômetros rodados</span><strong id="trip-km-travelled">0 km</strong></div>
            <div><span>Custo da quilometragem</span><strong id="trip-km-cost">R$ 0,00</strong></div>
            <div><span>Abastecimento</span><strong id="trip-fuel-cost">R$ 0,00</strong></div>
            <div><span>Hospedagem</span><strong id="trip-stay-cost">R$ 0,00</strong></div>
            <div><span>Alimentação</span><strong id="trip-food-cost">R$ 0,00</strong></div>
            <div class="travel-total"><span>Total da despesa</span><strong id="trip-total">R$ 0,00</strong></div>
          </div>
          <p id="trip-status" class="hint" role="status" aria-live="polite"></p>
          <div class="actions"><button class="primary" type="submit" id="trip-submit">Salvar despesa de viagem</button><button class="outline" type="button" id="trip-clear">Limpar</button></div>
        </form>
      </div>
'''
once(html,'      <div class="panel"><h2>Novo lançamento</h2><form id="finance-form">',
     travel_html+'      <div class="panel"><h2>Novo lançamento</h2><form id="finance-form">')
once(html,'  <script src="catalog.js" defer></script>',
     '  <script src="catalog.js" defer></script>\n  <script src="travel-core.js" defer></script>\n  <script src="travel.js" defer></script>')
app=assets/"app.js"
anchor="  document.addEventListener('click',e=>{const b=e.target.closest('[data-del-fin]');"
hook='''  window.OSFinance={
    currentOs:()=>db.current.numero,
    findTravel:id=>{const x=db.finance.find(x=>x.id===id&&x.categoria==='viagem');return x?clone(x):null;},
    saveTravel:entry=>{
      if(!can('financeiro'))throw Error('Sem permissão para despesas de viagem.');
      const t=window.ACRTravel.calculateTravel(entry.viagem);
      const id=entry.id||uid();
      const previousEntry=db.finance.find(x=>x.id===id);
      if(previousEntry&&previousEntry.categoria!=='viagem')throw Error('Lançamento não é uma viagem.');
      const newEntry={id,tipo:'despesa',categoria:'viagem',
        descricao:String(entry.descricao||'Despesas de viagem').slice(0,220),
        osNumero:String(entry.osNumero||'').slice(0,120),
        data:String(entry.data||''),forma:'Despesas de viagem',valor:t.total,viagem:t};
      const previous=clone(db.finance);
      const idx=db.finance.findIndex(x=>x.id===id);
      if(idx>=0)db.finance[idx]=newEntry;else db.finance.unshift(newEntry);
      try{save();}catch(error){db.finance=previous;throw error;}
      renderFinance();renderDashboard();return clone(newEntry);
    }
  };
'''
once(app,anchor,hook+anchor)
once(app,"  window.OSProVersion = '1.7.4';","  window.OSProVersion = '1.7.6';")
styles=assets/"styles.css"
styles.write_text(styles.read_text(encoding='utf-8')+'''
/* Despesas de viagem ACR 1.7.6 */
#trip-expenses-panel .travel-fuel-option{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
#trip-expenses-panel .travel-fuel-option input{width:22px;height:22px;accent-color:#102d4e}
#trip-expenses-panel .travel-fuel-option small{display:block;width:100%;padding-left:30px;line-height:1.4}
.travel-calc{border:1px solid #afc3d8;border-left:4px solid #d6a02c;border-radius:12px;padding:16px;background:#f1f6fc;margin:14px 0}
.travel-calc h3{color:#102d4e;margin:0 0 8px}
.travel-calc div{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid #d1dfec}
.travel-calc div:last-child{border-bottom:0}
.travel-calc .travel-total{color:#102d4e;font-size:1.1rem;font-weight:750}
.travel-entry{display:block;margin-top:5px;line-height:1.55;color:#40576a}
.trip-error{color:#b12424!important;font-weight:700}
#trip-form :is(input,select,textarea,button):focus-visible{outline:3px solid #daa12d;outline-offset:2px}
@media(max-width:600px){.travel-calc div{gap:5px}.travel-calc div strong{white-space:normal}}
''',encoding='utf-8')
shutil.copyfile(Path(__file__).parent/"travel-v176.js",assets/"travel.js")
shutil.copyfile(Path(__file__).parent.parent/"backend/travel.js",assets/"travel-core.js")
gradle=root/"app/build.gradle.kts"
once(gradle,'versionName = "1.7.5"','versionName = "1.7.6"')
once(gradle,'versionCode = 14','versionCode = 15')
print("ACR OS Pro 1.7.6: despesas de viagem calculadas e registradas no Financeiro.")
