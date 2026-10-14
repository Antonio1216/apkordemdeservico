#!/usr/bin/env python3
"""Install ACR service desk, admin technician delegation and ticket notifications UI."""
from pathlib import Path
import shutil
import sys

root=Path(sys.argv[1])
assets=root/"app/src/main/assets"
here=Path(__file__).resolve().parent

auth=assets/"auth.js"
s=auth.read_text(encoding="utf-8")
needle="async function reloadWorkspace(){"
if s.count(needle)!=1:
    raise RuntimeError("auth.js sem ponto de extensão")
s=s.replace(needle,'''async function serviceDeskRequest(p,method='GET',data){return request('/api/team/'+p,method,data);}
''' +needle,1)
needle="fetchRhidMonitor,totpStatus,totpSetup,totpConfirm};"
if s.count(needle)!=1:raise RuntimeError("OSAuth na versão esperada 1.7.9 com recuperação não encontrado")
s=s.replace(needle,"fetchRhidMonitor,totpStatus,totpSetup,totpConfirm,serviceDeskRequest};",1)
auth.write_text(s,encoding="utf-8")

html=assets/"index.html"
s=html.read_text(encoding="utf-8")
needle='<button type="button" data-tab="rhid">◉ Monitoramento RHiD</button>'
if s.count(needle)!=1:raise RuntimeError("Aba RHiD não encontrada no menu")
s=s.replace(needle,needle+'\n    <button type="button" data-tab="chamados">◈ Chamados</button>',1)
needle='    <section id="usuarios" class="pane"'
if s.count(needle)!=1:raise RuntimeError("Seção usuários não encontrada")
panel='''    <section id="chamados" class="pane" aria-labelledby="ticket-heading">
      <div class="heading"><div><p class="eyebrow">ATENDIMENTO POR EMPRESA</p>
        <h1 id="ticket-heading">Chamados técnicos</h1>
        <p>Receba solicitações de clientes, visualize evidências e atualize a situação.</p></div></div>
      <div class="panel"><div class="actions">
        <button type="button" class="primary" id="ticket-refresh">Atualizar chamados</button>
        <button type="button" id="tickets-seen">Marcar novos como visualizados</button>
      </div><p id="ticket-status" role="status" aria-live="polite"></p></div>
      <div id="ticket-list" class="stack" aria-live="polite">Aguardando conexão...</div>
    </section>
'''
s=s.replace(needle,panel+needle,1)
needle='</body>'
if s.count(needle)!=1:raise RuntimeError("Fim do HTML não encontrado")
s=s.replace(needle,'  <script src="service-desk-ui.js" defer></script>\n'+needle,1)
html.write_text(s,encoding="utf-8")

app=assets/"app.js"
s=app.read_text(encoding="utf-8")
# Add module to tab visibility control and authorization check, if present.
s=s.replace("'ordens','clientes','assinaturas','catalogo','licencas','rhid']){",
            "'ordens','clientes','assinaturas','catalogo','licencas','rhid','chamados']){")
s=s.replace("'ordens','clientes','assinaturas','catalogo','licencas','rhid'].includes(name)",
            "'ordens','clientes','assinaturas','catalogo','licencas','rhid','chamados'].includes(name)")
app.write_text(s,encoding="utf-8")

shutil.copyfile(here/"service-desk-ui-v181.js",assets/"service-desk-ui.js")
print("Portal de chamados, delegação e avisos de app integrados.")
