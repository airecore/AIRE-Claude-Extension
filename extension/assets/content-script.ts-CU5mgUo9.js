(function(){function e(e){return new Promise(t=>setTimeout(t,e))}async function t(t,n,r){let i=Math.max(1,Math.ceil(r/n)+1);for(let r=0;r<i;r++){let a=t();if(a)return a;r<i-1&&await e(n)}return null}function n(e){return(e.textContent??``).trim().length===0}var r=[`[data-testid="chat-input"]`,`div.ProseMirror[contenteditable="true"]`,`[contenteditable="true"][aria-label*="prompt" i]`,`[contenteditable="true"][aria-label*="Claude" i]`,`fieldset [contenteditable="true"]`,`form [contenteditable="true"]`,`[contenteditable="true"][role="textbox"]`],i=150,a=3e3;function o(e){return e.getClientRects().length>0}function s(e){return e.isContentEditable?e:e.querySelector(`[contenteditable="true"]`)}function c(e=document){for(let t of r)for(let n of Array.from(e.querySelectorAll(t))){let e=s(n);if(e&&o(e))return e}return null}function l(e=location.pathname){let t=e.split(`/`).filter(Boolean)[0]??`home`;return/^[a-z-]{1,20}$/i.test(t)?t:`other`}async function u(e){let r=await t(c,i,a);return r?(r.focus(),!document.execCommand(`insertText`,!1,e)||n(r)?(console.warn(`[Claude Tools] prompt insertion did not take effect`),{ok:!1,error:`insert_failed`,message:`Couldn't type the prompt into Claude's chat box. Try reloading the page.`}):{ok:!0}):(console.warn(`[Claude Tools] chat input not found within timeout`),{ok:!1,error:`input_not_found`,message:`Couldn't find Claude's chat box. Try reloading the page.`})}var d=3e5,f=250;function p(e,t=Date.now){let r=c();if(!r)return()=>{};let i=!1,a=n(r)?null:t(),o=t=>{i||(i=!0,s.disconnect(),clearTimeout(l),t&&e())},s=new MutationObserver(()=>{if(!i){if(!n(r)){a===null&&(a=t());return}a!==null&&t()-a>=f&&o(!0)}});s.observe(r,{childList:!0,subtree:!0,characterData:!0});let l=setTimeout(()=>o(!1),d);return()=>o(!1)}var m={session:`Session`,weekly_all:`Weekly`},h={out_of_credits:`Out of credits`};function g(e){return h[e]??e.replace(/_/g,` `)}function _(e){return typeof e==`object`&&!!e}function v(e){if(!_(e))return null;let t=e.kind,n=e.percent,r=e.severity;if(typeof t!=`string`||typeof n!=`number`||typeof r!=`string`)return null;let i=typeof e.resets_at==`string`?e.resets_at:null;return{label:y(t,e.scope),percent:n,severity:r,resetsAt:i,disabledReason:null}}function y(e,t){if(m[e])return m[e];let n=_(t)&&_(t.model)?t.model.display_name:null;if(typeof n==`string`&&n)return e.startsWith(`weekly`)?`Weekly · ${n}`:n;let r=e.replace(/_/g,` `);return r.charAt(0).toUpperCase()+r.slice(1)}function b(e){if(!_(e))return null;let t=e.percent,n=e.severity;if(typeof t!=`number`||typeof n!=`string`)return null;if(e.enabled===!0)return{label:`Extra usage`,percent:t,severity:n,resetsAt:null,disabledReason:null};let r=typeof e.disabled_reason==`string`?e.disabled_reason:null;return r?{label:`Extra usage`,percent:t,severity:n,resetsAt:null,disabledReason:g(r)}:null}function x(e,t){if(e===null)return null;let n=Date.parse(e);if(Number.isNaN(n))return null;let r=n-t;if(r<6e4)return`resets soon`;let i=Math.floor(r/6e4);if(i<60)return`resets in ${i}m`;let a=Math.floor(r/36e5);return a<24?`resets in ${a}h`:`resets in ${Math.floor(r/864e5)}d`}function S(e){if(!_(e))return{meters:[]};let t=[];if(Array.isArray(e.limits))for(let n of e.limits){let e=v(n);e&&t.push(e)}let n=b(e.spend);return n&&t.push(n),{meters:t}}function C(e){let t=document.cookie.match(RegExp(`(?:^|; )${e}=([^;]*)`));return t?decodeURIComponent(t[1]):null}async function w(){let e=C(`lastActiveOrg`);if(!e)return console.warn(`[Claude Tools] no lastActiveOrg cookie found; cannot fetch usage`),{ok:!1};let t;try{t=await fetch(`https://claude.ai/api/organizations/${encodeURIComponent(e)}/usage`,{credentials:`include`})}catch(e){return console.error(`[Claude Tools] usage fetch failed`,e),{ok:!1}}if(!t.ok)return console.error(`[Claude Tools] usage endpoint returned status`,t.status),{ok:!1};let n;try{n=await t.json()}catch(e){return console.error(`[Claude Tools] usage response was not valid JSON`,e),{ok:!1}}return{ok:!0,usage:S(n)}}var T=`[data-testid="sidebar-recents"]`,E=`claude-tools-usage-widget`,D=`claude-tools-usage-widget-style`,O=19,k=2*Math.PI*O,A=`http://www.w3.org/2000/svg`,j=`
#${E} {
  margin: 10px 8px 8px;
  padding: 10px 10px 14px;
  border-radius: 10px;
  color: inherit;
  background: color-mix(in srgb, currentColor 4%, transparent);
  border: 1px solid color-mix(in srgb, currentColor 12%, transparent);
  font-family: inherit;
}
#${E} .ctu-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
#${E} .ctu-title {
  font-size: 10.5px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: color-mix(in srgb, currentColor 60%, transparent);
}
#${E} .ctu-refresh {
  width: 18px;
  height: 18px;
  border-radius: 5px;
  border: none;
  background: transparent;
  color: color-mix(in srgb, currentColor 60%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  cursor: pointer;
  padding: 0;
}
#${E} .ctu-refresh:hover {
  background: color-mix(in srgb, currentColor 8%, transparent);
  color: inherit;
}
#${E} .ctu-rings {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  justify-items: center;
  gap: 6px;
}
#${E} .ctu-ring {
  position: relative;
  width: 56px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
#${E} .ctu-ring svg {
  width: 46px;
  height: 46px;
  transform: rotate(-90deg);
}
#${E} .ctu-ring circle {
  fill: none;
  stroke-width: 4;
}
#${E} .ctu-track {
  stroke: color-mix(in srgb, currentColor 14%, transparent);
}
#${E} .ctu-fill {
  stroke-linecap: round;
}
#${E} .ctu-fill.normal {
  stroke: #4caf50;
}
#${E} .ctu-fill.warning {
  stroke: #e09a2d;
}
#${E} .ctu-fill.critical {
  stroke: #e5484d;
}
#${E} .ctu-pct {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10.5px;
  font-weight: 700;
  color: inherit;
  font-variant-numeric: tabular-nums;
}
#${E} .ctu-label {
  display: block;
  margin-top: 3px;
  font-size: 9px;
  color: color-mix(in srgb, currentColor 65%, transparent);
}
#${E} .ctu-reset {
  display: block;
  margin-top: 2px;
  font-size: 8px;
  color: color-mix(in srgb, currentColor 50%, transparent);
  white-space: nowrap;
}
`;function M(e){return e===`normal`?`normal`:e===`warning`?`warning`:`critical`}function N(){if(document.getElementById(D))return;let e=document.createElement(`style`);e.id=D,e.textContent=j,document.head.appendChild(e)}function P(e,t,n,r,i){let a=document.createElement(`div`);a.className=`ctu-ring`,a.setAttribute(`role`,`img`);let o=i?0:Math.min(100,Math.max(0,t)),s=Math.round(o);a.setAttribute(`aria-label`,i?`${e}: ${i}`:r?`${e}: ${s}%, ${r}`:`${e}: ${s}%`);let c=document.createElementNS(A,`svg`);c.setAttribute(`viewBox`,`0 0 46 46`);let l=document.createElementNS(A,`circle`);l.setAttribute(`class`,`ctu-track`),l.setAttribute(`cx`,`23`),l.setAttribute(`cy`,`23`),l.setAttribute(`r`,String(O)),c.appendChild(l);let u=k-o/100*k,d=document.createElementNS(A,`circle`);d.setAttribute(`class`,`ctu-fill ${M(n)}`),d.setAttribute(`cx`,`23`),d.setAttribute(`cy`,`23`),d.setAttribute(`r`,String(O)),d.setAttribute(`stroke-dasharray`,String(k)),d.setAttribute(`stroke-dashoffset`,String(u)),c.appendChild(d),a.appendChild(c);let f=document.createElement(`span`);f.className=`ctu-pct`,f.textContent=i?`—`:`${s}%`,a.appendChild(f);let p=document.createElement(`span`);if(p.className=`ctu-label`,p.textContent=e,a.appendChild(p),i){let e=document.createElement(`span`);e.className=`ctu-reset`,e.textContent=i,a.appendChild(e)}else if(r){let e=document.createElement(`span`);e.className=`ctu-reset`,e.textContent=r,a.appendChild(e)}return a}function F(e){let t=document.createElement(`div`);t.id=E;let n=document.createElement(`div`);n.className=`ctu-head`;let r=document.createElement(`span`);r.className=`ctu-title`,r.textContent=`Usage`,n.appendChild(r);let i=document.createElement(`button`);i.type=`button`,i.className=`ctu-refresh`,i.textContent=`↻`,i.setAttribute(`aria-label`,`Refresh usage`),i.addEventListener(`click`,()=>{B()}),n.appendChild(i),t.appendChild(n);let a=Date.now(),o=document.createElement(`div`);return o.className=`ctu-rings`,e.forEach(e=>{let t=x(e.resetsAt,a);o.appendChild(P(e.label,e.percent,e.severity,t,e.disabledReason))}),t.appendChild(o),t}var I=!1,L=!1;function R(){L||(L=!0,setTimeout(()=>{L=!1,!document.getElementById(E)&&document.querySelector(T)&&B()},1e3))}function z(){I||(I=!0,new MutationObserver(R).observe(document.body,{childList:!0,subtree:!0}))}async function B(){let e=document.querySelector(T);if(!e)return;let t=await w();if(!t.ok||t.usage.meters.length===0)return;N();let n=F(t.usage.meters),r=document.getElementById(E);r?r.replaceWith(n):e.insertAdjacentElement(`beforebegin`,n)}async function V(){if(!await t(()=>document.querySelector(T),300,8e3)){console.warn(`[Claude Tools] sidebar recents anchor not found; usage widget not injected`);return}z(),await B()}function H(e,t,n,r){let i={type:`QA_REPORT`,name:e,message:t.slice(0,1e3),stack:n?.slice(0,4e3),props:r};try{chrome.runtime.sendMessage(i).catch(()=>{})}catch{}}function U(e){return e instanceof Error?{message:`${e.name}: ${e.message}`,stack:e.stack}:typeof e==`string`?{message:e,stack:void 0}:{message:`[object]`,stack:void 0}}var W=e=>(e??``).includes(`chrome-extension://`);function G(e,t,n){H(e,t,Error(t).stack,n)}function K(){let e=console.error.bind(console);console.error=(...t)=>{e(...t);let n=t.map(e=>U(e)),r=n.find(e=>e.stack)?.stack??Error().stack?.split(`
`).slice(2).join(`
`);W(r)&&H(`console_error`,n.map(e=>e.message).join(` `),r)},self.addEventListener(`error`,e=>{let t=e.error instanceof Error?e.error.stack:`at ${e.filename}:${e.lineno}:${e.colno}`;W(t)&&H(`uncaught_error`,e.message||`Uncaught error`,t)}),self.addEventListener(`unhandledrejection`,e=>{let{message:t,stack:n}=U(e.reason);W(n)&&H(`unhandled_rejection`,t,n)})}var q=window;(()=>{try{return q.__aireContentAlive?.()===!0}catch{return!1}})()||(q.__aireContentAlive=()=>{try{return!!chrome.runtime?.id}catch{return!1}},J());function J(){K(),console.log(`[Claude Tools] content script loaded on`,window.location.href),V(),chrome.runtime.onMessage.addListener((e,t,n)=>{if(!e||e.type!==`INSERT_PROMPT`)return;let{prompt:r,runToken:i}=e;return u(r).then(e=>{n(e),e.ok||G(`insert_${e.error}`,e.message,{page:l(),editables:document.querySelectorAll(`[contenteditable="true"]`).length}),B(),e.ok&&i&&p(()=>{let e={type:`PROMPT_SENT`,runToken:i};chrome.runtime.sendMessage(e).catch(()=>{})})}).catch(e=>{console.error(`[Claude Tools] unexpected error during insertPrompt`,e),n({ok:!1,error:`insert_failed`,message:`Something went wrong inserting the prompt. Check the console for details.`})}),!0}),chrome.runtime.onMessage.addListener((e,t,n)=>{if(!(!e||e.type!==`GET_USAGE`))return w().then(e=>n(e)).catch(e=>{console.error(`[Claude Tools] unexpected error during fetchUsage`,e),n({ok:!1})}),!0})}})()
