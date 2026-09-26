// Engineering screening helpers. Material limits are supplied by the user;
// no grade is approved solely because of its name or a plotted SSC domain.
export const COMPONENTS = [
  'Casing / suction', 'Suction cover', 'Discharge cover', 'Inlet plenum',
  'Discharge scroll', 'Shaft', 'First impeller', 'Later impellers',
  'Balance drum', 'Labyrinths',
];

const examples = [
  ['Casing / suction', 'ASTM A350 LF2 + Alloy 625 overlay'],
  ['Casing / suction', 'ASTM A350 LF2 (bare)'],
  ['Suction cover', 'ASTM A350 LF2 + Alloy 625 overlay'],
  ['Discharge cover', 'ASTM A350 LF2'],
  ['Inlet plenum', 'Alloy 625'],
  ['Discharge scroll', 'ASTM A352 LCB Mod'],
  ['Shaft', 'ASTM A322 Type 4140'],
  ['Shaft', 'Alloy 718'],
  ['First impeller', 'Alloy 718'],
  ['First impeller', 'ASTM A182 F22'],
  ['Later impellers', 'ASTM A182 F22'],
  ['Balance drum', 'ASTM A182 F22'],
  ['Labyrinths', 'AA6082'],
];

export const MATERIAL_FIELDS = [
  ['minTempC', 'Minimum metal temperature', '°C'],
  ['maxTempC', 'Maximum operating temperature', '°C'],
  ['maxH2SBar', 'Maximum wet pH₂S', 'bar'],
  ['maxCO2Bar', 'Maximum wet pCO₂', 'bar'],
  ['maxDryH2SBar', 'Maximum dry pH₂S', 'bar'],
  ['minPH', 'Minimum aqueous pH', 'pH'],
  ['maxChloridePpmv', 'Maximum chloride', 'ppmv'],
  ['maxOxygenPpmv', 'Maximum oxygen', 'ppmv'],
  ['maxMercuryNgNm3', 'Maximum mercury', 'ng/Nm³'],
  ['maxDropletUm', 'Maximum entrained droplet', 'μm'],
  ['maxRateMmY', 'Maximum accepted corrosion rate', 'mm/y'],
  ['allowableLossMm', 'Maximum accepted life loss', 'mm'],
  ['maxHardnessHRC', 'Maximum hardness', 'HRC'],
];

export const blankMaterial = (id = `mat-${Date.now()}`) => ({
  id, component: COMPONENTS[0], name: '', form: '', surface: '',
  source: '', verified: false, notes: '', measuredHardnessHRC: '',
  ...Object.fromEntries(MATERIAL_FIELDS.map(([field]) => [field, ''])),
});

export const DEFAULT_MATERIALS = examples.map(([component, name], i) => ({
  ...blankMaterial(`example-${i + 1}`), component, name,
  surface: name.includes('overlay') ? 'Alloy 625 overlay (verify wetted surface)' : name,
  notes: 'Example name only. Add verified service limits and supporting documents before assessment.',
}));

export const DEFAULT_CASE = {
  title: 'Example operating case',
  designBasis: '',
  stages: [
    [2.72, 28.1], [3.92, 47.8], [5.52, 66.9],
    [7.72, 86], [10.7, 105.5], [14.59, 124.9],
  ].map(([pressure, temperature], i) => ({
    pressure: String(pressure), temperature: String(temperature), h2o: '0.922',
    co2: '5', h2s: '30', water: i === 0 ? 'yes' : 'no',
    ph: ['3.91', '3.89', '3.87', '3.85', '3.82', '3.75'][i],
    phBasis: 'example', rate: '', rateBasis: 'unknown',
  })),
  conditions: {
    mdmt: '', chloride: '', oxygen: '', mercury: '', droplet: '',
    serviceYears: '20', sopPressure: '', sopTemperature: '', sopH2o: '', sopH2S: '', sopCO2: '',
    sopWater: 'unknown', sopPH: '', sopPHBasis: 'unknown', sopRate: '', sopRateBasis: 'unknown',
  },
  selected: Object.fromEntries(COMPONENTS.map(component=>[component,DEFAULT_MATERIALS.find(m=>m.component===component)?.id||''])),
};

export const copy = value => JSON.parse(JSON.stringify(value));

function requiredNumber(value, label, min, max, errors) {
  if (String(value ?? '').trim() === '') { errors.push(`${label} is required`); return null; }
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) { errors.push(`${label} must be between ${min} and ${max}`); return null; }
  return n;
}

function optionalNumber(value, label, min, max, errors) {
  if (String(value ?? '').trim() === '') return null;
  return requiredNumber(value, label, min, max, errors);
}

