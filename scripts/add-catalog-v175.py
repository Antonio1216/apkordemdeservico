#!/usr/bin/env python3
"""Atualizacao incremental do APK ACR OS Pro 1.7.4 -> 1.7.5: catálogo corporativo."""
from pathlib import Path
import sys,shutil
root=Path(sys.argv[1] if len(sys.argv)>1 else "ospro-eletrica-software")
assets=root/"app/src/main/assets"
def once(filepath,old,new):
    text=filepath.read_text(encoding="utf-8")
    n=text.count(old)
    if n!=1:raise RuntimeError(f"Esperada uma ocorrência em {filepath.name}, encontrado {n}: {old[:85]}")
    filepath.write_text(text.replace(old,new,1),encoding="utf-8")
html=assets/"index.html"
once(html,'    <button type="button" data-tab="clientes">♙ Clientes</button>',
          '    <button type="button" data-tab="clientes">♙ Clientes</button>\n    <button type="button" data-tab="catalogo">▦ Serviços, Produtos e Equipamentos</button>')
section='''    <section id="catalogo" class="pane" aria-labelledby="title-catalogo">
      <div class="heading"><div><p class="eyebrow">PATRIMÔNIO E CATÁLOGO CORPORATIVO</p><h1 id="title-catalogo">Serviços, Produtos e Equipamentos</h1>
      <p>Cadastre serviços, itens e qualquer tipo de equipamento. Associe equipamentos à empresa proprietária.</p></div></div>
      <div class="panel">
        <h2>Tipos de cadastro</h2>
        <div class="segmented catalog-tabs" role="group" aria-label="Tipo de cadastro">
          <button type="button" data-catalog-kind="services">Serviços</button>
          <button type="button" data-catalog-kind="products">Produtos</button>
          <button type="button" class="active" data-catalog-kind="equipments">Equipamentos</button>
        </div>
        <p class="hint">Os dados são salvos no servidor e ficam disponíveis aos usuários autorizados. Cadastre primeiro a empresa na seção Clientes para vincular equipamentos.</p>
        <p id="catalog-status" role="status" aria-live="polite" class="hint">Preparando catálogo...</p>
      </div>
      <form id="catalog-services-form" class="panel" hidden>
        <h2>Novo serviço / editar serviço</h2><input type="hidden" name="id">
        <div class="form-grid">
          <label class="wide">Nome do serviço * <input name="nome" maxlength="180" required placeholder="Instalação, manutenção, visita técnica..."></label>
          <label>Código do serviço <input name="codigo" maxlength="120" placeholder="SERV-001"></label>
          <label>Unidade de cobrança <input name="unidade" maxlength="50" value="hora" placeholder="hora, visita, serviço"></label>
          <label>Valor de referência (R$) <input name="valor" type="number" min="0" step="0.01" value="0"></label>
          <label>Empresa vinculada (opcional) <select name="empresaId" class="catalog-company"></select></label>
          <label class="wide">Descrição do serviço <textarea name="descricao" maxlength="1200" rows="3"></textarea></label>
        </div>
        <div class="actions"><button type="submit" class="primary">Salvar Serviço</button><button type="button" class="outline" data-catalog-reset>Limpar</button></div>
      </form>
      <form id="catalog-products-form" class="panel" hidden>
        <h2>Novo produto / editar produto</h2><input type="hidden" name="id">
        <div class="form-grid">
          <label class="wide">Nome do produto * <input name="nome" maxlength="180" required placeholder="Roteador, cabo, computador..."></label>
          <label>Código / SKU <input name="codigo" maxlength="120"></label>
          <label>Unidade <input name="unidade" maxlength="50" value="un" placeholder="un, caixa, metro"></label>
          <label>Preço unitário (R$) <input name="valor" type="number" min="0" step="0.01" value="0"></label>
          <label>Quantidade em estoque <input name="quantidade" type="number" min="0" step="1" value="0"></label>
          <label>Empresa vinculada (opcional) <select name="empresaId" class="catalog-company"></select></label>
          <label class="wide">Descrição / especificações <textarea name="descricao" maxlength="1200" rows="3"></textarea></label>
        </div>
        <div class="actions"><button type="submit" class="primary">Salvar Produto</button><button type="button" class="outline" data-catalog-reset>Limpar</button></div>
      </form>
      <form id="catalog-equipments-form" class="panel">
        <h2>Novo equipamento / editar equipamento</h2><input type="hidden" name="id">
        <div class="form-grid">
          <label class="wide">Nome / identificação do equipamento * <input name="nome" maxlength="180" required placeholder="Servidor da recepção, Switch do rack 2..."></label>
          <label class="wide">Tipo de equipamento * <input name="tipo" list="catalog-type-suggestions" maxlength="120" required placeholder="Digite QUALQUER tipo: servidor, câmera, nobreak, PLC...">
            <datalist id="catalog-type-suggestions"></datalist>
            <small>Campo livre: digite um tipo novo ou escolha um já utilizado.</small>
          </label>
          <label class="wide">Empresa proprietária * <select name="empresaId" class="catalog-company" required></select></label>
          <label>Fabricante / marca <input name="fabricante" maxlength="160"></label>
          <label>Modelo <input name="modelo" maxlength="160"></label>
          <label>Número de série <input name="serie" maxlength="120" placeholder="SN-123456"></label>
          <label>IP <input name="ip" maxlength="45" inputmode="text" placeholder="192.168.0.10"></label>
          <label>MAC <input name="mac" maxlength="17" placeholder="AA:BB:CC:DD:EE:FF"></label>
          <label>Local / setor <input name="local" maxlength="160" placeholder="Sala de TI, rack 02..."></label>
          <label>Estado <select name="status"><option>Ativo</option><option>Em manutenção</option><option>Reserva</option><option>Inativo</option><option>Desativado</option></select></label>
          <label class="wide">Observações <textarea name="observacoes" maxlength="1200" rows="3" placeholder="Condição, características, responsável..."></textarea></label>
        </div>
        <div class="actions"><button type="submit" class="primary">Salvar Equipamento</button><button type="button" class="outline" data-catalog-reset>Limpar</button></div>
      </form>
      <div class="panel">
        <div class="catalog-toolbar"><h2 id="catalog-title-list">Equipamentos cadastrados</h2><strong id="catalog-count" aria-live="polite">0 registro(s)</strong></div>
        <div class="form-grid">
          <label>Buscar <input id="catalog-filter" type="search" placeholder="Nome, série, IP, MAC, tipo..." aria-label="Buscar no catálogo"></label>
          <label>Filtrar por empresa <select id="catalog-company-filter"><option value="">Todas as empresas</option></select></label>
        </div>
        <div class="actions"><button type="button" class="outline" id="catalog-refresh">Atualizar do servidor</button></div>
        <div id="catalog-results" class="catalog-results" aria-live="polite"></div>
      </div>
    </section>

'''
once(html,'    <section id="config" class="pane"',section+'    <section id="config" class="pane"')
once(html,'<label class="permission-item"><input type="checkbox" data-permission="financeiro">',
          '<label class="permission-item"><input type="checkbox" data-permission="catalogo"><span><strong>Serviços, produtos e equipamentos</strong><small>Cadastrar, editar e consultar catálogo e patrimônio das empresas</small></span></label>\n            <label class="permission-item"><input type="checkbox" data-permission="financeiro">')
