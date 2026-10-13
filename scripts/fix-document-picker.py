#!/usr/bin/env python3
"""Força gerenciador de documentos Android em upload não-fotográfico do ACR OS Pro."""
from pathlib import Path
import re
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else "ospro-eletrica-software")
kt_file = root / "app/src/main/java/br/com/ospro/ordens/MainActivity.kt"
gradle_file = root / "app/build.gradle.kts"

source = kt_file.read_text(encoding="utf-8")
start = source.index("            override fun onShowFileChooser(")
end_marker = "\n            }\n        }\n        webView.addJavascriptInterface"
end = source.index(end_marker, start) + len("\n            }")
before = source[start:end]
if "params.createIntent()" not in before or "ACTION_IMAGE_CAPTURE" not in before:
    raise RuntimeError("Não foi encontrado o seletor esperado: revisar MainActivity antes de alterar")

after = """            override fun onShowFileChooser(view: WebView, callback: ValueCallback<Array<Uri>>, params: WebChromeClient.FileChooserParams): Boolean {
                cameraResult?.onReceiveValue(null)
                cameraResult = callback
                cameraUri = null
                return try {
                    val accepted = params.acceptTypes
                        .flatMap { it.split(",") }
                        .map { it.trim() }
                        .filter { it.isNotEmpty() }
                        .ifEmpty { listOf("*/*") }
                    val onlyImages = accepted.all { it.startsWith("image/") }
                    // A camera só é usada para um input de imagem que solicitou capture.
                    // PDF, JSON, backup, logo e fotos sem capture usam Arquivos do Android.
                    val cameraRequested = params.isCaptureEnabled && onlyImages

                    fun openAndroidFiles() {
                        val documents = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                            addCategory(Intent.CATEGORY_OPENABLE)
                            type = if (accepted.size == 1) accepted[0] else "*/*"
                            if (accepted.size > 1)
                                putExtra(Intent.EXTRA_MIME_TYPES, accepted.toTypedArray())
                            if (params.mode == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE)
                                putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        }
                        photoPicker.launch(documents)
                    }
                    if (cameraRequested) {
                        val photoFile = File(
                            File(cacheDir, "photos").apply { mkdirs() },
                            "camera-${System.currentTimeMillis()}.jpg"
                        )
                        val imageUri = FileProvider.getUriForFile(
                            this@MainActivity, "$packageName.fileprovider", photoFile
                        )
                        val camera = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
                            putExtra(MediaStore.EXTRA_OUTPUT, imageUri)
                            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
                        }
                        if (camera.resolveActivity(packageManager) != null) {
                            cameraUri = imageUri
                            photoPicker.launch(camera)
                        } else {
                            openAndroidFiles()
                        }
                    } else {
                        openAndroidFiles()
                    }
                    true
                } catch (e: Exception) {
                    cameraResult?.onReceiveValue(null)
                    cameraResult = null
                    cameraUri = null
                    false
                }
            }"""
source = source[:start] + after + source[end:]
if source.count("Intent(MediaStore.ACTION_IMAGE_CAPTURE)") != 1 or source.count("Intent(Intent.ACTION_OPEN_DOCUMENT)") != 1:
    raise RuntimeError("A correção deve ter exatamente uma rota para câmera e outra para arquivos")
kt_file.write_text(source, encoding="utf-8")

gradle = gradle_file.read_text(encoding="utf-8")
if 'versionName = "1.7.2"' not in gradle:
    raise RuntimeError("Versão base diferente de 1.7.2")
gradle = gradle.replace('versionName = "1.7.2"', 'versionName = "1.7.3"', 1)
gradle, n = re.subn(r"versionCode\s*=\s*11\b", "versionCode = 12", gradle, count=1)
if n != 1:
    raise RuntimeError("Código de versão 11 esperado")
gradle_file.write_text(gradle, encoding="utf-8")
print("Corrigido: arquivos pela ACTION_OPEN_DOCUMENT; câmera somente com capture para imagem. ACR OS Pro v1.7.3")