export function waterDewPoint(pH2O) {
  if (!Number.isFinite(pH2O) || pH2O <= 0) return null;
  const dew = 1730.63 / (8.07131 - Math.log10(pH2O * 750.062)) - 233.426;
  return Number.isFinite(dew) && dew >= 0 && dew <= 100 ? dew : null;
}

// Reconstructed schematic from the user-supplied plot. Not ISO 15156 limits.
export function illustrativeDomain(pH2S, ph) {
  if (!Number.isFinite(ph) || ph < 2.5 || ph > 7.5 || pH2S <= 0) return null;
  if (pH2S < 0.003) return 'D0';
  const log = Math.log10(Math.max(pH2S, 0.003));
  const upper = Math.min(6.5, 4 + 1.0 * (log - Math.log10(0.003)));
  const lower = Math.min(5.5, 3.5 + 1.0 * (log - Math.log10(0.01)));
  if (ph >= upper) return 'D1';
  if (ph >= lower) return 'D2';
  return 'D3';
}

export function analyzeCase(data) {
  const errors = [], stages = [];
  if (!Array.isArray(data?.stages) || data.stages.length < 1 || data.stages.length > 12) {
    return {errors:['Enter between 1 and 12 stages'],stages:[],sop:null};
  }
  data.stages.forEach((s, index) => {
    const label = `Stage ${index + 1}`;
    const pressure = requiredNumber(s.pressure,`${label} pressure`,0.000001,1000,errors);
    const temperature = requiredNumber(s.temperature,`${label} temperature`,-100,500,errors);
    const h2o = requiredNumber(s.h2o,`${label} H₂O %`,0,100,errors);
    const co2 = requiredNumber(s.co2,`${label} CO₂ %`,0,100,errors);
    const h2s = requiredNumber(s.h2s,`${label} H₂S %`,0,100,errors);
    const ph = optionalNumber(s.ph,`${label} aqueous pH`,0,14,errors);
    const rate = optionalNumber(s.rate,`${label} corrosion rate`,0,100,errors);
    if (![h2o,co2,h2s].includes(null) && h2o+co2+h2s>100.00001) errors.push(`${label}: H₂O + CO₂ + H₂S exceeds 100%`);
    if (!['yes','no','unknown'].includes(s.water)) errors.push(`${label}: choose a liquid-water status`);
    const pH2S=pressure==null||h2s==null?null:pressure*h2s/100;
    const pCO2=pressure==null||co2==null?null:pressure*co2/100;
    const pH2O=pressure==null||h2o==null?null:pressure*h2o/100;
    stages.push({id:index+1,...s,pressure,temperature,h2o,co2,h2s,ph,rate,pH2S,pCO2,pH2O,
      dew:pH2O==null?null:waterDewPoint(pH2O),
      domain:pH2S==null?null:illustrativeDomain(pH2S,ph),
      phBasis:s.phBasis || 'unknown',rateBasis:s.rateBasis || 'unknown'});
  });
  const c=data.conditions||{};
  let sop=null;
  if (String(c.sopPressure??'').trim()!=='' || String(c.sopTemperature??'').trim()!=='' || String(c.sopH2o??'').trim()!=='') {
    const pressure=requiredNumber(c.sopPressure,'SOP pressure',0.000001,1000,errors);
    const temperature=requiredNumber(c.sopTemperature,'SOP temperature',-100,500,errors);
    const h2o=requiredNumber(c.sopH2o,'SOP H₂O %',0,100,errors);
    const h2s=requiredNumber(c.sopH2S,'SOP H₂S %',0,100,errors);
    const co2=requiredNumber(c.sopCO2,'SOP CO₂ %',0,100,errors);
    if (![h2o,h2s,co2].includes(null) && h2o+h2s+co2>100.00001) errors.push('SOP H₂O + H₂S + CO₂ exceeds 100%');
    if (![pressure,temperature,h2o,h2s,co2].includes(null)) sop={pressure,temperature,h2o,h2s,co2,pH2O:pressure*h2o/100,pH2S:pressure*h2s/100,pCO2:pressure*co2/100,dew:waterDewPoint(pressure*h2o/100)};
  }
  return {errors,stages:errors.length?[]:stages,sop:errors.length?null:sop};
}

const present = value => String(value??'').trim()!=='' && Number.isFinite(Number(value));
const labelNumber = (value, unit) => `${Number(value).toLocaleString(undefined,{maximumFractionDigits:3})}${unit?' '+unit:''}`;

