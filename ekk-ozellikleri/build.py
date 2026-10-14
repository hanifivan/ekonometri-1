#!/usr/bin/env python3
"""
EKK İnteraktif Ders Notu — derleme betiği.

index.template.html icindeki dort yer tutucuyu (Chart.js, gomulu KaTeX CSS,
KaTeX JS, uygulama JS) gercek icerikle degistirip tek dosya index.html uretir.
Cikti tamamen cevrimdisi calisir: hicbir dis baglanti yoktur.

Kullanim:
    python build.py
"""
import pathlib
import re

BASE = pathlib.Path(__file__).parent


def inject(text, marker, payload):
    needle = "/*" + marker + "*/"
    if needle not in text:
        raise SystemExit("Yer tutucu bulunamadi: " + marker)
    return text.replace(needle, payload)


def main():
    tpl = (BASE / "index.template.html").read_text(encoding="utf-8")
    katex_css = (BASE / "assets/katex.embedded.css").read_text(encoding="utf-8")
    katex_js = (BASE / "assets/katex.min.js").read_text(encoding="utf-8")
    app_js = (BASE / "assets/app.js").read_text(encoding="utf-8")

    # Chart.js dosyasi bastaki <script> etiketiyle basliyor, onu at
    chart = (BASE / "assets/chartjs.inline.js").read_text(encoding="utf-8")
    chart = chart.replace("<script>", "", 1)

    out = tpl
    out = inject(out, "__KATEX_CSS__", katex_css)
    out = inject(out, "__CHARTJS__", chart)
    out = inject(out, "__KATEX_JS__", katex_js)
    out = inject(out, "__APP_JS__", app_js)

    leftover = re.findall(r"/\*__[A-Z_]+__\*/", out)
    if leftover:
        raise SystemExit("Kalan yer tutucu: " + str(leftover))

    (BASE / "index.html").write_text(out, encoding="utf-8")
    kb = round(len(out.encode("utf-8")) / 1024)
    print(f"index.html uretildi ({kb} KB)")


if __name__ == "__main__":
    main()
