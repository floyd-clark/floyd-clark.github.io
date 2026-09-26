const $ = selector => document.querySelector(selector);
const make = (tag, value, className) => { const el=document.createElement(tag); el.textContent=value; if(className) el.className=className; return el; };
const fmt = value => Number(value).toLocaleString('en-US');
const svgNode=(tag,attrs={},label)=>{const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value] of Object.entries(attrs))el.setAttribute(key,String(value));if(label!==undefined)el.textContent=label;return el;};
function plot(container, series, maxX, maxY, xLabels, yTitle){
  const svg=svgNode('svg',{viewBox:'0 0 720 310',preserveAspectRatio:'xMidYMid meet',focusable:'false'}), left=59,top=18,width=570,height=220;
  const X=x=>left+x/maxX*width, Y=y=>top+height-y/maxY*height;
  for(let i=0;i<=4;i++){const val=maxY*i/4,y=Y(val);svg.append(svgNode('line',{x1:left,y1:y,x2:left+width,y2:y,class:'plot-grid'}),svgNode('text',{x:left-12,y:y+4,'text-anchor':'end',class:'plot-tick'},val<10?val.toFixed(1):Math.round(val)));}
  xLabels.forEach(([v,label])=>svg.append(svgNode('text',{x:X(v),y:top+height+24,'text-anchor':'middle',class:'plot-tick'},label)));
  svg.append(svgNode('text',{x:2,y:13,class:'plot-title'},yTitle));
  series.forEach(line=>{if(line.low){const upper=line.high.map((v,t)=>`${X(t)},${Y(v)}`),lower=line.low.map((_,t)=>`${X(maxX-t)},${Y(line.low[maxX-t])}`);svg.append(svgNode('polygon',{points:[...upper,...lower].join(' '),fill:line.color,opacity:'.12'}));}});
  series.forEach((line,i)=>{const points=line.values.map((v,t)=>`${X(t)},${Y(v)}`).join(' ');svg.append(svgNode('polyline',{points,fill:'none',stroke:line.color,'stroke-width':i===1?3:2,'stroke-dasharray':i===0?'5 5':'none'}));svg.append(svgNode('circle',{cx:X(maxX),cy:Y(line.values[maxX]),r:4,fill:line.color}));svg.append(svgNode('text',{x:X(maxX)+7,y:Y(line.values[maxX])+4,class:'plot-end',fill:line.color},line.values[maxX].toFixed(maxY<10?2:0)));});
  container.replaceChildren(svg);
  const legend=make('div','','plot-legend');series.forEach(line=>{const item=make('span',line.name);item.style.setProperty('--legend-color',line.color);legend.append(item);});container.append(legend);
}
function renderFunnel(data){
  const h=$('#hourglass');
  const row=(label,value,width,kind)=>{const item=make('div','','hourglass-row '+kind);const bar=make('div','','hourglass-bar');bar.style.width=`${Math.max(12,width)}%`;bar.append(make('span',`${label} · ${fmt(value)}`));item.append(bar);h.append(item);};
  h.append(make('p','LINKEDIN · Sep 19–25','funnel-label'));
  row('Impressions',data.linkedin.impressions,100,'attention');row('Members reached',data.linkedin.reached,72,'attention');row('Engagement actions',data.linkedin.engagements,37,'attention');
  h.append(make('div','ATTRIBUTION UNKNOWN · no matched person-level path','hourglass-gap'));
  h.append(make('p','ROLE TRACKER · Sep 25','funnel-label'));
  row('Applied',data.pipeline.confirmedApplications,59,'pipeline');row('Active roles',data.pipeline.active,100,'pipeline');
  const list=$('#role-funnel');
  const stages=Object.entries(data.pipeline.stages).sort((a,b)=>b[1]-a[1]);
  for(const [stage,count] of stages){const item=make('div','','funnel-row');item.append(make('span',stage));const track=make('div','','funnel-track'),bar=make('div','','funnel-bar');bar.style.width=`${100*count/data.pipeline.active}%`;track.append(bar);item.append(track,make('strong',`${count} · ${Math.round(100*count/data.pipeline.active)}%`));list.append(item);}
  list.append(make('p',`Denominator: ${data.pipeline.active} active records. Stages total ${stages.reduce((n,[,v])=>n+v,0)}. Closed records excluded.`,'chart-caption'));
}
function renderBrief(data){
  const brief=data.changeBrief;
  const entries=[['Changed',brief.changed],['Unchanged / scope',brief.unchanged],['Weak signals',brief.weakSignals],['Forecast change',[brief.forecastChange]],['Best use of time',[brief.bestUseOfTime]]];
  if(brief.strongSignals.length) entries.splice(2,0,['Strong signals',brief.strongSignals]);
  for(const [title,items] of entries){const card=make('article','','card brief-card');card.append(make('h3',title));for(const item of items)card.append(make('p',item));$('#daily-brief').append(card);}
  const chart=$('#history-chart');
  for(const point of data.history){const row=make('div','','history-row');row.append(make('span',point.date));for(const [label,value] of [['Active',point.active],['Applied',point.applied],['Closed',point.closed]]){const block=make('span',`${label} ${value}`,'history-value');block.style.setProperty('--share',`${Math.round(value/Math.max(...data.history.map(d=>d.active))*100)}%`);row.append(block);}chart.append(row);}
  const bands={};for(const j of data.pipeline.journeys)bands[j.lastTouch]=(bands[j.lastTouch]||0)+1;
  for(const [label,count] of Object.entries(bands).sort((a,b)=>a[0].localeCompare(b[0]))){const row=make('div','','funnel-row');row.append(make('span',label));const track=make('div','','funnel-track'),bar=make('div','','funnel-bar');bar.style.width=`${100*count/data.pipeline.active}%`;track.append(bar);row.append(track,make('strong',`${count} / ${data.pipeline.active}`));$('#aging-chart').append(row);}
}
function renderModels(data){
  const controls=()=>{
    const cohort=$('#forecast-cohort').value,n=data.pipeline.stages[cohort],q=Number($('#daily-rate').value)/100;
    $('#rate-value').textContent=`${(q*100).toFixed(1)}% / day · ${n} roles`;
    const rates=[q/2,q,Math.min(q*2,1)],colors=['#77a7b9','#b6e9c7','#efbb75'];
    const series=rates.map((rate,i)=>({name:`${['½×','1×','2×'][i]} assumed rate`,color:colors[i],values:Array.from({length:8},(_,t)=>n*(1-(1-rate)**t))}));
    const max=Math.max(0.5,Math.ceil(series[2].values[7]*2)/2);
    plot($('#short-plot'),series,7,max,[[0,'Sep 26'],[2,'Sep 28'],[4,'Sep 30'],[7,'Oct 3']],'EXPECTED RESPONSES · sensitivity only');
  };
  $('#forecast-cohort').addEventListener('change',controls);$('#daily-rate').addEventListener('input',controls);controls();
  const bands=data.forecast.scenario.bands,colors=['#77a7b9','#b6e9c7','#efbb75'];
  const series=bands.map((band,i)=>{const [lo,hi]=band.range.split('–').map(Number),endpoint=(lo+hi)/2;return {name:`${band.name} · ${band.range} at 2032`,color:colors[i],values:Array.from({length:7},(_,t)=>100*(endpoint/100)**(t/6)),low:Array.from({length:7},(_,t)=>100*(lo/100)**(t/6)),high:Array.from({length:7},(_,t)=>100*(hi/100)**(t/6))};});
  plot($('#long-plot'),series,6,240,[[0,'2026'],[2,'2028'],[4,'2030'],[6,'2032']],'INDEX · 2026 = 100');
}
function render(data) {
  renderBrief(data);
  const metrics=[
    ['Active roles',data.pipeline.active,'Tracker · Sep 25'],
    ['Confirmed applications',data.pipeline.confirmedApplications,'Subset of active roles'],
    ['LinkedIn impressions',fmt(data.linkedin.impressions),'Sep 19–25 · repeated displays'],
    ['Members reached',fmt(data.linkedin.reached),'Sep 19–25 · unique members'],
    ['Engagement actions',data.linkedin.engagements,'Sum of daily actions'],
    ['New followers',data.linkedin.newFollowers,'Sep 19–25']
  ];
  for(const [label,value,note] of metrics){const card=make('article','','metric');card.append(make('span',label,'metric-label'),make('strong',String(value)),make('small',note));$('#metrics').append(card);}
  const stageOrder=['Applied','Referral requested','Recruiter outreach','Applying','Targeting','Needs confirmation'];
  for(const stage of stageOrder){const card=make('div','','stage-card');card.append(make('strong',String(data.pipeline.stages[stage]||0)),make('span',stage));$('#stages').append(card);}
  renderFunnel(data);
  const journeys=data.pipeline.journeys;
  const stages=[...new Set(journeys.map(j=>j.stage))], families=[...new Set(journeys.map(j=>j.family))].sort();
  for(const [selector,values] of [['#stage-filter',stages],['#family-filter',families]]) for(const value of values){const option=make('option',value);option.value=value;$(selector).append(option);}
  function drawRows(){
    const stage=$('#stage-filter').value, family=$('#family-filter').value;
    const visible=journeys.filter(j=>(stage==='All'||j.stage===stage)&&(family==='All'||j.family===family));
    $('#role-rows').replaceChildren();
    for(const j of visible){const tr=make('tr','');for(const [value,cls] of [[j.id,'mono'],[j.family,''],[j.stage,''],[j.lastTouch,''],[j.evidence,'']])tr.append(make('td',value,cls));$('#role-rows').append(tr);}
    $('#result-count').textContent=`${visible.length} of ${journeys.length} active roles`;
  }
  $('#stage-filter').addEventListener('change',drawRows);$('#family-filter').addEventListener('change',drawRows);drawRows();
  const max=Math.max(...data.linkedin.days.map(d=>d.impressions));
  for(const d of data.linkedin.days){
    const row=make('div','','trend-row');
    row.append(make('span',d.date,'trend-date'));
    const track=make('div','','trend-track'),bar=make('div','','trend-bar');bar.style.width=`${100*d.impressions/max}%`;track.append(bar);row.append(track);
    row.append(make('strong',fmt(d.impressions),'trend-value'),make('small',`${d.engagements} actions · +${d.followers} followers`,'trend-note'));
    $('#trend').append(row);
  }
  const f=data.forecast;
  renderModels(data);
  $('#forecast-meta').textContent=`Issued ${f.createdAt.slice(0,10)} · Window ${f.window} · ${f.modelVersion} · ${f.status}`;
  for(const item of f.cards){
    const card=make('article','','forecast-card');
    card.append(make('span',`${item.id} · ${f.status}`,'forecast-id'),make('h3',item.title),make('p',item.target,'forecast-target'));
    const details=make('dl','','forecast-details');
    for(const [label,value] of [['Supporting evidence',item.support],['Counterevidence',item.against],['Verification rule',item.change],['Outcome',item.outcome]])details.append(make('dt',label),make('dd',value));
    card.append(details);$('#forecast-cards').append(card);
  }
  for(const band of f.scenario.bands){
    const card=make('article','','scenario-card');card.append(make('span',band.name,'forecast-id'),make('strong',band.range),make('small',`2032 index · ${f.scenario.base}`),make('p',band.meaning));$('#scenario-cards').append(card);
  }
}
fetch('data/public-snapshot.json?v=15').then(r=>{if(!r.ok)throw Error('Data unavailable');return r.json();}).then(render).catch(error=>{$('#metrics').textContent='The snapshot could not be loaded. Inspect data/public-snapshot.json directly.';console.error(error);});
