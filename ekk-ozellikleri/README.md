# En Küçük Kareler Tahmin Edicilerinin Özellikleri — İnteraktif Ders Notu

**Hazırlayan: Doç. Dr. M. Hanifi VAN**, Van Yüzüncü Yıl Üniversitesi, İİBF Ekonometri Bölümü

Sayfa: https://hanifivan.github.io/ekk-ozellikleri/

Ekonometri öğrencileri için hazırlanmış, tarayıcıda çalışan interaktif bir ders notu. En küçük kareler (EKK / OLS) tahmin edicilerinin özelliklerini formüllerle değil, öğrencinin kendi çektiği Monte Carlo örnekleriyle anlatır.

## İçerik

Not, kaynak ders notundaki akışı izler ve her konuyu dört kademede sunar: günlük hayattan sezgi, hedef tahtası benzetmesi, canlı benzetim ve katlanabilir formal ispat.

0. Neyi anlatıyoruz? (giriş ve model)
1. Yenilemeli örnekleme: bütün notun Monte Carlo motoru
2. Hedef tahtası: sapma ve varyans ayrımı
3. Sapmasızlık
4. En küçük varyans ve etkinlik
5. Doğrusallık
6. OHK: sapma ile varyansın dengesi (Var + Sapma² ayrışımı)
7. Tutarlılık (büyük örnek özelliği)
8. Gauss-Markov teoremi (DEST / BLUE)
9. Özet ve mini quiz

## Teknik

- Tek dosya, tamamen çevrimdışı: `index.html` hiçbir dış bağlantı içermez.
- Grafikler [Chart.js](https://www.chartjs.org/) ile çizilir (gömülü).
- Matematik dizgisi [KaTeX](https://katex.org/) ile yapılır; fontlar CSS içine base64 gömülüdür.
- Bütün benzetimler gerçek Monte Carlo hesabıdır; EKK eğimi her örnekte yeniden tahmin edilir.

## Yeniden derleme

Kaynak dosyalar düzenlendikten sonra tek dosyayı yeniden üretmek için:

```
python build.py
```

Bu betik `index.template.html` içindeki yer tutucuları `assets/` altındaki Chart.js, KaTeX ve `app.js` ile doldurup `index.html` üretir.

### Klasör yapısı

```
index.html              Yayınlanan tek dosya (üretilir)
index.template.html     HTML iskeleti + sayfa CSS'i
build.py                Derleme betiği
assets/
  app.js                Tüm benzetim ve etkileşim mantığı
  chartjs.inline.js     Chart.js (gömülü)
  katex.min.js          KaTeX motoru
  katex.embedded.css    Fontları base64 gömülü KaTeX CSS'i
  katex.min.css         Kaynak KaTeX CSS'i (referans)
  fonts/                KaTeX woff2 fontları (referans)
```

## Kaynak

"En Küçük Kareler Tahmin Edicilerinin Özellikleri" başlıklı ekonometri ders notu.
