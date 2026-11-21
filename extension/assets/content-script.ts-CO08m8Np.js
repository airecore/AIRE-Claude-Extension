(function(){var e=[{id:`claude`,name:`Claude`,hosts:[`claude.ai`],inputSelectors:[`[data-testid="chat-input"]`,`div.ProseMirror[contenteditable="true"]`,`[contenteditable="true"][aria-label*="Claude" i]`]},{id:`chatgpt`,name:`ChatGPT`,hosts:[`chatgpt.com`,`chat.openai.com`],inputSelectors:[`#prompt-textarea`,`div.ProseMirror[contenteditable="true"]`,`textarea[aria-label*="ChatGPT" i]`,`textarea[placeholder*="ChatGPT" i]`]},{id:`copilot`,name:`Copilot`,hosts:[`copilot.microsoft.com`,`copilot.com`,`copilot.cloud.microsoft`,`m365.cloud.microsoft`],inputSelectors:[`textarea#userInput`,`[data-testid="composer-input"]`,`[contenteditable="true"][aria-label*="Copilot" i]`,`textarea[aria-label*="Copilot" i]`,`textarea[placeholder*="Copilot" i]`,`[contenteditable="true"][aria-label*="message" i]`,`textarea[aria-label*="message" i]`]},{id:`gemini`,name:`Gemini`,hosts:[`gemini.google.com`],inputSelectors:[`rich-textarea .ql-editor[contenteditable="true"]`,`[contenteditable="true"][aria-label*="Gemini" i]`]}];function t(t){return e.find(e=>e.hosts.includes(t))??null}function n(e){return new Promise(t=>setTimeout(t,e))}async function r(e,t,r){let i=Math.max(1,Math.ceil(r/t)+1);for(let r=0;r<i;r++){let a=e();if(a)return a;r<i-1&&await n(t)}return null}function i(e){return typeof e.value==`string`?e.value:e.textContent??``}function a(e){return i(e).trim().length===0}var o=[`[contenteditable="true"][aria-label*="prompt" i]`,`fieldset [contenteditable="true"]`,`form [contenteditable="true"]`,`[contenteditable="true"][role="textbox"]`,`form textarea`];function s(n=location.hostname){return[...(t(n)??e[0]).inputSelectors,...o]}function c(n=location.hostname){return(t(n)??e[0]).name}var l=150,u=3e3;function d(e){return e.getClientRects().length>0}var f=`[contenteditable="true"]:not(.ql-clipboard), textarea`;function p(e){return e.classList.contains(`ql-clipboard`)?!1:e.isContentEditable||e instanceof HTMLTextAreaElement}function m(e){return p(e)?e:e.querySelector(f)}function h(e=document){for(let t of s())for(let n of Array.from(e.querySelectorAll(t))){let e=m(n);if(e&&d(e))return e}return null}function g(e=location.pathname){let t=e.split(`/`).filter(Boolean)[0]??`home`;return/^[a-z-]{1,20}$/i.test(t)?t:`other`}async function _(e){let t=await r(h,l,u);return t?(t.focus(),!document.execCommand(`insertText`,!1,e)||a(t)?(console.warn(`[Claude Tools] prompt insertion did not take effect`),{ok:!1,error:`insert_failed`,message:`Couldn't type the prompt into ${c()}'s chat box. Try reloading the page.`}):{ok:!0}):(console.warn(`[Claude Tools] chat input not found within timeout`),{ok:!1,error:`input_not_found`,message:`Couldn't find ${c()}'s chat box. Try reloading the page.`})}var v=3e5,y=250,b=200;function x(e,t=Date.now){let n=h();if(!n)return()=>{};let r=!1,i=a(n)?null:t(),o=t=>{r||(r=!0,clearInterval(s),clearTimeout(c),t&&e())},s=setInterval(()=>{if(!r){if(n.isConnected||(n=h()??n),!(!n.isConnected||a(n))){i===null&&(i=t());return}i!==null&&t()-i>=y&&o(!0)}},b),c=setTimeout(()=>o(!1),v);return()=>o(!1)}var S={session:`Session`,weekly_all:`Weekly`},C={out_of_credits:`Out of credits`};function w(e){return C[e]??e.replace(/_/g,` `)}function T(e){return typeof e==`object`&&!!e}function E(e){if(!T(e))return null;let t=e.kind,n=e.percent,r=e.severity;if(typeof t!=`string`||typeof n!=`number`||typeof r!=`string`)return null;let i=typeof e.resets_at==`string`?e.resets_at:null;return{label:D(t,e.scope),percent:n,severity:r,resetsAt:i,disabledReason:null}}function D(e,t){if(S[e])return S[e];let n=T(t)&&T(t.model)?t.model.display_name:null;if(typeof n==`string`&&n)return e.startsWith(`weekly`)?`Weekly · ${n}`:n;let r=e.replace(/_/g,` `);return r.charAt(0).toUpperCase()+r.slice(1)}function O(e){if(!T(e))return null;let t=e.percent,n=e.severity;if(typeof t!=`number`||typeof n!=`string`)return null;if(e.enabled===!0)return{label:`Extra usage`,percent:t,severity:n,resetsAt:null,disabledReason:null};let r=typeof e.disabled_reason==`string`?e.disabled_reason:null;return r?{label:`Extra usage`,percent:t,severity:n,resetsAt:null,disabledReason:w(r)}:null}function k(e,t){if(e===null)return null;let n=Date.parse(e);if(Number.isNaN(n))return null;let r=n-t;if(r<6e4)return`resets soon`;let i=Math.floor(r/6e4);if(i<60)return`resets in ${i}m`;let a=Math.floor(r/36e5);return a<24?`resets in ${a}h`:`resets in ${Math.floor(r/864e5)}d`}function A(e){if(!T(e))return{meters:[]};let t=[];if(Array.isArray(e.limits))for(let n of e.limits){let e=E(n);e&&t.push(e)}let n=O(e.spend);return n&&t.push(n),{meters:t}}function ee(e){try{let t=document.cookie.match(RegExp(`(?:^|; )${e}=([^;]*)`));return t?decodeURIComponent(t[1]):null}catch{return null}}async function j(){let e=ee(`lastActiveOrg`);if(!e)return console.warn(`[Claude Tools] no lastActiveOrg cookie found; cannot fetch usage`),{ok:!1};let t;try{t=await fetch(`https://claude.ai/api/organizations/${encodeURIComponent(e)}/usage`,{credentials:`include`})}catch(e){return console.error(`[Claude Tools] usage fetch failed`,e),{ok:!1}}if(!t.ok)return console.error(`[Claude Tools] usage endpoint returned status`,t.status),{ok:!1};let n;try{n=await t.json()}catch(e){return console.error(`[Claude Tools] usage response was not valid JSON`,e),{ok:!1}}return{ok:!0,usage:A(n)}}var M=`[data-testid="sidebar-recents"]`,N=`claude-tools-usage-widget`,P=`claude-tools-usage-widget-style`,F=19,I=2*Math.PI*F,L=`http://www.w3.org/2000/svg`,R=`
#${N} {
  margin: 10px 8px 8px;
  padding: 10px 10px 14px;
  border-radius: 10px;
  color: inherit;
  background: color-mix(in srgb, currentColor 4%, transparent);
  border: 1px solid color-mix(in srgb, currentColor 12%, transparent);
  font-family: inherit;
}
#${N} .ctu-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
#${N} .ctu-title {
  font-size: 10.5px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: color-mix(in srgb, currentColor 60%, transparent);
}
#${N} .ctu-refresh {
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
#${N} .ctu-refresh:hover {
  background: color-mix(in srgb, currentColor 8%, transparent);
  color: inherit;
}
#${N} .ctu-rings {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  justify-items: center;
  gap: 6px;
}
#${N} .ctu-ring {
  position: relative;
  width: 56px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
#${N} .ctu-ring svg {
  width: 46px;
  height: 46px;
  transform: rotate(-90deg);
}
#${N} .ctu-ring circle {
  fill: none;
  stroke-width: 4;
}
#${N} .ctu-track {
  stroke: color-mix(in srgb, currentColor 14%, transparent);
}
#${N} .ctu-fill {
  stroke-linecap: round;
}
#${N} .ctu-fill.normal {
  stroke: #4caf50;
}
#${N} .ctu-fill.warning {
  stroke: #e09a2d;
}
#${N} .ctu-fill.critical {
  stroke: #e5484d;
}
#${N} .ctu-pct {
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
#${N} .ctu-label {
  display: block;
  margin-top: 3px;
  font-size: 9px;
  color: color-mix(in srgb, currentColor 65%, transparent);
}
#${N} .ctu-reset {
  display: block;
  margin-top: 2px;
  font-size: 8px;
  color: color-mix(in srgb, currentColor 50%, transparent);
  white-space: nowrap;
}
`;function z(e){return e===`normal`?`normal`:e===`warning`?`warning`:`critical`}function B(){if(document.getElementById(P))return;let e=document.createElement(`style`);e.id=P,e.textContent=R,document.head.appendChild(e)}function V(e,t,n,r,i){let a=document.createElement(`div`);a.className=`ctu-ring`,a.setAttribute(`role`,`img`);let o=i?0:Math.min(100,Math.max(0,t)),s=Math.round(o);a.setAttribute(`aria-label`,i?`${e}: ${i}`:r?`${e}: ${s}%, ${r}`:`${e}: ${s}%`);let c=document.createElementNS(L,`svg`);c.setAttribute(`viewBox`,`0 0 46 46`);let l=document.createElementNS(L,`circle`);l.setAttribute(`class`,`ctu-track`),l.setAttribute(`cx`,`23`),l.setAttribute(`cy`,`23`),l.setAttribute(`r`,String(F)),c.appendChild(l);let u=I-o/100*I,d=document.createElementNS(L,`circle`);d.setAttribute(`class`,`ctu-fill ${z(n)}`),d.setAttribute(`cx`,`23`),d.setAttribute(`cy`,`23`),d.setAttribute(`r`,String(F)),d.setAttribute(`stroke-dasharray`,String(I)),d.setAttribute(`stroke-dashoffset`,String(u)),c.appendChild(d),a.appendChild(c);let f=document.createElement(`span`);f.className=`ctu-pct`,f.textContent=i?`—`:`${s}%`,a.appendChild(f);let p=document.createElement(`span`);if(p.className=`ctu-label`,p.textContent=e,a.appendChild(p),i){let e=document.createElement(`span`);e.className=`ctu-reset`,e.textContent=i,a.appendChild(e)}else if(r){let e=document.createElement(`span`);e.className=`ctu-reset`,e.textContent=r,a.appendChild(e)}return a}function H(e){let t=document.createElement(`div`);t.id=N;let n=document.createElement(`div`);n.className=`ctu-head`;let r=document.createElement(`span`);r.className=`ctu-title`,r.textContent=`Usage`,n.appendChild(r);let i=document.createElement(`button`);i.type=`button`,i.className=`ctu-refresh`,i.textContent=`↻`,i.setAttribute(`aria-label`,`Refresh usage`),i.addEventListener(`click`,()=>{q()}),n.appendChild(i),t.appendChild(n);let a=Date.now(),o=document.createElement(`div`);return o.className=`ctu-rings`,e.forEach(e=>{let t=k(e.resetsAt,a);o.appendChild(V(e.label,e.percent,e.severity,t,e.disabledReason))}),t.appendChild(o),t}var U=!1,W=!1;function G(){W||(W=!0,setTimeout(()=>{W=!1,!document.getElementById(N)&&document.querySelector(M)&&q()},1e3))}function K(){U||(U=!0,new MutationObserver(G).observe(document.body,{childList:!0,subtree:!0}))}async function q(){let e=document.querySelector(M);if(!e)return;let t=await j();if(!t.ok||t.usage.meters.length===0)return;B();let n=H(t.usage.meters),r=document.getElementById(N);r?r.replaceWith(n):e.insertAdjacentElement(`beforebegin`,n)}async function J(){if(!await r(()=>document.querySelector(M),300,8e3)){console.warn(`[Claude Tools] sidebar recents anchor not found; usage widget not injected`);return}K(),await q()}function Y(e,t,n,r){let i={type:`QA_REPORT`,name:e,message:t.slice(0,1e3),stack:n?.slice(0,4e3),props:r};try{chrome.runtime.sendMessage(i).catch(()=>{})}catch{}}function X(e){return e instanceof Error?{message:`${e.name}: ${e.message}`,stack:e.stack}:typeof e==`string`?{message:e,stack:void 0}:{message:`[object]`,stack:void 0}}var Z=e=>(e??``).includes(`chrome-extension://`);function Q(e,t,n){Y(e,t,Error(t).stack,n)}function te(){let e=console.error.bind(console);console.error=(...t)=>{e(...t);let n=t.map(e=>X(e)),r=n.find(e=>e.stack)?.stack??Error().stack?.split(`
`).slice(2).join(`
`);Z(r)&&Y(`console_error`,n.map(e=>e.message).join(` `),r)},self.addEventListener(`error`,e=>{let t=e.error instanceof Error?e.error.stack:`at ${e.filename}:${e.lineno}:${e.colno}`;Z(t)&&Y(`uncaught_error`,e.message||`Uncaught error`,t)}),self.addEventListener(`unhandledrejection`,e=>{let{message:t,stack:n}=X(e.reason);Z(n)&&Y(`unhandled_rejection`,t,n)})}var $=window;(()=>{try{return $.__aireContentAlive?.()===!0}catch{return!1}})()||($.__aireContentAlive=()=>{try{return!!chrome.runtime?.id}catch{return!1}},ne());function ne(){te(),console.log(`[Claude Tools] content script loaded on`,window.location.href);let e=t(location.hostname),n=!e||e.id===`claude`;n&&J().catch(e=>{console.warn(`[Claude Tools] usage box could not start`,e)}),chrome.runtime.onMessage.addListener((t,r,i)=>{if(!t||t.type!==`INSERT_PROMPT`)return;let{prompt:a,runToken:o}=t;return _(a).then(t=>{i(t),t.ok||Q(`insert_${t.error}`,t.message,{site:e?.id??`unknown`,page:g(),editables:document.querySelectorAll(`[contenteditable="true"], textarea`).length}),n&&q(),t.ok&&o&&x(()=>{let e={type:`PROMPT_SENT`,runToken:o};chrome.runtime.sendMessage(e).catch(()=>{})})}).catch(e=>{console.error(`[Claude Tools] unexpected error during insertPrompt`,e),i({ok:!1,error:`insert_failed`,message:`Something went wrong inserting the prompt. Check the console for details.`})}),!0}),chrome.runtime.onMessage.addListener((e,t,n)=>{if(!(!e||e.type!==`GET_USAGE`))return j().then(e=>n(e)).catch(e=>{console.error(`[Claude Tools] unexpected error during fetchUsage`,e),n({ok:!1})}),!0})}})()
