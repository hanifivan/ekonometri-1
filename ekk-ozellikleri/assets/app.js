/* ============================================================
   EKK Tahmin Edicilerinin Özellikleri: İnteraktif Ders Notu
   Tüm hesaplar tarayıcıda, çevrimdışı çalışır.
   ============================================================ */
(function(){
"use strict";

/* ---------- Sabitler ve renkler ---------- */
var TRUE_B0 = 5, TRUE_B1 = 2.0;
var C = {
  primary:"#3457b2", primarySoft:"rgba(52,87,178,.18)",
  good:"#2e9e6b", goodSoft:"rgba(46,158,107,.20)",
  bad:"#d1495b", badSoft:"rgba(209,73,91,.20)",
  accent:"#e08a1e", accentSoft:"rgba(224,138,30,.22)",
  muted:"#5b6576", grid:"rgba(90,101,118,.12)"
};

/* ---------- Sayı biçimleme (Türkçe) ---------- */
function tr(x, d){ if(x===null||x===undefined||isNaN(x)) return "–"; d=(d===undefined)?2:d; return x.toFixed(d).replace(".", ","); }

/* ---------- İstatistik yardımcıları ---------- */
function randn(){ // Box-Muller
  var u=0,v=0; while(u===0)u=Math.random(); while(v===0)v=Math.random();
  return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);
}
function mean(a){ var s=0; for(var i=0;i<a.length;i++)s+=a[i]; return s/a.length; }
function sd(a){ var m=mean(a),s=0; for(var i=0;i<a.length;i++)s+=(a[i]-m)*(a[i]-m); return Math.sqrt(s/a.length); }

function makeX(n){ var xs=[]; for(var i=0;i<n;i++) xs.push(1 + 9*i/(n-1)); return xs; }
function Sxx(xs){ var mx=mean(xs),s=0; for(var i=0;i<xs.length;i++)s+=(xs[i]-mx)*(xs[i]-mx); return s; }

function olsSlope(xs, ys){
  var mx=mean(xs), my=mean(ys), sxy=0, sxx=0;
  for(var i=0;i<xs.length;i++){ var dx=xs[i]-mx; sxy+=dx*(ys[i]-my); sxx+=dx*dx; }
  return sxy/sxx;
}
function olsIntercept(xs, ys, slope){ return mean(ys) - slope*mean(xs); }

// Bir örnek Y üret: Y = b0 + b1*x + N(0,sigma)
function drawSample(xs, sigma){
  var ys=[]; for(var i=0;i<xs.length;i++) ys.push(TRUE_B0 + TRUE_B1*xs[i] + sigma*randn()); return ys;
}

// Yoğunluk poligonu: değerleri sabit aralıkta binle, alanı 1'e normalize et
function density(values, lo, hi, bins){
  var w=(hi-lo)/bins, counts=new Array(bins).fill(0), i;
  for(i=0;i<values.length;i++){ var b=Math.floor((values[i]-lo)/w); if(b>=0&&b<bins) counts[b]++; }
  var pts=[]; for(i=0;i<bins;i++){ pts.push({x:lo+(i+0.5)*w, y:counts[i]/(values.length*w)}); }
  return pts;
}

/* ---------- KaTeX render ---------- */
function renderMath(){
  if(typeof katex==="undefined") return;
  document.querySelectorAll(".katex-inline[data-tex]").forEach(function(el){
    try{ katex.render(el.getAttribute("data-tex"), el, {throwOnError:false, displayMode:false}); }catch(e){}
  });
  document.querySelectorAll(".formula[data-tex]").forEach(function(el){
    try{ katex.render(el.getAttribute("data-tex"), el, {throwOnError:false, displayMode:true}); }catch(e){}
  });
}

/* ---------- Chart.js ortak ayarlar ---------- */
function setupChartDefaults(){
  if(typeof Chart==="undefined") return;
  Chart.defaults.font.family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";
  Chart.defaults.font.size=12;
  Chart.defaults.color=C.muted;
  Chart.defaults.plugins.legend.labels.usePointStyle=true;
  Chart.defaults.plugins.legend.labels.boxWidth=8;
  Chart.defaults.animation.duration=300;
}
// Gerçek değeri gösteren dikey çizgi eklentisi
function trueLinePlugin(getX, label){
  return {
    id:"trueLine_"+Math.random().toString(36).slice(2),
    afterDraw:function(chart){
      var x=getX(); if(x===null) return;
      var xa=chart.scales.x, ya=chart.scales.y; if(!xa||!ya) return;
      var px=xa.getPixelForValue(x);
      var ctx=chart.ctx; ctx.save();
      ctx.strokeStyle=C.accent; ctx.lineWidth=2; ctx.setLineDash([5,4]);
      ctx.beginPath(); ctx.moveTo(px, ya.top); ctx.lineTo(px, ya.bottom); ctx.stroke();
      ctx.setLineDash([]); ctx.fillStyle=C.accent; ctx.font="bold 11px sans-serif"; ctx.textAlign="center";
      ctx.fillText(label||"gerçek", px, ya.top-4);
      ctx.restore();
    }
  };
}

/* ============================================================
   BÖLÜM 1: Yenilemeli örnekleme motoru
   ============================================================ */
var S1 = { betas:[], scatter:null, hist:null };
function s1Init(){
  var sc=document.getElementById("s1scatter").getContext("2d");
  S1.scatter=new Chart(sc,{ type:"scatter",
    data:{ datasets:[
      {label:"Gözlemler", data:[], backgroundColor:C.primarySoft, borderColor:C.primary, pointRadius:3},
      {label:"EKK doğrusu", type:"line", data:[], borderColor:C.bad, borderWidth:2.5, pointRadius:0, fill:false}
    ]},
    options:{ maintainAspectRatio:false, scales:{
      x:{title:{display:true,text:"X"},grid:{color:C.grid}},
      y:{title:{display:true,text:"Y"},grid:{color:C.grid}} },
      plugins:{legend:{display:true,position:"top"}} }
  });
  var hc=document.getElementById("s1hist").getContext("2d");
  S1.hist=new Chart(hc,{ type:"line",
    data:{ datasets:[{label:"β̂₁ yoğunluğu", data:[], borderColor:C.primary, backgroundColor:C.primarySoft, fill:true, tension:.3, pointRadius:0, borderWidth:2}]},
    options:{ maintainAspectRatio:false, parsing:false, scales:{
      x:{type:"linear", min:-1, max:5, title:{display:true,text:"β̂₁"}, grid:{color:C.grid}},
      y:{title:{display:true,text:"yoğunluk"}, grid:{color:C.grid}, ticks:{display:false}} },
      plugins:{legend:{display:false}} },
    plugins:[trueLinePlugin(function(){return TRUE_B1;},"β₁=2")]
  });
}
function s1Draw(k){
  var n=+document.getElementById("s1n").value, sigma=+document.getElementById("s1s").value;
  var xs=makeX(n), lastYs=null;
  for(var j=0;j<k;j++){
    var ys=drawSample(xs, sigma);
    S1.betas.push(olsSlope(xs, ys));
    lastYs=ys;
  }
  // Son örneği scatter'a koy
  var pts=[]; for(var i=0;i<n;i++) pts.push({x:xs[i], y:lastYs[i]});
  var b1=olsSlope(xs,lastYs), b0=olsIntercept(xs,lastYs,b1);
  S1.scatter.data.datasets[0].data=pts;
  S1.scatter.data.datasets[1].data=[{x:xs[0],y:b0+b1*xs[0]},{x:xs[n-1],y:b0+b1*xs[n-1]}];
  S1.scatter.update();
  // Histogram
  S1.hist.data.datasets[0].data=density(S1.betas, -1, 5, 60);
  S1.hist.update();
  // İstatistik kartları
  document.getElementById("s1_count").textContent=S1.betas.length;
  document.getElementById("s1_mean").textContent=tr(mean(S1.betas));
  document.getElementById("s1_sd").textContent=S1.betas.length>1?tr(sd(S1.betas)):"–";
}
function s1Reset(){ S1.betas=[]; S1.hist.data.datasets[0].data=[]; S1.hist.update();
  document.getElementById("s1_count").textContent=0;
  document.getElementById("s1_mean").textContent="–"; document.getElementById("s1_sd").textContent="–"; }

/* ============================================================
   BÖLÜM 2: Hedef tahtası
   ============================================================ */
var DART = { darts:[] };
function dartShoot(){
  var bias=+document.getElementById("dart_b").value, spread=+document.getElementById("dart_s").value;
  DART.darts=[]; for(var i=0;i<70;i++){ DART.darts.push({dx:bias+spread*randn(), dy:spread*randn()}); }
  dartDraw();
}
function dartDraw(){
  var bias=+document.getElementById("dart_b").value, spread=+document.getElementById("dart_s").value;
  var cv=document.getElementById("dart"), ctx=cv.getContext("2d");
  var W=cv.width, H=cv.height, cx=W/2, cy=H/2, R=W/2-10;
  var scale=R/2.6; // birim -> piksel
  ctx.clearRect(0,0,W,H);
  // halkalar
  var rings=[{r:R,c:"#f2f5fb"},{r:R*0.78,c:"#e6ecf8"},{r:R*0.56,c:"#dbe4f5"},{r:R*0.34,c:"#c9d6f0"},{r:R*0.15,c:C.accentSoft}];
  for(var i=0;i<rings.length;i++){ ctx.beginPath(); ctx.arc(cx,cy,rings[i].r,0,2*Math.PI); ctx.fillStyle=rings[i].c; ctx.fill(); }
  // merkez artı
  ctx.strokeStyle=C.accent; ctx.lineWidth=2; ctx.beginPath();
  ctx.moveTo(cx-8,cy);ctx.lineTo(cx+8,cy);ctx.moveTo(cx,cy-8);ctx.lineTo(cx,cy+8); ctx.stroke();
  // oklar
  for(i=0;i<DART.darts.length;i++){
    var d=DART.darts[i], px=cx+d.dx*scale, py=cy+d.dy*scale;
    var dist=Math.sqrt(d.dx*d.dx+d.dy*d.dy);
    ctx.beginPath(); ctx.arc(px,py,3.2,0,2*Math.PI);
    ctx.fillStyle= dist<0.5?C.good:(dist<1.2?C.primary:C.bad); ctx.globalAlpha=.8; ctx.fill(); ctx.globalAlpha=1;
  }
  // ortalama nokta (sapmayı gösterir)
  var mdx=0,mdy=0; for(i=0;i<DART.darts.length;i++){mdx+=DART.darts[i].dx;mdy+=DART.darts[i].dy;}
  if(DART.darts.length){ mdx/=DART.darts.length; mdy/=DART.darts.length;
    ctx.beginPath(); ctx.arc(cx+mdx*scale, cy+mdy*scale, 5, 0, 2*Math.PI);
    ctx.fillStyle="#111"; ctx.fill(); ctx.strokeStyle="#fff"; ctx.lineWidth=1.5; ctx.stroke(); }
  // OHK = sapma^2 + varyans
  var mse=bias*bias + spread*spread;
  document.getElementById("dart_mse").textContent=tr(mse);
  document.getElementById("dart_b_v").textContent=tr(bias,1);
  document.getElementById("dart_s_v").textContent=tr(spread,2);
}
function dartSetPreset(btn){
  document.querySelectorAll(".preset").forEach(function(p){p.classList.remove("active");});
  btn.classList.add("active");
  document.getElementById("dart_b").value=btn.getAttribute("data-bias");
  document.getElementById("dart_s").value=btn.getAttribute("data-spread");
  dartShoot();
}

/* ============================================================
   BÖLÜM 3: Sapmasızlık (sapmasız vs sapmalı)
   ============================================================ */
var S3=null;
function s3Init(){
  var ctx=document.getElementById("s3chart").getContext("2d");
  S3=new Chart(ctx,{ type:"line",
    data:{ datasets:[
      {label:"Sapmasız β̂", data:[], borderColor:C.good, backgroundColor:C.goodSoft, fill:true, tension:.3, pointRadius:0, borderWidth:2},
      {label:"Sapmalı β̃", data:[], borderColor:C.bad, backgroundColor:C.badSoft, fill:true, tension:.3, pointRadius:0, borderWidth:2}
    ]},
    options:{ maintainAspectRatio:false, parsing:false, scales:{
      x:{type:"linear", min:0, max:5, title:{display:true,text:"tahmin değeri"}, grid:{color:C.grid}},
      y:{title:{display:true,text:"yoğunluk"}, ticks:{display:false}, grid:{color:C.grid}} },
      plugins:{legend:{position:"top"}} },
    plugins:[trueLinePlugin(function(){return TRUE_B1;},"β₁=2")]
  });
}
function s3Run(){
  var bias=+document.getElementById("s3b").value, n=40, sigma=4;
  var xs=makeX(n), a=[], b=[];
  for(var i=0;i<500;i++){ var ys=drawSample(xs,sigma); var e=olsSlope(xs,ys); a.push(e); b.push(e+bias); }
  S3.data.datasets[0].data=density(a,0,5,60);
  S3.data.datasets[1].data=density(b,0,5,60);
  S3.update();
  document.getElementById("s3_m1").textContent=tr(mean(a));
  document.getElementById("s3_m2").textContent=tr(mean(b));
}

/* ============================================================
   BÖLÜM 4: En küçük varyans / etkinlik
   ============================================================ */
var S4=null;
function s4Init(){
  var ctx=document.getElementById("s4chart").getContext("2d");
  S4=new Chart(ctx,{ type:"line",
    data:{ datasets:[
      {label:"Etkin (düşük varyans)", data:[], borderColor:C.good, backgroundColor:C.goodSoft, fill:true, tension:.3, pointRadius:0, borderWidth:2},
      {label:"Yüksek varyanslı", data:[], borderColor:C.bad, backgroundColor:C.badSoft, fill:true, tension:.3, pointRadius:0, borderWidth:2}
    ]},
    options:{ maintainAspectRatio:false, parsing:false, scales:{
      x:{type:"linear", min:0, max:4, title:{display:true,text:"β̂₁"}, grid:{color:C.grid}},
      y:{title:{display:true,text:"yoğunluk"}, ticks:{display:false}, grid:{color:C.grid}} },
      plugins:{legend:{position:"top"}} },
    plugins:[trueLinePlugin(function(){return TRUE_B1;},"β₁=2")]
  });
}
function s4Run(){
  var mult=+document.getElementById("s4v").value, n=40, sigma=4;
  var xs=makeX(n), baseSD=sigma/Math.sqrt(Sxx(xs));
  var addSD=baseSD*Math.sqrt(Math.max(0,mult*mult-1));
  var a=[], b=[];
  for(var i=0;i<800;i++){ var ys=drawSample(xs,sigma); var e=olsSlope(xs,ys); a.push(e); b.push(e+addSD*randn()); }
  S4.data.datasets[0].data=density(a,0,4,70);
  S4.data.datasets[1].data=density(b,0,4,70);
  S4.update();
  document.getElementById("s4_sd1").textContent=tr(sd(a),3);
  document.getElementById("s4_sd2").textContent=tr(sd(b),3);
}

/* ============================================================
   BÖLÜM 5: Doğrusallık (ağırlıklar k_i)
   ============================================================ */
function s5Init(){
  var n=20, xs=makeX(n), mx=mean(xs), sxx=Sxx(xs);
  var ks=[], labels=[]; for(var i=0;i<n;i++){ ks.push((xs[i]-mx)/sxx); labels.push(tr(xs[i],1)); }
  var ctx=document.getElementById("s5chart").getContext("2d");
  new Chart(ctx,{ type:"bar",
    data:{ labels:labels, datasets:[{label:"ağırlık kᵢ", data:ks,
      backgroundColor:ks.map(function(k){return k>=0?C.primarySoft:C.badSoft;}),
      borderColor:ks.map(function(k){return k>=0?C.primary:C.bad;}), borderWidth:1.2}]},
    options:{ maintainAspectRatio:false, scales:{
      x:{title:{display:true,text:"Xᵢ değeri"}, grid:{display:false}},
      y:{title:{display:true,text:"kᵢ"}, grid:{color:C.grid}} },
      plugins:{legend:{display:false},
        tooltip:{callbacks:{label:function(c){return "kᵢ = "+tr(c.raw,4);}}}} }
  });
}

/* ============================================================
   BÖLÜM 6: OHK ayrışımı, adım adım (Ekonometri II RESET kalıbı)
   Tahmin edici: β̂ ~ N(β + b, v), β = TRUE_B1; v ve b kaydırıcılardan.
   Adımlar: 1 Saçılım, 2 Kayma, 3 Benzetimle doğrulama, 4 Formül, 5 Alıştırma, 6 Karar.
   Pano: Varyans (mavi), Sapma (turuncu), Sapma² (mor), OHK (lacivert).
   ============================================================ */
var AD_RENK={ varr:"#378ADD", sap:"#EF9F27", sap2:"#7F77DD", ohk:"#1E2D5E", iyi:"#1D9E75", kotu:"#E24B4A" };
var S6={dist:null, bar:null, mc:null, adim:1, acik:false, fb:"", deneme:null, cevap:{s2:"",ohk:""}};
var S6_ADIM=["Saçılım","Kayma","Tutuyor mu?","Formül","Siz hesaplayın","Karar"], S6_N=S6_ADIM.length;
var S6_DENEME=3, S6_FORMUL=4, S6_ALIS=5, S6_KARAR=6; // adım numaraları
var S6_RAKIP_VAR=1.00; // sapmasız rakip tahmin edici: Var = 1,00, Sapma = 0
function normalPts(mu, sigma, lo, hi, steps){
  var pts=[]; for(var i=0;i<=steps;i++){ var x=lo+(hi-lo)*i/steps;
    var y=Math.exp(-0.5*Math.pow((x-mu)/sigma,2))/(sigma*Math.sqrt(2*Math.PI)); pts.push({x:x,y:y}); } return pts;
}
// Kaydırıcı adımı 0,05 olduğundan b² en çok 4 basamaklıdır; tam değeri gizlememek için gerekiyorsa 4 basamak yaz.
function adSay(x){ var r=Math.round(x*1e4)/1e4; return Math.abs(r*100-Math.round(r*100))<1e-6 ? tr(r,2) : tr(r,4); }
function adTex(x){ return adSay(x).replace(",", "{,}"); }
function s6Deger(){ var v=+document.getElementById("s6v").value, b=+document.getElementById("s6b").value; return {v:v, b:b, b2:b*b, ohk:v+b*b, sd:Math.sqrt(v), eb:TRUE_B1+b}; }
var BH='<span data-tex="\\hat{\\beta}"></span>'; // metin içinde β̂ (KaTeX)
function s6Tex(root){
  if(typeof katex==="undefined") return;
  root.querySelectorAll("[data-tex]").forEach(function(el){
    try{ katex.render(el.getAttribute("data-tex"), el, {throwOnError:false, displayMode:el.classList.contains("formula")}); }catch(e){} });
}
// Eksen etiketleri virgüllü ondalık
function trTick(v){ var r=Math.round(v*100)/100; return Number.isInteger(r)?String(r):tr(r, Math.round(r*10)===r*10?1:2); }
// Grafik yazısı: arkası yarı saydam beyaz kutulu, çizim alanı içinde tutulur
function s6Etiket(g, yazi, x, y, hiza, renk, alan){
  g.font="bold 12px sans-serif"; var w=g.measureText(yazi).width, x0=hiza==="center"?x-w/2:(hiza==="right"?x-w:x);
  if(alan){ x0=Math.max(alan.left+2, Math.min(x0, alan.right-w-2)); }
  g.fillStyle="rgba(255,255,255,.88)"; g.fillRect(x0-3, y-12, w+6, 16); g.fillStyle=renk; g.textAlign="left"; g.fillText(yazi, x0, y);
}
// x ekseni: E(β̂) ± 3,5·sd(β̂) ve gerçek β'yı kapsar
function s6Aralik(D){ var lo=Math.min(TRUE_B1, D.eb-3.5*D.sd), hi=Math.max(TRUE_B1, D.eb+3.5*D.sd); return {lo:Math.floor(lo), hi:Math.ceil(hi)}; }
// Dağılım grafiği üstüne: gerçek β (koyu kesikli), 1. adımda ±sd(β̂) oku (mavi), 2. adımda E(β̂) çizgisi ve β → E(β̂) oku (turuncu).
function s6DistPlugin(){
  return { id:"s6isaret", afterDraw:function(chart){
    var D=s6Deger(), xa=chart.scales.x, ya=chart.scales.y, g=chart.ctx, alan=chart.chartArea; if(!xa||!ya) return;
    var px=function(x){ return xa.getPixelForValue(x); }, ok=function(x1,x2,y,renk){
      g.strokeStyle=renk; g.fillStyle=renk; g.lineWidth=2.5; g.setLineDash([]); g.beginPath(); g.moveTo(x1,y); g.lineTo(x2,y); g.stroke();
      [[x1,x2],[x2,x1]].forEach(function(p){ if(Math.abs(p[1]-p[0])<8) return; var d=p[1]>p[0]?-1:1; g.beginPath(); g.moveTo(p[1],y); g.lineTo(p[1]+d*8,y-5); g.lineTo(p[1]+d*8,y+5); g.closePath(); g.fill(); }); };
    g.save();
    g.strokeStyle="#182031"; g.lineWidth=2; g.setLineDash([5,4]); g.beginPath(); g.moveTo(px(TRUE_B1),ya.top); g.lineTo(px(TRUE_B1),ya.bottom); g.stroke();
    g.setLineDash([]);
    // Etiketler çizim alanının üstündeki boşluğa yazılır, eğriye binmez
    s6Etiket(g, "gerçek β = "+tr(TRUE_B1), px(TRUE_B1)-4, ya.top-6, "right", "#182031", alan);
    var tepe=1/(D.sd*Math.sqrt(2*Math.PI)), yMid=ya.getPixelForValue(tepe*0.6065); // ±sd noktasındaki yükseklik
    if(S6.adim===1){
      ok(px(D.eb-D.sd), px(D.eb+D.sd), yMid, AD_RENK.varr);
      s6Etiket(g, "±sd(β̂) = ±"+tr(D.sd), px(D.eb), yMid-9, "center", AD_RENK.varr, alan);
    }
    if(S6.adim===2){
      g.strokeStyle=AD_RENK.sap; g.lineWidth=2.5; g.setLineDash([6,4]); g.beginPath(); g.moveTo(px(D.eb),ya.top); g.lineTo(px(D.eb),ya.bottom); g.stroke(); g.setLineDash([]);
      if(D.b>0) s6Etiket(g, "E(β̂) = "+adSay(D.eb), px(D.eb)+4, ya.top-6, "left", "#b36d0a", alan);
      var yOk=ya.bottom-14; g.globalAlpha=.18; g.fillStyle=AD_RENK.sap; g.fillRect(px(TRUE_B1), ya.top, px(D.eb)-px(TRUE_B1), ya.bottom-ya.top); g.globalAlpha=1;
      ok(px(TRUE_B1), px(D.eb), yOk, AD_RENK.sap);
      // Sapma yazısı okun üstünde, beyaz zeminli; eğrinin kuyruğuyla çakışsa da okunur
      s6Etiket(g, "Sapma = "+adSay(D.b), (px(TRUE_B1)+px(D.eb))/2, yOk-8, "center", "#b36d0a", alan);
    }
    g.restore(); } };
}
function s6Init(){
  S6.dist=new Chart(document.getElementById("s6dist").getContext("2d"),{ type:"line",
    data:{ datasets:[{label:"β̂ dağılımı", data:[], borderColor:AD_RENK.varr, backgroundColor:"rgba(55,138,221,.18)", fill:true, tension:.3, pointRadius:0, borderWidth:2}]},
    options:{ maintainAspectRatio:false, parsing:false, animation:false, locale:"tr-TR", layout:{padding:{top:20}}, scales:{
      x:{type:"linear", min:-1, max:5, title:{display:true,text:"β̂ (tahmin)"}, grid:{color:C.grid}, ticks:{callback:trTick}},
      y:{ticks:{display:false}, grid:{color:C.grid}, beginAtZero:true} },
      plugins:{legend:{display:false}, tooltip:{enabled:false}} },
    plugins:[s6DistPlugin()]
  });
  S6.bar=new Chart(document.getElementById("s6bar").getContext("2d"),{ type:"bar",
    data:{ labels:["Bizim tahmin edici","Sapmasız rakip"], datasets:[
      {label:"Varyans", data:[0,S6_RAKIP_VAR], backgroundColor:AD_RENK.varr},
      {label:"Sapma²", data:[0,0], backgroundColor:AD_RENK.sap2} ]},
    options:{ maintainAspectRatio:false, locale:"tr-TR", scales:{
      x:{stacked:true, grid:{display:false}},
      y:{stacked:true, title:{display:true,text:"OHK'ya katkı"}, grid:{color:C.grid}, beginAtZero:true, ticks:{callback:trTick}} },
      plugins:{legend:{position:"top"}, tooltip:{callbacks:{label:function(c){ return c.dataset.label+" "+adSay(c.raw); }}}} }
  });
  S6.mc=new Chart(document.getElementById("s6mc").getContext("2d"),{ type:"bar",
    data:{ labels:[], datasets:[{label:"(β̂ − β)² değerleri", data:[], backgroundColor:"rgba(91,101,118,.45)", borderWidth:0, barPercentage:1, categoryPercentage:1}]},
    options:{ maintainAspectRatio:false, animation:false, locale:"tr-TR", scales:{
      x:{type:"linear", min:0, title:{display:true,text:"(β̂ − β)²   (son çubuk daha büyük değerleri de kapsar)"}, grid:{color:C.grid}, offset:false, ticks:{callback:trTick}},
      y:{title:{display:true,text:"çekiliş sayısı"}, grid:{color:C.grid}, beginAtZero:true} },
      plugins:{legend:{position:"top"}, tooltip:{enabled:false}} },
    plugins:[{ id:"s6ort", afterDraw:function(chart){ var M=S6.deneme; if(!M) return; var xa=chart.scales.x, ya=chart.scales.y, g=chart.ctx, p=xa.getPixelForValue(M.mse);
      g.save(); g.strokeStyle=AD_RENK.sap; g.lineWidth=3; g.beginPath(); g.moveTo(p,ya.top); g.lineTo(p,ya.bottom); g.stroke();
      s6Etiket(g, "ortalama = "+tr(M.mse,4), p+5, ya.top+14, "left", "#b36d0a", chart.chartArea); g.restore(); } }]
  });
}
// 3. adım: tarayıcıda canlı deneme. 2000 β̂ çek, her birinde (β̂ − β)².
function s6Deneme(){
  var D=s6Deger(), N=2000, bh=[], k=[], i, top=0;
  for(i=0;i<N;i++){ var x=TRUE_B1+D.b+D.sd*randn(); bh.push(x); k.push((x-TRUE_B1)*(x-TRUE_B1)); top+=x; }
  var m=top/N, mse=mean(k), vN=0; for(i=0;i<N;i++) vN+=(bh[i]-m)*(bh[i]-m); vN/=N;
  var sap=m-TRUE_B1;
  var sira=k.slice().sort(function(a,b){return a-b;}), ust=Math.ceil(2*Math.max(sira[Math.floor(0.99*N)], mse*1.3))/2;
  var B=40, w=ust/B, h=new Array(B).fill(0); k.forEach(function(q){ var j=Math.floor(q/w); if(j>=B) j=B-1; h[j]++; });
  S6.deneme={ v:D.v, b:D.b, N:N, mse:mse, vN:vN, sap:sap, top:vN+sap*sap, teorik:D.ohk, ust:ust,
    pts:h.map(function(c,j){ return {x:(j+0.5)*w, y:c}; }) };
}
function s6Eski(){ var M=S6.deneme, D=s6Deger(); return M && (Math.abs(M.v-D.v)>1e-9 || Math.abs(M.b-D.b)>1e-9); }
function s6Pano(){
  var D=s6Deger(), adim=S6.adim, kucukAcik=S6.acik||adim>=S6_KARAR;
  function dol(id, deger, gor){ var h=document.getElementById(id), b=h.querySelector("b"), once=h.classList.contains("dolu");
    h.classList.toggle("dolu", gor); b.textContent=gor?deger:"?";
    if(gor&&!once){ h.classList.remove("yanip"); void h.offsetWidth; h.classList.add("yanip"); } }
  dol("s6p_var", adSay(D.v), adim>=1); dol("s6p_sap", adSay(D.b), adim>=2||kucukAcik);
  dol("s6p_sap2", adSay(D.b2), kucukAcik); dol("s6p_ohk", adSay(D.ohk), kucukAcik);
}
function s6Satir(etiket, deger, cls){ return '<div class="ad-satir"><span>'+etiket+'</span><span class="s '+(cls||'')+'">'+deger+'</span></div>'; }
function s6Icerik(){
  var D=s6Deger(), acik=S6.acik||S6.adim>=S6_KARAR, V='<span class="ad-var">'+adSay(D.v)+'</span>', Bb='<span class="ad-sap">'+adSay(D.b)+'</span>',
      B2='<span class="ad-sap2">'+adSay(D.b2)+'</span>', O='<span class="ad-ohk">'+adSay(D.ohk)+'</span>', sonra="";
  var ic={
    1:function(){ return '<h5>1. adım. Saçılım (varyans)</h5><div class="ad-soru">Soru. Tahminler kendi ortalamaları etrafında ne kadar saçılıyor?</div>'+
      '<p>Grafikteki eğri, aynı süreçten defalarca örnek çekseydik elde edeceğimiz '+BH+' değerlerinin dağılımıdır. Varyans bu dağılımın <b>kendi merkezi</b> E('+BH+') etrafındaki genişliğini ölçer, gerçek β\'ya uzaklığını değil. Tanımı <span style="white-space:nowrap" data-tex="\\mathrm{Var}(\\hat{\\beta}) = E\\big[(\\hat{\\beta}-E(\\hat{\\beta}))^2\\big]"></span> biçimindedir.</p>'+
      '<div class="ad-yaz"><b>Var('+BH+') = '+V+'</b> → panoya. Standart sapması sd('+BH+') = √'+adSay(D.v)+' = '+tr(D.sd)+'; mavi ok merkezden bir standart sapma sağa ve sola uzanır. "Varyans bileşeni" kaydırıcısını oynatın; eğri genişler ya da daralır, merkez yerinden oynamaz.</div>'; },
    2:function(){ return '<h5>2. adım. Kayma (sapma)</h5><div class="ad-soru">Soru. Tahminlerin merkezi gerçek β\'nın üstüne oturuyor mu, yoksa kaymış mı?</div>'+
      '<p>Merkez E('+BH+') = β + b = '+tr(TRUE_B1)+' + '+adSay(D.b)+' = <span class="ad-sap">'+adSay(D.eb)+'</span> (turuncu kesikli çizgi), gerçek β = '+tr(TRUE_B1)+' (siyah kesikli çizgi). İkisi arasındaki şerit kaymadır.</p>'+
      '<div class="ad-yaz"><b>Sapma = E('+BH+') − β = '+adSay(D.eb)+' − '+tr(TRUE_B1)+' = '+Bb+'</b> → panoya. "Sapma bileşeni" kaydırıcısı eğriyi sağa kaydırır, genişliğini değiştirmez. '+(D.b===0?'Şu an sapma sıfır, yani tahmin edici sapmasız.':'Sapma sıfırdan büyük, yani tahmin edici ortalamada gerçek değeri aşıyor.')+'</div>'; },
    3:function(){ var M=S6.deneme, eski=s6Eski(), t='<h5>3. adım. Bu iki parça OHK\'yı gerçekten veriyor mu?</h5>'+
      '<div class="ad-soru">Soru. OHK\'yı doğrudan ölçersek, yani E[('+BH+' − β)²] ortalamasını çekilen tahminlerden hesaplarsak, panodaki Varyans ve Sapma\'dan kurulan Var + Sapma² ile aynı sayıyı bulur muyuz?</div>'+
      '<p>Deneyelim. Tarayıcı '+BH+' ~ N('+tr(TRUE_B1)+' + '+adSay(D.b)+'; '+adSay(D.v)+') dağılımından 2000 tahmin çeker ve her birinde gerçek değerden farkın karesini, ('+BH+' − β)², hesaplar. Bu karelerin ortalaması benzetimin OHK\'sıdır.</p>'+
      '<div class="btn-row"><button class="btn small" id="s6_cek">'+(M?'Yeniden 2000 '+BH+' çek':'2000 '+BH+' çek')+'</button></div>';
      if(!M) return t+'<p class="ad-ipucu">Düğmeye basın; grafik ve sonuçlar burada belirir.</p>';
      var r6=function(x){ return Math.round(x*1e6)/1e6; }, pv=r6(M.vN), ps=r6(M.sap*M.sap), pt=r6(pv+ps), pm=r6(M.mse);
      var yuv=Math.abs(pt-pm)>5e-7;
      sonra=(eski?'<div class="ad-karar eski">Kaydırıcı değişti. Aşağıdaki sonuç eski değerlere ait (Var = '+adSay(M.v)+', Sapma = '+adSay(M.b)+'); yeniden çekin.</div>':'')+
        '<div class="ad-liste'+(eski?' solgun':'')+'">'+
        '<div class="ad-satir bas"><span>Benzetimden (N = 2000)</span></div>'+
        s6Satir('OHK = ortalama ('+BH+' − β)²', tr(M.mse,6), 'ad-ohk')+
        s6Satir('Varyans (N\'ye bölünen)', tr(pv,6), 'ad-var')+
        s6Satir('Sapma = ortalama '+BH+' − β', tr(M.sap,6), 'ad-sap')+
        s6Satir('Sapma²', tr(ps,6), 'ad-sap2')+
        s6Satir('Varyans + Sapma²', tr(pv,6)+' + '+tr(ps,6)+' = '+tr(pt,6))+
        '</div>'+
        '<div class="ad-yaz">Benzetimin OHK\'sı ile benzetimin "Varyans + Sapma²" toplamı <b>aynı sayıdır</b>'+(yuv?' (altıncı basamaktaki 1 birimlik fark yalnız yuvarlamadan gelir)':'')+'. Bu şans değil, cebirdir. Varyansı N\'ye bölerek hesaplayınca örnekteki çapraz terim de tam sıfırdır, çünkü '+BH+'\'ların kendi ortalamalarından farklarının toplamı sıfırdır. Pano değerleriyle (Var = '+adSay(M.v)+', Sapma = '+adSay(M.b)+') teorik OHK\'yı 5. adımda siz hesaplayacaksınız; benzetimin sonucu ona yakın çıkar, aradaki küçük fark yalnız örnekleme gürültüsüdür ve çekiliş sayısı arttıkça küçülür.</div>';
      return t; },
    4:function(){ return '<h5>4. adım. Formül</h5>'+
      '<p>Sözle söylersek <b>OHK = saçılımın katkısı + kaymanın katkısı.</b> Tahminin gerçek değerden farkı iki parçadan oluşur. Biri tahminin kendi merkezinden farkı (saçılım), öteki merkezin gerçek değerden farkı (kayma). Farkın karesini alınca bir de çapraz terim çıkar; ama saçılım ortalamada sıfır olduğundan çapraz terimin beklenen değeri sıfırdır (aşağıdaki ispat). Geriye iki karenin toplamı kalır. 3. adımdaki deneyde gördüğümüz eşitlik budur.</p>'+
      '<div class="formula center" data-tex="\\begin{aligned}\\textcolor{'+AD_RENK.ohk+'}{\\mathrm{OHK}(\\hat{\\beta})} &= E\\big[(\\hat{\\beta}-\\beta)^2\\big] \\\\ &= \\textcolor{'+AD_RENK.varr+'}{\\mathrm{Var}(\\hat{\\beta})} + \\big[\\textcolor{'+AD_RENK.sap+'}{\\text{Sapma}(\\hat{\\beta})}\\big]^2\\end{aligned}"></div>'+
      '<div class="formula center" data-tex="\\begin{aligned}\\textcolor{'+AD_RENK.ohk+'}{\\mathrm{OHK}} &= \\textcolor{'+AD_RENK.varr+'}{'+adTex(D.v)+'} + \\big(\\textcolor{'+AD_RENK.sap+'}{'+adTex(D.b)+'}\\big)^2 \\\\ &= \\textcolor{'+AD_RENK.varr+'}{'+adTex(D.v)+'} + \\textcolor{'+AD_RENK.sap2+'}{'+(acik?adTex(D.b2):'?')+'} \\\\ &= \\textcolor{'+AD_RENK.ohk+'}{'+(acik?adTex(D.ohk):'?')+'}\\end{aligned}"></div>'+
      (acik?'<div class="ad-yaz">Ara sonuçlar sırayla Sapma² = '+Bb+'² = '+B2+' ve toplam '+V+' + '+B2+' = <b>'+O+'</b>. OHK\'ya saçılımın payı %'+tr(100*D.v/D.ohk,1)+', kaymanın payı %'+tr(100*D.b2/D.ohk,1)+'.</div>'
        :'<div class="ad-yaz">Sapma² ve OHK yuvaları şimdilik boş. Bu iki değeri 5. adımda siz hesaplayacaksınız; doğru cevaptan sonra bu satır ve bileşenlerin payları burada dolar.</div>'); },
    5:function(){ return '<h5>5. adım. Panodaki iki kutuyu siz doldurun</h5>'+
      '<p>Elimizde Var('+BH+') = '+V+' ve Sapma = '+Bb+' var. Sapma² ve OHK değerlerini hesaplayın. Kendinizi sınamak için önce kaydırıcılardan birini değiştirip yeni değerlerle de deneyebilirsiniz. Ondalık ayracı olarak virgül ya da nokta yazabilirsiniz.</p>'+
      '<div class="ad-alistirma"><label>Sapma² = <input id="s6_g_s2" type="text" inputmode="decimal" autocomplete="off"></label>'+
      '<label>OHK = <input id="s6_g_ohk" type="text" inputmode="decimal" autocomplete="off"></label>'+
      '<div class="btn-row"><button class="btn small" id="s6_kontrol">Kontrol et</button><button class="btn ghost small" id="s6_goster">Cevabı göster</button></div>'+
      '<div id="s6_geribildirim">'+S6.fb+'</div></div>'; },
    6:function(){ var bizim=D.ohk, rakip=S6_RAKIP_VAR, fark=bizim-rakip, esit=Math.abs(fark)<0.005, bizIyi=fark<0;
      var kart=function(ad, ayr, d, iyi){ var cls=esit?"":(iyi?"iyi":"kotu"); return '<div class="ad-kart '+cls+'"><div class="l">'+ad+'</div><div class="d">OHK = '+adSay(d)+'</div><div class="e">'+ayr+(esit?' · denk':(iyi?' · küçük OHK, kazanır':' · büyük OHK'))+'</div></div>'; };
      var mesaj, sinif="iyi";
      if(esit){ sinif="notr"; mesaj='İki OHK neredeyse eşit (fark 0,005 değerinden küçük). Bu değerlerde iki tahmin edici toplam hata bakımından denktir.'; }
      else if(bizIyi&&D.b===0) mesaj='OHK '+adSay(bizim)+' &lt; '+adSay(rakip)+'. Bu değerlerde bizim tahmin edici de sapmasız ve daha dar; bu yüzden <b>kazanır.</b>';
      else if(bizIyi) mesaj='OHK '+adSay(bizim)+' &lt; '+adSay(rakip)+', yani <b>sapmalı ama dar olan kazanır.</b> Sapma² olarak '+adSay(D.b2)+' kabul ettik, karşılığında varyansta '+adSay(rakip-D.v)+' kazandık.';
      else if(D.v>=rakip) mesaj='OHK '+adSay(bizim)+' &gt; '+adSay(rakip)+', yani <b>sapmasız rakip kazanır.</b> Bizim tahmin edicinin varyansı ('+adSay(D.v)+') zaten rakibinkinden büyük ya da eşit'+(D.b>0?'; üstüne sapma da eklenir.':'.')+'';
      else mesaj='OHK '+adSay(bizim)+' &gt; '+adSay(rakip)+', yani <b>sapmasız rakip kazanır.</b> Varyansta kazanılan '+adSay(rakip-D.v)+', sapmanın karesini ('+adSay(D.b2)+') karşılamıyor.';
      var esik=D.v<rakip?Math.sqrt(rakip-D.v):null;
      var rol=esik===null?'Şu anki varyans ('+adSay(D.v)+') 1,00 değerinden küçük değil; sapma ne olursa olsun rakip önde ya da onunla denk. Rollerin değiştiğini görmek için "Varyans bileşeni" kaydırıcısını 1,00 değerinin altına indirin.'
        :'Kaydırıcılarla rolleri değiştirebilirsiniz. Şu anki varyansla ('+adSay(D.v)+') sınır, Sapma = √(1,00 − '+adSay(D.v)+') ≈ '+tr(esik,2)+' noktasıdır. Sapma bunun altında kaldıkça sapmalı tahmin edici, üstüne çıkınca sapmasız rakip kazanır.';
      sonra='<div class="ad-kartlar">'+kart("Bizim tahmin edici ("+(D.b===0?"sapmasız":"sapmalı")+")", "Var "+adSay(D.v)+" + Sapma² "+adSay(D.b2), bizim, bizIyi)+kart("Sapmasız rakip", "Var "+adSay(rakip)+" + Sapma² 0", rakip, !bizIyi)+'</div>'+
        '<div class="ad-karar '+sinif+'">'+mesaj+'</div>'+
        '<div class="ad-yaz">'+rol+'</div>'+
        '<div class="ad-yaz"><b>Sınır.</b> OHK iki bileşeni eşit ağırlıkla toplar. Hangi bileşenin önemli olduğu amaca bağlıdır. Güven aralığı ve hipotez testi için genellikle sapmasızlık aranır; tek bir sayının gerçek değere ortalamada yakın olması isteniyorsa OHK uygun ölçüttür.</div>';
      return '<h5>6. adım. Karar, hangi tahmin edici daha iyi?</h5>'+
        '<p>Bölümün başındaki sezgi "küçük bir sapmayı kabul edip çok daha düşük varyans alabilirsin" diyordu. Bunu sayıyla görelim. Bizim tahmin ediciyi, varyansı '+adSay(S6_RAKIP_VAR)+' olan <b>sapmasız</b> bir rakiple karşılaştırıyoruz. Grafikte her sütun OHK\'nın iki parçasını üst üste gösterir.</p>'; }
  };
  var g1=document.getElementById("s6_g_s2"), g2=document.getElementById("s6_g_ohk");
  if(g1){ S6.cevap.s2=g1.value; S6.cevap.ohk=g2.value; }
  var kutu=document.getElementById("s6_icerik"); kutu.innerHTML=ic[S6.adim](); s6Tex(kutu);
  document.getElementById("s6_sonra").innerHTML=sonra; s6Tex(document.getElementById("s6_sonra"));
  if(S6.adim===S6_ALIS) s6AlistirmaBagla();
  if(S6.adim===S6_DENEME) document.getElementById("s6_cek").onclick=function(){ s6Deneme(); s6Ciz(); };
  s6Grafik();
  document.getElementById("s6_adimlar").innerHTML=S6_ADIM.map(function(a,k){ return '<button data-a="'+(k+1)+'" class="'+(k+1===S6.adim?'active':(k+1<S6.adim?'gecti':''))+'">'+(k+1)+'. '+a+'</button>'; }).join("");
  document.querySelectorAll("#s6_adimlar button").forEach(function(b){ b.onclick=function(){ s6Git(+b.getAttribute("data-a")); }; });
  document.getElementById("s6_geri").disabled=S6.adim===1; document.getElementById("s6_ileri").disabled=S6.adim===S6_N;
  document.getElementById("s6_sayac").textContent=S6.adim+" / "+S6_N;
  s6Pano();
}
function s6Grafik(){
  var D=s6Deger(), a=S6.adim, goster=function(id, gor){ document.getElementById(id).style.display=gor?"":"none"; };
  goster("s6_ispat", a===S6_FORMUL); goster("s6dist_wrap", a===1||a===2); goster("s6mc_wrap", a===S6_DENEME&&!!S6.deneme); goster("s6bar_wrap", a===S6_KARAR);
  if(a===1||a===2){ var A=s6Aralik(D), x=S6.dist.options.scales.x; x.min=A.lo; x.max=A.hi;
    S6.dist.options.scales.y.max=1.1/(D.sd*Math.sqrt(2*Math.PI));
    S6.dist.data.datasets[0].data=normalPts(D.eb, D.sd, A.lo, A.hi, 200); S6.dist.resize(); S6.dist.update(); }
  if(a===S6_DENEME&&S6.deneme){ var M=S6.deneme; document.getElementById("s6mc_wrap").classList.toggle("solgun", !!s6Eski());
    S6.mc.data.labels=[]; S6.mc.data.datasets[0].data=M.pts; S6.mc.options.scales.x.max=M.ust; S6.mc.resize(); S6.mc.update(); }
  if(a===S6_KARAR){ S6.bar.data.datasets[0].data=[D.v, S6_RAKIP_VAR]; S6.bar.data.datasets[1].data=[D.b2, 0]; S6.bar.resize(); S6.bar.update(); }
}
// 5. adım alıştırması: Sapma² ve OHK'yı öğrenci bulur; sık yapılan hatalar ayrı ayrı tanınır.
function s6Sayi(s){ s=(s||"").trim().replace(/\s/g,"").replace(",", "."); if(s===""||!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return null; return parseFloat(s); }
// Göreli tolerans: max(0,001; %1)
function s6Tol(x){ return Math.max(0.001, 0.01*Math.abs(x)); }
// Girilen değer doğruysa null, tanınan bir hataya uyuyorsa o hatanın mesajı, hiçbirine uymuyorsa "genel" döner.
// Hatalı aday doğru cevaptan farklıysa ve giriş ona doğru cevaptan daha yakınsa hata sayılır (küçük b'de "sapmayı unuttunuz" doğru sayılmasın).
function s6Sinifla(x, dogru, adaylar){
  var enIyi=null;
  adaylar.forEach(function(c){ if(Math.abs(c[0]-dogru)<1e-9) return; var u=Math.abs(x-c[0]);
    if(u<=s6Tol(c[0]) && u<Math.abs(x-dogru) && (!enIyi||u<enIyi.u)) enIyi={u:u, m:c[1]}; });
  if(enIyi) return enIyi.m;
  // Tam değer dört basamaklıysa iki basamağa yuvarlanmış cevap da kabul, not düşülür (hata adayları önce denetlendi)
  var r2=Math.round(dogru*100)/100; if(Math.abs(r2-dogru)>1e-9 && Math.abs(x-r2)<1e-9) return "yuvarlak";
  if(Math.abs(x-dogru)<=s6Tol(dogru)) return null;
  return "genel";
}
function s6AlistirmaBagla(){
  var D=s6Deger(), g1=document.getElementById("s6_g_s2"), g2=document.getElementById("s6_g_ohk");
  g1.value=S6.cevap.s2; g2.value=S6.cevap.ohk;
  var yaz=function(h){ S6.fb=h; var k=document.getElementById("s6_geribildirim"); k.innerHTML=h; s6Tex(k); };
  var dogru=function(not){ S6.acik=true; s6Pano();
    yaz('<div class="ad-karar iyi">Doğru. Bileşenleri tek tek sayalım. <span class="ad-kat"><span class="ad-var">Varyans '+adSay(D.v)+'</span></span> + <span class="ad-kat"><span class="ad-sap2">Sapma² '+adSay(D.b2)+' (= '+adSay(D.b)+'²)</span></span> = <span class="ad-kat"><span class="ad-ohk">OHK '+adSay(D.ohk)+'</span></span>. Panodaki iki kutu doldu.'+(not||'')+'</div>'); };
  document.getElementById("s6_goster").onclick=function(){ g1.value=adSay(D.b2); g2.value=adSay(D.ohk); S6.cevap.s2=g1.value; S6.cevap.ohk=g2.value; dogru(""); };
  document.getElementById("s6_kontrol").onclick=function(){
    S6.cevap.s2=g1.value; S6.cevap.ohk=g2.value;
    var s2=s6Sayi(g1.value), o=s6Sayi(g2.value), h=[], notlar=[];
    if(s2===null||o===null) return yaz('<div class="ad-karar kotu">İki kutuya da bir sayı yazın (ör. 0,25 ya da 0.25).</div>');
    var sd=D.sd, v=D.v, b=D.b, b2=D.b2, gs=g1.value.trim(), go=g2.value.trim();
    if(s2<0) h.push('Sapma² için '+gs+' yazdınız. Bir sayının karesi <b>negatif olamaz</b>.');
    else { var r1=s6Sinifla(s2, b2, [
        [b, 'Sapma² için '+adSay(b)+' yazdınız; bu sapmanın kendisi. <b>Karesini</b> alın, yani '+adSay(b)+' × '+adSay(b)+'.'],
        [2*b, 'Sapma² için '+adSay(2*b)+' yazdınız; sapmayı 2 ile çarptınız. Kare almak sayıyı kendisiyle çarpmaktır, yani '+adSay(b)+' × '+adSay(b)+'.']]);
      if(r1==="yuvarlak"){ notlar.push('Sapma² için iki basamağa yuvarladınız; tam değer '+adSay(b2)+'.'); r1=null; }
      if(r1) h.push(r1==="genel"?'Sapma² için '+gs+' doğru değil. Panodaki sapmanın (turuncu) karesini alın.':r1); }
    var r2=s6Sinifla(o, D.ohk, [
        [v+b, 'OHK için '+adSay(v+b)+' yazdınız, yani Var + Sapma. Sapmanın <b>karesini almadınız</b>.'],
        [sd+b2, 'OHK için '+tr(sd+b2,4)+' yazdınız, yani sd + Sapma². Varyans yerine <b>standart sapma</b> (√'+adSay(v)+' = '+tr(sd,4)+') kullandınız; OHK\'da varyans var.'],
        [(sd+b)*(sd+b), 'OHK için '+tr((sd+b)*(sd+b),4)+' yazdınız, yani (sd + Sapma)². <b>Toplamın karesi, karelerin toplamı değildir.</b> Çapraz terim beklenen değerde sıfırdır; geriye Var + Sapma² kalır.'],
        [v, 'OHK için '+adSay(v)+' yazdınız, yani yalnız Var. <b>Sapmayı unuttunuz.</b> Bu tahmin edici sapmasız değil; Sapma² de eklenir.'],
        [b2, 'OHK için '+adSay(b2)+' yazdınız, yani yalnız Sapma². <b>Varyansı unuttunuz.</b> Saçılım da hataya katkı yapar.'],
        [v-b2, 'OHK için '+adSay(v-b2)+' yazdınız, yani Var − Sapma². İşaret hatası var; <b>iki bileşen de pozitif katkı yapar</b>, eksi yok.'],
        [v*b2, 'OHK için '+adSay(v*b2)+' yazdınız, yani Var × Sapma². Bileşenler <b>çarpılmaz, toplanır</b>.'],
        [v*b, 'OHK için '+adSay(v*b)+' yazdınız, yani Var × Sapma. Bileşenler <b>çarpılmaz, toplanır</b> ve sapmanın karesi alınır.']]);
    if(r2==="yuvarlak"){ notlar.push('OHK için iki basamağa yuvarladınız; tam değer '+adSay(D.ohk)+'.'); r2=null; }
    if(r2) h.push(r2==="genel"?'OHK için '+go+' doğru değil. Var('+BH+') = '+adSay(v)+' ile Sapma² değerini toplayın.':r2);
    h.length ? yaz('<div class="ad-karar kotu">'+h.join("<br>")+'</div>') : dogru(notlar.length?' '+notlar.join(' '):'');
  };
}
function s6Git(a){
  S6.adim=Math.max(1, Math.min(S6_N, a)); if(S6.adim>=S6_KARAR) S6.acik=true; s6Icerik();
  var r=document.getElementById("s6_adim").getBoundingClientRect();
  if(r.top<0||r.top>window.innerHeight-80) document.getElementById("s6_adim").scrollIntoView({block:"start", behavior:"smooth"});
}
function s6Ciz(){ s6Icerik(); }
// Kaydırıcı değişince alıştırmanın beklenen cevabı değişir; eski geri bildirim, "açık" durumu ve giriş kutuları temizlenir.
// Deneme adımında sonuç "eskidi" diye işaretlenir (tablo ve histogram soluklaşır); panodaki değerler her adımda güncellenir.
function s6Update(){
  var D=s6Deger();
  document.getElementById("s6v_v").textContent=tr(D.v); document.getElementById("s6b_v").textContent=tr(D.b);
  S6.acik=S6.adim>=S6_KARAR; S6.fb=""; S6.cevap={s2:"",ohk:""};
  var g1=document.getElementById("s6_g_s2"), g2=document.getElementById("s6_g_ohk"); if(g1){ g1.value=""; g2.value=""; }
  s6Icerik();
}

/* ============================================================
   BÖLÜM 5 eki: Elle hesaplayalım (adım adım, 6. bölümdeki kalıbın aynısı)
   Veri: Y = 5 + 2X + u, u ~ N(0, 2²), numpy default_rng(2026), Y bir ondalığa yuvarlandı.
   Python/statsmodels ile doğrulandı: β̂₁ = 2,405, β̂₀ = 2,815, Σxᵢ² = 40, Σkᵢ = 0, ΣkᵢXᵢ = 1.
   Pano: X̄ (mavi), Σxᵢ² (mor), kᵢ (turuncu), β̂₁ (lacivert).
   ============================================================ */
var S5V={ X:[1,3,5,7,9], Y:[5.4,11.5,11.2,21.8,24.3], sigma:2 };
(function(){ var X=S5V.X, Y=S5V.Y, n=X.length; S5V.n=n; S5V.xbar=mean(X); S5V.ybar=mean(Y);
  S5V.x=X.map(function(v){return v-S5V.xbar;}); S5V.sxx=S5V.x.reduce(function(s,v){return s+v*v;},0);
  S5V.k=S5V.x.map(function(v){return v/S5V.sxx;}); S5V.kY=S5V.k.map(function(k,i){return k*Y[i];});
  S5V.b1=S5V.kY.reduce(function(s,v){return s+v;},0); S5V.b0=S5V.ybar-S5V.b1*S5V.xbar;
  S5V.sxy=S5V.x.reduce(function(s,v,i){return s+v*Y[i];},0); S5V.sd=S5V.sigma/Math.sqrt(S5V.sxx); })();
var XBt='<span data-tex="\\bar{X}"></span>', B1t='<span data-tex="\\hat{\\beta}_1"></span>'; // metin içinde X̄ ve β̂₁ (KaTeX)
var S5={adim:1, acik1:false, acik2:false, fb1:"", fb2:"", g1:"", g2:"", deneme:null, kc:null, mc:null, sc:null};
var S5_ADIM=["Veri ve ortalama","Sapmalar","Ağırlıklar","Formül","Değişir mi?","Sonuç"], S5_N=S5_ADIM.length;
// Sayı yazımı: virgül, eksi işareti U+2212, en çok 3 basamak (gereksiz sıfırlar atılır, en az d basamak)
function s5S(x, d){ d=(d===undefined)?0:d; var r=Math.round(x*1000)/1000, k=3; while(k>d && Math.abs(r*Math.pow(10,k-1)-Math.round(r*Math.pow(10,k-1)))<1e-9) k--;
  if(Math.abs(r)<1e-12) r=0; return tr(r,k).replace("-", "−"); }
function s5Tex(x, d){ return s5S(x,d).replace("−","-").replace(",", "{,}"); }
function s5Tablo(adim){
  var V=S5V, sx=adim>=2, sk=adim>=3, sky=adim>=4, kyAcik=S5.acik2||adim>=5;
  var bas='<tr><th>i</th><th>Xᵢ</th><th>Yᵢ</th>'+(sx?'<th'+(adim===2?' class="yeni"':'')+'>xᵢ = Xᵢ − '+XBt+'</th>':'')+(sk?'<th class="ad-sap'+(adim===3?' yeni':'')+'">kᵢ</th>':'')+(sky?'<th'+(adim===4?' class="yeni"':'')+'>kᵢYᵢ</th>':'')+'</tr>';
  var sat=V.X.map(function(X,i){ return '<tr><td>'+(i+1)+'</td><td>'+X+'</td><td>'+s5S(V.Y[i],1)+'</td>'+(sx?'<td>'+s5S(V.x[i])+'</td>':'')+(sk?'<td class="ad-sap">'+s5S(V.k[i],2)+'</td>':'')+(sky?'<td>'+(kyAcik?s5S(V.kY[i],2):'?')+'</td>':'')+'</tr>'; }).join("");
  var top='<tr class="top"><td>Σ</td><td>'+s5S(25)+'</td><td>'+s5S(74.2,1)+'</td>'+(sx?'<td>0</td>':'')+(sk?'<td class="ad-sap">0</td>':'')+(sky?'<td>'+(kyAcik?s5S(V.b1,3):'?')+'</td>':'')+'</tr>';
  return '<table class="ad-veri">'+bas+sat+top+'</table>';
}
function s5Pano(){
  var a=S5.adim, V=S5V;
  function dol(id, deger, gor){ var h=document.getElementById(id), b=h.querySelector("b"), once=h.classList.contains("dolu");
    h.classList.toggle("dolu", gor); b.textContent=gor?deger:"?";
    if(gor&&!once){ h.classList.remove("yanip"); void h.offsetWidth; h.classList.add("yanip"); } }
  var b1Acik=S5.acik2||a>=5;
  dol("s5p_xbar", s5S(V.xbar), a>=1); dol("s5p_sxx", s5S(V.sxx), S5.acik1||a>=3||b1Acik); dol("s5p_k", "−0,10 … 0,10", a>=3||b1Acik); dol("s5p_b1", s5S(V.b1,3), b1Acik);
}
var S5R={ xbar:"#378ADD", sxx:"#7F77DD", k:"#EF9F27", b1:"#1E2D5E", iyi:"#1D9E75" };
function s5Icerik(){
  var V=S5V, a=S5.adim, sonra="", XB='<span class="ad-var">'+s5S(V.xbar)+'</span>', SXX='<span class="ad-sap2">'+s5S(V.sxx)+'</span>', B1='<span class="ad-ohk">'+s5S(V.b1,3)+'</span>';
  var ic={
    1:function(){ return '<h5>1. adım. Veri ve ortalama</h5><div class="ad-soru">Soru. Eğimi, tek tek gözlemlerin ağırlıklı toplamı olarak yazabilir miyiz?</div>'+
      s5Tablo(1)+'<p>Önce X\'in ortalaması gerekiyor, çünkü ağırlıklar X\'lerin ortalamadan uzaklığına göre belirlenecek.</p>'+
      '<div class="ad-yaz"><b>'+XBt+' = (1 + 3 + 5 + 7 + 9) / 5 = 25 / 5 = '+XB+'</b> → panoya.</div>'; },
    2:function(){ return '<h5>2. adım. Ortalamadan sapmalar</h5>'+s5Tablo(2)+
      '<p>Her gözlem için xᵢ = Xᵢ − '+XBt+' hesaplanır. Sapmaların toplamı <b>her zaman sıfırdır</b> (Σxᵢ = 0), çünkü ortalamanın altındaki ve üstündeki uzaklıklar birbirini götürür. Formülün paydasında ise sapmaların kareler toplamı Σxᵢ² vardır; bu, EKK\'nın türetiminden (hata kareleri toplamını en küçükleyen eğim) gelir.</p>'+
      '<div class="ad-alistirma"><label>Σxᵢ² = <input id="s5_g1" type="text" inputmode="decimal" autocomplete="off"></label>'+
      '<div class="btn-row"><button class="btn small" id="s5_kontrol1">Kontrol et</button><button class="btn ghost small" id="s5_goster1">Cevabı göster</button></div>'+
      '<div id="s5_fb1">'+S5.fb1+'</div></div>'; },
    3:function(){ var kX=V.k.map(function(k,i){ return k===0?'0·'+V.X[i]:'('+s5S(k,2)+')('+V.X[i]+')'; }).join(' + ');
      return '<h5>3. adım. Ağırlıklar</h5>'+s5Tablo(3)+
      '<p>Her gözlemin ağırlığı kᵢ = xᵢ / Σxᵢ² = xᵢ / '+SXX+'. <b>Uçtaki gözlemler</b> (X = 1 ve X = 9) mutlak değerce en büyük ağırlığı alır; ortadaki gözlemin (X = 5) ağırlığı sıfırdır. Ortalamanın altındaki gözlemlerin ağırlığı negatiftir.</p>'+
      '<div class="ad-yaz">Ağırlıkların iki özelliği var. Toplamları sıfırdır, Σkᵢ = 0. X ile çarpılıp toplanınca bir eder, ΣkᵢXᵢ = '+kX+' = 1. Bu ikisi sayesinde '+B1t+' = Σkᵢ(β₀ + β₁Xᵢ + uᵢ) = β₁ + Σkᵢuᵢ olur; ortalamada β₁\'i verir (sapmasızlık). kᵢ\'ler yalnız X\'lere bağlı sabitler olduğundan '+B1t+' doğrusaldır; yukarıdaki notun dediği Gauss-Markov ön koşulu budur.</div>'; },
    5:function(){ var M=S5.deneme, t='<h5>5. adım. Ağırlıklar örnekten örneğe değişir mi?</h5>'+
      '<div class="ad-soru">Soru. Aynı X\'lerle yeni Y\'ler çekersek kᵢ ağırlıkları değişir mi, ve Σ kᵢYᵢ yine EKK eğimini verir mi?</div>'+
      '<p>Deneyelim. Aynı X\'lerle (1, 3, 5, 7, 9) Y = 5 + 2X + u sürecinden 400 yeni örnek çekilir (σ = 2). Her örnekte eğim iki yoldan hesaplanır, bu adımlardaki Σ kᵢYᵢ ile ve sayfanın baştan beri kullandığı EKK hesabıyla.</p>'+
      '<div class="btn-row"><button class="btn small" id="s5_cek">'+(M?'Yeniden 400 örnek çek':'400 örnek çek')+'</button></div>';
      if(!M) return t+'<p class="ad-ipucu">Düğmeye basın; grafik ve sonuçlar burada belirir.</p>';
      sonra='<div class="ad-liste"><div class="ad-satir bas"><span>400 örnekten</span></div>'+
        s6Satir('İki yöntem arasındaki en büyük mutlak fark', M.fark===0?'0':M.fark.toExponential(1).replace(".", ",").replace(/e-(\d+)/, function(_,d){ return ' × 10<sup>−'+d+'</sup>'; }))+
        s6Satir('kᵢ ağırlıkları (−0,10; −0,05; 0; 0,05; 0,10)', 'değişmedi', 'ad-sap')+
        s6Satir(''+B1t+'\'lerin ortalaması', tr(M.ort,3))+
        s6Satir(''+B1t+'\'lerin std. sapması (benzetim)', tr(M.sd,3))+
        s6Satir('Teorik std. sapma σ/√Σxᵢ² = 2/√40', tr(V.sd,3))+'</div>'+
        '<div class="ad-yaz">İki yöntem <b>aynı sayıyı</b> veriyor; aradaki fark yalnız bilgisayarın yuvarlama hatası düzeyinde. Ağırlıklar yalnız X\'lere bağlı olduğundan değişmedi; değişen yalnız Y\'ler. Eğimlerin ortalaması gerçek β₁ = 2 değerine yakın (sapmasızlık), yayılımı da teorik değere yakın. Turuncu çizgi bizim örneğimizin eğimi '+s5S(V.b1,3)+'; dağılımın içinde olağan bir değer.</div>';
      return t; },
    4:function(){ var ac=S5.acik2, R=S5R;
      var tx=function(k,y){ return '('+s5Tex(k,2)+')('+s5Tex(y,1)+')'; };
      return '<h5>4. adım. Formül</h5>'+
      '<p>Sözle söylersek eğim, Y gözlemlerinin <b>ağırlıklı toplamıdır</b>; ağırlıklar ortalamadan uzaklığın kareler toplamına oranıdır.</p>'+
      '<div class="formula center" data-tex="\\textcolor{'+R.b1+'}{\\hat{\\beta}_1} = \\sum_i \\textcolor{'+R.k+'}{k_i}\\,Y_i, \\qquad \\textcolor{'+R.k+'}{k_i} = \\frac{X_i-\\textcolor{'+R.xbar+'}{\\bar{X}}}{\\textcolor{'+R.sxx+'}{\\sum_i x_i^2}}"></div>'+
      '<div class="formula center" data-tex="\\begin{aligned}\\textcolor{'+R.b1+'}{\\hat{\\beta}_1} &= \\textcolor{'+R.k+'}{(-0{,}10)}(5{,}4) + \\textcolor{'+R.k+'}{(-0{,}05)}(11{,}5) \\\\ &\\quad + \\textcolor{'+R.k+'}{0}\\cdot(11{,}2) + \\textcolor{'+R.k+'}{(0{,}05)}(21{,}8) \\\\ &\\quad + \\textcolor{'+R.k+'}{(0{,}10)}(24{,}3) \\\\ &= '+(ac?'-0{,}54 - 0{,}575 + 0 \\\\ &\\quad + 1{,}09 + 2{,}43':'? + ? + ? + ? + ?')+' \\\\ &= \\textcolor{'+R.b1+'}{'+(ac?s5Tex(V.b1,3):'?')+'}\\end{aligned}"></div>'+
      s5Tablo(4)+
      '<p>'+(ac?'Ara çarpımlar tablonun son sütununda.':'Beş çarpımı kᵢ × Yᵢ kendiniz yapın ve işaretleriyle toplayın. Doğru cevaptan sonra son sütun ve açılım dolar.')+'</p>'+
      '<div class="ad-alistirma"><label>'+B1t+' = <input id="s5_g2" type="text" inputmode="decimal" autocomplete="off"></label>'+
      '<div class="btn-row"><button class="btn small" id="s5_kontrol2">Kontrol et</button><button class="btn ghost small" id="s5_goster2">Cevabı göster</button></div>'+
      '<div id="s5_fb2">'+S5.fb2+'</div></div>'; },
    6:function(){ return '<h5>6. adım. Sonuç, EKK ile aynı mı?</h5>'+
      '<p>Aynı veride klasik EKK formülü de aynı eğimi verir. Σxᵢyᵢ (yᵢ = Yᵢ − Ȳ) bu veride '+s5S(V.sxy,1)+' olur.</p>'+
      '<div class="formula center" data-tex="\\begin{aligned}\\textcolor{'+S5R.b1+'}{\\hat{\\beta}_1} &= \\frac{\\sum_i x_i y_i}{\\textcolor{'+S5R.sxx+'}{\\sum_i x_i^2}} \\\\ &= \\frac{96{,}2}{\\textcolor{'+S5R.sxx+'}{40}} = \\textcolor{'+S5R.b1+'}{2{,}405}\\end{aligned}"></div>'+
      '<div class="formula center" data-tex="\\begin{aligned}\\hat{\\beta}_0 &= \\bar{Y} - \\hat{\\beta}_1\\textcolor{'+S5R.xbar+'}{\\bar{X}} \\\\ &= 14{,}84 - 2{,}405\\cdot\\textcolor{'+S5R.xbar+'}{5} = 2{,}815\\end{aligned}"></div>'+
      '<p>Grafikte örnek noktaları, EKK doğrusu Ŷ = 2,815 + 2,405X (lacivert) ve gerçek doğru Y = 5 + 2X (yeşil kesikli) var.</p>'; }
  };
  if(a===6) sonra='<div class="ad-yaz"><b>Sınır.</b> Gerçek β₁ = 2, bu tek örnekte '+B1t+' = '+s5S(V.b1,3)+'. Aradaki fark ('+s5S(V.b1-2,3)+') <b>örnekleme hatasıdır</b>, sapma değil. 5. adımdaki 400 örnekte eğimlerin ortalaması 2\'ye yakındı; tek örnekteki fark ise yaklaşık '+tr((V.b1-2)/V.sd,1)+' standart sapma, yani olağan.</div>';
  var g1=document.getElementById("s5_g1"), g2=document.getElementById("s5_g2"); if(g1) S5.g1=g1.value; if(g2) S5.g2=g2.value;
  var kutu=document.getElementById("s5_icerik"); kutu.innerHTML=ic[a](); s6Tex(kutu);
  var so=document.getElementById("s5_sonra"); so.innerHTML=sonra; s6Tex(so);
  if(a===2) s5Alistirma1(); if(a===4) s5Alistirma2();
  if(a===5) document.getElementById("s5_cek").onclick=function(){ s5Deneme(); s5Icerik(); };
  s5Grafik();
  document.getElementById("s5_adimlar").innerHTML=S5_ADIM.map(function(t,k){ return '<button data-a="'+(k+1)+'" class="'+(k+1===a?'active':(k+1<a?'gecti':''))+'">'+(k+1)+'. '+t+'</button>'; }).join("");
  document.querySelectorAll("#s5_adimlar button").forEach(function(b){ b.onclick=function(){ s5Git(+b.getAttribute("data-a")); }; });
  document.getElementById("s5_geri").disabled=a===1; document.getElementById("s5_ileri").disabled=a===S5_N;
  document.getElementById("s5_sayac").textContent=a+" / "+S5_N;
  s5Pano();
}
function s5Deneme(){
  var V=S5V, xs=V.X, N=400, b=[], fark=0;
  for(var i=0;i<N;i++){ var ys=drawSample(xs, V.sigma), e1=0; for(var j=0;j<xs.length;j++) e1+=V.k[j]*ys[j];
    var e2=olsSlope(xs, ys); fark=Math.max(fark, Math.abs(e1-e2)); b.push(e1); }
  var lo=0.5, hi=3.5, B=30, w=(hi-lo)/B, h=new Array(B).fill(0); b.forEach(function(q){ var j=Math.floor((q-lo)/w); j=Math.max(0,Math.min(B-1,j)); h[j]++; });
  S5.deneme={ fark:fark, ort:mean(b), sd:sd(b), pts:h.map(function(c,j){ return {x:lo+(j+0.5)*w, y:c}; }) };
}
function s5AdimInit(){
  var V=S5V;
  S5.kc=new Chart(document.getElementById("s5k").getContext("2d"),{ type:"bar",
    data:{ labels:V.X.map(function(x,i){ return "X"+"₁₂₃₄₅"[i]+" = "+x; }), datasets:[{label:"kᵢ", data:V.k,
      backgroundColor:V.k.map(function(k){ return k>=0?"rgba(239,159,39,.75)":"rgba(239,159,39,.35)"; }), borderColor:"#EF9F27", borderWidth:1.2}]},
    options:{ maintainAspectRatio:false, locale:"tr-TR", scales:{ x:{grid:{display:false}}, y:{title:{display:true,text:"kᵢ"}, grid:{color:C.grid}, ticks:{callback:trTick}} },
      plugins:{legend:{display:false}, tooltip:{callbacks:{label:function(c){ return "kᵢ = "+s5S(c.raw,2); }}}} } });
  S5.mc=new Chart(document.getElementById("s5mc").getContext("2d"),{ type:"bar",
    data:{ datasets:[{label:"400 örnekte β̂₁", data:[], backgroundColor:"rgba(91,101,118,.45)", borderWidth:0, barPercentage:1, categoryPercentage:1}]},
    options:{ maintainAspectRatio:false, animation:false, locale:"tr-TR", scales:{
      x:{type:"linear", min:0.5, max:3.5, title:{display:true,text:"β̂₁"}, grid:{color:C.grid}, ticks:{callback:trTick}},
      y:{title:{display:true,text:"örnek sayısı"}, grid:{color:C.grid}, beginAtZero:true} },
      plugins:{legend:{position:"top"}, tooltip:{enabled:false}} },
    plugins:[{ id:"s5cizgi", afterDraw:function(ch){ var xa=ch.scales.x, ya=ch.scales.y, g=ch.ctx; g.save();
      var p=xa.getPixelForValue(2); g.strokeStyle="#182031"; g.lineWidth=2; g.setLineDash([5,4]); g.beginPath(); g.moveTo(p,ya.top); g.lineTo(p,ya.bottom); g.stroke(); g.setLineDash([]);
      s6Etiket(g, "gerçek β₁ = 2", p-4, ya.top+14, "right", "#182031", ch.chartArea);
      p=xa.getPixelForValue(V.b1); g.strokeStyle="#EF9F27"; g.lineWidth=3; g.beginPath(); g.moveTo(p,ya.top); g.lineTo(p,ya.bottom); g.stroke();
      s6Etiket(g, "bizim örnek "+s5S(V.b1,3), p+5, ya.top+32, "left", "#b36d0a", ch.chartArea); g.restore(); } }] });
  S5.sc=new Chart(document.getElementById("s5sc").getContext("2d"),{ type:"scatter",
    data:{ datasets:[
      {label:"Gözlemler", data:V.X.map(function(x,i){ return {x:x, y:V.Y[i]}; }), backgroundColor:"#378ADD", pointRadius:5},
      {label:"EKK doğrusu Ŷ = 2,815 + 2,405X", type:"line", data:[{x:0,y:V.b0},{x:10,y:V.b0+10*V.b1}], borderColor:"#1E2D5E", borderWidth:2.5, pointRadius:0},
      {label:"Gerçek doğru Y = 5 + 2X", type:"line", data:[{x:0,y:5},{x:10,y:25}], borderColor:"#1D9E75", borderDash:[6,4], borderWidth:2, pointRadius:0} ]},
    options:{ maintainAspectRatio:false, locale:"tr-TR", scales:{ x:{min:0, max:10, title:{display:true,text:"X"}, grid:{color:C.grid}, ticks:{callback:trTick}},
      y:{title:{display:true,text:"Y"}, grid:{color:C.grid}, ticks:{callback:trTick}} }, plugins:{legend:{position:"top"}} } });
}
function s5Grafik(){
  var a=S5.adim, g=function(id, gor){ document.getElementById(id).style.display=gor?"":"none"; };
  g("s5k_wrap", a===3); g("s5mc_wrap", a===5&&!!S5.deneme); g("s5sc_wrap", a===6);
  if(a===3){ S5.kc.resize(); S5.kc.update(); }
  if(a===5&&S5.deneme){ S5.mc.data.datasets[0].data=S5.deneme.pts; S5.mc.resize(); S5.mc.update(); }
  if(a===6){ S5.sc.resize(); S5.sc.update(); }
}
// Alıştırmalar: göreli tolerans ve bilinen hatalar (s6Sinifla yeniden kullanılır)
function s5Yaz(id, h){ var k=document.getElementById(id); k.innerHTML=h; s6Tex(k); }
// Tam eşitlik ya da ±tol; bilinen hatalar 0,001 içinde; "yuvarlak" listesindeki değerler not ile doğru sayılır.
// Karşılaştırmalar 1e-9 payıyla yapılır (2,405 × 100 gibi kayan nokta hataları için).
function s5Sinifla(x, dogru, tol, yuvarlak, adaylar){
  for(var i=0;i<adaylar.length;i++){ if(Math.abs(x-adaylar[i][0])<=0.001+1e-9) return adaylar[i][1]; }
  if(Math.abs(x-dogru)<=tol+1e-9) return null;
  for(var j=0;j<yuvarlak.length;j++){ if(Math.abs(x-yuvarlak[j])<1e-9) return "yuvarlak"; }
  return "genel";
}
function s5Alistirma1(){
  var V=S5V, g=document.getElementById("s5_g1"); g.value=S5.g1;
  var dogru=function(){ S5.acik1=true; S5.fb1='<div class="ad-karar iyi">Doğru. Kareleri tek tek toplayalım. (−4)² + (−2)² + 0² + 2² + 4² = 16 + 4 + 0 + 4 + 16 = <span class="ad-sap2">40</span>. Panoya yazıldı.</div>'; s5Yaz("s5_fb1", S5.fb1); s5Pano(); };
  document.getElementById("s5_goster1").onclick=function(){ g.value="40"; S5.g1="40"; dogru(); };
  document.getElementById("s5_kontrol1").onclick=function(){
    S5.g1=g.value; var x=s6Sayi(g.value);
    if(x===null){ S5.fb1='<div class="ad-karar kotu">Kutuya bir sayı yazın.</div>'; return s5Yaz("s5_fb1", S5.fb1); }
    var r=s5Sinifla(x, V.sxx, 1e-9, [], [
      [165, '165 yazdınız, yani ΣXᵢ². Ortalamadan sapmaları değil, <b>ham X\'leri</b> karelediniz. Önce '+XBt+' = 5\'i çıkarın.'],
      [0, '0 yazdınız, yani Σxᵢ. Sapmaların toplamı <b>her zaman sıfırdır</b>; kareleri toplanır.'],
      [25, '25 yazdınız, yani ΣXᵢ. Kareleri değil <b>kendilerini</b> topladınız; üstelik ham X\'leri kullandınız.'],
      [125, '125 yazdınız, yani (ΣXᵢ)²/n. Bu kareler toplamı değil; her sapmanın karesini ayrı ayrı alıp toplayın.'],
      [625, '625 yazdınız, yani (ΣXᵢ)². Önce toplayıp sonra kare aldınız; <b>önce kare, sonra toplam</b>.'],
      [12, '12 yazdınız, yani Σ|xᵢ|. Mutlak değerleri değil, <b>kareleri</b> toplayın.'],
      [10, '10 yazdınız, yani Σxᵢ²/(n − 1). Bu örnek varyansı; burada <b>kareler toplamı</b> istenir, bölme yok.'],
      [8, '8 yazdınız, yani Σxᵢ²/n. Bölme yok; <b>kareler toplamı</b> istenir.'],
      [20, '20 yazdınız; yalnız bir tarafın kareleri. <b>Negatif sapmaların kareleri de pozitiftir</b>, onları da ekleyin.']]);
    if(r===null) return dogru();
    S5.fb1='<div class="ad-karar kotu">'+(r==="genel"?g.value.trim()+' doğru değil. xᵢ sütunundaki her sapmanın karesini alıp toplayın.':r)+'</div>'; s5Yaz("s5_fb1", S5.fb1);
  };
}
function s5Alistirma2(){
  var V=S5V, g=document.getElementById("s5_g2"); g.value=S5.g2;
  var dogru=function(not){ S5.acik2=true; S5.fb2='<div class="ad-karar iyi">Doğru. −0,54 − 0,575 + 0 + 1,09 + 2,43 = <span class="ad-ohk">2,405</span>. Panoya yazıldı.'+(not||'')+'</div>'; s5Icerik(); };
  document.getElementById("s5_goster2").onclick=function(){ g.value="2,405"; S5.g2="2,405"; dogru(""); };
  document.getElementById("s5_kontrol2").onclick=function(){
    S5.g2=g.value; var x=s6Sayi(g.value);
    if(x===null){ S5.fb2='<div class="ad-karar kotu">Kutuya bir sayı yazın.</div>'; return s5Yaz("s5_fb2", S5.fb2); }
    var r=s5Sinifla(x, V.b1, 0.001, [2.4, 2.41], [
      [96.2, '96,2 yazdınız, yani Σxᵢyᵢ. <b>Σxᵢ² = 40 ile bölmeyi unuttunuz</b>; kᵢ\'lerde bu bölme zaten var.'],
      [4.635, '4,635 yazdınız. <b>İşaret hatası</b> var; ilk iki çarpım negatiftir (−0,54 ve −0,575), çıkarılmalı.'],
      [V.ybar, '14,84 yazdınız. Bu Ȳ, yani ağırlıklar eşit 1/n olsaydı çıkacak değer; eğimde ağırlıklar kᵢ\'dir.']]);
    if(r===null||r==="yuvarlak") return dogru(r==="yuvarlak"?' Yazdığınız '+g.value.trim()+' yuvarlanmış; tam değer 2,405.':'');
    S5.fb2='<div class="ad-karar kotu">'+(r==="genel"?g.value.trim()+' doğru değil. Beş kᵢ × Yᵢ çarpımını yapıp işaretleriyle toplayın.':r)+'</div>'; s5Yaz("s5_fb2", S5.fb2);
  };
}
function s5Git(a){
  S5.adim=Math.max(1, Math.min(S5_N, a)); s5Icerik();
  var r=document.getElementById("s5_adim").getBoundingClientRect();
  if(r.top<0||r.top>window.innerHeight-80) document.getElementById("s5_adim").scrollIntoView({block:"start", behavior:"smooth"});
}

/* ---------- Adımlı kutular: ok tuşuyla gezme (genel yardımcı) ----------
   ADIMLI dizisine { el, ileri, geri } eklenir; ileri/geri adım değiştirebildiyse true döner.
   Kutu ekranda en görünür öğe iken ve odak bir yazı alanında değilken ArrowRight / ArrowLeft adımları gezer.
   PageDown/PageUp sayfa kaydırması için bırakılır. */
var ADIMLI=[];
window.ADIMLI=ADIMLI;
function adimliEnGorunur(){
  var vh=window.innerHeight, en=null, enAlan=0;
  ADIMLI.forEach(function(a){ if(!a.el||!a.el.offsetParent) return; var r=a.el.getBoundingClientRect();
    var gor=Math.max(0, Math.min(r.bottom,vh)-Math.max(r.top,0));
    // "en görünür": ekranın en az %40'ını ya da kendi yüksekliğinin yarısını kaplıyor olmalı
    if(gor>=Math.min(0.4*vh, 0.5*r.height) && gor>enAlan){ en=a; enAlan=gor; } });
  return en;
}
function adimliKur(){
  document.addEventListener("keydown", function(e){
    if(e.key!=="ArrowRight"&&e.key!=="ArrowLeft") return;
    if(e.altKey||e.ctrlKey||e.metaKey||e.shiftKey) return;
    var t=e.target, tag=t&&t.tagName?t.tagName.toLowerCase():"";
    if(tag==="input"||tag==="textarea"||tag==="select"||(t&&t.isContentEditable)) return;
    var a=adimliEnGorunur(); if(!a) return;
    if(a[e.key==="ArrowRight"?"ileri":"geri"]()) e.preventDefault();
  });
}

/* ============================================================
   BÖLÜM 7: Tutarlılık (n büyüdükçe)
   ============================================================ */
var S7={chart:null, palette:["#c9d6f0","#8ba7e0","#5b7fe0","#3457b2","#22346f"], idx:0};
function s7Init(){
  var ctx=document.getElementById("s7chart").getContext("2d");
  S7.chart=new Chart(ctx,{ type:"line",
    data:{ datasets:[] },
    options:{ maintainAspectRatio:false, parsing:false, scales:{
      x:{type:"linear", min:0.5, max:3.5, title:{display:true,text:"β̂₁"}, grid:{color:C.grid}},
      y:{title:{display:true,text:"yoğunluk"}, ticks:{display:false}, grid:{color:C.grid}} },
      plugins:{legend:{position:"top"}} },
    plugins:[trueLinePlugin(function(){return TRUE_B1;},"β₁=2")]
  });
}
function s7Run(){
  var n=+document.getElementById("s7n").value, sigma=4;
  var xs=makeX(n), a=[];
  for(var i=0;i<600;i++){ a.push(olsSlope(xs, drawSample(xs,sigma))); }
  var col=S7.palette[S7.idx % S7.palette.length]; S7.idx++;
  S7.chart.data.datasets.push({label:"n="+n, data:density(a,0.5,3.5,80), borderColor:col, backgroundColor:"transparent", tension:.3, pointRadius:0, borderWidth:2.2});
  S7.chart.update();
  document.getElementById("s7_n").textContent=n;
  document.getElementById("s7_sd").textContent=tr(sd(a),3);
  document.getElementById("s7_mean").textContent=tr(mean(a));
}
function s7Clear(){ S7.chart.data.datasets=[]; S7.idx=0; S7.chart.update(); }

/* ============================================================
   BÖLÜM 8: Asimtotik etkinlik (tüm veri vs yarım veri)
   ============================================================ */
var SAE=null;
// Tutarlı ama daha az etkin tahmin edici: örneğin yalnız yarısını (her ikinci gözlem) kullanan EKK
function halfSlope(xs, ys){
  var xh=[], yh=[]; for(var i=0;i<xs.length;i+=2){ xh.push(xs[i]); yh.push(ys[i]); }
  return olsSlope(xh, yh);
}
function saeInit(){
  var ctx=document.getElementById("aechart").getContext("2d");
  SAE=new Chart(ctx,{ type:"line",
    data:{ datasets:[
      {label:"Etkin: tüm veri (EKK)", data:[], borderColor:C.good, backgroundColor:C.goodSoft, fill:true, tension:.3, pointRadius:0, borderWidth:2.2},
      {label:"Yarım veri (tutarlı, daha az etkin)", data:[], borderColor:C.bad, backgroundColor:C.badSoft, fill:true, tension:.3, pointRadius:0, borderWidth:2}
    ]},
    options:{ maintainAspectRatio:false, parsing:false, scales:{
      x:{type:"linear", min:0.5, max:3.5, title:{display:true,text:"β̂₁"}, grid:{color:C.grid}},
      y:{title:{display:true,text:"yoğunluk"}, ticks:{display:false}, grid:{color:C.grid}} },
      plugins:{legend:{position:"top"}} },
    plugins:[trueLinePlugin(function(){return TRUE_B1;},"β₁=2")]
  });
}
function saeRun(){
  var n=+document.getElementById("ae_n").value, sigma=4, xs=makeX(n), a=[], b=[];
  for(var i=0;i<600;i++){ var ys=drawSample(xs,sigma); a.push(olsSlope(xs,ys)); b.push(halfSlope(xs,ys)); }
  SAE.data.datasets[0].data=density(a,0.5,3.5,80);
  SAE.data.datasets[1].data=density(b,0.5,3.5,80);
  SAE.update();
  var sd1=sd(a), sd2=sd(b);
  document.getElementById("ae_sd1").textContent=tr(sd1,3);
  document.getElementById("ae_sd2").textContent=tr(sd2,3);
  document.getElementById("ae_ratio").textContent=(sd1>0?tr((sd2*sd2)/(sd1*sd1),2):"–")+"×";
  document.getElementById("ae_n_v").textContent=n;
}

/* ============================================================
   BÖLÜM 9: Gauss-Markov (EKK vs alternatif)
   ============================================================ */
var S8=null;
// Alternatif doğrusal sapmasız tahmin edici: yalnız iki uç noktayı kullanır
function twoPointSlope(xs, ys){ var n=xs.length; return (ys[n-1]-ys[0])/(xs[n-1]-xs[0]); }
function s8Init(){
  var ctx=document.getElementById("s8chart").getContext("2d");
  S8=new Chart(ctx,{ type:"line",
    data:{ datasets:[
      {label:"EKK (DEST)", data:[], borderColor:C.good, backgroundColor:C.goodSoft, fill:true, tension:.3, pointRadius:0, borderWidth:2.2},
      {label:"Alternatif doğrusal sapmasız", data:[], borderColor:C.bad, backgroundColor:C.badSoft, fill:true, tension:.3, pointRadius:0, borderWidth:2}
    ]},
    options:{ maintainAspectRatio:false, parsing:false, scales:{
      x:{type:"linear", min:0, max:4, title:{display:true,text:"β̂₁"}, grid:{color:C.grid}},
      y:{title:{display:true,text:"yoğunluk"}, ticks:{display:false}, grid:{color:C.grid}} },
      plugins:{legend:{position:"top"}} },
    plugins:[trueLinePlugin(function(){return TRUE_B1;},"β₁=2")]
  });
}
function s8Run(){
  var n=30, sigma=4, xs=makeX(n), a=[], b=[];
  for(var i=0;i<1000;i++){ var ys=drawSample(xs,sigma); a.push(olsSlope(xs,ys)); b.push(twoPointSlope(xs,ys)); }
  S8.data.datasets[0].data=density(a,0,4,80);
  S8.data.datasets[1].data=density(b,0,4,80);
  S8.update();
  document.getElementById("s8_m1").textContent=tr(mean(a));
  document.getElementById("s8_sd1").textContent=tr(sd(a),3);
  document.getElementById("s8_m2").textContent=tr(mean(b));
  document.getElementById("s8_sd2").textContent=tr(sd(b),3);
}

/* ============================================================
   BÖLÜM 9: Quiz
   ============================================================ */
var QUIZ=[
  { q:"Bir tahmin edici sapmasızsa ne demektir?",
    opts:["Her örnekte gerçek değeri tam verir","Ortalamada gerçek değeri verir; tek örnekte sapabilir","Varyansı sıfırdır","Örnek büyüklüğünden bağımsız olarak hatasızdır"],
    correct:1, fb:"Sapmasızlık E(β̂)=β demektir: beklenen değer doğrudur, ama tek bir örnekten gelen tahmin gerçek değerin altında veya üstünde olabilir." },
  { q:"Sapmasız ama yüksek varyanslı bir tahmin edicinin sorunu nedir?",
    opts:["Ortalaması yanlıştır","Elindeki tek örnekten gelen tahmin gerçek değerden çok uzak olabilir","Doğrusal değildir","Hiçbir sorunu yoktur"],
    correct:1, fb:"Ortalama doğru olsa da dağılım geniştir; pratikte elimizde tek örnek olduğundan o tek tahmin çok sapabilir. Bu yüzden düşük varyans da gerekir." },
  { q:"OHK (ortalama hata karesi) neye eşittir?",
    opts:["Sadece varyans","Sadece sapma²","Varyans + Sapma²","Varyans − Sapma²"],
    correct:2, fb:"OHK = Var(β̂) + [Sapma(β̂)]². Çapraz terim sıfır olduğu için toplam bu iki bileşene ayrışır." },
  { q:"Tutarlılık için hangi iki koşul birlikte gerekir?",
    opts:["Doğrusallık ve sapmasızlık","Asimtotik sapmasızlık ve varyansın sıfıra gitmesi","Düşük OHK ve etkinlik","Sadece büyük örnek"],
    correct:1, fb:"n→∞ iken hem E(β̂)→β (asimtotik sapmasızlık) hem Var(β̂)→0 olmalı; dağılım gerçek değerin üstünde bir noktaya çöker." },
  { q:"Gauss-Markov teoremi EKK için ne söyler?",
    opts:["EKK tüm tahmin ediciler içinde en iyidir","EKK, doğrusal ve sapmasız tahmin ediciler arasında en küçük varyanslıdır","EKK her zaman tutarlıdır","EKK sapmasız olmak zorunda değildir"],
    correct:1, fb:"DEST/BLUE: belirli varsayımlar altında EKK, doğrusal ve sapmasız tahmin ediciler sınıfı içinde en küçük varyanslı (en iyi) olandır." }
];
function quizInit(){
  var box=document.getElementById("quiz"); if(!box) return;
  QUIZ.forEach(function(item, qi){
    var wrap=document.createElement("div"); wrap.style.marginBottom="1.4rem";
    var q=document.createElement("div"); q.className="q"; q.textContent=(qi+1)+". "+item.q; wrap.appendChild(q);
    var fb=document.createElement("div"); fb.className="fb";
    item.opts.forEach(function(opt, oi){
      var b=document.createElement("button"); b.className="opt"; b.textContent=opt;
      b.addEventListener("click", function(){
        if(wrap.getAttribute("data-done")) return;
        wrap.setAttribute("data-done","1");
        var btns=wrap.querySelectorAll(".opt");
        btns[item.correct].classList.add("correct");
        if(oi!==item.correct) b.classList.add("wrong");
        fb.className="fb show "+(oi===item.correct?"ok":"no");
        fb.textContent=(oi===item.correct?"Doğru. ":"Doğru cevap işaretlendi. ")+item.fb;
      });
      wrap.appendChild(b);
    });
    wrap.appendChild(fb); box.appendChild(wrap);
  });
}

/* ---------- Scrollspy (sidebar) ---------- */
function initScrollSpy(){
  var links=document.querySelectorAll("#sidebar a.navlink");
  var map={}; links.forEach(function(l){ map[l.getAttribute("href").slice(1)]=l; });
  var obs=new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(e.isIntersecting){ links.forEach(function(l){l.classList.remove("active");});
        var l=map[e.target.id]; if(l) l.classList.add("active"); }
    });
  }, {rootMargin:"-40% 0px -55% 0px"});
  document.querySelectorAll("main .section").forEach(function(s){obs.observe(s);});
}

