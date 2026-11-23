(function(){var e=[{id:`claude`,name:`Claude`,hosts:[`claude.ai`],inputSelectors:[`[data-testid="chat-input"]`,`div.ProseMirror[contenteditable="true"]`,`[contenteditable="true"][aria-label*="Claude" i]`]},{id:`chatgpt`,name:`ChatGPT`,hosts:[`chatgpt.com`,`chat.openai.com`],inputSelectors:[`#prompt-textarea`,`div.ProseMirror[contenteditable="true"]`,`[contenteditable="true"][aria-label*="ChatGPT" i]`,`textarea[aria-label*="ChatGPT" i]`,`textarea[placeholder*="ChatGPT" i]`]},{id:`copilot`,name:`Copilot`,hosts:[`copilot.microsoft.com`,`copilot.com`,`copilot.cloud.microsoft`,`m365.cloud.microsoft`],inputSelectors:[`#m365-chat-editor-target-element`,`textarea#userInput`,`[data-testid="composer-input"]`,`[contenteditable="true"][aria-label*="Copilot" i]`,`textarea[aria-label*="Copilot" i]`,`textarea[placeholder*="Copilot" i]`,`[contenteditable="true"][aria-label*="message" i]`,`textarea[aria-label*="message" i]`]},{id:`gemini`,name:`Gemini`,hosts:[`gemini.google.com`],inputSelectors:[`rich-textarea .ql-editor[contenteditable="true"]`,`[contenteditable="true"][aria-label*="Gemini" i]`]}];function t(t){return e.find(e=>e.hosts.includes(t))??null}var n={"m365.cloud.microsoft":`/chat`};function r(e=location.hostname,t=location.pathname){let r=n[e];return!r||t===r||t.startsWith(`${r}/`)}function i(e){return new Promise(t=>setTimeout(t,e))}async function a(e,t,n){let r=Math.max(1,Math.ceil(n/t)+1);for(let n=0;n<r;n++){let a=e();if(a)return a;n<r-1&&await i(t)}return null}function o(e){return typeof e.value==`string`?e.value:e.textContent??``}function s(e){return o(e).trim().length===0}var c=[`[contenteditable="true"][aria-label*="prompt" i]`,`fieldset [contenteditable="true"]`,`form [contenteditable="true"]`,`[contenteditable="true"][role="textbox"]`,`form textarea`];function l(n=location.hostname){return[...(t(n)??e[0]).inputSelectors,...c]}function u(n=location.hostname){return(t(n)??e[0]).name}var d=150,f=3e3;function p(e){return e.getClientRects().length>0}var m=`[contenteditable="true"]:not(.ql-clipboard), textarea`;function h(e){return e.classList.contains(`ql-clipboard`)?!1:e.isContentEditable||e instanceof HTMLTextAreaElement}function g(e){return h(e)?e:e.querySelector(m)}function _(e=document){if(!r())return null;for(let t of l())for(let n of Array.from(e.querySelectorAll(t))){let e=g(n);if(e&&p(e))return e}return null}function ee(e=location.pathname){let t=e.split(`/`).filter(Boolean)[0]??`home`;return/^[a-z-]{1,20}$/i.test(t)?t:`other`}function v(e){return e.replace(/\s+/g,` `).trim()}function te(e,n){if(t(location.hostname)?.id===`copilot`&&e.isContentEditable){let t=new DataTransfer;t.setData(`text/plain`,n);let r=new ClipboardEvent(`paste`,{clipboardData:t,bubbles:!0,cancelable:!0});if(e.dispatchEvent(r),r.defaultPrevented)return}document.execCommand(`insertText`,!1,n)}var y=1500,b=50;async function x(e,t,n){let r=v(n).slice(0,40),a=Date.now()+y;for(;;){await i(b);for(let n of[e,_()]){if(!n||!n.isConnected)continue;let e=v(o(n));if(e&&(e.includes(r)||e!==t))return!0}if(Date.now()>=a)return!1}}async function S(e){let t=await a(_,d,f);if(!t)return console.warn(`[Claude Tools] chat input not found within timeout`),{ok:!1,error:`input_not_found`,message:`Couldn't find ${u()}'s chat box. Try reloading the page.`};let n=v(o(t));t.focus();let r=t.isConnected?t:_()??t;return te(r,e),await x(r,n,e)?{ok:!0}:(console.warn(`[Claude Tools] prompt insertion did not take effect`),{ok:!1,error:`insert_failed`,message:`Couldn't type the prompt into ${u()}'s chat box. Try reloading the page.`})}var C=3e5,w=250,T=200;function E(e,t=Date.now){let n=_();if(!n)return()=>{};let r=!1,i=s(n)?null:t(),a=t=>{r||(r=!0,clearInterval(o),clearTimeout(c),t&&e())},o=setInterval(()=>{if(!r){if(n.isConnected||(n=_()??n),!(!n.isConnected||s(n))){i===null&&(i=t());return}i!==null&&t()-i>=w&&a(!0)}},T),c=setTimeout(()=>a(!1),C);return()=>a(!1)}var D={session:`Session`,weekly_all:`Weekly`},ne={out_of_credits:`Out of credits`};function re(e){return ne[e]??e.replace(/_/g,` `)}function O(e){return typeof e==`object`&&!!e}function ie(e){if(!O(e))return null;let t=e.kind,n=e.percent,r=e.severity;if(typeof t!=`string`||typeof n!=`number`||typeof r!=`string`)return null;let i=typeof e.resets_at==`string`?e.resets_at:null,a=t===`session`?`session`:t===`weekly_all`?`weekly`:void 0;return{label:ae(t,e.scope),percent:n,severity:r,resetsAt:i,disabledReason:null,key:a}}function ae(e,t){if(D[e])return D[e];let n=O(t)&&O(t.model)?t.model.display_name:null;if(typeof n==`string`&&n)return e.startsWith(`weekly`)?`Weekly · ${n}`:n;let r=e.replace(/_/g,` `);return r.charAt(0).toUpperCase()+r.slice(1)}function oe(e){if(!O(e))return null;let t=e.percent,n=e.severity;if(typeof t!=`number`||typeof n!=`string`)return null;if(e.enabled===!0)return{label:`Extra usage`,percent:t,severity:n,resetsAt:null,disabledReason:null,key:`spend`};let r=typeof e.disabled_reason==`string`?e.disabled_reason:null;return r?{label:`Extra usage`,percent:t,severity:n,resetsAt:null,disabledReason:re(r),key:`spend`}:null}function se(e,t){if(e===null)return null;let n=Date.parse(e);if(Number.isNaN(n))return null;let r=n-t;if(r<6e4)return`resets soon`;let i=Math.floor(r/6e4);if(i<60)return`resets in ${i}m`;let a=Math.floor(r/36e5);return a<24?`resets in ${a}h`:`resets in ${Math.floor(r/864e5)}d`}function ce(e){if(!O(e))return{meters:[]};let t=[];if(Array.isArray(e.limits))for(let n of e.limits){let e=ie(n);e&&t.push(e)}let n=oe(e.spend);return n&&t.push(n),{meters:t}}function le(e){return e>=90?`critical`:e>=70?`warning`:`normal`}var ue={deep_research:`Deep research`,image_gen:`Images`,reason:`Thinking`,file_upload:`File uploads`};function de(e){if(!O(e)||!Array.isArray(e.limits_progress))return{meters:[]};let t=[];for(let n of e.limits_progress){if(!O(n))continue;let e=typeof n.feature_name==`string`?ue[n.feature_name]:void 0;!e||typeof n.remaining!=`number`||t.push({label:e,percent:0,severity:n.remaining===0?`critical`:n.remaining<=2?`warning`:`normal`,resetsAt:typeof n.reset_after==`string`?n.reset_after:null,disabledReason:null,remaining:n.remaining})}return{meters:t}}function fe(e){let t=e.split(/\n+/).map(e=>e.trim()).filter(Boolean),n=e.match(/(\d+(?:\.\d+)?)\s*% used/i);if(t.length===0||!n)return null;let r=t[0],i=/week/i.test(r),a=Number(n[1]),o=t.find(e=>/^resets?(\s|$)/i.test(e));return{label:i?`Weekly`:/current|session|daily/i.test(r)?`Current`:r,percent:a,severity:le(a),resetsAt:null,disabledReason:null,key:i?`weekly`:/current|session|daily/i.test(r)?`session`:void 0,resetText:o?o.charAt(0).toLowerCase()+o.slice(1):void 0}}function pe(e){try{let t=document.cookie.match(RegExp(`(?:^|; )${e}=([^;]*)`));return t?decodeURIComponent(t[1]):null}catch{return null}}async function k(){let e=pe(`lastActiveOrg`);if(!e)return console.warn(`[Claude Tools] no lastActiveOrg cookie found; cannot fetch usage`),{ok:!1};let t;try{t=await fetch(`https://claude.ai/api/organizations/${encodeURIComponent(e)}/usage`,{credentials:`include`})}catch(e){return console.warn(`[Claude Tools] usage fetch failed`,e),{ok:!1}}if(!t.ok)return console.warn(`[Claude Tools] usage endpoint returned status`,t.status),{ok:!1};let n;try{n=await t.json()}catch(e){return console.warn(`[Claude Tools] usage response was not valid JSON`,e),{ok:!1}}return{ok:!0,usage:ce(n)}}async function A(){try{let e=await(await fetch(`/api/auth/session`,{credentials:`include`})).json();if(typeof e.accessToken!=`string`)return{ok:!1};let t=await fetch(`/backend-api/conversation/init`,{method:`POST`,credentials:`include`,headers:{Authorization:`Bearer ${e.accessToken}`,"Content-Type":`application/json`},body:JSON.stringify({gizmo_id:null,requested_default_model:null,conversation_id:null,timezone_offset_min:new Date().getTimezoneOffset()})});return t.ok?{ok:!0,usage:de(await t.json())}:(console.warn(`[Claude Tools] ChatGPT usage returned status`,t.status),{ok:!1})}catch(e){return console.warn(`[Claude Tools] ChatGPT usage could not be read`,e),{ok:!1}}}var j=`aire.geminiUsage`;function M(e=location.pathname){let t=/^\/u\/(\d+)/.exec(e)?.[1];return t&&t!==`0`?`${j}.u${t}`:j}async function N(){if(!/^(\/u\/\d+)?\/usage\/?$/.test(location.pathname))return!1;let e=document.querySelector(`[aria-label="Usage windows"]`);if(!e)return!1;let t=Array.from(e.querySelectorAll(`li`)).map(e=>fe(e.innerText)).filter(e=>e!==null);if(t.length===0)return!1;let n=(await chrome.storage.local.get(M()))[M()],r=JSON.stringify(n?.meters)!==JSON.stringify(t);return await chrome.storage.local.set({[M()]:{meters:t,savedAt:Date.now()}}),r}async function P(){await N();let e=(await chrome.storage.local.get(M()))[M()];return!e||e.meters.length===0?{ok:!1}:{ok:!0,usage:{meters:e.meters},savedAt:e.savedAt}}var F={claude:{anchor:()=>document.querySelector(`[data-testid="sidebar-recents"]`),fetch:k},chatgpt:{anchor:()=>document.querySelector(`nav[aria-label="Chat history"] [class~="group/nav-section"]`),fetch:A},gemini:{anchor:()=>document.querySelector(`[data-test-id="overflow-container"] expandable-section`)??document.querySelector(`expandable-section[data-test-id="chats-expandable-section"]`),fetch:P,refreshHint:`Open Gemini’s usage page to update`}};function I(e=location.hostname){return F[t(e)?.id??`claude`]??null}var L=`claude-tools-usage-widget`,R=`claude-tools-usage-widget-style`,z=19,B=2*Math.PI*z,V=`http://www.w3.org/2000/svg`,me=`
#${L} {
  margin: 10px 8px 8px;
  padding: 10px 10px 14px;
  border-radius: 10px;
  color: inherit;
  background: color-mix(in srgb, currentColor 4%, transparent);
  border: 1px solid color-mix(in srgb, currentColor 12%, transparent);
  font-family: inherit;
}
#${L} .ctu-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
#${L} .ctu-title {
  font-size: 10.5px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: color-mix(in srgb, currentColor 60%, transparent);
}
#${L} .ctu-updated {
  margin-left: 6px;
  text-transform: none;
  letter-spacing: 0;
  color: color-mix(in srgb, currentColor 45%, transparent);
}
#${L} .ctu-refresh {
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
#${L} .ctu-refresh:hover {
  background: color-mix(in srgb, currentColor 8%, transparent);
  color: inherit;
}
#${L} .ctu-rings {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  justify-items: center;
  gap: 6px;
}
#${L} .ctu-ring {
  position: relative;
  width: 56px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
#${L} .ctu-ring svg {
  width: 46px;
  height: 46px;
  transform: rotate(-90deg);
}
#${L} .ctu-ring circle {
  fill: none;
  stroke-width: 4;
}
#${L} .ctu-track {
  stroke: color-mix(in srgb, currentColor 14%, transparent);
}
#${L} .ctu-fill {
  stroke-linecap: round;
}
#${L} .ctu-fill.normal {
  stroke: #4caf50;
}
#${L} .ctu-fill.warning {
  stroke: #e09a2d;
}
#${L} .ctu-fill.critical {
  stroke: #e5484d;
}
#${L} .ctu-pct {
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
#${L} .ctu-label {
  display: block;
  margin-top: 3px;
  font-size: 9px;
  color: color-mix(in srgb, currentColor 65%, transparent);
}
#${L} .ctu-reset {
  display: block;
  margin-top: 2px;
  font-size: 8px;
  color: color-mix(in srgb, currentColor 50%, transparent);
  white-space: nowrap;
}
`;function he(e){return e===`normal`?`normal`:e===`warning`?`warning`:`critical`}function ge(){if(document.getElementById(R))return;let e=document.createElement(`style`);e.id=R,e.textContent=me,document.head.appendChild(e)}function _e(e,t){let{label:n,percent:r,severity:i,disabledReason:a,remaining:o}=e,s=typeof o==`number`,c=document.createElement(`div`);c.className=`ctu-ring`,c.setAttribute(`role`,`img`);let l=a||s?0:Math.min(100,Math.max(0,r)),u=Math.round(l);c.setAttribute(`aria-label`,a?`${n}: ${a}`:s?`${n}: ${o} left${t?`, ${t}`:``}`:t?`${n}: ${u}%, ${t}`:`${n}: ${u}%`);let d=document.createElementNS(V,`svg`);d.setAttribute(`viewBox`,`0 0 46 46`);let f=document.createElementNS(V,`circle`);f.setAttribute(`class`,`ctu-track`),f.setAttribute(`cx`,`23`),f.setAttribute(`cy`,`23`),f.setAttribute(`r`,String(z)),d.appendChild(f);let p=B-l/100*B,m=document.createElementNS(V,`circle`);m.setAttribute(`class`,`ctu-fill ${he(i)}`),m.setAttribute(`cx`,`23`),m.setAttribute(`cy`,`23`),m.setAttribute(`r`,String(z)),m.setAttribute(`stroke-dasharray`,String(B)),m.setAttribute(`stroke-dashoffset`,String(p)),d.appendChild(m),c.appendChild(d);let h=document.createElement(`span`);h.className=`ctu-pct`,h.textContent=a?`—`:s?String(o):`${u}%`,c.appendChild(h);let g=document.createElement(`span`);if(g.className=`ctu-label`,g.textContent=n,c.appendChild(g),a){let e=document.createElement(`span`);e.className=`ctu-reset`,e.textContent=a,c.appendChild(e)}else if(t||s){let e=document.createElement(`span`);e.className=`ctu-reset`,e.textContent=s?[`left`,t].filter(Boolean).join(` · `):t,c.appendChild(e)}return c}function ve(e,t){let n=Math.floor((t-e)/6e4);if(n<1)return`updated just now`;if(n<60)return`updated ${n}m ago`;let r=Math.floor(n/60);return r<24?`updated ${r}h ago`:`updated ${Math.floor(r/24)}d ago`}function ye(e,t={}){let n=document.createElement(`div`);n.id=L;let r=document.createElement(`div`);r.className=`ctu-head`;let i=document.createElement(`span`);i.className=`ctu-title`,i.textContent=`Usage`;let a=Date.now();if(t.savedAt!==void 0){let e=document.createElement(`span`);e.className=`ctu-updated`,e.textContent=ve(t.savedAt,a),i.appendChild(e)}r.appendChild(i);let o=document.createElement(`button`);o.type=`button`,o.className=`ctu-refresh`,o.textContent=`↻`;let s=t.refreshHint;o.setAttribute(`aria-label`,s??`Refresh usage`),o.title=s??`Refresh usage`,o.addEventListener(`click`,()=>{s&&!q()?location.assign(be()):J({force:!0})}),r.appendChild(o),n.appendChild(r);let c=document.createElement(`div`);return c.className=`ctu-rings`,e.forEach(e=>{let t=e.resetText??se(e.resetsAt,a);c.appendChild(_e(e,t))}),n.appendChild(c),n}var H=!1,U=!1,W=typeof location>`u`?``:location.pathname,G=3e5,K=0;function q(e=location.pathname){return/^(\/u\/\d+)?\/usage\/?$/.test(e)}function be(e=location.pathname){return`${/^\/u\/\d+/.exec(e)?.[0]??``}/usage`}function xe(){U||(U=!0,setTimeout(()=>{U=!1;let e=I();if(!e)return;let t=location.pathname!==W;if(W=location.pathname,t&&(K=0),q()&&e.refreshHint){N().then(e=>{(e||t)&&J({force:!0})});return}document.getElementById(L)||Date.now()-K<G||e.anchor()&&J()},1e3))}function Se(e){let t=document.getElementById(L);return t!==null&&e.every(e=>t.contains(e.target)||[...Array.from(e.addedNodes),...Array.from(e.removedNodes)].some(e=>e===t))}function Ce(){H||(H=!0,new MutationObserver(e=>{Se(e)||xe()}).observe(document.body,{childList:!0,subtree:!0}))}async function J(e={}){let t=I();if(!t)return;let n=t.anchor();if(!n||!e.force&&Date.now()-K<G)return;let r=await t.fetch();if(!r.ok||r.usage.meters.length===0){K=Date.now();return}K=0,ge();let i=ye(r.usage.meters,{savedAt:r.savedAt,refreshHint:t.refreshHint}),a=document.getElementById(L);a?a.replaceWith(i):n.insertAdjacentElement(`beforebegin`,i),Y(i,n)}function we(e){return document.createTreeWalker(e,NodeFilter.SHOW_TEXT,{acceptNode:e=>(e.textContent??``).trim()?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_SKIP}).nextNode()?.parentElement??null}function Y(e,t){let n=we(t);n&&(e.style.fontFamily=getComputedStyle(n).fontFamily)}async function Te(){let e=I();if(e){if(Ce(),!await a(e.anchor,300,8e3)){console.warn(`[Claude Tools] sidebar anchor not found; usage widget not injected yet`);return}await J()}}function X(e,t,n,r){let i={type:`QA_REPORT`,name:e,message:t.slice(0,1e3),stack:n?.slice(0,4e3),props:r};try{chrome.runtime.sendMessage(i).catch(()=>{})}catch{}}function Z(e){return e instanceof Error?{message:`${e.name}: ${e.message}`,stack:e.stack}:typeof e==`string`?{message:e,stack:void 0}:typeof e==`number`||typeof e==`boolean`||e==null?{message:String(e),stack:void 0}:{message:`[object]`,stack:void 0}}var Q=e=>(e??``).includes(`chrome-extension://`);function Ee(e,t,n){X(e,t,Error(t).stack,n)}function De(){let e=console.error.bind(console);console.error=(...t)=>{e(...t);let n=t.map(e=>Z(e)),r=n.find(e=>e.stack)?.stack??Error().stack?.split(`
`).slice(2).join(`
`);Q(r)&&X(`console_error`,n.map(e=>e.message).join(` `),r)},self.addEventListener(`error`,e=>{let t=e.error instanceof Error?e.error.stack:`at ${e.filename}:${e.lineno}:${e.colno}`;Q(t)&&X(`uncaught_error`,e.message||`Uncaught error`,t)}),self.addEventListener(`unhandledrejection`,e=>{let{message:t,stack:n}=Z(e.reason);Q(n)&&X(`unhandled_rejection`,t,n)})}var Oe=36e5,$=window;(()=>{try{return $.__aireContentAlive?.()===!0}catch{return!1}})()||($.__aireContentAlive=()=>{try{return!!chrome.runtime?.id}catch{return!1}},ke());function ke(){De(),console.log(`[Claude Tools] content script loaded on`,window.location.href);let e=t(location.hostname);Te().catch(e=>{console.warn(`[Claude Tools] usage box could not start`,e)}),chrome.runtime.onMessage.addListener((t,n,r)=>{if(!t||t.type!==`INSERT_PROMPT`)return;let{prompt:i,runToken:a}=t;return S(i).then(t=>{r(t),t.ok||Ee(`insert_${t.error}`,t.message,{site:e?.id??`unknown`,page:ee(),editables:document.querySelectorAll(`[contenteditable="true"], textarea`).length}),J(),t.ok&&a&&E(()=>{let e={type:`PROMPT_SENT`,runToken:a};chrome.runtime.sendMessage(e).catch(()=>{})})}).catch(e=>{console.error(`[Claude Tools] unexpected error during insertPrompt`,e),r({ok:!1,error:`insert_failed`,message:`Something went wrong inserting the prompt. Check the console for details.`})}),!0}),chrome.runtime.onMessage.addListener((t,n,r)=>{if(!t||t.type!==`GET_USAGE`)return;let i=I();if(!i){r({ok:!1});return}return i.fetch().then(t=>{let n=t.ok&&t.savedAt!==void 0&&Date.now()-t.savedAt>Oe;r(t.ok&&!n?{ok:!0,usage:t.usage,site:e?.id??`claude`}:{ok:!1})}).catch(e=>{console.error(`[Claude Tools] unexpected error during fetchUsage`,e),r({ok:!1})}),!0})}})()
