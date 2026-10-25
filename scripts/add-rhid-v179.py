#!/usr/bin/env python3
"""ACR OS Pro v1.7.9: read-only monitoring of RHiD devices via Render server."""
from pathlib import Path
import sys,shutil
root=Path(sys.argv[1] if len(sys.argv)>1 else "ospro-eletrica-software")
here=Path(__file__).parent
assets=root/"app/src/main/assets"
def once(path,old,new):
    content=path.read_text(encoding="utf-8")
    n=content.count(old)
    if n!=1:raise RuntimeError(f"{path.name}: âncora encontrada {n}x: {old[:96]}")
    path.write_text(content.replace(old,new,1),encoding="utf-8")
html=assets/"index.html"
once(html,'    <button type="button" data-tab="licencas">▣ Licenças de Software</button>',
'''    <button type="button" data-tab="licencas">▣ Licenças de Software</button>
    <button type="button" data-tab="rhid">◉ Monitoramento RHiD</button>''')
panel=(here/"rhid-panel-v179.html").read_text(encoding="utf-8")
once(html,'    <section id="usuarios" class="pane"',panel+'    <section id="usuarios" class="pane"')
once(html,'<label class="permission-item"><input type="checkbox" data-permission="licencas">',
'''<label class="permission-item"><input type="checkbox" data-permission="rhid"><span><strong>Monitoramento RHiD</strong><small>Consultar dispositivos online/offline, histórico e PDF corporativo</small></span></label>
            <label class="permission-item"><input type="checkbox" data-permission="licencas">''')
once(html,'  <script src="licenses.js" defer></script>',
'  <script src="licenses.js" defer></script>\n  <script src="rhid.js" defer></script>')
auth=assets/"auth.js"
once(auth,'async function reloadWorkspace(){',
'''async function fetchRhidMonitor(){return request('/api/team/rhid-monitor');}
async function reloadWorkspace(){''')
once(auth,'fetchLicenses,saveLicenses};','fetchLicenses,saveLicenses,fetchRhidMonitor};')
app=assets/"app.js"
once(app,"'ordens','clientes','assinaturas','catalogo','licencas']){",
          "'ordens','clientes','assinaturas','catalogo','licencas','rhid']){")
once(app,"'ordens','clientes','assinaturas','catalogo','licencas'].includes(name)",
          "'ordens','clientes','assinaturas','catalogo','licencas','rhid'].includes(name)")
once(app,"  window.OSProVersion = '1.7.8';","  window.OSProVersion = '1.7.10';")
styles=assets/"styles.css"
styles.write_text(styles.read_text(encoding="utf-8")+'''
/* ACR OS Pro v1.7.9 — Monitoramento RHiD com cores e foco acessíveis */
#rhid .panel{border-top:3px solid #dba62e}
.rhid-list{display:grid;gap:12px;margin:15px 0}
.rhid-card{border:1px solid #b8cbe0;border-left:5px solid #dfa93c;border-radius:11px;padding:14px;background:#f6f9fd;display:flex;gap:12px;align-items:start}
.rhid-card strong{color:#102d4e;font-size:1.1rem;margin-right:12px}
.rhid-card p{line-height:1.55;overflow-wrap:anywhere;margin:7px 0}
.rhid-badge{font-weight:800;border-radius:999px;padding:4px 10px;display:inline-block;white-space:nowrap}
.rhid-online{background:#d8f5e3;color:#145c2c}
.rhid-offline{background:#ffe0e2;color:#a01122}
.rhid-desconhecido{background:#fff2bd;color:#765200}
.rhid-offline-text,.rhid-error{color:#ac1526!important;font-weight:750}
.rhid-history{border-left:4px solid #a7bfd9;padding:11px;margin:3px 0;background:#f6f9fd;overflow-wrap:anywhere}
#rhid :is(input,select,button):focus-visible{outline:3px solid #dba62e;outline-offset:3px}
@media(max-width:640px){#rhid .actions>*{width:100%}.rhid-card{flex-direction:column}}
''',encoding="utf-8")
shutil.copyfile(here/"rhid-v179.js",assets/"rhid.js")
native=root/"app/src/main/java/br/com/ospro/ordens/MainActivity.kt"
once(native,'listOf("","equipment","catalog","travel","licenses")','listOf("","equipment","catalog","travel","licenses","rhid")')
once(native,'                        "licenses"->"Licencas-Software"',
'''                        "licenses"->"Licencas-Software"
                        "rhid"->"Monitoramento-RHiD"''')
gradle=root/"app/build.gradle.kts"
once(gradle,'versionName = "1.7.8"','versionName = "1.7.10"')
once(gradle,'versionCode = 17','versionCode = 19')
print("ACR OS Pro 1.7.9: painel RHiD, permissão exclusiva e relatório PDF habilitados.")
