package br.com.ospro.ordens

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import org.json.JSONArray
import org.json.JSONObject
import java.io.OutputStream
import java.text.NumberFormat
import java.util.Locale
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

/** PDFs corporativos A4 e Excel verdadeiro, sem bibliotecas externas. */
internal object ExtendedReportExport {
    private fun clean(s: String) = s.replace(Regex("[\\u0000-\\u001f]"), " ").trim()
    private fun value(o: JSONObject, key: String): String = clean(o.optString(key, ""))
    private fun item(a: JSONArray, i: Int): JSONObject = a.optJSONObject(i) ?: JSONObject()
    private fun xml(s: String) = clean(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&apos;")
    private fun column(n: Int): String {
        var k=n+1
        var out=""
        while(k>0){k--;out=('A'+k%26)+out;k/=26}
        return out
    }
    private fun textCell(row:Int,col:Int,s:String,style:Int=0):String {
        return "<c r=\"" + column(col) + row + "\" s=\"" + style + "\" t=\"inlineStr\"><is><t xml:space=\"preserve\">" + xml(s.take(32767)) + "</t></is></c>"
    }
    private fun numberCell(row:Int,col:Int,v:Number):String {
        val d=v.toDouble()
        return "<c r=\"" + column(col) + row + "\" s=\"0\"><v>" + (if(d.isFinite())d else 0.0) + "</v></c>"
    }
    private fun sheet(headers:JSONArray,records:JSONArray):String {
        val sb=StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><sheetViews><sheetView workbookViewId=\"0\"/></sheetViews><sheetFormatPr defaultRowHeight=\"19\"/><cols>")
        for(i in 0 until headers.length()){
            sb.append("<col min=\"").append(i+1).append("\" max=\"").append(i+1).append("\" width=\"30\" customWidth=\"1\"/>")
        }
        sb.append("</cols><sheetData><row r=\"1\">")
        for(j in 0 until headers.length())sb.append(textCell(1,j,headers.optString(j),1))
        sb.append("</row>")
        for(i in 0 until records.length()){
            val values=records.optJSONArray(i) ?: JSONArray()
            sb.append("<row r=\"").append(i+2).append("\">")
            for(j in 0 until headers.length()){
                val x=values.opt(j)
                sb.append(if(x is Number)numberCell(i+2,j,x) else textCell(i+2,j,if(x==null||x===JSONObject.NULL)"" else x.toString()))
            }
            sb.append("</row>")
        }
        val last=if(headers.length()>0)column(headers.length()-1) else "A"
        sb.append("</sheetData><autoFilter ref=\"A1:").append(last).append(records.length()+1).append("\"/></worksheet>")
        return sb.toString()
    }
    private fun zipEntry(z:ZipOutputStream,name:String,content:String) {
        z.putNextEntry(ZipEntry(name))
        z.write(content.toByteArray(Charsets.UTF_8))
        z.closeEntry()
    }
    fun writeXlsx(payload:JSONObject,out:OutputStream) {
        val metrics=payload.optJSONArray("metrics")?:JSONArray()
        val metricsRows=JSONArray()
        metricsRows.put(JSONArray().put("Relatório").put(value(payload,"title")))
        metricsRows.put(JSONArray().put("Empresa").put(value(payload,"company")))
        metricsRows.put(JSONArray().put("Emitido em").put(value(payload,"generatedAt")))
        metricsRows.put(JSONArray().put("Filtros").put(value(payload,"filtersText")))
        for(i in 0 until metrics.length()){
            val o=item(metrics,i)
            metricsRows.put(JSONArray().put(value(o,"label")).put(o.opt("value")))
        }
        val summaryHead=payload.optJSONArray("summaryColumns")?:JSONArray().put("Grupo").put("Quantidade")
        val summaryRows=payload.optJSONArray("summaryRows")?:JSONArray()
        val detailsHead=payload.optJSONArray("columns")?:JSONArray()
        val detailsRows=payload.optJSONArray("rows")?:JSONArray()
        require(detailsHead.length()>0){"Colunas ausentes no relatório"}
        ZipOutputStream(out).use{z->
            zipEntry(z,"[Content_Types].xml","""<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>""")
            zipEntry(z,"_rels/.rels","""<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>""")
            zipEntry(z,"xl/workbook.xml","""<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Detalhamento" sheetId="1" r:id="rId1"/><sheet name="Por Empresa ou OS" sheetId="2" r:id="rId2"/><sheet name="Indicadores" sheetId="3" r:id="rId3"/></sheets></workbook>""")
            zipEntry(z,"xl/_rels/workbook.xml.rels","""<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>""")
            zipEntry(z,"xl/styles.xml","""<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF102D4E"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs></styleSheet>""")
            zipEntry(z,"xl/worksheets/sheet1.xml",sheet(detailsHead,detailsRows))
            zipEntry(z,"xl/worksheets/sheet2.xml",sheet(summaryHead,summaryRows))
            zipEntry(z,"xl/worksheets/sheet3.xml",sheet(JSONArray().put("Indicador").put("Valor"),metricsRows))
        }
    }
    fun writePdf(payload:JSONObject,out:OutputStream,logo:Bitmap?) {
        val pdf=PdfDocument()
        val navy=Color.rgb(16,45,78)
        val gold=Color.rgb(223,169,60)
        val muted=Color.rgb(65,86,107)
        val paperWidth=595
        val paperHeight=842
        val paint=Paint(Paint.ANTI_ALIAS_FLAG)
        var canvas:Canvas?=null
        var page:PdfDocument.Page?=null
        var pageNum=0
        var y=0f
        fun footer(){
            val c=canvas?:return
            paint.typeface=Typeface.DEFAULT
            paint.textSize=9f
            paint.color=muted
            c.drawLine(30f,803f,565f,803f,paint)
            c.drawText("ACR Suporte em T.I  •  Relatório corporativo  •  Página "+pageNum,32f,820f,paint)
        }
        fun newPage(){
            page?.let{footer();pdf.finishPage(it)}
            pageNum++
            page=pdf.startPage(PdfDocument.PageInfo.Builder(paperWidth,paperHeight,pageNum).create())
            canvas=page!!.canvas
            val c=canvas!!
            c.drawColor(Color.WHITE)
            paint.color=navy
            c.drawRect(0f,0f,paperWidth.toFloat(),97f,paint)
            paint.color=gold
            c.drawRect(0f,94f,paperWidth.toFloat(),98f,paint)
            if(logo!=null){
                paint.color=Color.WHITE
                c.drawRoundRect(RectF(30f,16f,145f,81f),7f,7f,paint)
                val ratio=logo.width.toFloat()/logo.height.toFloat()
                val limitW=105f
                val limitH=56f
                val dw=minOf(limitW,limitH*ratio)
                val dh=dw/ratio
                val dest=RectF(87.5f-dw/2f,48.5f-dh/2f,87.5f+dw/2f,48.5f+dh/2f)
                paint.color=Color.WHITE
                c.drawBitmap(logo,null,dest,paint)
            }
            paint.color=Color.WHITE
            paint.typeface=Typeface.create(Typeface.DEFAULT,Typeface.BOLD)
            paint.textSize=16f
            c.drawText("ACR SUPORTE EM T.I",155f,36f,paint)
            paint.textSize=10.5f
            paint.typeface=Typeface.DEFAULT
            c.drawText(value(payload,"title").take(61),155f,57f,paint)
            paint.textSize=9f
            c.drawText("Emitido em: "+value(payload,"generatedAt").take(56),155f,77f,paint)
            y=119f
        }
        fun drawLine(line:String,size:Float=10f,bold:Boolean=false,color:Int=navy,space:Float=15f) {
            if(y>780f)newPage()
            val c=canvas!!
            paint.textSize=size
            paint.typeface=if(bold)Typeface.create(Typeface.DEFAULT,Typeface.BOLD) else Typeface.DEFAULT
            paint.color=color
            val source=clean(line)
            var remaining=source
            if(remaining.isEmpty()){y+=space;return}
            while(remaining.isNotEmpty()){
                if(y>780f)newPage()
                val count=paint.breakText(remaining,true,520f,null).coerceAtLeast(1)
                val p=if(count>=remaining.length)remaining.length else {
                    val part=remaining.substring(0,count)
                    val last=part.lastIndexOf(' ')
                    if(last>count/2)last else count
                }
                canvas!!.drawText(remaining.substring(0,p),36f,y,paint)
                y+=space
                remaining=remaining.substring(p).trimStart()
            }
        }
        fun sectionTitle(value:String){
            if(y>735f)newPage()
            y+=8f
            paint.color=Color.rgb(239,244,249)
            canvas!!.drawRect(30f,y-16f,565f,y+9f,paint)
            drawLine(value,12f,true,navy,20f)
        }
        try{
            newPage()
            drawLine("Filtro: "+value(payload,"filtersText"),9.5f,false,muted,14f)
            val metrics=payload.optJSONArray("metrics")?:JSONArray()
            y+=8f;sectionTitle("INDICADORES")
            for(i in 0 until metrics.length()){
                val m=item(metrics,i)
                drawLine(value(m,"label")+": "+value(m,"value"),10.5f,true,navy,16f)
            }
            val groups=payload.optJSONArray("groups")?:JSONArray()
            if(groups.length()==0){
                sectionTitle("RESULTADOS")
                drawLine("Nenhum registro corresponde aos filtros escolhidos.")
            }else for(i in 0 until groups.length()){
                val group=item(groups,i)
                sectionTitle(value(group,"heading"))
                val items=group.optJSONArray("items")?:JSONArray()
                for(j in 0 until items.length()){
                    val row=item(items,j)
                    if(y>730f)newPage()
                    drawLine(value(row,"title"),10.7f,true,navy,16f)
                    val details=row.optJSONArray("lines")?:JSONArray()
                    for(k in 0 until details.length())drawLine(details.optString(k),9.6f,false,muted,14f)
                    y+=9f
                }
            }
            page?.let{footer();pdf.finishPage(it)}
            pdf.writeTo(out)
        }finally{pdf.close()}
    }
}
