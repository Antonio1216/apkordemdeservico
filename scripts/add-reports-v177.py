#!/usr/bin/env python3
"""Patch Android ACR v1.7.6 -> 1.7.7: relatórios de equipamentos por empresa e viagens."""
from pathlib import Path
import sys,shutil
root=Path(sys.argv[1] if len(sys.argv)>1 else "ospro-eletrica-software")
src=Path(__file__).parent
assets=root/"app/src/main/assets"
def once(path,old,new):
    c=path.read_text(encoding="utf-8"); n=c.count(old)
    if n!=1:raise RuntimeError(f"{path.name}: trecho encontrado {n}x: {old[:95]}")
    path.write_text(c.replace(old,new,1),encoding="utf-8")
html=assets/"index.html"
panel=(src/"reports-panel-v177.html").read_text(encoding="utf-8")
once(html,'    </section>\n\n    <section id="financeiro" class="pane"',panel+'    </section>\n\n    <section id="financeiro" class="pane"')
once(html,'  <script src="travel.js" defer></script>',
     '  <script src="travel.js" defer></script>\n  <script src="report-model.js" defer></script>\n  <script src="reports.js" defer></script>')
app=assets/"app.js"
anchor="  document.addEventListener('click',e=>{const b=e.target.closest('[data-del-fin]');"
once(app,anchor,'''  window.OSReportData={
    company:()=>db.settings.empresa||'ACR Suporte em T.I',
    finance:()=>can('financeiro')?clone(db.finance):[]
  };
'''+anchor)
once(app,"  window.OSProVersion = '1.7.6';","  window.OSProVersion = '1.7.7';")
styles=assets/"styles.css"
styles.write_text(styles.read_text(encoding="utf-8")+'''
/* ACR 1.7.7 - relatórios de equipamentos, produtos e viagens */
#report-equipment,#report-catalog,#report-travel{border-top:4px solid #d8a02c}
#relatorios .report-scroll{margin-top:15px;overflow-x:auto;-webkit-overflow-scrolling:touch}
#relatorios .report-table{min-width:920px}
#report-travel .report-table{min-width:1450px}
#relatorios .report-table tr{vertical-align:top}
#relatorios .report-table th{background:#102d4e;color:#fff}
#relatorios [data-report-export]{min-height:48px;max-width:100%;white-space:normal}
#relatorios :is(input,select,button):focus-visible{outline:3px solid #d8a02c;outline-offset:2px}
#report-extended-status{font-weight:650}
@media(max-width:600px){#relatorios [data-report-export]{width:100%}}
''',encoding="utf-8")
shutil.copyfile(src/"reports-v177.js",assets/"reports.js")
shutil.copyfile(src.parent/"backend/report-analytics.js",assets/"report-model.js")
native=root/"app/src/main/java/br/com/ospro/ordens/MainActivity.kt"
shutil.copyfile(src/"ExtendedReportExport-v177.kt",native.parent/"ExtendedReportExport.kt")
dollar='$'
old='                    val filename="ACR-Relatorio-Chamados-'+dollar+'{System.currentTimeMillis()}.$format"'
new='''                    val reportType=payload.optString("reportType","")
                    require(reportType in listOf("","equipment","catalog","travel")) { "Tipo de relatório não permitido" }
                    val suffix=when(reportType){
                        "equipment"->"Equipamentos"
                        "catalog"->"Produtos-Servicos"
                        "travel"->"Viagens-Despesas"
                        else->"Chamados"
                    }
                    val filename="ACR-Relatorio-"+suffix+"-"+System.currentTimeMillis()+"."+format'''
once(native,old,new)
once(native,'''                            if(format=="pdf")ServiceReportExport.writePdf(payload,stream)
                            else ServiceReportExport.writeXlsx(payload,stream)''',
'''                            if(reportType.isEmpty()){
                                if(format=="pdf")ServiceReportExport.writePdf(payload,stream)
                                else ServiceReportExport.writeXlsx(payload,stream)
                            }else{
                                if(format=="pdf"){
                                    val logo=assets.open("brand/acr-logo.jpg").use { BitmapFactory.decodeStream(it) }
                                    try { ExtendedReportExport.writePdf(payload,stream,logo) }
                                    finally {logo?.recycle()}
                                }else ExtendedReportExport.writeXlsx(payload,stream)
                            }''')
gradle=root/"app/build.gradle.kts"
once(gradle,'versionName = "1.7.6"','versionName = "1.7.7"')
once(gradle,'versionCode = 15','versionCode = 16')
print("ACR OS Pro v1.7.7 — relatórios corporativos em PDF e XLSX adicionados.")
