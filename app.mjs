import {COMPONENTS,DEFAULT_CASE,DEFAULT_MATERIALS,MATERIAL_FIELDS,blankMaterial,copy,analyzeCase,assessAll} from './engine.mjs';
import {condensationSVG,sscSVG,h2sSVG} from './charts.mjs';

const KEY='compressor-material-assessment-local-v1';
const $app=document.querySelector('#app');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(value,digits=3)=>value==null?'—':Number(value).toLocaleString(undefined,{maximumFractionDigits:digits});
const id=()=>`mat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
let saved;
try{saved=JSON.parse(localStorage.getItem(KEY)||'null')}catch{saved=null}
let state={case:copy(DEFAULT_CASE),materials:copy(DEFAULT_MATERIALS),cases:{}};
if(saved && saved.case && Array.isArray(saved.materials)) {
  state={case:{...copy(DEFAULT_CASE),...saved.case,conditions:{...DEFAULT_CASE.conditions,...saved.case.conditions},selected:saved.case.selected||{}},
    materials:saved.materials,cases:saved.cases&&typeof saved.cases==='object'?saved.cases:{}};
}
let tab='assessment', selected=0, editor=null, search='', notice='', saveTimer;
const persist=()=>{try{localStorage.setItem(KEY,JSON.stringify(state))}catch{notify('Browser storage is full; export your case as JSON.')}};
const saveSoon=()=>{clearTimeout(saveTimer);saveTimer=setTimeout(persist,300)};
const notify=message=>{notice=message;const node=document.querySelector('#toast');if(node){node.textContent=message;node.hidden=false;setTimeout(()=>node.hidden=true,5000)}};
const levels={outside:'Outside recorded limits',missing:'Evidence needed',conditional:'Within recorded limits · conditional'};
const waterLabel=value=>value==='yes'?'Wet':value==='no'?'Dry':'Unconfirmed';

function field(label,fieldName,value,opts={}) {
  const {hint='',unit='',type='text',attr='',kind='condition'}=opts;
  return `<label class="field"><span>${label}${unit?` <small>(${unit})</small>`:''}</span><input data-${kind}="${fieldName}" type="${type}" inputmode="${type==='number'?'decimal':'text'}" ${attr} value="${esc(value)}" placeholder="${esc(hint)}"></label>`;
}

function yesNo(fieldName,label,value,kind='condition') {
  return `<label class="field"><span>${label}</span><select data-${kind}="${fieldName}"><option value="unknown" ${value==='unknown'?'selected':''}>Unconfirmed</option><option value="yes" ${value==='yes'?'selected':''}>Wet / yes</option><option value="no" ${value==='no'?'selected':''}>Dry / no</option></select></label>`;
}

function basis(fieldName,label,value,kind,options=['unknown','example','measured','validated']) {
  const labels={unknown:'Not established',example:'Example only',measured:'Measured',validated:'Validated assessment'};
  return `<label class="field"><span>${label}</span><select data-${kind}="${fieldName}">${options.map(k=>`<option value="${k}" ${value===k?'selected':''}>${labels[k]}</option>`).join('')}</select></label>`;
}

function toolbar() {
  return `<div class="toolbar"><button data-action="save-case" class="btn primary">Save named case</button><label class="load-control">Load case<select id="load-case"><option value="">Choose saved case</option>${Object.keys(state.cases).sort().map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join('')}</select></label><button data-action="export-json" class="btn light">Export case JSON</button><label class="btn light import-button">Import case JSON<input id="import-json" type="file" accept="application/json,.json" hidden></label><button data-action="export-csv" class="btn light">Export results CSV</button><button data-action="reset-case" class="btn quiet">Reset example</button></div>`;
}

function stageTable() {
  const fields=[['pressure','P abs','bar'],['temperature','T','°C'],['h2o','H₂O','mol%'],['co2','CO₂','mol%'],['h2s','H₂S','mol%'],['ph','Aqueous pH',''],['rate','CR','mm/y']];
  return `<section class="panel"><div class="section-heading"><div><h2>Operating stages</h2><p>Enter one row for each stage. Example pH values illustrate the plot; confirm their source for an assessment.</p></div><button class="btn light" data-action="add-stage" ${state.case.stages.length>=12?'disabled':''}>+ Stage</button></div><div class="scroll stage-scroll"><table class="stage-table"><thead><tr><th>Stage</th>${fields.map(([,label,unit])=>`<th>${label}${unit?` <small>${unit}</small>`:''}</th>`).join('')}<th>pH source</th><th>CR source</th><th>Liquid water</th><th></th></tr></thead><tbody>${state.case.stages.map((s,i)=>`<tr class="${i===selected?'active':''}"><th scope="row"><button data-stage-select="${i}" class="row-stage" aria-expanded="${i===selected}">St${i+1}</button><span class="stage-brief">${esc(s.pressure)} bar · ${esc(s.temperature)} °C · ${waterLabel(s.water)}</span></th>${fields.map(([name,label,unit])=>`<td data-label="${label}${unit?' ('+unit+')':''}"><input data-stage="${i}" data-field="${name}" inputmode="decimal" aria-label="Stage ${i+1} ${label}${unit?' '+unit:''}" value="${esc(s[name])}" placeholder="—"></td>`).join('')}<td data-label="pH source"><select data-stage="${i}" data-field="phBasis" aria-label="Stage ${i+1} pH source">${['unknown','example','measured','validated'].map(k=>`<option value="${k}" ${s.phBasis===k?'selected':''}>${{unknown:'Unknown',example:'Example',measured:'Measured',validated:'Validated'}[k]}</option>`).join('')}</select></td><td data-label="CR source"><select data-stage="${i}" data-field="rateBasis" aria-label="Stage ${i+1} corrosion-rate source">${['unknown','measured','validated'].map(k=>`<option value="${k}" ${s.rateBasis===k?'selected':''}>${{unknown:'Unknown',measured:'Measured',validated:'Validated'}[k]}</option>`).join('')}</select></td><td data-label="Liquid water"><select data-stage="${i}" data-field="water" aria-label="Stage ${i+1} water">${['unknown','yes','no'].map(k=>`<option value="${k}" ${s.water===k?'selected':''}>${waterLabel(k)}</option>`).join('')}</select></td><td class="stage-remove"><button class="icon-button" data-remove-stage="${i}" aria-label="Remove stage ${i+1}" ${state.case.stages.length===1?'disabled':''}>×</button></td></tr>`).join('')}</tbody></table></div><p class="mini">Inputs update the graphs after leaving the field. Pressure is absolute; gas percentages are molar.</p></section>`;
}

function conditions() {
  const c=state.case.conditions;
  return `<section class="panel" id="conditions"><div class="section-heading"><div><h2>Case conditions and SOP</h2><p>Enter the values and the project design-basis reference used for this client case.</p></div></div><div class="form-grid">${field('Minimum design metal temperature','mdmt',c.mdmt,{unit:'°C',type:'number'})}${field('Chlorides','chloride',c.chloride,{unit:'ppmv',type:'number'})}${field('Oxygen','oxygen',c.oxygen,{unit:'ppmv',type:'number'})}${field('Mercury','mercury',c.mercury,{unit:'ng/Nm³',type:'number'})}${field('Maximum entrained droplet','droplet',c.droplet,{unit:'μm',type:'number'})}${field('Assessment life','serviceYears',c.serviceYears,{unit:'years',type:'number'})}</div><h3 class="subhead">Settled out / standstill case (SOP)</h3><div class="form-grid">${field('SOP pressure','sopPressure',c.sopPressure,{unit:'bar abs',type:'number'})}${field('SOP temperature','sopTemperature',c.sopTemperature,{unit:'°C',type:'number'})}${field('SOP H₂O','sopH2o',c.sopH2o,{unit:'mol%',type:'number'})}${field('SOP H₂S','sopH2S',c.sopH2S,{unit:'mol%',type:'number'})}${field('SOP CO₂','sopCO2',c.sopCO2,{unit:'mol%',type:'number'})}${yesNo('sopWater','Liquid water at SOP',c.sopWater)}${field('SOP aqueous pH','sopPH',c.sopPH,{type:'number'})}${basis('sopPHBasis','SOP pH source',c.sopPHBasis,'condition',['unknown','measured','validated'])}${field('SOP assessed corrosion rate','sopRate',c.sopRate,{unit:'mm/y',type:'number'})}${basis('sopRateBasis','SOP corrosion-rate source',c.sopRateBasis,'condition',['unknown','measured','validated'])}</div><p class="mini">The SOP point appears on the water plot once pressure, temperature and composition are entered. The 10 °C line is an approach indicator; it does not determine whether a metal surface is wet.</p></section>`;
}

function statusSummary(results) {
  const verdicts=Object.values(results);
  const outside=verdicts.filter(v=>v.status==='outside').length;
  const conditional=verdicts.filter(v=>v.status==='conditional').length;
  const label=outside?`${outside} selected materials outside recorded limits`:conditional===verdicts.length?'Selected materials within recorded limits':`${verdicts.length-conditional} selections need evidence`;
  const tone=outside?'bad':conditional===verdicts.length?'good':'review';
  return `<section class="summary ${tone}"><div><div class="eyebrow">CURRENT CASE · ${esc(state.case.title||'Untitled')}</div><h2>${label}</h2><p>Result applies to the entered process case and the limits documented in your material records. Review each component's reasons below.</p></div><div class="summary-stat"><strong>${conditional}/${verdicts.length}</strong><span>conditional matches</span></div></section>`;
}

