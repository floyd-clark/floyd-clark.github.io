const $ = selector => document.querySelector(selector);
const make = (tag, value, className) => { const el=document.createElement(tag); el.textContent=value; if(className) el.className=className; return el; };
const fmt = value => Number(value).toLocaleString('en-US');
function render(data) {
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
}
fetch('data/public-snapshot.json').then(r=>{if(!r.ok)throw Error('Data unavailable');return r.json();}).then(render).catch(()=>{$('#metrics').textContent='The snapshot could not be loaded. Inspect data/public-snapshot.json directly.';});
