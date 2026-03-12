/** @jsxImportSource hono/jsx */
import { Hono } from "hono";
import type { AppEnv } from "../../index";

export const workspaceChartRoutes = new Hono<AppEnv>();

workspaceChartRoutes.get("/static/charts.js", (c) => {
  // Safe: chart data comes from server-rendered data-* attributes, not user input
  const js = `(function(){
if(typeof Chart==='undefined')return;

var COLORS={
  technical:'#6366f1',content:'#8b5cf6',aiReady:'#3b82f6',perf:'#06b6d4',
  overall:'#6b7280',
  gradeA:'#22c55e',gradeB:'#84cc16',gradeC:'#eab308',gradeD:'#f97316',gradeF:'#ef4444'
};

// ── Count-up animation ──
document.querySelectorAll('[data-count-up]').forEach(function(el){
  var target=parseInt(el.getAttribute('data-count-up'),10);
  if(isNaN(target))return;
  var dur=800,start=performance.now();
  el.textContent='0';
  function tick(now){
    var t=Math.min((now-start)/dur,1);
    var ease=1-Math.pow(1-t,3);
    el.textContent=Math.round(ease*target).toString();
    if(t<1)requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
});

// ── Score bar animation ──
document.querySelectorAll('[data-score-bar]').forEach(function(el){
  var w=el.getAttribute('data-score-bar');
  el.style.width='0%';
  requestAnimationFrame(function(){
    requestAnimationFrame(function(){ el.style.width=w+'%'; });
  });
});

// ── Issue distribution doughnut ──
var distEl=document.getElementById('issue-dist-chart');
if(distEl){
  var d=JSON.parse(distEl.getAttribute('data-chart-data')||'{}');
  var cv=document.createElement('canvas');
  while(distEl.firstChild)distEl.removeChild(distEl.firstChild);
  distEl.appendChild(cv);
  new Chart(cv,{type:'doughnut',data:{
    labels:['Critical','Warning','Info'],
    datasets:[{data:[d.critical||0,d.warning||0,d.info||0],
      backgroundColor:['#ef4444','#eab308','#3b82f6']}]},
    options:{responsive:true,maintainAspectRatio:false,
      animation:{animateRotate:true,animateScale:true,duration:600},
      plugins:{legend:{position:'bottom',labels:{padding:16,usePointStyle:true}},
        tooltip:{callbacks:{label:function(ctx){
          var sum=ctx.dataset.data.reduce(function(a,b){return a+b},0);
          var pct=sum>0?Math.round(ctx.raw/sum*100):0;
          return ctx.label+': '+ctx.raw+' ('+pct+'%)';
        }}}}}});
}

// ── Category breakdown horizontal bar ──
document.querySelectorAll('[data-chart-type="category-breakdown"]').forEach(function(el){
  var cd=JSON.parse(el.getAttribute('data-chart-data')||'null');
  if(!cd)return;
  var cv=document.createElement('canvas');
  while(el.firstChild)el.removeChild(el.firstChild);
  el.appendChild(cv);
  new Chart(cv,{type:'bar',data:{
    labels:['Technical','Content','AI Readiness','Performance'],
    datasets:[{data:[cd.technical||0,cd.content||0,cd.aiReadiness||0,cd.performance||0],
      backgroundColor:[COLORS.technical,COLORS.content,COLORS.aiReady,COLORS.perf],
      borderRadius:4,barPercentage:0.7}]},
    options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,
      animation:{duration:800,easing:'easeOutCubic'},
      scales:{x:{min:0,max:100,grid:{display:false}},y:{grid:{display:false}}},
      plugins:{legend:{display:false},
        tooltip:{callbacks:{label:function(ctx){return ctx.raw+'/100'}}}}}});
});

// ── Grade distribution horizontal bar ──
var gradeEl=document.getElementById('grade-dist-chart');
if(gradeEl){
  var gd=JSON.parse(gradeEl.getAttribute('data-chart-data')||'null');
  if(gd){
    var cv3=document.createElement('canvas');
    while(gradeEl.firstChild)gradeEl.removeChild(gradeEl.firstChild);
    gradeEl.appendChild(cv3);
    new Chart(cv3,{type:'bar',data:{
      labels:['A (90+)','B (80-89)','C (70-79)','D (60-69)','F (<60)'],
      datasets:[{data:[gd.A||0,gd.B||0,gd.C||0,gd.D||0,gd.F||0],
        backgroundColor:[COLORS.gradeA,COLORS.gradeB,COLORS.gradeC,COLORS.gradeD,COLORS.gradeF],
        borderRadius:4,barPercentage:0.7}]},
      options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,
        animation:{duration:800,easing:'easeOutCubic'},
        scales:{x:{beginAtZero:true,ticks:{stepSize:1},grid:{display:false}},y:{grid:{display:false}}},
        plugins:{legend:{display:false}}}});
  }
}

// ── Score trend line chart ──
var trendEl=document.getElementById('score-trend-chart');
if(trendEl){
  var td=JSON.parse(trendEl.getAttribute('data-chart-data')||'null');
  if(td){
    var cv2=document.getElementById('score-trend-canvas');
    if(cv2){
      var datasets=[{label:'Overall',data:td.scores,
        borderColor:COLORS.overall,backgroundColor:'rgba(107,114,128,0.05)',
        fill:true,tension:0.3,pointRadius:4,borderWidth:2}];
      if(td.technical){
        datasets.push({label:'Technical',data:td.technical,borderColor:COLORS.technical,
          borderDash:[5,3],tension:0.3,pointRadius:2,borderWidth:1.5,fill:false});
        datasets.push({label:'Content',data:td.content,borderColor:COLORS.content,
          borderDash:[5,3],tension:0.3,pointRadius:2,borderWidth:1.5,fill:false});
        datasets.push({label:'AI Readiness',data:td.aiReadiness,borderColor:COLORS.aiReady,
          borderDash:[5,3],tension:0.3,pointRadius:2,borderWidth:1.5,fill:false});
        datasets.push({label:'Performance',data:td.performance,borderColor:COLORS.perf,
          borderDash:[5,3],tension:0.3,pointRadius:2,borderWidth:1.5,fill:false});
      }
      new Chart(cv2,{type:'line',data:{labels:td.labels,datasets:datasets},
        options:{responsive:true,maintainAspectRatio:false,
          animation:{duration:800,easing:'easeOutCubic'},
          interaction:{mode:'index',intersect:false},
          scales:{y:{min:0,max:100}},
          plugins:{legend:{display:datasets.length>1,position:'bottom',
            labels:{usePointStyle:true,padding:12}},
            tooltip:{mode:'index',intersect:false}}}});
    }
  }
}

})();`;
  return c.body(js, 200, {
    "Content-Type": "application/javascript",
    "Cache-Control": "public, max-age=3600",
  });
});