export function assessMaterial(data, analysis, material) {
  const failures=[], missing=[], checks=[];
  const fail = text => failures.push(text);
  const need = text => missing.push(text);
  const ok = text => checks.push(text);
  if (!material) {need('Select a material for this component.');return {status:'missing',failures,missing,checks};}
  if (analysis.errors.length) {need('Correct stage inputs before assessment.');return {status:'missing',failures,missing,checks};}
  if (!material.verified || !String(material.source||'').trim()) need('Add a verified material service basis and its document reference.');
  else ok(`Material evidence: ${material.source}`);
  if (!String(material.form||'').trim()) need('Record the qualified product form and material condition.');
  if (!String(material.surface||'').trim()) need('Record the actual exposed surface.');
  if (!String(data.designBasis||'').trim()) need('Enter the project design-basis reference.');
  const c=data.conditions;
  const minTemp=present(c.mdmt)?Number(c.mdmt):null;
  const maxTemp=Math.max(...analysis.stages.map(s=>s.temperature),analysis.sop?.temperature??-Infinity);
  if (minTemp==null) need('Enter MDMT.');
  if (!present(material.minTempC)) need('Add the material minimum qualified temperature.');
  else if (minTemp!=null) Number(material.minTempC)>minTemp
    ? fail(`MDMT ${labelNumber(minTemp,'°C')} is below the material minimum ${labelNumber(material.minTempC,'°C')}.`)
    : ok('MDMT is inside the recorded material range.');
  if (!present(material.maxTempC)) need('Add the material maximum qualified temperature.');
  else if (maxTemp>Number(material.maxTempC)) fail(`Stage temperature ${labelNumber(maxTemp,'°C')} exceeds material maximum ${labelNumber(material.maxTempC,'°C')}.`);
  else ok('All stage temperatures are inside the recorded material range.');

  const wet=analysis.stages.filter(s=>s.water==='yes');
  const dry=analysis.stages.filter(s=>s.water==='no');
  const uncertain=analysis.stages.filter(s=>s.water==='unknown');
  if (uncertain.length) need(`Confirm liquid water at stages ${uncertain.map(s=>s.id).join(', ')}.`);
  if (c.sopWater==='unknown' || !['yes','no'].includes(c.sopWater)) need('Confirm liquid water during settled-out / standstill conditions.');
  if (!analysis.sop) need('Enter SOP pressure, temperature and H₂O % to review cooldown.');
  if (analysis.sop && c.sopWater==='no' && analysis.sop.dew!=null && analysis.sop.temperature<analysis.sop.dew+10)
    need('SOP is declared dry but lies within the 10 °C dew-point approach; substantiate the dry assumption.');
  if (c.sopWater==='yes') {
    const ph=present(c.sopPH)?Number(c.sopPH):null;
    if (ph==null || !['measured','validated'].includes(c.sopPHBasis)) need('Wet SOP requires measured or validated aqueous pH.');
    else wet.push({id:'SOP',ph,phBasis:c.sopPHBasis,pH2S:analysis.sop?.pH2S,pCO2:analysis.sop?.pCO2,
      rate:present(c.sopRate)?Number(c.sopRate):null,rateBasis:c.sopRateBasis});
  }
  if (c.sopWater==='no' && analysis.sop) dry.push({id:'SOP',pH2S:analysis.sop.pH2S});
  if (dry.length) {
    if (!present(material.maxDryH2SBar)) need('Add a qualified dry-service pH₂S limit for the exposed surface.');
    else for (const s of dry) {
      const name=s.id==='SOP'?'SOP':`Stage ${s.id}`;
      if (s.pH2S>Number(material.maxDryH2SBar)) fail(`${name} dry pH₂S ${labelNumber(s.pH2S,'bar')} exceeds material limit ${labelNumber(material.maxDryH2SBar,'bar')}.`);
      else ok(`${name} dry pH₂S ${labelNumber(s.pH2S,'bar')} ≤ recorded limit ${labelNumber(material.maxDryH2SBar,'bar')}.`);
    }
  }
  if (wet.length) {
    for (const s of wet) {
      const name=s.id==='SOP'?'SOP':`Stage ${s.id}`;
      if (s.ph==null || !['measured','validated'].includes(s.phBasis)) need(`${s.id==='SOP'?'SOP':`Stage ${s.id}`}: enter a measured or validated aqueous pH.`);
      if (!present(material.maxH2SBar)) need('Add a qualified wet pH₂S limit for the exposed surface.');
      else if (s.pH2S!=null && s.pH2S>Number(material.maxH2SBar)) fail(`${s.id==='SOP'?'SOP':`Stage ${s.id}`} pH₂S ${labelNumber(s.pH2S,'bar')} exceeds material limit ${labelNumber(material.maxH2SBar,'bar')}.`);
      else if (s.pH2S!=null) ok(`${name} wet pH₂S ${labelNumber(s.pH2S,'bar')} ≤ recorded limit ${labelNumber(material.maxH2SBar,'bar')}.`);
      if (!present(material.maxCO2Bar)) need('Add the material wet pCO₂ limit.');
      else if (s.pCO2!=null && s.pCO2>Number(material.maxCO2Bar)) fail(`${s.id==='SOP'?'SOP':`Stage ${s.id}`} pCO₂ exceeds the recorded material limit.`);
      else if (s.pCO2!=null) ok(`${name} wet pCO₂ ${labelNumber(s.pCO2,'bar')} ≤ recorded limit ${labelNumber(material.maxCO2Bar,'bar')}.`);
      if (!present(material.minPH)) need('Add the material minimum qualified aqueous pH.');
      else if (s.ph!=null && s.ph<Number(material.minPH)) fail(`${s.id==='SOP'?'SOP':`Stage ${s.id}`} pH ${labelNumber(s.ph,'')} is below material minimum ${labelNumber(material.minPH,'')}.`);
      else if (s.ph!=null && ['measured','validated'].includes(s.phBasis)) ok(`${name} aqueous pH ${labelNumber(s.ph,'')} ≥ recorded minimum ${labelNumber(material.minPH,'')}.`);
    }
    const years=present(c.serviceYears)?Number(c.serviceYears):null;
    if (years==null || years<=0) need('Enter a positive service life in years.');
    if (!present(material.maxRateMmY)) need('Add an accepted corrosion-rate limit for the component.');
    if (!present(material.allowableLossMm)) need('Add an accepted lifetime material-loss limit for the component.');
    for (const s of wet) {
      const name=s.id==='SOP'?'SOP':`Stage ${s.id}`;
      if (s.rate==null || !['measured','validated'].includes(s.rateBasis)) {need(`${name}: enter an independently assessed corrosion rate and source.`);continue;}
      if (present(material.maxRateMmY) && s.rate>Number(material.maxRateMmY)) fail(`${name} rate ${labelNumber(s.rate,'mm/y')} exceeds component limit ${labelNumber(material.maxRateMmY,'mm/y')}.`);
      else if (present(material.maxRateMmY)) ok(`${name} rate ${labelNumber(s.rate,'mm/y')} ≤ accepted limit ${labelNumber(material.maxRateMmY,'mm/y')}.`);
      if (present(material.allowableLossMm) && years!=null && s.rate*years>Number(material.allowableLossMm)) fail(`${name} ${years}-year loss ${labelNumber(s.rate*years,'mm')} exceeds limit ${labelNumber(material.allowableLossMm,'mm')}.`);
      else if (present(material.allowableLossMm) && years!=null) ok(`${name} ${years}-year loss ${labelNumber(s.rate*years,'mm')} ≤ accepted allowance ${labelNumber(material.allowableLossMm,'mm')}.`);
    }
    const extra = [
      ['chloride','maxChloridePpmv','chloride','ppmv'],
      ['oxygen','maxOxygenPpmv','oxygen','ppmv'],
      ['mercury','maxMercuryNgNm3','mercury','ng/Nm³'],
      ['droplet','maxDropletUm','droplet size','μm'],
    ];
    for (const [caseField,limitField,label,unit] of extra) {
      if (!present(c[caseField])) {need(`Enter ${label} for the case.`);continue;}
      if (Number(c[caseField])>0 && !present(material[limitField])) need(`Add an assessed ${label} limit for the exposed surface.`);
      else if (present(material[limitField]) && Number(c[caseField])>Number(material[limitField])) fail(`${label} ${labelNumber(c[caseField],unit)} exceeds material limit ${labelNumber(material[limitField],unit)}.`);
      else if (present(material[limitField])) ok(`${label} ${labelNumber(c[caseField],unit)} ≤ recorded limit ${labelNumber(material[limitField],unit)}.`);
    }
  }
  if (present(material.maxHardnessHRC)) {
    if (!present(material.measuredHardnessHRC)) need('Enter the material condition / measured hardness.');
    else if (Number(material.measuredHardnessHRC)>Number(material.maxHardnessHRC)) fail('Measured hardness exceeds the recorded qualification limit.');
  }
  return {status:failures.length?'outside':missing.length?'missing':'conditional',failures:[...new Set(failures)],missing:[...new Set(missing)],checks,
    wetStages:wet.map(s=>s.id),worstH2S:Math.max(0,...analysis.stages.map(s=>s.pH2S))};
}

export function assessAll(data,analysis,materials) {
  return Object.fromEntries(COMPONENTS.map(component=>[
    component,assessMaterial(data,analysis,materials.find(m=>m.id===data.selected?.[component] && m.component===component)),
  ]));
}