const plotData={condensation:{name:'Water condensation',file:'water-condensation'},ssc:{name:'SSC domain',file:'ssc-domain'},h2s:{name:'H2S partial pressure',file:'h2s-partial-pressure'}};
function plotCard(key,title,description,svg) {
  return `<section class="panel plot-card" data-plot="${key}"><div class="section-heading"><div><h2>${title}</h2><p>${description}</p></div><div class="download-actions"><button data-expand="${key}" class="btn light" aria-expanded="false" aria-label="Expand ${title}">Expand</button><button data-download="${key}:svg" class="btn light" aria-label="Download ${title} as SVG">SVG</button><button data-download="${key}:png" class="btn light" aria-label="Download ${title} as PNG">PNG</button></div></div><div class="chart-frame" tabindex="0" aria-label="${title} chart, scroll sideways to see all data">${svg}</div><p class="mobile-chart-hint">Swipe to explore the chart, or tap Expand for a larger view.</p></section>`;
}

function stageDetail(analysis) {
  const s=analysis.stages[selected]||analysis.stages[0];
  if(!s)return '';
  return `<div class="stage-detail"><div><div class="eyebrow">STAGE ${s.id} · ${waterLabel(s.water).toUpperCase()}</div><h3>${s.domain?`Illustrative SSC domain ${s.domain}`:'SSC domain unassigned'}</h3><p>${s.water==='no'?'The plotted pH is a hypothetical aqueous position for this dry stage.':s.domain?'Stage position describes the input environment; the material decision comes from verified material limits.':'Aqueous pH is required to plot a domain.'}</p></div><dl><div><dt>pH₂S</dt><dd>${fmt(s.pH2S,4)} bar</dd></div><div><dt>pCO₂</dt><dd>${fmt(s.pCO2,4)} bar</dd></div><div><dt>Aqueous pH</dt><dd>${fmt(s.ph,2)} <small>${esc(s.phBasis)}</small></dd></div><div><dt>Water dew point</dt><dd>${s.dew==null?'Outside estimate':`${fmt(s.dew,1)} °C`}</dd></div></dl></div>`;
}

