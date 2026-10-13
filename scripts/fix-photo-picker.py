#!/usr/bin/env python3
"""Corrige escolha de foto vs captura direta da câmera no APK OS Pro."""
from pathlib import Path
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else "ospro-eletrica-software")
html_file = root / "app/src/main/assets/index.html"
js_file = root / "app/src/main/assets/app.js"
kt_file = root / "app/src/main/java/br/com/ospro/ordens/MainActivity.kt"
gradle_file = root / "app/build.gradle.kts"


def once(original, before, after, label):
    count = original.count(before)
    if count != 1:
        raise RuntimeError(f"{label}: esperada uma ocorrência; encontrou {count}")
    return original.replace(before, after, 1)


html = html_file.read_text(encoding="utf-8")
html = once(
    html,
    '<label class="file-pick">📷 Adicionar foto<input id="photo-input" type="file" accept="image/*" capture="environment" hidden></label>',
    '''<div class="actions photo-actions" role="group" aria-label="Adicionar evidências fotográficas">
          <label class="file-pick">🖼️ Escolher foto<input id="photo-input" type="file" accept="image/*" hidden></label>
          <label class="file-pick">📷 Tirar foto<input id="photo-camera" type="file" accept="image/*" capture="environment" hidden></label>
        </div>''',
    "Botões de fotos",
)
html_file.write_text(html, encoding="utf-8")

js = js_file.read_text(encoding="utf-8")
js = once(
    js,
    "  $('#photo-input').onchange=async e=>",
    "  const onPhotoSelected=async e=>",
    "Tratamento de fotos",
)
line = next((v for v in js.splitlines() if "const onPhotoSelected=async e=>" in v), None)
if not line or not line.rstrip().endswith("};"):
    raise RuntimeError("Não foi possível identificar o final do evento de foto")
js = once(
    js, line,
    line + "\n  $('#photo-input').onchange=onPhotoSelected;\n  $('#photo-camera').onchange=onPhotoSelected;",
    "Vincular os dois controles à evidência",
)
js_file.write_text(js, encoding="utf-8")

kt = kt_file.read_text(encoding="utf-8")
kt = once(
    kt,
    'val chooser = Intent.createChooser(picker, "Selecionar foto / câmera")\n                        if (canCamera) chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, arrayOf(camera))\n                        photoPicker.launch(chooser)',
    'val chooser = Intent.createChooser(picker, "Escolher arquivo ou foto")\n                        photoPicker.launch(chooser)',
    "Android WebView file chooser",
)
kt_file.write_text(kt, encoding="utf-8")

gradle = gradle_file.read_text(encoding="utf-8")
if 'versionName = "1.7.0"' not in gradle:
    raise RuntimeError("Versão base inesperada; revisar antes de gerar APK")
import re
match = re.search(r'versionCode\s*=\s*(\d+)', gradle)
if not match:
    raise RuntimeError("versionCode ausente")
gradle = once(gradle, match.group(0), "versionCode = 11", "Incremento de versão")
gradle = once(gradle, 'versionName = "1.7.0"', 'versionName = "1.7.2"', "Versão do APK")
gradle_file.write_text(gradle, encoding="utf-8")
print("Seletor de galeria e captura direta da câmera separados (v1.7.2).")