once(html,'  <script src="permissions.js" defer></script>','  <script src="permissions.js" defer></script>\n  <script src="catalog.js" defer></script>')
auth=assets/"auth.js"
once(auth,'async function reloadWorkspace(){',
'''async function fetchCatalog(){return request('/api/team/catalog');}
async function saveCatalog(data){return request('/api/team/catalog','PUT',data);}
async function reloadWorkspace(){''')
once(auth,'reloadWorkspace,pushWorkspace};','reloadWorkspace,pushWorkspace,fetchCatalog,saveCatalog};')
app=assets/"app.js"
once(app,"'clientes','assinaturas']){","'clientes','assinaturas','catalogo']){")
once(app,"'clientes','assinaturas'].includes(name)","'clientes','assinaturas','catalogo'].includes(name)")
styles=assets/"styles.css"
styles.write_text(styles.read_text(encoding='utf-8')+'''
/* ACR 1.7.5 - Inventario corporativo responsivo e acessivel */
.catalog-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}
.catalog-tabs button{min-width:135px}
.catalog-results{display:grid;gap:12px;margin-top:18px}
.catalog-card{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-start;gap:12px;padding:16px;border-radius:10px;border:1px solid #c4d2e1;border-left:4px solid #daa627;background:#f7faff}
.catalog-card strong{display:block;color:#102d4e;font-size:1.06rem}
.catalog-card small{display:block;color:#405970;line-height:1.55;margin-top:5px}
.catalog-card p{margin:6px 0 0;overflow-wrap:anywhere}
.catalog-info{flex:1;min-width:200px}
.catalog-toolbar{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap}
.catalog-error{color:#a32121!important;font-weight:700}
#catalogo input,#catalogo select,#catalogo textarea{max-width:100%}
#catalogo :is(input,select,textarea,button):focus-visible{outline:3px solid #d7a132;outline-offset:2px}
@media(max-width:640px){.catalog-card{flex-direction:column}.catalog-card .actions{width:100%}.catalog-card .actions button{flex:1}}
''',encoding='utf-8')
shutil.copyfile(Path(__file__).parent/"catalog-v175.js",assets/"catalog.js")
gradle=root/"app/build.gradle.kts"
once(gradle,'versionName = "1.7.4"','versionName = "1.7.5"')
once(gradle,'versionCode = 13','versionCode = 14')
print("OK: versão 1.7.5 catálogo/patrimônio de empresas com serviços, produtos, IP, MAC, série e tipos livres.")