function graphs(analysis) {
  if(analysis.errors.length)return `<section class="panel alert bad">Correct the highlighted input errors to display the operating plots.</section>`;
  return `<section id="graphs" class="graphs-head"><div><div class="eyebrow">INTERACTIVE OPERATING MAP</div><h2>Inspect each stage</h2><p>Move the pointer over a point for its values. Click to keep a stage selected across the plots and table.</p></div><div class="stage-tabs">${analysis.stages.map((s,i)=>`<button data-stage-select="${i}" class="stage-chip ${i===selected?'active':''}" aria-pressed="${i===selected}">St${i+1}</button>`).join('')}</div></section>${stageDetail(analysis)}<div class="plot-grid">${plotCard('condensation','Water condensation','Saturation, +10 °C approach and stage / SOP points.',condensationSVG(analysis.stages,analysis.sop,selected))}${plotCard('ssc','SSC domains · schematic','Stage positions on aqueous pH versus pH₂S. Diagram geometry is illustrative.',sscSVG(analysis.stages,selected))}</div>${plotCard('h2s','H₂S by stage','Partial pressure and entered wet/dry status.',h2sSVG(analysis.stages,selected))}`;
}

function stageResults(analysis) {
  if(analysis.errors.length)return `<section class="panel alert bad"><strong>Check these inputs:</strong><ul>${analysis.errors.map(e=>`<li>${esc(e)}</li>`).join('')}</ul></section>`;
  return `<section class="panel"><div class="section-heading"><div><h2>Calculated stage results</h2><p>Ideal partial pressure = total absolute pressure × molar fraction.</p></div></div><div class="scroll"><table class="results-table"><thead><tr><th>Stage</th><th>Water</th><th>pH₂S bar</th><th>pCO₂ bar</th><th>pH₂O bar</th><th>Dew point °C</th><th>Aqueous pH</th><th>Illustrative domain</th><th>Rate mm/y</th></tr></thead><tbody>${analysis.stages.map((s,i)=>`<tr class="${i===selected?'active':''}"><th><button class="row-stage" data-stage-select="${i}">St${s.id}</button></th><td>${waterLabel(s.water)}</td><td>${fmt(s.pH2S,4)}</td><td>${fmt(s.pCO2,4)}</td><td>${fmt(s.pH2O,4)}</td><td>${s.dew==null?'—':fmt(s.dew,1)}</td><td>${fmt(s.ph,2)} · ${esc(s.phBasis)}</td><td>${esc(s.domain||'Unassigned')}</td><td>${fmt(s.rate,3)}</td></tr>`).join('')}</tbody></table></div><p class="mini">The water equation is limited to dew points from 0–100 °C. An entered aqueous pH for a dry stage does not establish actual liquid water.</p></section>`;
}

