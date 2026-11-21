(function(){var e=[{id:`claude`,name:`Claude`,hosts:[`claude.ai`],inputSelectors:[`[data-testid="chat-input"]`,`div.ProseMirror[contenteditable="true"]`,`[contenteditable="true"][aria-label*="Claude" i]`]},{id:`chatgpt`,name:`ChatGPT`,hosts:[`chatgpt.com`,`chat.openai.com`],inputSelectors:[`#prompt-textarea`,`div.ProseMirror[contenteditable="true"]`,`[contenteditable="true"][aria-label*="ChatGPT" i]`,`textarea[aria-label*="ChatGPT" i]`,`textarea[placeholder*="ChatGPT" i]`]},{id:`copilot`,name:`Copilot`,hosts:[`copilot.microsoft.com`,`copilot.com`,`copilot.cloud.microsoft`,`m365.cloud.microsoft`],inputSelectors:[`#m365-chat-editor-target-element`,`textarea#userInput`,`[data-testid="composer-input"]`,`[contenteditable="true"][aria-label*="Copilot" i]`,`textarea[aria-label*="Copilot" i]`,`textarea[placeholder*="Copilot" i]`,`[contenteditable="true"][aria-label*="message" i]`,`textarea[aria-label*="message" i]`]},{id:`gemini`,name:`Gemini`,hosts:[`gemini.google.com`],inputSelectors:[`rich-textarea .ql-editor[contenteditable="true"]`,`[contenteditable="true"][aria-label*="Gemini" i]`]}];function t(t){return e.find(e=>e.hosts.includes(t))??null}function n(e){return new Promise(t=>setTimeout(t,e))}async function r(e,t,r){let i=Math.max(1,Math.ceil(r/t)+1);for(let r=0;r<i;r++){let a=e();if(a)return a;r<i-1&&await n(t)}return null}function i(e){return typeof e.value==`string`?e.value:e.textContent??``}function a(e){return i(e).trim().length===0}var o=[`[contenteditable="true"][aria-label*="prompt" i]`,`fieldset [contenteditable="true"]`,`form [contenteditable="true"]`,`[contenteditable="true"][role="textbox"]`,`form textarea`];function s(n=location.hostname){return[...(t(n)??e[0]).inputSelectors,...o]}function c(n=location.hostname){return(t(n)??e[0]).name}var l=150,u=3e3;function d(e){return e.getClientRects().length>0}var f=`[contenteditable="true"]:not(.ql-clipboard), textarea`;function p(e){return e.classList.contains(`ql-clipboard`)?!1:e.isContentEditable||e instanceof HTMLTextAreaElement}function m(e){return p(e)?e:e.querySelector(f)}function h(e=document){for(let t of s())for(let n of Array.from(e.querySelectorAll(t))){let e=m(n);if(e&&d(e))return e}return null}function g(e=location.pathname){let t=e.split(`/`).filter(Boolean)[0]??`home`;return/^[a-z-]{1,20}$/i.test(t)?t:`other`}function _(e,n){if(t(location.hostname)?.id===`copilot`&&e.isContentEditable){let t=new DataTransfer;t.setData(`text/plain`,n);let r=new ClipboardEvent(`paste`,{clipboardData:t,bubbles:!0,cancelable:!0});if(e.dispatchEvent(r),r.defaultPrevented&&!a(e))return!0}return document.execCommand(`insertText`,!1,n)}async function ee(e){let t=await r(h,l,u);return t?(t.focus(),!_(t,e)||a(t)?(console.warn(`[Claude Tools] prompt insertion did not take effect`),{ok:!1,error:`insert_failed`,message:`Couldn't type the prompt into ${c()}'s chat box. Try reloading the page.`}):{ok:!0}):(console.warn(`[Claude Tools] chat input not found within timeout`),{ok:!1,error:`input_not_found`,message:`Couldn't find ${c()}'s chat box. Try reloading the page.`})}var te=3e5,ne=250,re=200;function v(e,t=Date.now){let n=h();if(!n)return()=>{};let r=!1,i=a(n)?null:t(),o=t=>{r||(r=!0,clearInterval(s),clearTimeout(c),t&&e())},s=setInterval(()=>{if(!r){if(n.isConnected||(n=h()??n),!(!n.isConnected||a(n))){i===null&&(i=t());return}i!==null&&t()-i>=ne&&o(!0)}},re),c=setTimeout(()=>o(!1),te);return()=>o(!1)}var y={session:`Session`,weekly_all:`Weekly`},b={out_of_credits:`Out of credits`};function x(e){return b[e]??e.replace(/_/g,` `)}function S(e){return typeof e==`object`&&!!e}function C(e){if(!S(e))return null;let t=e.kind,n=e.percent,r=e.severity;if(typeof t!=`string`||typeof n!=`number`||typeof r!=`string`)return null;let i=typeof e.resets_at==`string`?e.resets_at:null,a=t===`session`?`session`:t===`weekly_all`?`weekly`:void 0;return{label:w(t,e.scope),percent:n,severity:r,resetsAt:i,disabledReason:null,key:a}}function w(e,t){if(y[e])return y[e];let n=S(t)&&S(t.model)?t.model.display_name:null;if(typeof n==`string`&&n)return e.startsWith(`weekly`)?`Weekly · ${n}`:n;let r=e.replace(/_/g,` `);return r.charAt(0).toUpperCase()+r.slice(1)}function T(e){if(!S(e))return null;let t=e.percent,n=e.severity;if(typeof t!=`number`||typeof n!=`string`)return null;if(e.enabled===!0)return{label:`Extra usage`,percent:t,severity:n,resetsAt:null,disabledReason:null,key:`spend`};let r=typeof e.disabled_reason==`string`?e.disabled_reason:null;return r?{label:`Extra usage`,percent:t,severity:n,resetsAt:null,disabledReason:x(r),key:`spend`}:null}function E(e,t){if(e===null)return null;let n=Date.parse(e);if(Number.isNaN(n))return null;let r=n-t;if(r<6e4)return`resets soon`;let i=Math.floor(r/6e4);if(i<60)return`resets in ${i}m`;let a=Math.floor(r/36e5);return a<24?`resets in ${a}h`:`resets in ${Math.floor(r/864e5)}d`}function D(e){if(!S(e))return{meters:[]};let t=[];if(Array.isArray(e.limits))for(let n of e.limits){let e=C(n);e&&t.push(e)}let n=T(e.spend);return n&&t.push(n),{meters:t}}function ie(e){return e>=90?`critical`:e>=70?`warning`:`normal`}var ae={deep_research:`Deep research`,image_gen:`Images`,reason:`Thinking`,file_upload:`File uploads`};function oe(e){if(!S(e)||!Array.isArray(e.limits_progress))return{meters:[]};let t=[];for(let n of e.limits_progress){if(!S(n))continue;let e=typeof n.feature_name==`string`?ae[n.feature_name]:void 0;!e||typeof n.remaining!=`number`||t.push({label:e,percent:0,severity:n.remaining===0?`critical`:n.remaining<=2?`warning`:`normal`,resetsAt:typeof n.reset_after==`string`?n.reset_after:null,disabledReason:null,remaining:n.remaining})}return{meters:t}}function se(e){let t=e.split(/\n+/).map(e=>e.trim()).filter(Boolean),n=e.match(/(\d+(?:\.\d+)?)\s*% used/i);if(t.length===0||!n)return null;let r=t[0],i=/week/i.test(r),a=Number(n[1]),o=t.find(e=>/^resets?(\s|$)/i.test(e));return{label:i?`Weekly`:/current|session|daily/i.test(r)?`Current`:r,percent:a,severity:ie(a),resetsAt:null,disabledReason:null,key:i?`weekly`:/current|session|daily/i.test(r)?`session`:void 0,resetText:o?o.charAt(0).toLowerCase()+o.slice(1):void 0}}function ce(e){try{let t=document.cookie.match(RegExp(`(?:^|; )${e}=([^;]*)`));return t?decodeURIComponent(t[1]):null}catch{return null}}async function O(){let e=ce(`lastActiveOrg`);if(!e)return console.warn(`[Claude Tools] no lastActiveOrg cookie found; cannot fetch usage`),{ok:!1};let t;try{t=await fetch(`https://claude.ai/api/organizations/${encodeURIComponent(e)}/usage`,{credentials:`include`})}catch(e){return console.error(`[Claude Tools] usage fetch failed`,e),{ok:!1}}if(!t.ok)return console.error(`[Claude Tools] usage endpoint returned status`,t.status),{ok:!1};let n;try{n=await t.json()}catch(e){return console.error(`[Claude Tools] usage response was not valid JSON`,e),{ok:!1}}return{ok:!0,usage:D(n)}}async function k(){try{let e=await(await fetch(`/api/auth/session`,{credentials:`include`})).json();if(typeof e.accessToken!=`string`)return{ok:!1};let t=await fetch(`/backend-api/conversation/init`,{method:`POST`,credentials:`include`,headers:{Authorization:`Bearer ${e.accessToken}`,"Content-Type":`application/json`},body:JSON.stringify({gizmo_id:null,requested_default_model:null,conversation_id:null,timezone_offset_min:new Date().getTimezoneOffset()})});return t.ok?{ok:!0,usage:oe(await t.json())}:(console.warn(`[Claude Tools] ChatGPT usage returned status`,t.status),{ok:!1})}catch(e){return console.warn(`[Claude Tools] ChatGPT usage could not be read`,e),{ok:!1}}}var A=`aire.geminiUsage`;async function j(){if(location.pathname!==`/usage`)return!1;let e=document.querySelector(`[aria-label="Usage windows"]`);if(!e)return!1;let t=Array.from(e.querySelectorAll(`li`)).map(e=>se(e.innerText)).filter(e=>e!==null);return t.length!==0&&(await chrome.storage.local.set({[A]:{meters:t,savedAt:Date.now()}}),!0)}async function M(){await j();let e=(await chrome.storage.local.get(A))[A];return!e||e.meters.length===0?{ok:!1}:{ok:!0,usage:{meters:e.meters},savedAt:e.savedAt}}var N={claude:{anchor:()=>document.querySelector(`[data-testid="sidebar-recents"]`),fetch:O},chatgpt:{anchor:()=>document.querySelector(`nav[aria-label="Chat history"] [class~="group/nav-section"]`),fetch:k},gemini:{anchor:()=>document.querySelector(`[data-test-id="overflow-container"] expandable-section`)??document.querySelector(`expandable-section[data-test-id="chats-expandable-section"]`),fetch:M,refreshHint:`Open Gemini’s usage page to update`}};function P(e=location.hostname){return N[t(e)?.id??`claude`]??null}var F=`claude-tools-usage-widget`,I=`claude-tools-usage-widget-style`,L=19,R=2*Math.PI*L,z=`http://www.w3.org/2000/svg`,B=`
#${F} {
  margin: 10px 8px 8px;
  padding: 10px 10px 14px;
  border-radius: 10px;
  color: inherit;
  background: color-mix(in srgb, currentColor 4%, transparent);
  border: 1px solid color-mix(in srgb, currentColor 12%, transparent);
  font-family: inherit;
}
#${F} .ctu-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
#${F} .ctu-title {
  font-size: 10.5px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: color-mix(in srgb, currentColor 60%, transparent);
}
#${F} .ctu-updated {
  margin-left: 6px;
  text-transform: none;
  letter-spacing: 0;
  color: color-mix(in srgb, currentColor 45%, transparent);
}
#${F} .ctu-refresh {
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
#${F} .ctu-refresh:hover {
  background: color-mix(in srgb, currentColor 8%, transparent);
  color: inherit;
}
#${F} .ctu-rings {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  justify-items: center;
  gap: 6px;
}
#${F} .ctu-ring {
  position: relative;
  width: 56px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
#${F} .ctu-ring svg {
  width: 46px;
  height: 46px;
  transform: rotate(-90deg);
}
#${F} .ctu-ring circle {
  fill: none;
  stroke-width: 4;
}
#${F} .ctu-track {
  stroke: color-mix(in srgb, currentColor 14%, transparent);
}
#${F} .ctu-fill {
  stroke-linecap: round;
}
#${F} .ctu-fill.normal {
  stroke: #4caf50;
}
#${F} .ctu-fill.warning {
  stroke: #e09a2d;
}
#${F} .ctu-fill.critical {
  stroke: #e5484d;
}
#${F} .ctu-pct {
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
#${F} .ctu-label {
  display: block;
  margin-top: 3px;
  font-size: 9px;
  color: color-mix(in srgb, currentColor 65%, transparent);
}
#${F} .ctu-reset {
  display: block;
  margin-top: 2px;
  font-size: 8px;
  color: color-mix(in srgb, currentColor 50%, transparent);
  white-space: nowrap;
}
`;function V(e){return e===`normal`?`normal`:e===`warning`?`warning`:`critical`}function H(){if(document.getElementById(I))return;let e=document.createElement(`style`);e.id=I,e.textContent=B,document.head.appendChild(e)}function le(e,t){let{label:n,percent:r,severity:i,disabledReason:a,remaining:o}=e,s=typeof o==`number`,c=document.createElement(`div`);c.className=`ctu-ring`,c.setAttribute(`role`,`img`);let l=a||s?0:Math.min(100,Math.max(0,r)),u=Math.round(l);c.setAttribute(`aria-label`,a?`${n}: ${a}`:s?`${n}: ${o} left${t?`, ${t}`:``}`:t?`${n}: ${u}%, ${t}`:`${n}: ${u}%`);let d=document.createElementNS(z,`svg`);d.setAttribute(`viewBox`,`0 0 46 46`);let f=document.createElementNS(z,`circle`);f.setAttribute(`class`,`ctu-track`),f.setAttribute(`cx`,`23`),f.setAttribute(`cy`,`23`),f.setAttribute(`r`,String(L)),d.appendChild(f);let p=R-l/100*R,m=document.createElementNS(z,`circle`);m.setAttribute(`class`,`ctu-fill ${V(i)}`),m.setAttribute(`cx`,`23`),m.setAttribute(`cy`,`23`),m.setAttribute(`r`,String(L)),m.setAttribute(`stroke-dasharray`,String(R)),m.setAttribute(`stroke-dashoffset`,String(p)),d.appendChild(m),c.appendChild(d);let h=document.createElement(`span`);h.className=`ctu-pct`,h.textContent=a?`—`:s?String(o):`${u}%`,c.appendChild(h);let g=document.createElement(`span`);if(g.className=`ctu-label`,g.textContent=n,c.appendChild(g),a){let e=document.createElement(`span`);e.className=`ctu-reset`,e.textContent=a,c.appendChild(e)}else if(t||s){let e=document.createElement(`span`);e.className=`ctu-reset`,e.textContent=s?[`left`,t].filter(Boolean).join(` · `):t,c.appendChild(e)}return c}function U(e,t){let n=Math.floor((t-e)/6e4);if(n<1)return`updated just now`;if(n<60)return`updated ${n}m ago`;let r=Math.floor(n/60);return r<24?`updated ${r}h ago`:`updated ${Math.floor(r/24)}d ago`}function W(e,t={}){let n=document.createElement(`div`);n.id=F;let r=document.createElement(`div`);r.className=`ctu-head`;let i=document.createElement(`span`);i.className=`ctu-title`,i.textContent=`Usage`;let a=Date.now();if(t.savedAt!==void 0){let e=document.createElement(`span`);e.className=`ctu-updated`,e.textContent=U(t.savedAt,a),i.appendChild(e)}r.appendChild(i);let o=document.createElement(`button`);o.type=`button`,o.className=`ctu-refresh`,o.textContent=`↻`;let s=t.refreshHint;o.setAttribute(`aria-label`,s??`Refresh usage`),o.title=s??`Refresh usage`,o.addEventListener(`click`,()=>{s&&location.pathname!==`/usage`?location.assign(`/usage`):J()}),r.appendChild(o),n.appendChild(r);let c=document.createElement(`div`);return c.className=`ctu-rings`,e.forEach(e=>{let t=e.resetText??E(e.resetsAt,a);c.appendChild(le(e,t))}),n.appendChild(c),n}var G=!1,K=!1,q=location.pathname;function ue(){K||(K=!0,setTimeout(()=>{K=!1;let e=P();if(!e)return;let t=location.pathname!==q;if(q=location.pathname,location.pathname===`/usage`&&e.refreshHint){j().then(e=>{(e||t)&&J()});return}document.getElementById(F)||e.anchor()&&J()},1e3))}function de(){G||(G=!0,new MutationObserver(ue).observe(document.body,{childList:!0,subtree:!0}))}async function J(){let e=P();if(!e)return;let t=e.anchor();if(!t)return;let n=await e.fetch();if(!n.ok||n.usage.meters.length===0)return;H();let r=W(n.usage.meters,{savedAt:n.savedAt,refreshHint:e.refreshHint}),i=document.getElementById(F);i?i.replaceWith(r):t.insertAdjacentElement(`beforebegin`,r),pe(r,t)}function fe(e){return document.createTreeWalker(e,NodeFilter.SHOW_TEXT,{acceptNode:e=>(e.textContent??``).trim()?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_SKIP}).nextNode()?.parentElement??null}function pe(e,t){let n=fe(t);n&&(e.style.fontFamily=getComputedStyle(n).fontFamily)}async function Y(){let e=P();if(e){if(de(),!await r(e.anchor,300,8e3)){console.warn(`[Claude Tools] sidebar anchor not found; usage widget not injected yet`);return}await J()}}function X(e,t,n,r){let i={type:`QA_REPORT`,name:e,message:t.slice(0,1e3),stack:n?.slice(0,4e3),props:r};try{chrome.runtime.sendMessage(i).catch(()=>{})}catch{}}function Z(e){return e instanceof Error?{message:`${e.name}: ${e.message}`,stack:e.stack}:typeof e==`string`?{message:e,stack:void 0}:{message:`[object]`,stack:void 0}}var Q=e=>(e??``).includes(`chrome-extension://`);function me(e,t,n){X(e,t,Error(t).stack,n)}function he(){let e=console.error.bind(console);console.error=(...t)=>{e(...t);let n=t.map(e=>Z(e)),r=n.find(e=>e.stack)?.stack??Error().stack?.split(`
`).slice(2).join(`
`);Q(r)&&X(`console_error`,n.map(e=>e.message).join(` `),r)},self.addEventListener(`error`,e=>{let t=e.error instanceof Error?e.error.stack:`at ${e.filename}:${e.lineno}:${e.colno}`;Q(t)&&X(`uncaught_error`,e.message||`Uncaught error`,t)}),self.addEventListener(`unhandledrejection`,e=>{let{message:t,stack:n}=Z(e.reason);Q(n)&&X(`unhandled_rejection`,t,n)})}var $=window;(()=>{try{return $.__aireContentAlive?.()===!0}catch{return!1}})()||($.__aireContentAlive=()=>{try{return!!chrome.runtime?.id}catch{return!1}},ge());function ge(){he(),console.log(`[Claude Tools] content script loaded on`,window.location.href);let e=t(location.hostname);Y().catch(e=>{console.warn(`[Claude Tools] usage box could not start`,e)}),chrome.runtime.onMessage.addListener((t,n,r)=>{if(!t||t.type!==`INSERT_PROMPT`)return;let{prompt:i,runToken:a}=t;return ee(i).then(t=>{r(t),t.ok||me(`insert_${t.error}`,t.message,{site:e?.id??`unknown`,page:g(),editables:document.querySelectorAll(`[contenteditable="true"], textarea`).length}),J(),t.ok&&a&&v(()=>{let e={type:`PROMPT_SENT`,runToken:a};chrome.runtime.sendMessage(e).catch(()=>{})})}).catch(e=>{console.error(`[Claude Tools] unexpected error during insertPrompt`,e),r({ok:!1,error:`insert_failed`,message:`Something went wrong inserting the prompt. Check the console for details.`})}),!0}),chrome.runtime.onMessage.addListener((t,n,r)=>{if(!t||t.type!==`GET_USAGE`)return;let i=P();if(!i){r({ok:!1});return}return i.fetch().then(t=>r(t.ok?{ok:!0,usage:t.usage,site:e?.id??`claude`}:t)).catch(e=>{console.error(`[Claude Tools] unexpected error during fetchUsage`,e),r({ok:!1})}),!0})}})()
