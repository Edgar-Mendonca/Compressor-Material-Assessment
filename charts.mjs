const blue='#004C99', mid='#0066CC', accent='#00A3FF', ink='#1b3f61';
const tick='#66819b', grid='#dce8f3', wet='#d75058', dry='#0066CC', unknown='#ca8a2b';
const num = n => Number(n).toFixed(2);
const sat = temp => 10**(8.07131-1730.63/(temp+233.426))/750.062;
const mark = stage => stage.water==='yes'?wet:stage.water==='no'?dry:unknown;
const text = (x,y,s,extras='') => `<text x="${num(x)}" y="${num(y)}" ${/\bfill=/.test(extras)?'':`fill="${ink}"`} ${/\bfont-size=/.test(extras)?'':'font-size="12"'} font-family="Arial, Helvetica, sans-serif" ${extras}>${s}</text>`;
const header = (w,h,alt) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${alt}">`;
const gridline = (x1,y1,x2,y2) => `<line x1="${num(x1)}" y1="${num(y1)}" x2="${num(x2)}" y2="${num(y2)}" stroke="${grid}" stroke-width="1"/>`;
const circle = (x,y,color,filled=true) => `<circle cx="${num(x)}" cy="${num(y)}" r="7" fill="${filled?color:'#fff'}" stroke="${color}" stroke-width="2.6"/>`;
const point = (x,y,i,stage,selected,details) => `<g data-plot-stage="${i}" tabindex="0" role="button" aria-label="Inspect Stage ${i+1}: ${details}" style="cursor:pointer">${selected?`<circle cx="${num(x)}" cy="${num(y)}" r="12" fill="none" stroke="${blue}" stroke-width="2"/>`:''}${circle(x,y,mark(stage),stage.water!=='no')}${text(x+10,y-8,`St${i+1}`,'font-weight="700"')}<title>Stage ${i+1}: ${details}</title></g>`;

export function condensationSVG(stages,sop,selected=0) {
  const W=760,H=370,L=75,T=36,R=25,B=72,w=W-L-R,h=H-T-B;
  const maxT=Math.max(160,...stages.map(s=>s.temperature),sop?.temperature??0);
  const xmax=Math.max(200,Math.ceil(maxT/20)*20);
  const ymax=Math.max(2,Math.ceil(Math.max(...stages.map(s=>s.pH2O),sop?.pH2O??0,1.2)*1.12*2)/2);
  const x=t=>L+t/xmax*w, y=p=>T+h-p/ymax*h;
  let svg=header(W,H,'Water saturation curve and selectable stage points');
  svg+=`<rect width="${W}" height="${H}" fill="#fff"/>${text(L,22,'Water condensation · operating points','font-size="17" font-weight="700"')}`;
  for(let t=0;t<=xmax;t+=40) svg+=gridline(x(t),T,x(t),T+h)+text(x(t),H-46,String(t),'text-anchor="middle" fill="#66819b"');
  for(let p=0;p<=ymax+0.0001;p+=0.5) svg+=gridline(L,y(p),L+w,y(p))+text(L-10,y(p)+4,p.toFixed(1),'text-anchor="end" fill="#66819b"');
  const curve=(offset=0)=>Array.from({length:101},(_,i)=>`${i?'L':'M'}${num(x(i+offset))} ${num(y(sat(i)))}`).join(' ');
  svg+=`<path d="${curve()}" fill="none" stroke="${blue}" stroke-width="3"/><path d="${curve(10)}" fill="none" stroke="${accent}" stroke-width="2.5" stroke-dasharray="8 5"/>`;
  stages.forEach((s,i)=>{svg+=point(x(s.temperature),y(s.pH2O),i,s,i===selected,`${s.temperature} °C, pH₂O ${s.pH2O.toFixed(4)} bar, water ${s.water}`)});
  if(sop) {
    const px=x(sop.temperature),py=y(sop.pH2O);
    svg+=`<g data-plot-sop="true" tabindex="0" role="button" aria-label="Inspect SOP: ${sop.temperature} degrees Celsius, pH2O ${sop.pH2O.toFixed(4)} bar" style="cursor:pointer"><path d="M ${num(px)} ${num(py-9)} L ${num(px+9)} ${num(py)} L ${num(px)} ${num(py+9)} L ${num(px-9)} ${num(py)} Z" fill="${unknown}" stroke="#fff" stroke-width="2"/>${text(px+11,py-9,'SOP','font-weight="700"')}<title>SOP: ${sop.temperature} °C, pH₂O ${sop.pH2O.toFixed(4)} bar</title></g>`;
  }
  svg+=text(W/2,H-17,'Temperature (°C)','text-anchor="middle" font-weight="600"');
  svg+=`<text x="18" y="${H/2}" transform="rotate(-90 18 ${H/2})" font-family="Arial, Helvetica, sans-serif" font-size="12" fill="${ink}" text-anchor="middle">H₂O partial pressure (bar)</text>`;
  svg+=`<line x1="${W-238}" y1="20" x2="${W-213}" y2="20" stroke="${blue}" stroke-width="3"/>${text(W-207,24,'Saturation')}`;
  svg+=`<line x1="${W-121}" y1="20" x2="${W-95}" y2="20" stroke="${accent}" stroke-dasharray="7 4" stroke-width="2"/>${text(W-90,24,'+10 °C')}`;
  svg+=text(L,H-2,'Water equation valid 0–100 °C · surface wetness requires separate confirmation','font-size="11" fill="#66819b"');
  return svg+'</svg>';
}