function materialCards(verdicts) {
  return `<section id="materials" class="panel"><div class="section-heading"><div><h2>Selected component materials</h2><p>Choose a record. Edit its supported limits and evidence in the Material library tab.</p></div></div><div class="material-grid">${COMPONENTS.map(component=>{
    const candidate=state.materials.find(m=>m.id===state.case.selected?.[component]);
    const result=verdicts[component];
    const opts=state.materials.filter(m=>m.component===component);
    const main=result.failures[0]||result.missing[0]||'Entered conditions fit the documented record. Final review is still required.';
    return `<article class="material-card"><div class="material-top"><h3>${component}</h3><span class="status ${result.status}">${levels[result.status]}</span></div><label class="field"><span>Selected grade / product form</span><select data-candidate="${esc(component)}"><option value="">Select material</option>${opts.map(m=>`<option value="${esc(m.id)}" ${candidate?.id===m.id?'selected':''}>${esc(m.name)}</option>`).join('')}</select></label><p class="surface">Exposed surface: ${esc(candidate?.surface||'Not recorded')}</p><div class="key-reason ${result.status}">${esc(main)}</div><details><summary>View assessment checks (${result.failures.length+result.missing.length+result.checks.length})</summary>${result.failures.length?`<h4>Outside limit</h4><ul>${result.failures.map(e=>`<li>${esc(e)}</li>`).join('')}</ul>`:''}${result.missing.length?`<h4>Evidence needed</h4><ul>${result.missing.map(e=>`<li>${esc(e)}</li>`).join('')}</ul>`:''}${result.checks.length?`<h4>Within recorded limit / documented</h4><ul>${result.checks.map(e=>`<li>${esc(e)}</li>`).join('')}</ul>`:''}</details><button class="inline-button" data-edit-record="${esc(candidate?.id||'')}" ${candidate?'':'disabled'}>Edit this material record</button></article>`;
  }).join('')}</div><p class="mini">“Outside recorded limits” applies to the entered conditions and record, not to all uses of the grade. A domain colour is never treated as proof of material qualification.</p></section>`;
}

function assessmentScreen() {
  const analysis=analyzeCase(state.case), verdicts=assessAll(state.case,analysis,state.materials);
  selected=Math.min(selected,Math.max(analysis.stages.length-1,0));
  return `<main class="workspace"><div class="heading"><div><div class="eyebrow">COMPRESSOR MOC WORKSPACE</div><h1>Material assessment</h1><p>Enter a process case, inspect stage exposure, and assess selected materials against their documented limits.</p></div><div class="case-title">${field('Case / client','title',state.case.title,{kind:'case',hint:'Project name',attr:'maxlength="100"'})}${field('Design-basis document reference','designBasis',state.case.designBasis,{kind:'case',hint:'Data sheet / MOC revision',attr:'maxlength="180"'})}</div></div>${toolbar()}${statusSummary(verdicts)}${stageTable()}${conditions()}${graphs(analysis)}${stageResults(analysis)}${materialCards(verdicts)}</main>`;
}

function materialForm() {
  if(!editor)return '';
  const m=editor;
  const input=(name,label,hint='',unit='')=>`<label class="field"><span>${label}${unit?` <small>(${unit})</small>`:''}</span><input name="${name}" value="${esc(m[name])}" placeholder="${esc(hint)}" ${MATERIAL_FIELDS.some(([k])=>k===name)||name==='measuredHardnessHRC'?'inputmode="decimal"':''}></label>`;
  return `<section class="panel editor" id="editor"><div class="section-heading"><div><h2>${m.id&&state.materials.some(r=>r.id===m.id)?'Edit material':'Add material'}</h2><p>Limits must apply to the actual exposed surface, product form, and documented condition.</p></div><button class="btn light" data-action="close-editor">Close</button></div><form id="material-form"><div class="form-grid"><label class="field"><span>Component</span><select name="component" required>${COMPONENTS.map(component=>`<option value="${esc(component)}" ${m.component===component?'selected':''}>${component}</option>`).join('')}</select></label>${input('name','Material grade / construction','e.g. Alloy 625 overlay')}${input('form','Product form / heat treatment','Forging, casting, QT…')}${input('surface','Wetted surface or protective layer','Actual exposed alloy or overlay')}${input('source','Supporting document / clause / report','Required before marking reviewed')}</div><label class="verified"><input type="checkbox" name="verified" ${m.verified?'checked':''}> Engineering limits reviewed against the document cited above</label><h3 class="subhead">Recorded limits (leave blank when unknown)</h3><div class="form-grid">${MATERIAL_FIELDS.map(([name,label,unit])=>input(name,label,'Unknown',unit)).join('')}${input('measuredHardnessHRC','Measured / specified hardness','When max HRC applies','HRC')}</div><label class="field full"><span>Material notes and assumptions</span><textarea name="notes" rows="3">${esc(m.notes)}</textarea></label><div class="form-actions"><button type="submit" class="btn primary">Save material</button><button type="button" class="btn light" data-action="close-editor">Cancel</button></div></form></section>`;
}

