#!/usr/bin/env python3
"""Overlay ACR OS Pro v1.7.8: licenças de software, vencimento, PDF detalhado."""
from pathlib import Path
import sys,shutil
root=Path(sys.argv[1] if len(sys.argv)>1 else "ospro-eletrica-software")
here=Path(__file__).parent
assets=root/"app/src/main/assets"
def once(path,a,b):
    s=path.read_text(encoding="utf-8")
    count=s.count(a)
    if count!=1:raise RuntimeError(f"{path.name}: âncora encontrada {count}x: {a[:95]}")
    path.write_text(s.replace(a,b,1),encoding="utf-8")
html=assets/"index.html"
once(html,
     '    <button type="button" data-tab="catalogo">▦ Serviços, Produtos e Equipamentos</button>',
     '    <button type="button" data-tab="catalogo">▦ Serviços, Produtos e Equipamentos</button>\n    <button type="button" data-tab="licencas">▣ Licenças de Software</button>')
panel=(here/"licenses-panel-v178.html").read_text(encoding="utf-8")
once(html,'    <section id="usuarios" class="pane"',panel+'    <section id="usuarios" class="pane"')
once(html,'<label class="permission-item"><input type="checkbox" data-permission="financeiro">',
'''<label class="permission-item"><input type="checkbox" data-permission="licencas"><span><strong>Licenças de software</strong><small>Cadastrar licenças, acompanhar pagamentos e vencimentos e exportar PDF detalhado</small></span></label>
            <label class="permission-item"><input type="checkbox" data-permission="financeiro">''')
once(html,'  <script src="reports.js" defer></script>',
'  <script src="reports.js" defer></script>\n  <script src="license-utils.js" defer></script>\n  <script src="licenses.js" defer></script>')
auth=assets/"auth.js"
once(auth,'async function reloadWorkspace(){',
'''async function fetchLicenses(){return request('/api/team/licenses');}
async function saveLicenses(data){return request('/api/team/licenses','PUT',data);}
async function reloadWorkspace(){''')
once(auth,'reloadWorkspace,pushWorkspace,fetchCatalog,saveCatalog};',
     'reloadWorkspace,pushWorkspace,fetchCatalog,saveCatalog,fetchLicenses,saveLicenses};')
app=assets/"app.js"
once(app,"'ordens','clientes','assinaturas','catalogo']){","'ordens','clientes','assinaturas','catalogo','licencas']){")
once(app,"'ordens','clientes','assinaturas','catalogo'].includes(name)","'ordens','clientes','assinaturas','catalogo','licencas'].includes(name)")
once(app,"  window.OSProVersion = '1.7.7';","  window.OSProVersion = '1.7.8';")
styles=assets/"styles.css"
styles.write_text(styles.read_text(encoding="utf-8")+'''
/* ACR OS Pro v1.7.8 — licenças, status, total calculado e impressão */
#licencas .panel{border-top:3px solid #dba62e}
#license-total{display:block;font-size:1.35rem;font-weight:800;color:#102d4e;padding:10px 12px;border:1px solid #aebed1;border-radius:10px;background:#f0f6fb}
.license-alert{margin:14px 0;padding:12px;border-radius:8px;background:#edf4ff;color:#102d4e;font-weight:650;border-left:4px solid #2e5c89}
.license-error{background:#fff1f1!important;color:#a01919!important;font-weight:750;border-left-color:#c12a2a}
.license-card{display:flex;justify-content:space-between;align-items:start;gap:12px;flex-wrap:wrap;border:1px solid #bbcce0;border-left:4px solid #dbad36;border-radius:10px;background:#f6f9fd;padding:16px;margin:10px 0}
.license-card-info{flex:1;min-width:210px}
.license-card-info strong{font-size:1.08rem;display:inline-block;margin-right:10px;color:#102d4e}
.license-card-info p{line-height:1.5;margin:7px 0;overflow-wrap:anywhere}
.license-tag{font-size:.85rem;font-weight:750;padding:4px 9px;border-radius:999px;display:inline-block}
.license-pago{background:#d7f3e1;color:#176232}
.license-pendente{background:#fff0ba;color:#6e4a00}
.license-atrasado{background:#ffe0e0;color:#a01422}
#licencas :is(input,select,button,textarea):focus-visible{outline:3px solid #d8a02c;outline-offset:2px}
@media(max-width:640px){.license-card{flex-direction:column}.license-card .actions{width:100%}.license-card .actions button{flex:1;min-height:48px}}
''',encoding="utf-8")
shutil.copyfile(here/"licenses-v178.js",assets/"licenses.js")
shutil.copyfile(here.parent/"backend/license-utils.js",assets/"license-utils.js")
native=root/"app/src/main/java/br/com/ospro/ordens/MainActivity.kt"
once(native,'listOf("","equipment","catalog","travel")','listOf("","equipment","catalog","travel","licenses")')
once(native,'                        "travel"->"Viagens-Despesas"',
'''                        "travel"->"Viagens-Despesas"
                        "licenses"->"Licencas-Software"''')
gradle=root/"app/build.gradle.kts"
once(gradle,'versionName = "1.7.7"','versionName = "1.7.8"')
once(gradle,'versionCode = 16','versionCode = 17')
print("ACR OS Pro v1.7.8: licenças e relatórios PDF detalhados ativados.")