export function sscSVG(stages,selected=0) {
  const W=760,H=370,L=75,T=36,R=25,B=72,w=W-L-R,h=H-T-B;
  const x=v=>L+(Math.log10(Math.max(v,1e-5))+5)/7*w;
  const y=p=>T+(7.5-p)/5*h;
  const upper=v=>Math.min(6.5,4+(Math.log10(Math.max(v,.003))-Math.log10(.003)));
  const lower=v=>Math.min(5.5,3.5+(Math.log10(Math.max(v,.003))-Math.log10(.01)));
  const xs=Array.from({length:101},(_,i)=>.003*10**(i/100*Math.log10(100/.003)));
  const path=fn=>xs.map((v,i)=>`${i?'L':'M'}${num(x(v))} ${num(y(Math.max(2.5,fn(v))))}`).join(' ');
  let svg=header(W,H,'Illustrative SSC domain map and selectable stages');
  svg+=`<rect width="${W}" height="${H}" fill="#fff"/>${text(L,22,'SSC domain map · illustrative','font-size="17" font-weight="700"')}`;
  svg+=`<rect x="${num(L)}" y="${T}" width="${num(x(.003)-L)}" height="${h}" fill="#e7f3ff"/><rect x="${num(x(.003))}" y="${T}" width="${num(L+w-x(.003))}" height="${h}" fill="#fdeceb"/>`;
  // Explicit polygons follow the drawn upper and lower diagram lines.
  svg+=`<path d="M ${num(x(.003))} ${T} L ${num(x(100))} ${T} ${xs.slice().reverse().map(v=>`L ${num(x(v))} ${num(y(upper(v)))}`).join(' ')} Z" fill="#e9f3ff"/>`;
  svg+=`<path d="${path(upper)} ${xs.slice().reverse().map(v=>`L ${num(x(v))} ${num(y(Math.max(2.5,lower(v))))}`).join(' ')} Z" fill="#fff2d7"/>`;
  for(let decade=-5;decade<=2;decade++)svg+=gridline(x(10**decade),T,x(10**decade),T+h)+text(x(10**decade),H-45,`10^${decade}`,'text-anchor="middle" fill="#66819b"');
  for(let p=2.5;p<=7.5;p+=1)svg+=gridline(L,y(p),L+w,y(p))+text(L-11,y(p)+4,p.toFixed(1),'text-anchor="end" fill="#66819b"');
  svg+=`<line x1="${num(x(.003))}" x2="${num(x(.003))}" y1="${T}" y2="${num(T+h)}" stroke="${blue}" stroke-width="2"/><path d="${path(upper)}" stroke="${mid}" stroke-width="2.5" fill="none"/><path d="${path(lower)}" stroke="${mid}" stroke-width="2.5" fill="none"/>`;
  for (const [v,p,label] of [[.00018,6.3,'D0'],[.25,6.9,'D1'],[2,6.0,'D2'],[2,3.75,'D3']]) svg+=text(x(v),y(p),label,'text-anchor="middle" font-size="17" font-weight="700"');
  stages.forEach((s,i)=>{
    if(s.pH2S<=0)return;
    if(s.ph==null||s.ph<2.5||s.ph>7.5) {
      const px=x(s.pH2S);
      svg+=`<g data-plot-stage="${i}" tabindex="0" role="button" aria-label="Stage ${i+1}: pH unavailable or outside plotted range" style="cursor:pointer"><line x1="${num(px)}" x2="${num(px)}" y1="${T}" y2="${num(T+h)}" stroke="${unknown}" stroke-dasharray="5 5" stroke-width="2"/><title>Stage ${i+1}: pH needed to locate domain</title></g>`;
    } else svg+=point(x(s.pH2S),y(s.ph),i,s,i===selected,`pH₂S ${s.pH2S.toFixed(4)} bar, pH ${s.ph}, schematic ${s.domain}; ${s.phBasis} pH; water ${s.water}`);
  });
  svg+=text(W/2,H-17,'pH₂S (bar, logarithmic)','text-anchor="middle" font-weight="600"');
  svg+=`<text x="18" y="${H/2}" transform="rotate(-90 18 ${H/2})" font-family="Arial, Helvetica, sans-serif" font-size="12" fill="${ink}" text-anchor="middle">Aqueous pH</text>`;
  svg+=text(L,H-2,'Diagram geometry only · D0–D3 are not material acceptance criteria','font-size="11" fill="#66819b"');
  return svg+'</svg>';
}