function libraryScreen() {
  const rows=state.materials.filter(m=>`${m.component} ${m.name} ${m.source} ${m.surface}`.toLowerCase().includes(search.toLowerCase()));
  return `<main class="workspace"><div class="heading"><div><div class="eyebrow">LOCAL MATERIAL LIBRARY</div><h1>Material records</h1><p>Records are saved in this browser. Example names have no approved limits until you document them.</p></div><button class="btn primary" data-action="new-material">+ Add material</button></div><div class="panel"><label class="field search"><span>Find material or component</span><input id="material-search" value="${esc(search)}" type="search" placeholder="Search name, component or source"></label><div class="scroll library-scroll"><table class="results-table library-table"><thead><tr><th>Component</th><th>Material</th><th>Exposed surface</th><th>Evidence</th><th>Actions</th></tr></thead><tbody>${rows.map(m=>`<tr><td>${esc(m.component)}</td><th>${esc(m.name)}</th><td>${esc(m.surface)||'—'}</td><td><span class="status ${m.verified&&m.source?'conditional':'missing'}">${m.verified&&m.source?'Reviewed':'Unverified'}</span></td><td><div class="actions"><button class="inline-button" data-edit-record="${esc(m.id)}">Edit</button><button class="inline-button danger" data-delete-record="${esc(m.id)}">Delete</button></div></td></tr>`).join('')||'<tr><td colspan="5">No records match this search.</td></tr>'}</tbody></table></div></div>${materialForm()}</main>`;
}

function aboutScreen() {
  return `<main class="workspace about"><div class="heading"><div><div class="eyebrow">ABOUT THIS TOOL</div><h1>How to use the assessment</h1></div></div><div class="about-grid"><section class="panel"><h2>1. Establish the case</h2><p>Enter actual stage values, wet/dry conditions, SOP inputs and a design-basis reference. Example inputs let you explore the graphs; they are not measured project evidence.</p></section><section class="panel"><h2>2. Document the material</h2><p>Choose a component material and enter its product form, actual exposed surface, service limits and source. Example grade names start unverified.</p></section><section class="panel"><h2>3. Review the result</h2><p>“Within recorded limits” requires documented limits and complete relevant inputs. Breached limits appear separately from missing evidence. The graphs show exposure; they cannot certify a grade.</p></section><section class="panel"><h2>4. Present and share</h2><p>Hover over a graph point, download SVG or PNG, save the case in this browser, or export a case JSON file for another computer. The material library stays in this browser unless exported.</p></section></div><div class="panel"><h2>Methods and limits</h2><ul><li>Partial pressure is approximated as absolute pressure × gas mole fraction. Non-ideal fugacity is not calculated.</li><li>The water-dew-point estimate uses Antoine coefficients only for 0–100 °C; water at a metal surface is a separate input.</li><li>The D0–D3 picture is reconstructed from the supplied illustrative reference. It is not an ISO 15156 qualification chart.</li><li>Corrosion loss is entered rate × assessment years. The app does not predict corrosion rate or perform mechanical design.</li><li>Records and cases are saved locally in your browser; clearing browser data can remove them. Export JSON for backup.</li></ul></div></main>`;
}

function render() {
  document.body.classList.remove('chart-open');
  $app.innerHTML=`<header class="site-header"><div class="header-inner"><div class="identity"><div class="brand-mark" aria-hidden="true">M<span>·</span>A</div><div><strong>Compressor Material Assessment</strong><small>Engineering case workspace</small></div></div><nav aria-label="Application"><button data-view="assessment" class="${tab==='assessment'?'current':''}">Assessment</button><button data-view="library" class="${tab==='library'?'current':''}">Material library</button><button data-view="about" class="${tab==='about'?'current':''}">About</button></nav></div></header>${tab==='library'?libraryScreen():tab==='about'?aboutScreen():assessmentScreen()}<footer>Local material assessment · evidence led engineering review</footer><div id="toast" class="toast" role="status" hidden>${esc(notice)}</div><div id="plot-tooltip" class="plot-tooltip" role="status" hidden></div>`;
}

