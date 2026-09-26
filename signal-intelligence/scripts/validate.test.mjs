import assert from 'node:assert/strict';
import {validateEvidenceGraph} from './validate.mjs';
import {assess} from './evidence.mjs';

const graph={events:[{id:'EVT-006',domain:'hiring',entity:'role-a',version:2}],evidence:[{id:'EVD-009',eventId:'EVT-006',domain:'technical',entity:'role-a',source:'telemetry',observedAt:'2026-09-25',eventVersion:1}],signals:[{id:'SIG-003',domain:'hiring',entity:'role-a',supportingEvidenceIds:['EVD-009'],contradictingEvidenceIds:['EVD-009'],alternativeExplanation:'Ordinary ATS timing',expiresAt:'2026-10-01'}]};
const issues=validateEvidenceGraph(graph);
assert(issues.some(x=>x.includes('unexplained dual-role')));
assert(issues.some(x=>x.includes('unrelated evidence')));
graph.evidence[0].domain='hiring';
assert(validateEvidenceGraph(graph).some(x=>x.includes('stale event version')));
graph.signals[0].contradictingEvidenceIds=[];
graph.evidence[0].eventVersion=2;
assert.deepEqual(validateEvidenceGraph(graph),[]);
assert.equal(assess({id:'S',type:'profile_view'},[{signalId:'S',polarity:'support',sourceType:'profile_view',independentSourceId:'one',observedAt:'2026-09-20'}],new Date('2026-09-26')).status,'stale');
assert.equal(assess({id:'S',type:'interview'},[{signalId:'S',polarity:'support',sourceType:'direct_human',independentSourceId:'recruiter',observedAt:'2026-09-26'}],new Date('2026-09-26')).support,'strong');
console.log('Evidence integrity and ordinal decay checks passed.');
