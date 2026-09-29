import assert from 'node:assert/strict';
import {DEFAULT_CASE,DEFAULT_MATERIALS,analyzeCase,assessMaterial,blankMaterial,copy,illustrativeDomain,waterDewPoint} from '../engine.mjs';

const initial=analyzeCase(DEFAULT_CASE);
assert.equal(initial.errors.length,0);
assert.equal(initial.stages.length,6);
assert.equal(initial.stages[0].pH2S,2.72*.30);
assert.ok(Math.abs(initial.stages[0].dewMargin-(initial.stages[0].temperature-initial.stages[0].dew))<1e-9);
assert.equal(illustrativeDomain(initial.stages[0].pH2S,3.91),'D3');
assert.equal(assessMaterial(DEFAULT_CASE,initial,DEFAULT_MATERIALS[0]).status,'missing');
assert.ok(waterDewPoint(.023)>15 && waterDewPoint(.023)<25);

const project=copy(DEFAULT_CASE);
project.designBasis='TEST ONLY – process basis rev 1';
project.stages=project.stages.slice(0,2);
project.stages[0].phBasis='validated';
project.stages[0].rate='.05';
project.stages[0].rateBasis='validated';
project.conditions={...project.conditions,mdmt:'-30',chloride:'5',oxygen:'1',mercury:'0',droplet:'0',
  sopPressure:'2',sopTemperature:'50',sopH2o:'.1',sopH2S:'10',sopCO2:'5',sopWater:'no'};
const candidate={...blankMaterial('test-only'),component:'Casing / suction',name:'TEST ONLY candidate',surface:'test surface',form:'test plate',
  verified:true,source:'TEST ONLY source',minTempC:'-40',maxTempC:'150',maxH2SBar:'1',maxCO2Bar:'1',maxDryH2SBar:'2',
  minPH:'3',maxChloridePpmv:'10',maxOxygenPpmv:'2',maxRateMmY:'.1',allowableLossMm:'2'};
const check=(data=project,material=candidate)=>assessMaterial(data,analyzeCase(data),material);
assert.equal(check().status,'conditional');

const chloride=copy(project);chloride.conditions.chloride='11';
assert.equal(check(chloride).status,'outside');
assert.ok(check(chloride).failures.some(v=>v.includes('chloride')));
const lowTemperature=copy(project);lowTemperature.conditions.mdmt='-50';
assert.equal(check(lowTemperature).status,'outside');
const overRate=copy(project);overRate.stages[0].rate='.2';
assert.equal(check(overRate).status,'outside');
const dryLimit={...candidate,maxDryH2SBar:'.1'};
assert.equal(check(project,dryLimit).status,'outside');
const missingPH=copy(project);missingPH.stages[0].phBasis='example';
assert.equal(check(missingPH).status,'missing');
const nearDew=copy(project);nearDew.stages[1].temperature='25';
assert.ok(check(nearDew).missing.some(v=>v.includes('Stage 2 is declared dry')));
nearDew.stages[1].waterBasis='TEST dry-condition study';
assert.equal(check(nearDew).status,'conditional');
const wetSOP=copy(project);wetSOP.conditions.sopWater='yes';
assert.equal(check(wetSOP).status,'missing');
const wetSOPBreached=copy(wetSOP);wetSOPBreached.conditions.sopH2S='80';
const wetSOPLimit={...candidate,maxH2SBar:'.5'};
assert.equal(check(wetSOPBreached,wetSOPLimit).status,'outside');
assert.ok(check(wetSOPBreached,wetSOPLimit).failures.some(v=>v.includes('SOP pH₂S')));
wetSOP.conditions.sopPH='4';wetSOP.conditions.sopPHBasis='validated';
wetSOP.conditions.sopRate='.03';wetSOP.conditions.sopRateBasis='validated';
assert.equal(check(wetSOP).status,'conditional');
const incomplete=copy(project);incomplete.stages[0].pressure='';
assert.equal(analyzeCase(incomplete).errors.length>0,true);
assert.equal(check(incomplete).status,'missing');
const invalidCondition=copy(project);invalidCondition.conditions.chloride='-1';
assert.ok(analyzeCase(invalidCondition).errors.some(e=>e.includes('chlorides')));
console.log('Engine checks passed: partial pressures, domains, missing evidence, conditional and outside-limit results.');