function saveBlob(content,type,name) {
  const url=URL.createObjectURL(new Blob([content],{type}));
  const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),6000);
}
const slug=()=>String(state.case.title||'assessment').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,55)||'assessment';
function exportedSVG(key) {
  const svg=document.querySelector(`[data-plot="${key}"] svg`);
  if(!svg)throw Error('Plot is not available. Check the input values first.');
  const clone=svg.cloneNode(true);
  clone.querySelectorAll('[data-plot-stage],[data-plot-sop]').forEach(node=>{
    node.removeAttribute('tabindex');node.removeAttribute('role');node.removeAttribute('style');
  });
  clone.querySelectorAll('.chart-crosshair').forEach(el=>el.remove());
  clone.setAttribute('width','1520');clone.setAttribute('height',key==='h2s'?'600':'740');
  const title=document.createElementNS('http://www.w3.org/2000/svg','desc');
  title.textContent=`${plotData[key].name} for ${state.case.title||'untitled case'}. Engineering screening graphic.`;
  clone.prepend(title);
  return new XMLSerializer().serializeToString(clone);
}
async function downloadPlot(key,format) {
  if(!plotData[key])return;
  try{
    const svg=exportedSVG(key),filename=`${slug()}-${plotData[key].file}`;
    if(format==='svg'){saveBlob(svg,'image/svg+xml;charset=utf-8',`${filename}.svg`);return;}
    const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}));
    const image=new Image();image.src=url;
    await image.decode();
    const source=document.querySelector(`[data-plot="${key}"] svg`).viewBox.baseVal;
    const canvas=document.createElement('canvas');canvas.width=source.width*3;canvas.height=source.height*3;
    const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);
    context.drawImage(image,0,0,canvas.width,canvas.height);URL.revokeObjectURL(url);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    if(!blob)throw Error('PNG generation was not supported by this browser.');
    saveBlob(blob,'image/png',`${filename}.png`);
  }catch(error){notify(error.message||'Unable to export plot.')}
}

function csv() {
  const analysis=analyzeCase(state.case),verdicts=assessAll(state.case,analysis,state.materials);
  const rows=[['Case',state.case.title],['Design basis',state.case.designBasis],[],['Stage','Pressure bar abs','Temperature C','H2O %','CO2 %','H2S %','Water','pH','pH source','Corrosion rate mm/y','Rate source','pH2S bar','pCO2 bar','Dew point C','Illustrative domain']];
  state.case.stages.forEach((s,i)=>{const a=analysis.stages[i]||{};rows.push([i+1,s.pressure,s.temperature,s.h2o,s.co2,s.h2s,s.water,s.ph,s.phBasis,s.rate,s.rateBasis,a.pH2S??'',a.pCO2??'',a.dew??'',a.domain??''])});
  rows.push([],['Case condition','Value'],...Object.entries(state.case.conditions),[],['Component','Material','Assessment','Outside limits','Evidence needed','Material source']);
  COMPONENTS.forEach(component=>{const m=state.materials.find(x=>x.id===state.case.selected?.[component]);const v=verdicts[component];rows.push([component,m?.name||'',levels[v.status],v.failures.join('; '),v.missing.join('; '),m?.source||''])});
  return rows.map(row=>row.map(value=>{let v=String(value??'');if(/^[=+@\-]/.test(v)&&!/^-[0-9.]+$/.test(v))v="'"+v;return `"${v.replace(/"/g,'""')}"`}).join(',')).join('\r\n');
}

async function importJSON(file) {
  try{
    if(file.size>1024*1024)throw Error('Case file must be smaller than 1 MB.');
    const payload=JSON.parse(await file.text());
    const data=payload.case||payload;
    if(!data||!Array.isArray(data.stages)||data.stages.length<1||data.stages.length>12)throw Error('Invalid case file.');
    state.case={...copy(DEFAULT_CASE),...data,conditions:{...DEFAULT_CASE.conditions,...data.conditions},selected:data.selected||{}};
    if(Array.isArray(payload.materials))state.materials=payload.materials.filter(m=>m&&COMPONENTS.includes(m.component)&&typeof m.name==='string').slice(0,300);
    selected=0;persist();render();notify('Case imported. Review all inputs and evidence before use.');
  }catch(error){notify(error.message||'Unable to import case file.')}
}