export function h2sSVG(stages,selected=0) {
  const W=760,H=300,L=75,T=37,R=25,B=60,w=W-L-R,h=H-T-B;
  const max=Math.max(.1,...stages.map(s=>s.pH2S))*1.16;
  const y=v=>T+h-v/max*h;
  let svg=header(W,H,'H2S partial pressure by selectable stage');
  svg+=`<rect width="${W}" height="${H}" fill="#fff"/>${text(L,22,'H₂S partial pressure by stage','font-size="17" font-weight="700"')}`;
  for(let k=0;k<=4;k++)svg+=gridline(L,y(max*k/4),L+w,y(max*k/4))+text(L-10,y(max*k/4)+4,(max*k/4).toFixed(2),'text-anchor="end"');
  const slot=w/stages.length;
  stages.forEach((s,i)=>{
    const px=L+slot*(i+.5),bh=T+h-y(s.pH2S),color=mark(s);
    svg+=`<g data-plot-stage="${i}" tabindex="0" role="button" aria-label="Stage ${i+1}: pH2S ${s.pH2S.toFixed(4)} bar" style="cursor:pointer"><rect x="${num(px-16)}" y="${num(y(s.pH2S))}" width="32" height="${num(Math.max(bh,1))}" rx="3" fill="${color}" ${i===selected?`stroke="${blue}" stroke-width="2"`:''}/>${text(px,H-31,`St${i+1}`,'text-anchor="middle" font-weight="700"')}<title>Stage ${i+1}: pH₂S ${s.pH2S.toFixed(4)} bar; water ${s.water}</title></g>`;
  });
  svg+=text(L,H-3,'Wet stage: red · dry stage: blue · water unknown: amber','font-size="11" fill="#66819b"');
  return svg+'</svg>';
}
