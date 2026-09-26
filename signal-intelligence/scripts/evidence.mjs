// Ordinal evidence assessment. These labels describe support, never odds of hiring.
export const sourceRank = Object.freeze({official_ats:3,direct_human:3,employer_site:3,official_social:2,linkedin_post:2,aggregator:1,profile_view:1,unknown:0});
export function assess(signal, evidence, asOf=new Date()) {
  const usable=evidence.filter(e=>e.signalId===signal.id && e.polarity==='support' && !e.retracted);
  const contrary=evidence.filter(e=>e.signalId===signal.id && e.polarity==='contradict' && !e.retracted);
  const unique=new Set(usable.map(e=>e.independentSourceId).filter(Boolean));
  const authority=Math.max(0,...usable.map(e=>sourceRank[e.sourceType]||0));
  const age=usable.length?Math.min(...usable.map(e=>(asOf-new Date(e.observedAt))/86400000)):Infinity;
  const decay=signal.decayDays ?? (signal.type==='profile_view'?2:signal.type==='referral'?14:21);
  const status=age>decay?'stale':age>decay/2?'aging':'current';
  const support=contrary.length?'contested':!usable.length?'insufficient evidence':authority===3&&unique.size>=1?'strong':authority>=2&&unique.size>=2?'moderate':'weak';
  return {support,status,independentSources:unique.size,sourceAuthority:authority,ageDays:Number.isFinite(age)?Math.max(0,Math.floor(age)):null,contradictions:contrary.length,reason:contrary.length?'Contradiction requires review':status==='stale'?'Evidence expired for action triage':'Ordinal support, not a probability'};
}