function upsertMaterial(form) {
  const entries=Object.fromEntries(new FormData(form));
  const data={...blankMaterial(editor?.id||id()),...entries,verified:form.elements.verified.checked};
  if(!data.name.trim()||!COMPONENTS.includes(data.component))return notify('Enter a valid component and grade.');
  if(data.verified&&!data.source.trim())return notify('A reviewed record needs its document reference.');
  for(const [key] of MATERIAL_FIELDS){if(data[key]!==''&&(!Number.isFinite(Number(data[key]))||Number(data[key])<0&&key!=='minTempC'))return notify(`Check ${key}: enter a valid numeric limit.`)}
  if(data.minTempC!==''&&data.maxTempC!==''&&Number(data.minTempC)>Number(data.maxTempC))return notify('Minimum temperature cannot exceed maximum temperature.');
  if(editor&&state.materials.some(m=>m.id===editor.id))state.materials=state.materials.map(m=>m.id===editor.id?data:m);
  else state.materials.push(data);
  editor=null;persist();render();notify('Material record saved in this browser.');
}

$app.addEventListener('input',event=>{
  const d=event.target.dataset;
  if(d.stage!==undefined){const s=state.case.stages[Number(d.stage)];s[d.field]=event.target.value;if(d.field==='ph'&&s.phBasis==='example')s.phBasis='unknown';saveSoon();return}
  if(d.condition!==undefined){state.case.conditions[d.condition]=event.target.value;saveSoon();return}
  if(d.case!==undefined){state.case[d.case]=event.target.value;saveSoon();return}
  if(event.target.id==='material-search')search=event.target.value;
});
$app.addEventListener('change',event=>{
  const d=event.target.dataset;
  if(d.stage!==undefined){state.case.stages[Number(d.stage)][d.field]=event.target.value;persist();render();return}
  if(d.condition!==undefined){state.case.conditions[d.condition]=event.target.value;persist();render();return}
  if(d.case!==undefined){state.case[d.case]=event.target.value;persist();render();return}
  if(d.candidate!==undefined){state.case.selected[d.candidate]=event.target.value;persist();render();return}
  if(event.target.id==='load-case'&&event.target.value){
    state.case=copy(state.cases[event.target.value]);selected=0;persist();render();notify('Saved case loaded.');return;
  }
  if(event.target.id==='import-json'&&event.target.files[0])importJSON(event.target.files[0]);
  if(event.target.id==='material-search'){search=event.target.value;render()}
});
$app.addEventListener('submit',event=>{if(event.target.id==='material-form'){event.preventDefault();upsertMaterial(event.target)}});
$app.addEventListener('click',event=>{
  const point=event.target.closest('[data-plot-stage],[data-plot-sop]');
  if(point){if(point.dataset.plotStage!==undefined){selected=Number(point.dataset.plotStage);render()}else notify('SOP marker: enter its aqueous pH and corrosion rate if SOP is wet.');return}
  const el=event.target.closest('button');if(!el)return;
  if(el.dataset.view){tab=el.dataset.view;render();return}
  if(el.dataset.stageSelect!==undefined){selected=Number(el.dataset.stageSelect);render();return}
  if(el.dataset.removeStage!==undefined){if(state.case.stages.length<=1)return;state.case.stages.splice(Number(el.dataset.removeStage),1);selected=Math.min(selected,state.case.stages.length-1);persist();render();return}
  if(el.dataset.download){const [plot,format]=el.dataset.download.split(':');downloadPlot(plot,format);return}
  if(el.dataset.expand){const card=el.closest('.plot-card');const open=!card.classList.contains('expanded');card.classList.toggle('expanded',open);document.body.classList.toggle('chart-open',open);el.textContent=open?'Close':'Expand';el.setAttribute('aria-expanded',String(open));el.setAttribute('aria-label',`${open?'Close':'Expand'} ${card.querySelector('h2').textContent}`);return}
  if(el.dataset.editRecord!==undefined){editor=copy(state.materials.find(m=>m.id===el.dataset.editRecord));if(!editor)return;tab='library';render();document.querySelector('#editor')?.scrollIntoView({behavior:'smooth'});return}
  if(el.dataset.deleteRecord){const m=state.materials.find(x=>x.id===el.dataset.deleteRecord);if(m&&confirm(`Delete ${m.name} from this browser's material library?`)){state.materials=state.materials.filter(x=>x.id!==m.id);persist();render();notify('Material deleted.')}return}
  switch(el.dataset.action){
    case 'add-stage':if(state.case.stages.length<12){state.case.stages.push({pressure:'',temperature:'',h2o:'',co2:'',h2s:'',ph:'',phBasis:'unknown',rate:'',rateBasis:'unknown',water:'unknown'});persist();render()}break;
    case 'save-case':{const name=(state.case.title||'').trim();if(!name)return notify('Enter a case name before saving.');state.cases[name]=copy(state.case);persist();render();notify(`Saved case “${name}” in this browser.`);break}
    case 'reset-case':if(confirm('Load the editable example case? Your saved named cases and material records will remain.')){state.case=copy(DEFAULT_CASE);selected=0;persist();render()}break;
    case 'export-json':saveBlob(JSON.stringify({version:1,case:state.case,materials:state.materials},null,2),'application/json',`${slug()}-case.json`);break;
    case 'export-csv':saveBlob('\ufeff'+csv(),'text/csv;charset=utf-8',`${slug()}-results.csv`);break;
    case 'new-material':editor=blankMaterial(id());render();document.querySelector('#editor')?.scrollIntoView({behavior:'smooth'});break;
    case 'close-editor':editor=null;render();break;
  }
});
$app.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&document.querySelector('.plot-card.expanded')){document.querySelector('[data-expand][aria-expanded="true"]')?.click();return}
  if((event.key==='Enter'||event.key===' ')&&event.target.matches?.('[data-plot-stage],[data-plot-sop]')){
    event.preventDefault();event.target.click();
  }
});