/* ---------- Kaydırıcı etiket güncellemeleri ---------- */
function bindLabel(id, valId, fmt){
  var el=document.getElementById(id), v=document.getElementById(valId);
  function upd(){ v.textContent=fmt(+el.value); }
  el.addEventListener("input", upd); upd();
}

/* ---------- Başlat ---------- */
function init(){
  renderMath();
  setupChartDefaults();
  // Bölüm 1
  s1Init();
  bindLabel("s1n","s1n_v",function(x){return x.toString();});
  bindLabel("s1s","s1s_v",function(x){return tr(x,1);});
  document.getElementById("s1_one").addEventListener("click", function(){s1Draw(1);});
  document.getElementById("s1_many").addEventListener("click", function(){s1Draw(200);});
  document.getElementById("s1_reset").addEventListener("click", s1Reset);
  s1Draw(1);
  // Bölüm 2
  document.getElementById("dart_b").addEventListener("input", dartShoot);
  document.getElementById("dart_s").addEventListener("input", dartShoot);
  document.getElementById("dart_shoot").addEventListener("click", dartShoot);
  document.querySelectorAll(".preset").forEach(function(p){ p.addEventListener("click", function(){dartSetPreset(p);}); });
  dartShoot();
  // Bölüm 3
  s3Init(); bindLabel("s3b","s3b_v",function(x){return tr(x,1);});
  document.getElementById("s3_run").addEventListener("click", s3Run); s3Run();
  // Bölüm 4
  s4Init(); bindLabel("s4v","s4v_v",function(x){return tr(x,2)+"×";});
  document.getElementById("s4_run").addEventListener("click", s4Run); s4Run();
  // Bölüm 5
  s5Init();
  // Bölüm 6
  s6Init();
  document.getElementById("s6v").addEventListener("input", s6Update);
  document.getElementById("s6b").addEventListener("input", s6Update);
  document.getElementById("s6_geri").addEventListener("click", function(){ s6Git(S6.adim-1); });
  document.getElementById("s6_ileri").addEventListener("click", function(){ s6Git(S6.adim+1); });
  ADIMLI.push({ el:document.getElementById("s6_adim"),
    ileri:function(){ if(S6.adim<S6_N){ s6Git(S6.adim+1); return true; } return false; },
    geri:function(){ if(S6.adim>1){ s6Git(S6.adim-1); return true; } return false; } });
  s5AdimInit();
  document.getElementById("s5_geri").addEventListener("click", function(){ s5Git(S5.adim-1); });
  document.getElementById("s5_ileri").addEventListener("click", function(){ s5Git(S5.adim+1); });
  ADIMLI.push({ el:document.getElementById("s5_adim"),
    ileri:function(){ if(S5.adim<S5_N){ s5Git(S5.adim+1); return true; } return false; },
    geri:function(){ if(S5.adim>1){ s5Git(S5.adim-1); return true; } return false; } });
  s5Icerik();
  adimliKur();
  s6Update();
  // Bölüm 7
  s7Init();
  bindLabel("s7n","s7n_v",function(x){return x.toString();});
  document.getElementById("s7_run").addEventListener("click", s7Run);
  document.getElementById("s7_overlay").addEventListener("click", s7Clear); s7Run();
  // Bölüm 8: Asimtotik etkinlik
  saeInit();
  bindLabel("ae_n","ae_n_v",function(x){return x.toString();});
  document.getElementById("ae_run").addEventListener("click", saeRun); saeRun();
  // Bölüm 9: Gauss-Markov
  s8Init(); document.getElementById("s8_run").addEventListener("click", s8Run); s8Run();
  // Bölüm 10: Quiz
  quizInit();
  // Genel
  initScrollSpy();
}
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
