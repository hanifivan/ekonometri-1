/* ============================================================
   EKK Tahmin Edicilerinin Özellikleri — İnteraktif Ders Notu
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
   BÖLÜM 1 — Yenilemeli örnekleme motoru
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
   BÖLÜM 2 — Hedef tahtası
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
   BÖLÜM 3 — Sapmasızlık (sapmasız vs sapmalı)
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
   BÖLÜM 4 — En küçük varyans / etkinlik
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
   BÖLÜM 5 — Doğrusallık (ağırlıklar k_i)
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
   BÖLÜM 6 — OHK ayrışımı
   ============================================================ */
var S6={dist:null, bar:null};
function normalPts(mu, sigma, lo, hi, steps){
  var pts=[]; for(var i=0;i<=steps;i++){ var x=lo+(hi-lo)*i/steps;
    var y=Math.exp(-0.5*Math.pow((x-mu)/sigma,2))/(sigma*Math.sqrt(2*Math.PI)); pts.push({x:x,y:y}); } return pts;
}
function s6Init(){
  var dctx=document.getElementById("s6dist").getContext("2d");
  S6.dist=new Chart(dctx,{ type:"line",
    data:{ datasets:[{label:"β̂ dağılımı", data:[], borderColor:C.primary, backgroundColor:C.primarySoft, fill:true, tension:.3, pointRadius:0, borderWidth:2}]},
    options:{ maintainAspectRatio:false, parsing:false, scales:{
      x:{type:"linear", min:-1, max:5, title:{display:true,text:"tahmin"}, grid:{color:C.grid}},
      y:{ticks:{display:false}, grid:{color:C.grid}} },
      plugins:{legend:{display:false}} },
    plugins:[trueLinePlugin(function(){return TRUE_B1;},"gerçek β")]
  });
  var bctx=document.getElementById("s6bar").getContext("2d");
  S6.bar=new Chart(bctx,{ type:"bar",
    data:{ labels:["OHK bileşenleri"], datasets:[
      {label:"Varyans", data:[0], backgroundColor:C.primary},
      {label:"Sapma²", data:[0], backgroundColor:C.accent} ]},
    options:{ maintainAspectRatio:false, scales:{
      x:{stacked:true, grid:{display:false}},
      y:{stacked:true, title:{display:true,text:"katkı"}, grid:{color:C.grid}, beginAtZero:true} },
      plugins:{legend:{position:"top"}} }
  });
}
function s6Update(){
  var vComp=+document.getElementById("s6v").value, bias=+document.getElementById("s6b").value;
  var sigma=Math.sqrt(vComp);
  S6.dist.data.datasets[0].data=normalPts(TRUE_B1+bias, sigma, -1, 5, 120);
  S6.dist.update();
  S6.bar.data.datasets[0].data=[vComp];
  S6.bar.data.datasets[1].data=[bias*bias];
  S6.bar.update();
  document.getElementById("s6_var").textContent=tr(vComp);
  document.getElementById("s6_bias2").textContent=tr(bias*bias);
  document.getElementById("s6_mse").textContent=tr(vComp+bias*bias);
  document.getElementById("s6v_v").textContent=tr(vComp);
  document.getElementById("s6b_v").textContent=tr(bias);
}

/* ============================================================
   BÖLÜM 7 — Tutarlılık (n büyüdükçe)
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
   BÖLÜM 8 — Asimtotik etkinlik (tüm veri vs yarım veri)
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
   BÖLÜM 9 — Gauss-Markov (EKK vs alternatif)
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
   BÖLÜM 9 — Quiz
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
  document.getElementById("s6b").addEventListener("input", s6Update); s6Update();
  // Bölüm 7
  s7Init();
  bindLabel("s7n","s7n_v",function(x){return x.toString();});
  document.getElementById("s7_run").addEventListener("click", s7Run);
  document.getElementById("s7_overlay").addEventListener("click", s7Clear); s7Run();
  // Bölüm 8 — Asimtotik etkinlik
  saeInit();
  bindLabel("ae_n","ae_n_v",function(x){return x.toString();});
  document.getElementById("ae_run").addEventListener("click", saeRun); saeRun();
  // Bölüm 9 — Gauss-Markov
  s8Init(); document.getElementById("s8_run").addEventListener("click", s8Run); s8Run();
  // Bölüm 10 — Quiz
  quizInit();
  // Genel
  initScrollSpy();
}
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