function showPlotHover(event) {
  const svg=event.target.closest?.('.plot-card svg');
  const tooltip=document.querySelector('#plot-tooltip');
  if(!tooltip)return;
  if(!svg){tooltip.hidden=true;document.querySelectorAll('.chart-crosshair').forEach(el=>el.remove());return}
  const point=event.target.closest('[data-plot-stage],[data-plot-sop]');
  document.querySelectorAll('.chart-crosshair').forEach(el=>el.remove());
  if(!point){tooltip.hidden=true;return}
  const analysis=analyzeCase(state.case);
  const index=point.dataset.plotStage;
  if(index!==undefined){
    const s=analysis.stages[Number(index)];if(!s)return;
    tooltip.innerHTML=`<strong>Stage ${s.id} · ${waterLabel(s.water)}</strong><span>T ${fmt(s.temperature,1)} °C · pH₂S ${fmt(s.pH2S,4)} bar · pH₂O ${fmt(s.pH2O,4)} bar</span><span>pH ${fmt(s.ph,2)} (${esc(s.phBasis)}) · ${s.domain||'domain unassigned'}</span>`;
  }else{
    const sop=analysis.sop;if(!sop)return;
    tooltip.innerHTML=`<strong>Settled out / SOP</strong><span>T ${fmt(sop.temperature,1)} °C · pH₂O ${fmt(sop.pH2O,4)} bar</span><span>Water dew point ${sop.dew==null?'outside estimate':fmt(sop.dew,1)+' °C'}</span>`;
  }
  const shape=point.querySelector('circle:not([r="12"]),rect,path');
  if(shape){
    let cx=Number(shape.getAttribute('cx')),cy=Number(shape.getAttribute('cy'));
    if(!Number.isFinite(cx)||!Number.isFinite(cy)){
      cx=Number(shape.getAttribute('x'))+Number(shape.getAttribute('width'))/2;
      cy=Number(shape.getAttribute('y'));
    }
    if(Number.isFinite(cx)&&Number.isFinite(cy)){
      const ns='http://www.w3.org/2000/svg';
      for(const attrs of [{x1:cx,x2:cx,y1:36,y2:svg.viewBox.baseVal.height-60},{x1:75,x2:svg.viewBox.baseVal.width-25,y1:cy,y2:cy}]){
        const line=document.createElementNS(ns,'line');line.setAttribute('class','chart-crosshair');
        for(const [k,v] of Object.entries(attrs))line.setAttribute(k,String(v));
        line.setAttribute('stroke','#004C99');line.setAttribute('stroke-dasharray','5 5');line.setAttribute('opacity','.62');
        line.setAttribute('pointer-events','none');svg.append(line);
      }
    }
  }
  tooltip.hidden=false;
  tooltip.style.left=`${Math.min(event.clientX+16,window.innerWidth-310)}px`;
  tooltip.style.top=`${Math.max(12,event.clientY-84)}px`;
}
$app.addEventListener('pointermove',showPlotHover);
$app.addEventListener('pointerleave',()=>{const tooltip=document.querySelector('#plot-tooltip');if(tooltip)tooltip.hidden=true;document.querySelectorAll('.chart-crosshair').forEach(el=>el.remove())});
$app.addEventListener('focusin',event=>{if(event.target.matches?.('[data-plot-stage],[data-plot-sop]')){
  const box=event.target.getBoundingClientRect();showPlotHover({target:event.target,clientX:box.left+box.width/2,clientY:box.top});
}});
render();
