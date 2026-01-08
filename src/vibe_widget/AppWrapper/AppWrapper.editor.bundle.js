var lt=Object.create;var Le=Object.defineProperty;var ut=Object.getOwnPropertyDescriptor;var ct=Object.getOwnPropertyNames;var dt=Object.getPrototypeOf,pt=Object.prototype.hasOwnProperty;var ie=(e,t)=>()=>(t||e((t={exports:{}}).exports,t),t.exports);var ft=(e,t,o,n)=>{if(t&&typeof t=="object"||typeof t=="function")for(let r of ct(t))!pt.call(e,r)&&r!==o&&Le(e,r,{get:()=>t[r],enumerable:!(n=ut(t,r))||n.enumerable});return e};var b=(e,t,o)=>(o=e!=null?lt(dt(e)):{},ft(t||!e||!e.__esModule?Le(o,"default",{value:e,enumerable:!0}):o,e));var Fe=ie(l=>{"use strict";var fe=Symbol.for("react.transitional.element"),gt=Symbol.for("react.portal"),mt=Symbol.for("react.fragment"),bt=Symbol.for("react.strict_mode"),xt=Symbol.for("react.profiler"),vt=Symbol.for("react.consumer"),ht=Symbol.for("react.context"),yt=Symbol.for("react.forward_ref"),wt=Symbol.for("react.suspense"),Ct=Symbol.for("react.memo"),Ne=Symbol.for("react.lazy"),Et=Symbol.for("react.activity"),He=Symbol.iterator;function St(e){return e===null||typeof e!="object"?null:(e=He&&e[He]||e["@@iterator"],typeof e=="function"?e:null)}var Oe={isMounted:function(){return!1},enqueueForceUpdate:function(){},enqueueReplaceState:function(){},enqueueSetState:function(){}},De=Object.assign,Be={};function K(e,t,o){this.props=e,this.context=t,this.refs=Be,this.updater=o||Oe}K.prototype.isReactComponent={};K.prototype.setState=function(e,t){if(typeof e!="object"&&typeof e!="function"&&e!=null)throw Error("takes an object of state variables to update or a function which returns an object of state variables.");this.updater.enqueueSetState(this,e,t,"setState")};K.prototype.forceUpdate=function(e){this.updater.enqueueForceUpdate(this,e,"forceUpdate")};function Ye(){}Ye.prototype=K.prototype;function ge(e,t,o){this.props=e,this.context=t,this.refs=Be,this.updater=o||Oe}var me=ge.prototype=new Ye;me.constructor=ge;De(me,K.prototype);me.isPureReactComponent=!0;var ze=Array.isArray;function pe(){}var g={H:null,A:null,T:null,S:null},Ue=Object.prototype.hasOwnProperty;function be(e,t,o){var n=o.ref;return{$$typeof:fe,type:e,key:t,ref:n!==void 0?n:null,props:o}}function kt(e,t){return be(e.type,t,e.props)}function xe(e){return typeof e=="object"&&e!==null&&e.$$typeof===fe}function Rt(e){var t={"=":"=0",":":"=2"};return"$"+e.replace(/[=:]/g,function(o){return t[o]})}var Ie=/\/+/g;function de(e,t){return typeof e=="object"&&e!==null&&e.key!=null?Rt(""+e.key):t.toString(36)}function _t(e){switch(e.status){case"fulfilled":return e.value;case"rejected":throw e.reason;default:switch(typeof e.status=="string"?e.then(pe,pe):(e.status="pending",e.then(function(t){e.status==="pending"&&(e.status="fulfilled",e.value=t)},function(t){e.status==="pending"&&(e.status="rejected",e.reason=t)})),e.status){case"fulfilled":return e.value;case"rejected":throw e.reason}}throw e}function G(e,t,o,n,r){var i=typeof e;(i==="undefined"||i==="boolean")&&(e=null);var a=!1;if(e===null)a=!0;else switch(i){case"bigint":case"string":case"number":a=!0;break;case"object":switch(e.$$typeof){case fe:case gt:a=!0;break;case Ne:return a=e._init,G(a(e._payload),t,o,n,r)}}if(a)return r=r(e),a=n===""?"."+de(e,0):n,ze(r)?(o="",a!=null&&(o=a.replace(Ie,"$&/")+"/"),G(r,t,o,"",function(k){return k})):r!=null&&(xe(r)&&(r=kt(r,o+(r.key==null||e&&e.key===r.key?"":(""+r.key).replace(Ie,"$&/")+"/")+a)),t.push(r)),1;a=0;var s=n===""?".":n+":";if(ze(e))for(var u=0;u<e.length;u++)n=e[u],i=s+de(n,u),a+=G(n,t,o,i,r);else if(u=St(e),typeof u=="function")for(e=u.call(e),u=0;!(n=e.next()).done;)n=n.value,i=s+de(n,u++),a+=G(n,t,o,i,r);else if(i==="object"){if(typeof e.then=="function")return G(_t(e),t,o,n,r);throw t=String(e),Error("Objects are not valid as a React child (found: "+(t==="[object Object]"?"object with keys {"+Object.keys(e).join(", ")+"}":t)+"). If you meant to render a collection of children, use an array instead.")}return a}function se(e,t,o){if(e==null)return e;var n=[],r=0;return G(e,n,"","",function(i){return t.call(o,i,r++)}),n}function Tt(e){if(e._status===-1){var t=e._result;t=t(),t.then(function(o){(e._status===0||e._status===-1)&&(e._status=1,e._result=o)},function(o){(e._status===0||e._status===-1)&&(e._status=2,e._result=o)}),e._status===-1&&(e._status=0,e._result=t)}if(e._status===1)return e._result.default;throw e._result}var je=typeof reportError=="function"?reportError:function(e){if(typeof window=="object"&&typeof window.ErrorEvent=="function"){var t=new window.ErrorEvent("error",{bubbles:!0,cancelable:!0,message:typeof e=="object"&&e!==null&&typeof e.message=="string"?String(e.message):String(e),error:e});if(!window.dispatchEvent(t))return}else if(typeof process=="object"&&typeof process.emit=="function"){process.emit("uncaughtException",e);return}console.error(e)},Mt={map:se,forEach:function(e,t,o){se(e,function(){t.apply(this,arguments)},o)},count:function(e){var t=0;return se(e,function(){t++}),t},toArray:function(e){return se(e,function(t){return t})||[]},only:function(e){if(!xe(e))throw Error("React.Children.only expected to receive a single React element child.");return e}};l.Activity=Et;l.Children=Mt;l.Component=K;l.Fragment=mt;l.Profiler=xt;l.PureComponent=ge;l.StrictMode=bt;l.Suspense=wt;l.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE=g;l.__COMPILER_RUNTIME={__proto__:null,c:function(e){return g.H.useMemoCache(e)}};l.cache=function(e){return function(){return e.apply(null,arguments)}};l.cacheSignal=function(){return null};l.cloneElement=function(e,t,o){if(e==null)throw Error("The argument must be a React element, but you passed "+e+".");var n=De({},e.props),r=e.key;if(t!=null)for(i in t.key!==void 0&&(r=""+t.key),t)!Ue.call(t,i)||i==="key"||i==="__self"||i==="__source"||i==="ref"&&t.ref===void 0||(n[i]=t[i]);var i=arguments.length-2;if(i===1)n.children=o;else if(1<i){for(var a=Array(i),s=0;s<i;s++)a[s]=arguments[s+2];n.children=a}return be(e.type,r,n)};l.createContext=function(e){return e={$$typeof:ht,_currentValue:e,_currentValue2:e,_threadCount:0,Provider:null,Consumer:null},e.Provider=e,e.Consumer={$$typeof:vt,_context:e},e};l.createElement=function(e,t,o){var n,r={},i=null;if(t!=null)for(n in t.key!==void 0&&(i=""+t.key),t)Ue.call(t,n)&&n!=="key"&&n!=="__self"&&n!=="__source"&&(r[n]=t[n]);var a=arguments.length-2;if(a===1)r.children=o;else if(1<a){for(var s=Array(a),u=0;u<a;u++)s[u]=arguments[u+2];r.children=s}if(e&&e.defaultProps)for(n in a=e.defaultProps,a)r[n]===void 0&&(r[n]=a[n]);return be(e,i,r)};l.createRef=function(){return{current:null}};l.forwardRef=function(e){return{$$typeof:yt,render:e}};l.isValidElement=xe;l.lazy=function(e){return{$$typeof:Ne,_payload:{_status:-1,_result:e},_init:Tt}};l.memo=function(e,t){return{$$typeof:Ct,type:e,compare:t===void 0?null:t}};l.startTransition=function(e){var t=g.T,o={};g.T=o;try{var n=e(),r=g.S;r!==null&&r(o,n),typeof n=="object"&&n!==null&&typeof n.then=="function"&&n.then(pe,je)}catch(i){je(i)}finally{t!==null&&o.types!==null&&(t.types=o.types),g.T=t}};l.unstable_useCacheRefresh=function(){return g.H.useCacheRefresh()};l.use=function(e){return g.H.use(e)};l.useActionState=function(e,t,o){return g.H.useActionState(e,t,o)};l.useCallback=function(e,t){return g.H.useCallback(e,t)};l.useContext=function(e){return g.H.useContext(e)};l.useDebugValue=function(){};l.useDeferredValue=function(e,t){return g.H.useDeferredValue(e,t)};l.useEffect=function(e,t){return g.H.useEffect(e,t)};l.useEffectEvent=function(e){return g.H.useEffectEvent(e)};l.useId=function(){return g.H.useId()};l.useImperativeHandle=function(e,t,o){return g.H.useImperativeHandle(e,t,o)};l.useInsertionEffect=function(e,t){return g.H.useInsertionEffect(e,t)};l.useLayoutEffect=function(e,t){return g.H.useLayoutEffect(e,t)};l.useMemo=function(e,t){return g.H.useMemo(e,t)};l.useOptimistic=function(e,t){return g.H.useOptimistic(e,t)};l.useReducer=function(e,t,o){return g.H.useReducer(e,t,o)};l.useRef=function(e){return g.H.useRef(e)};l.useState=function(e){return g.H.useState(e)};l.useSyncExternalStore=function(e,t,o){return g.H.useSyncExternalStore(e,t,o)};l.useTransition=function(){return g.H.useTransition()};l.version="19.2.3"});var j=ie((Nt,Je)=>{"use strict";Je.exports=Fe()});var Ve=ie(ae=>{"use strict";var At=Symbol.for("react.transitional.element"),$t=Symbol.for("react.fragment");function qe(e,t,o){var n=null;if(o!==void 0&&(n=""+o),t.key!==void 0&&(n=""+t.key),"key"in t){o={};for(var r in t)r!=="key"&&(o[r]=t[r])}else o=t;return t=o.ref,{$$typeof:At,type:e,key:n,ref:t!==void 0?t:null,props:o}}ae.Fragment=$t;ae.jsx=qe;ae.jsxs=qe});var y=ie((Dt,Ge)=>{"use strict";Ge.exports=Ve()});var E=b(j());var le=b(j()),F=b(y());function ve({value:e,onChange:t,isLoading:o,loadError:n}){let r=(0,le.useRef)(null);return(0,le.useEffect)(()=>{r.current&&(r.current.value=e||"")},[e]),(0,F.jsxs)("div",{class:"source-viewer-editor",style:{position:"relative",width:"100%",height:"100%"},children:[(0,F.jsx)("style",{children:`
        .source-viewer-editor {
          background: #0b0b0b;
          border: 1px solid rgba(242, 240, 233, 0.15);
          border-radius: 4px;
          min-height: 240px;
          color: #f2f0e9;
          font-family: "JetBrains Mono", "Space Mono", ui-monospace, SFMono-Regular,
            Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 12px;
        }
        .source-viewer-loading,
        .source-viewer-error {
          padding: 12px;
          font-size: 12px;
        }
        .source-viewer-error { color: #fca5a5; }
      `}),o&&(0,F.jsx)("div",{class:"source-viewer-loading",children:"Loading editor..."}),n&&(0,F.jsx)("div",{class:"source-viewer-error",children:n}),!o&&!n&&(0,F.jsx)("textarea",{ref:r,defaultValue:e||"",onInput:i=>t&&t(i.target.value),style:{width:"100%",height:"100%",border:"none",outline:"none",background:"transparent",color:"inherit",padding:"10px",boxSizing:"border-box",resize:"vertical"}})]})}var Ut=b(j()),d=b(y());function he({hasAuditPayload:e,visibleConcerns:t,dismissedConcerns:o,showDismissed:n,onToggleDismissed:r,onRestoreDismissed:i,expandedCards:a,technicalCards:s,hoveredCardId:u,onHoverCard:k,onToggleExpanded:$,onToggleTechnical:c,onAddPendingChange:v,onDismissConcern:T,onScrollToLines:I,onRunAudit:P}){let N=t.length===0,te=e?`${t.length} concerns`:"No audit yet";return(0,d.jsxs)("div",{class:"audit-panel",children:[(0,d.jsx)("style",{children:`
        .audit-panel {
          font-family: "JetBrains Mono", "Space Mono", ui-monospace, SFMono-Regular,
            Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          color: #f2f0e9;
        }
        .audit-panel a { color: #f97316; }
        .audit-panel a:hover { color: #fb923c; }
        .audit-panel-header {
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        .audit-card {
          border-bottom: 1px solid rgba(242, 240, 233, 0.2);
          padding: 10px 0;
        }
        .audit-card-title {
          font-size: 10px;
          text-transform: uppercase;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .impact-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          display: inline-block;
        }
        .audit-card-actions {
          display: flex;
          gap: 6px;
          margin: 6px 0;
        }
        .audit-card-actions button {
          border-radius: 2px;
          background: #0f0f0f;
          color: #f2f0e9;
          border: 1px solid rgba(242, 240, 233, 0.3);
          font-size: 10px;
          width: 20px;
          height: 20px;
        }
        .audit-card-actions button:hover { background: #1a1a1a; }
        .audit-line-link {
          border: 1px solid rgba(242, 240, 233, 0.2);
          border-radius: 2px;
          padding: 2px 6px;
          background: #0f0f0f;
          color: #f2f0e9;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          font-size: 10px;
        }
        .audit-card-summary,
        .audit-card-detail {
          font-size: 11px;
          line-height: 1.5;
        }
        .audit-run-link {
          background: none;
          border: none;
          color: #f97316;
          text-decoration: underline;
          cursor: pointer;
          font-size: 11px;
          padding: 0 0 0 6px;
        }
        .audit-empty {
          border: 1px solid rgba(242, 240, 233, 0.2);
          border-radius: 2px;
          background: #0f0f0f;
          font-size: 11px;
          padding: 10px;
        }
      `}),(0,d.jsxs)("div",{class:"audit-panel-header",children:[(0,d.jsx)("span",{children:"Audit Overview"}),(0,d.jsx)("span",{children:te})]}),N?(0,d.jsxs)("div",{class:"audit-empty",children:[e?"All audits resolved.":(0,d.jsxs)(d.Fragment,{children:["Run an audit to see findings. ",P&&(0,d.jsx)("button",{class:"audit-run-link",onClick:P,children:"Run an audit"})]}),Object.keys(o).length>0&&(0,d.jsxs)("div",{children:[(0,d.jsx)("button",{onClick:r,children:n?"Hide dismissed":"Show dismissed"}),n&&(0,d.jsx)("div",{class:"audit-dismissed-list",children:Object.entries(o).map(([p,m])=>(0,d.jsxs)("div",{class:"audit-dismissed-item",children:[(0,d.jsx)("span",{children:m}),(0,d.jsx)("button",{onClick:()=>i(p),children:"Restore"})]}))})]})]}):(0,d.jsx)("div",{class:"audit-grid",children:t.map(({concern:p,cardId:m,index:q})=>{let f=!!a[m],L=!!s[m],O=(p.impact||"low").toLowerCase(),Q=O==="high"?"#f87171":O==="medium"?"#f59e0b":"#34d399",H=Array.isArray(p.location)?p.location:[],B=H.length>0?`LINES ${Math.min(...H)}-${Math.max(...H)}`:"GLOBAL",oe=p.summary||"",X=p.technical_summary||"",Z=p.details||"",V=X&&X!==oe,ne=L&&V?X:oe;return(0,d.jsxs)("div",{class:`audit-card ${u&&u!==m?"dimmed":""} ${u===m?"highlight":""}`,onClick:()=>$(m),children:[(0,d.jsxs)("div",{class:"audit-card-title",title:`Impact: ${O}`,children:[(0,d.jsx)("span",{class:"impact-dot",style:{background:Q}}),(0,d.jsx)("span",{children:p.id||"concern"})]}),(0,d.jsxs)("div",{class:"audit-card-actions",children:[(0,d.jsx)("button",{class:"audit-add-button",title:"Add to Changes",onClick:M=>{M.stopPropagation(),v(p,m,{itemId:`${m}-base`,source:"base"})},children:"+"}),(0,d.jsx)("button",{class:"audit-dismiss-button",title:"Dismiss",onClick:M=>{M.stopPropagation(),T(m,p.id||"concern")},children:"\xD7"})]}),(0,d.jsx)("div",{class:"audit-card-meta",children:(0,d.jsx)("button",{class:"audit-line-link",onClick:M=>{M.stopPropagation(),H.length>0&&I(H)},children:B})}),(0,d.jsx)("div",{class:"audit-card-summary",onClick:M=>{V&&(M.stopPropagation(),c(m))},title:V?"Click to toggle technical note":"",children:ne}),f&&Z&&(0,d.jsx)("div",{class:"audit-card-detail",children:Z}),f&&p.alternatives&&p.alternatives.length>0&&(0,d.jsxs)("div",{class:"audit-card-list",children:["Recommendations:"," ",Array.isArray(p.alternatives)?p.alternatives.map((M,W)=>{let Y=M.option||M,ue=W===p.alternatives.length-1;return(0,d.jsxs)("span",{children:[(0,d.jsx)("span",{class:"audit-alternative",role:"button",tabIndex:"0",onClick:U=>{U.stopPropagation(),v(p,m,{itemId:`${m}-alt-${W}`,label:`Recommendation: ${Y}`,source:"recommendation",alternative:Y})},onKeyDown:U=>{(U.key==="Enter"||U.key===" ")&&(U.preventDefault(),v(p,m,{itemId:`${m}-alt-${W}`,label:`Recommendation: ${Y}`,source:"recommendation",alternative:Y}))},children:Y}),ue?"":", "]})}):""]})]})})})]})}var qt=b(j()),A=b(y());function ye({showApprove:e,auditIndicator:t,auditStatus:o,hasAuditPayload:n,showAuditPanel:r,onToggleAuditPanel:i,onRunAudit:a,onApprove:s,onClose:u}){return(0,A.jsxs)("div",{class:"source-viewer-header",children:[(0,A.jsx)("style",{children:`
        .source-viewer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 8px 12px;
          background: rgba(12, 12, 12, 0.9);
          border-bottom: 1px solid rgba(242, 240, 233, 0.12);
          color: #f2f0e9;
          font-family: "JetBrains Mono", "Space Mono", ui-monospace, SFMono-Regular,
            Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 12px;
        }
        .source-viewer-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .source-viewer-button {
          background: #f97316;
          color: #0b0b0b;
          border: none;
          border-radius: 6px;
          padding: 6px 10px;
          font-size: 12px;
          cursor: pointer;
        }
        .source-viewer-button.subtle {
          background: transparent;
          color: #e2e8f0;
          border: 1px solid rgba(242, 240, 233, 0.18);
        }
        .audit-indicator {
          color: #f97316;
          font-size: 11px;
        }
      `}),(0,A.jsxs)("div",{class:"source-viewer-title",children:[(0,A.jsx)("span",{children:"Source Viewer"}),t&&(0,A.jsx)("span",{class:"audit-indicator",children:t}),o==="running"&&(0,A.jsx)("span",{class:"audit-indicator",children:"Auditing..."})]}),(0,A.jsxs)("div",{class:"source-viewer-actions",children:[!n&&(0,A.jsx)("button",{class:"source-viewer-button",disabled:o==="running",onClick:a,children:o==="running"?"Auditing...":"Audit"}),n&&(0,A.jsx)("button",{class:"source-viewer-button subtle",onClick:i,children:r?"Hide Audit":"Show Audit"}),e?(0,A.jsx)("button",{class:"source-viewer-button",onClick:s,children:"Approve"}):(0,A.jsx)("button",{class:"source-viewer-button subtle",onClick:u,children:"Close"})]})]})}var to=b(j());var ee=b(j()),_=b(y());function we({logs:e=[],status:t="ready",fullHeight:o=!1,heading:n=null,footer:r=null}){let i=t!=="ready"&&t!=="error",a=t==="ready",[s,u]=ee.default.useState(0),k=["|","/","-","\\"],$=ee.default.useRef(null);return ee.default.useEffect(()=>{let c=$.current;if(!c)return;c.scrollHeight-c.scrollTop-c.clientHeight<24&&(c.scrollTop=c.scrollHeight)},[e]),ee.default.useEffect(()=>{if(!i)return;let c=setInterval(()=>{u(v=>(v+1)%k.length)},140);return()=>clearInterval(c)},[i,k.length]),(0,_.jsxs)("div",{class:"progress-bezel",children:[(0,_.jsx)("style",{children:`
        .progress-bezel {
          width: 100%;
          height: 100%;
          box-sizing: border-box;
          color: #e2e8f0;
          background: #050505;
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 0;
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.02);
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .progress-heading {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: "JetBrains Mono", "Space Mono", ui-monospace, SFMono-Regular,
            Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 12px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: #f2f0e9;
          padding-left: 9px;
        }
        .progress-heading .dot {
          width: 8px;
          height: 8px;
          border-radius: 0;
          background: ${a?"#22c55e":"#f97316"};
          box-shadow: 0 0 0 4px rgba(249, 115, 22, 0.12);
        }
        .progress-log-container {
          flex: 1;
          min-height: 0;
          ${o?"":"max-height: 240px;"}
          overflow: auto;
          background: transparent;
          border: 0;
          border-radius: 0;
          padding: 6px 0 0;
          box-shadow: none;
        }
        .progress-log-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
          font-family: "JetBrains Mono", "Space Mono", ui-monospace, SFMono-Regular,
            Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 12px;
          text-transform: uppercase;
        }
        .progress-log-list::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        
        .progress-log-list::-webkit-scrollbar-thumb {
          background: rgba(243, 119, 38, 0.3);
          border-radius: 2px;
        }
        
        .progress-log-list::-webkit-scrollbar-thumb:hover {
          background: rgba(243, 119, 38, 0.5);
        }

        .progress-footer {
          padding-top: 8px;
        }
        
        .log-entry {
          display: flex;
          align-items: baseline;
          gap: 4px;
          padding: 2px 0;
          color: #94a3b8;
          opacity: 0;
          animation: fadeIn 0.3s ease-out forwards;
          animation-delay: calc(var(--entry-index) * 0.03s);
          white-space: pre-wrap;
          word-break: break-word;
          text-transform: uppercase;
        }

        .log-icon {
          width: 10px;
          flex: 0 0 10px;
          margin-left: 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .log-icon-block {
          width: 6px;
          height: 6px;
          border-radius: 0;
          background: rgba(148, 163, 184, 0.6);
        }

        .log-entry--live .log-text {
          color: #f97316;
          text-transform: uppercase;
        }

        .log-entry--live .log-icon {
          color: #f97316;
        }

        .log-entry--done .log-text {
          color: #94a3b8;
        }

        .log-entry--terminal .log-text {
          color: #cbd5e1;
        }

        .cursor {
          display: inline-block;
          margin-left: 1px;
          animation: cursorBlink 1s steps(2, end) infinite;
        }

        @keyframes cursorBlink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }

        @keyframes fadeIn {
          to {
            opacity: 1;
          }
        }
      `}),n&&(0,_.jsxs)("div",{class:"progress-heading",children:[(0,_.jsx)("span",{class:"dot","aria-hidden":"true"}),(0,_.jsx)("span",{children:n})]}),(0,_.jsx)("div",{class:"progress-log-container",ref:$,children:(0,_.jsx)("ul",{class:"progress-log-list",children:e.map((c,v)=>{let T=typeof c=="string"?c:String(c),I=T.toLowerCase().includes("runtime error"),P=v===e.length-1&&i,N=["log-entry",a?"log-entry--done":"",P?"log-entry--live":"",I?"log-entry--terminal":""].filter(Boolean).join(" ");return(0,_.jsxs)("li",{class:N,style:{"--entry-index":v},children:[(0,_.jsx)("span",{class:"log-icon",children:P?k[s]:(0,_.jsx)("span",{class:"log-icon-block"})}),(0,_.jsx)("span",{class:"log-text",children:T})]},v)})})}),r&&(0,_.jsx)("div",{class:"progress-footer",children:r})]})}var w=b(j()),z=b(y());function Ce({value:e,onChange:t,onSubmit:o,disabled:n=!1,maxHeight:r=200,blink:i=!0}){let a=(0,w.useRef)(null),s=(0,w.useRef)(null),u=(0,w.useRef)(null),k=(0,w.useRef)(null),[$,c]=(0,w.useState)(0),[v,T]=(0,w.useState)({left:0,top:0,height:14}),I=(e||"").replace(/\r\n/g,`
`),P=Math.min($,I.length),N=I.slice(0,P),te=I.slice(P),p=(0,w.useCallback)(()=>{let f=a.current;if(!f)return;let L=f.selectionStart??0;c(L)},[]),m=(0,w.useCallback)(()=>{let f=s.current,L=a.current;if(!f||!L)return;let O=parseFloat(window.getComputedStyle(L).lineHeight||"14"),Q=Number.isFinite(O)?O:14,H=L.scrollTop||0,B=L.scrollLeft||0;T({left:f.offsetLeft-B,top:f.offsetTop-H,height:Q})},[]),q=(0,w.useCallback)(()=>{let f=a.current;if(!f)return;f.style.height="auto";let L=Math.min(f.scrollHeight,r);f.style.height=`${L}px`,f.style.overflowY=f.scrollHeight>r?"auto":"hidden"},[r]);return(0,w.useLayoutEffect)(()=>{q(),m()},[I,P,q,m]),(0,w.useEffect)(()=>{let f=()=>m();return window.addEventListener("resize",f),()=>window.removeEventListener("resize",f)},[m]),(0,w.useEffect)(()=>{p()},[I,p]),(0,z.jsx)("div",{class:"state-input-row",children:(0,z.jsxs)("div",{class:"log-entry log-entry--active log-entry--input",children:[(0,z.jsx)("style",{children:`
        .state-input-row {
          border-top: 1px solid rgba(242, 240, 233, 0.25);
          margin: 8px 8px 0;
          padding-top: 12px;
        }
          .log-entry--input {
            align-items: flex-start;
          }
        .log-entry--input .log-text {
          display: flex;
          align-items: flex-start;
          gap: 4px;
          width: 100%;
          background: transparent;
          padding: 0;
          border: none;
          border-radius: 2px;
          margin-left: 4px;
        }
        .log-entry--input .log-icon {
          margin-left: 0;
        }
          .state-input-wrapper {
            position: relative;
            flex: 1;
            min-width: 0;
          }
        .state-input {
          width: 100%;
          background: transparent;
          color: #f2f0e9;
          border: none;
          padding: 0;
          margin: 0;
          box-shadow: none;
          outline: none;
          appearance: none;
            font-family: "JetBrains Mono", "Space Mono", ui-monospace, SFMono-Regular,
              Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
            font-size: 12px;
            line-height: 1.4;
            resize: none;
            min-height: 20px;
            caret-color: transparent;
          }
          .state-input:focus,
          .state-input:focus-visible {
            outline: none;
            box-shadow: none;
          }
          .state-input:disabled {
            color: rgba(242, 240, 233, 0.55);
          }
        .state-input-mirror {
          position: absolute;
          inset: 0;
          visibility: hidden;
          white-space: pre-wrap;
          word-break: break-word;
          padding: 0;
          margin: 0;
            font-family: "JetBrains Mono", "Space Mono", ui-monospace, SFMono-Regular,
              Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
            font-size: 12px;
            line-height: 1.4;
          }
          .state-input-caret {
            position: absolute;
            width: 0.7ch;
            background: #f2f0e9;
            pointer-events: none;
            top: 0;
            left: 0;
          }
          .state-input-caret.is-blinking {
            animation: terminalCaretBlink 1.6s steps(2, end) infinite;
          }
          @keyframes terminalCaretBlink {
            0%, 49% { opacity: 1; }
            50%, 100% { opacity: 0; }
          }
        `}),(0,z.jsx)("span",{class:"log-icon log-icon--active",children:">"}),(0,z.jsx)("span",{class:"log-text",children:(0,z.jsxs)("span",{class:"state-input-wrapper",ref:k,children:[(0,z.jsx)("textarea",{ref:a,class:"state-input",value:I,disabled:n,rows:1,onInput:f=>{t(f.target.value),p(),q()},onKeyDown:f=>{f.key==="Enter"&&!f.shiftKey&&(f.preventDefault(),o())},onClick:p,onKeyUp:p,onSelect:p,onScroll:m}),(0,z.jsxs)("div",{class:"state-input-mirror",ref:u,"aria-hidden":"true",children:[N,(0,z.jsx)("span",{ref:s,children:"\u200B"}),te]}),(0,z.jsx)("span",{class:`state-input-caret ${i?"is-blinking":""}`,style:{transform:`translate(${v.left}px, ${v.top}px)`,height:`${v.height}px`}})]})})]})})}var Zt=b(j()),C=b(y());function Ee({pendingChanges:e,codeChangeRanges:t,editingBubbleId:o,editingText:n,onStartEdit:r,onEditingTextChange:i,onSaveEdit:a,onRemovePending:s,onHoverCard:u,bubbleEditorRef:k}){let $=e.length;return(0,C.jsxs)("div",{class:"terminal-attachments",children:[(0,C.jsx)("style",{children:`
        .terminal-attachments {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .terminal-attachments-row {
          display: flex;
          gap: 8px;
          align-items: center;
          overflow-x: auto;
          padding-bottom: 2px;
          scrollbar-width: none;
        }
        .terminal-attachments-row::-webkit-scrollbar {
          width: 0;
          height: 0;
        }
        .audit-change-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #0b0b0b;
          border: 1px solid #4b5563;
          border-radius: 6px;
          padding: 6px 10px;
          color: #e5e7eb;
          font-size: 11px;
          max-width: 220px;
          position: relative;
          cursor: pointer;
          white-space: nowrap;
        }
        .audit-change-pill span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .audit-change-remove {
          border: none;
          background: transparent;
          color: #9aa4b2;
          cursor: pointer;
          font-size: 12px;
          line-height: 1;
        }
        .audit-change-remove:hover {
          color: #f87171;
        }
        .audit-bubble-editor {
          position: absolute;
          bottom: 130%;
          left: 0;
          width: 240px;
          background: #0f141a;
          border: 1px solid rgba(71, 85, 105, 0.6);
          border-radius: 10px;
          padding: 8px;
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.4);
          z-index: 10;
        }
        .audit-bubble-editor textarea {
          width: 100%;
          min-height: 80px;
          background: #12141d;
          color: #e5e7eb;
          border: 1px solid rgba(71, 85, 105, 0.6);
          border-radius: 8px;
          padding: 6px;
          font-family: "JetBrains Mono", "Space Mono", ui-monospace, SFMono-Regular,
            Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 11px;
          resize: vertical;
        }
        .audit-bubble-editor-actions {
          display: flex;
          justify-content: flex-end;
          gap: 6px;
          margin-top: 6px;
        }
        .audit-bubble-editor button {
          background: rgba(239, 125, 69, 0.9);
          color: #0b0b0b;
          border: none;
          border-radius: 6px;
          padding: 4px 8px;
          font-size: 10px;
          cursor: pointer;
        }
      `}),(0,C.jsxs)("div",{class:"terminal-attachments-row",children:[e.map(c=>{let v=o===c.itemId;return(0,C.jsxs)("div",{class:"audit-change-pill",onMouseEnter:()=>u(c.cardId),onMouseLeave:()=>u(null),onClick:()=>r(c),children:[(0,C.jsx)("span",{title:c.label,children:c.label}),(0,C.jsx)("button",{class:"audit-change-remove",title:"Remove",onClick:T=>{T.stopPropagation(),s(c.itemId)},children:"\xD7"}),v&&(0,C.jsxs)("div",{class:"audit-bubble-editor",ref:k,children:[(0,C.jsx)("textarea",{value:n,onInput:T=>i(T.target.value),placeholder:"Edit what will be sent..."}),(0,C.jsx)("div",{class:"audit-bubble-editor-actions",children:(0,C.jsx)("button",{onClick:T=>{T.stopPropagation(),a()},children:"Save"})})]})]})}),t.length>=3?(0,C.jsx)("div",{class:"audit-change-pill",title:`Changed: ${t.map(c=>c[0]===c[1]?`Line ${c[0]}`:`Lines ${c[0]}-${c[1]}`).join(", ")}`,children:(0,C.jsxs)("span",{children:["Code changes (",t.length,")"]})}):t.map(c=>{let v=c[0]===c[1]?`Line ${c[0]}`:`Lines ${c[0]}-${c[1]}`;return(0,C.jsx)("div",{class:"audit-change-pill",title:"Source code edits",children:(0,C.jsx)("span",{children:v})})})]})]})}var J=b(y());function Se({logs:e,status:t,heading:o,promptValue:n,onPromptChange:r,onPromptSubmit:i,promptDisabled:a,attachments:s,promptBlink:u=!1}){let k=s&&(s.pendingChanges.length>0||s.codeChangeRanges.length>0||s.isDirty),$=(0,J.jsxs)("div",{class:"terminal-footer",children:[(0,J.jsx)("style",{children:`
        .terminal-footer {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
      `}),(0,J.jsx)(Ce,{value:n,onChange:r,onSubmit:i,disabled:a,blink:u,maxHeight:200}),k&&(0,J.jsx)(Ee,{pendingChanges:s.pendingChanges,codeChangeRanges:s.codeChangeRanges,editingBubbleId:s.editingBubbleId,editingText:s.editingText,onStartEdit:s.onStartEdit,onEditingTextChange:s.onEditingTextChange,onSaveEdit:s.onSaveEdit,onRemovePending:s.onRemovePending,onHoverCard:s.onHoverCard,bubbleEditorRef:s.bubbleEditorRef})]});return(0,J.jsx)(we,{logs:e,status:t,fullHeight:!0,heading:o,footer:$})}function Ke({errorMessage:e,widgetError:t,logs:o,widgetLogs:n}){let r=[e,t].filter(Boolean).join(`
`),i=ke(r);if(i.length>0)return i;if(Array.isArray(n)&&n.length>0){let a=n.map(u=>u&&typeof u=="object"?u.message:u).filter(Boolean).join(`
`),s=ke(a);if(s.length>0)return s}return Array.isArray(o)&&o.length>0?ke(o.join(`
`)):[]}function ke(e){let t=String(e||"");if(!t)return[];let o=t.split(`
`).map(i=>i.trimEnd()).filter(i=>i.trim().length>0);if(o.length===0)return[];let n=o.findIndex(i=>/(^|\b)Error:/i.test(i));if(n>=0){let i=o.slice(n,n+8),a=i.filter((s,u)=>u===0||/^\s*at\s+/.test(s)).map((s,u)=>u===0?s:s.trimStart());return a.length>0?a:i.map((s,u)=>u===0?s:s.trimStart())}let r=o.findIndex(i=>i.toLowerCase().includes("traceback"));return r>=0?o.slice(r).slice(-8):[]}var S=b(y());function Re({code:e,errorMessage:t,status:o,logs:n,widgetLogs:r,stateErrorMessage:i,stateWidgetError:a,lastRuntimeError:s,auditStatus:u,auditReport:k,auditError:$,auditMeta:c,auditData:v,auditApplyStatus:T,auditApplyResponse:I,auditApplyError:P,onAudit:N,onApply:te,onClose:p,onSubmitPrompt:m,approvalMode:q,isApproved:f,onApprove:L}){let[O,Q]=(0,E.useState)(e||""),[H,B]=(0,E.useState)(!1),[oe,X]=(0,E.useState)([]),[Z,V]=(0,E.useState)({}),[ne,_e]=(0,E.useState)(!1),[Te,M]=(0,E.useState)(null),[W,Y]=(0,E.useState)({}),[ue,U]=(0,E.useState)({}),[Qe,Pt]=(0,E.useState)(null),[Xe,Ze]=(0,E.useState)(""),[We,Lt]=(0,E.useState)([]),[Me,et]=(0,E.useState)(""),[Ht,zt]=(0,E.useState)(!1),tt=k&&k.length>0,ce=v?.fast_audit||v?.full_audit||null,Ae=c?.saved_path||"",ot=Ae?`Saved to ${Ae}`:tt?"Audit saved":"",$e=!!ce,nt=q&&!f,rt=o!=="retrying",it=(0,E.useMemo)(()=>{let x=Array.isArray(n)?n.slice():[];if(i&&x.push(`Generation error:
${i}`),a&&a!==i&&x.push(`Runtime error:
${a}`),s){let h=`Runtime error:
${s}`;x.some(Pe=>String(Pe).includes(s))||x.push(h)}if(Array.isArray(r)&&r.length>0&&r.filter(h=>h&&(h.level==="error"||h.level==="warn")).forEach(h=>{let D=h&&typeof h=="object"?h.message:h;D&&x.push(`Runtime log: ${D}`)}),o==="retrying"||Array.isArray(n)&&n.some(h=>String(h).toLowerCase().includes("repairing code"))){let h=Ke({errorMessage:i,widgetError:a,logs:n,widgetLogs:r});if(h.length>0){let D=`Stack trace (most recent):
${h.join(`
`)}`;if(!x.some(re=>String(re).startsWith("Stack trace (most recent):"))){let re=x.findIndex(at=>String(at).toLowerCase().includes("repairing code"));re>=0?x.splice(re+1,0,D):x.push(D)}}}return x},[n,r,i,a,s,o]),st=ce?.concerns||ce?.concerns||[];return(0,S.jsxs)("div",{class:"source-viewer",children:[(0,S.jsx)("style",{children:`
        .source-viewer {
          position: fixed;
          inset: 0;
          z-index: 1100;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          box-sizing: border-box;
        }
        .source-viewer-card {
          width: min(1080px, 96vw);
          height: min(720px, 92vh);
          background: #0c0c0c;
          border: 1px solid rgba(242, 240, 233, 0.12);
          border-radius: 8px;
          box-shadow: 0 18px 48px rgba(0, 0, 0, 0.55);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .source-viewer-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 8px 12px 12px;
          overflow: hidden;
        }
        .source-viewer-main {
          flex: 1;
          display: grid;
          grid-template-columns: ${H?"minmax(0, 1fr) 320px":"minmax(0, 1fr)"};
          gap: 12px;
          min-height: 0;
        }
        .source-viewer-terminal {
          margin-top: 6px;
        }
        .source-viewer-error-banner {
          background: rgba(239, 125, 69, 0.1);
          color: #fca5a5;
          border: 1px solid rgba(239, 125, 69, 0.4);
          border-radius: 6px;
          padding: 8px 10px;
          font-family: "JetBrains Mono", "Space Mono", ui-monospace, SFMono-Regular,
            Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 12px;
          white-space: pre-wrap;
        }
        .source-debug-banner {
          background: rgba(59, 130, 246, 0.12);
          color: #cbd5e1;
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 6px;
          padding: 8px 10px;
          font-family: "JetBrains Mono", "Space Mono", ui-monospace, SFMono-Regular,
            Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 12px;
          white-space: pre-wrap;
        }
      `}),(0,S.jsxs)("div",{class:"source-viewer-card",role:"dialog","aria-live":"polite",children:[(0,S.jsx)(ye,{showApprove:nt,auditIndicator:ot,auditStatus:u,hasAuditPayload:$e,showAuditPanel:H,onToggleAuditPanel:()=>B(!H),onRunAudit:()=>{B(!0),N("fast")},onApprove:L,onClose:p}),(0,S.jsxs)("div",{class:"source-viewer-body",children:[s&&(0,S.jsxs)("div",{class:"source-debug-banner",children:["Last runtime error:",`
`,s]}),t&&(0,S.jsx)("div",{class:"source-viewer-error-banner",children:t}),$&&(0,S.jsxs)("div",{class:"source-viewer-error-banner",children:["Audit failed: ",$]}),P&&(0,S.jsxs)("div",{class:"source-viewer-error-banner",children:["Apply failed: ",P]}),(0,S.jsxs)("div",{class:"source-viewer-main",children:[(0,S.jsx)(ve,{value:O,onChange:Q}),H&&(0,S.jsx)(he,{hasAuditPayload:$e,visibleConcerns:st,dismissedConcerns:Z,showDismissed:ne,onToggleDismissed:()=>_e(!ne),onRestoreDismissed:x=>{let R={...Z};delete R[x],V(R)},expandedCards:W,technicalCards:ue,hoveredCardId:Te,onHoverCard:M,onToggleExpanded:x=>Y(R=>({...R,[x]:!R[x]})),onToggleTechnical:x=>U(R=>({...R,[x]:!R[x]})),onAddPendingChange:(x,R,h)=>{X(D=>D.concat([{itemId:h.itemId||`${R}-change`,cardId:R,label:h.label||x.summary||"Audit change"}]))},onDismissConcern:(x,R)=>{V(h=>({...h,[x]:R}))},onScrollToLines:x=>{},onRunAudit:()=>{B(!0),N("fast")}})]}),(0,S.jsx)("div",{class:"source-viewer-terminal",style:{height:"180px"},children:(0,S.jsx)(Se,{logs:it,status:o||"ready",heading:null,promptValue:Me,onPromptChange:et,onPromptSubmit:m?()=>m(Me):()=>{},promptDisabled:!rt,attachments:{pendingChanges:oe,codeChangeRanges:We,isDirty:!1,editingBubbleId:Qe,editingText:Xe,onStartEdit:()=>{},onEditingTextChange:Ze,onSaveEdit:()=>{},onRemovePending:()=>{},onHoverCard:M,bubbleEditorRef:null}})})]})]})]})}var xo=Re;export{xo as default};
/*! Bundled license information:

react/cjs/react.production.js:
  (**
   * @license React
   * react.production.js
   *
   * Copyright (c) Meta Platforms, Inc. and affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)

react/cjs/react-jsx-runtime.production.js:
  (**
   * @license React
   * react-jsx-runtime.production.js
   *
   * Copyright (c) Meta Platforms, Inc. and affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)
*/
