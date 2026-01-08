var at=Object.create;var Pe=Object.defineProperty;var lt=Object.getOwnPropertyDescriptor;var ut=Object.getOwnPropertyNames;var ct=Object.getPrototypeOf,dt=Object.prototype.hasOwnProperty;var re=(e,t)=>()=>(t||e((t={exports:{}}).exports,t),t.exports);var pt=(e,t,o,n)=>{if(t&&typeof t=="object"||typeof t=="function")for(let r of ut(t))!dt.call(e,r)&&r!==o&&Pe(e,r,{get:()=>t[r],enumerable:!(n=lt(t,r))||n.enumerable});return e};var b=(e,t,o)=>(o=e!=null?at(ct(e)):{},pt(t||!e||!e.__esModule?Pe(o,"default",{value:e,enumerable:!0}):o,e));var Ue=re(u=>{"use strict";var pe=Symbol.for("react.transitional.element"),ft=Symbol.for("react.portal"),gt=Symbol.for("react.fragment"),mt=Symbol.for("react.strict_mode"),bt=Symbol.for("react.profiler"),xt=Symbol.for("react.consumer"),vt=Symbol.for("react.context"),ht=Symbol.for("react.forward_ref"),yt=Symbol.for("react.suspense"),wt=Symbol.for("react.memo"),Ie=Symbol.for("react.lazy"),Ct=Symbol.for("react.activity"),Le=Symbol.iterator;function Et(e){return e===null||typeof e!="object"?null:(e=Le&&e[Le]||e["@@iterator"],typeof e=="function"?e:null)}var De={isMounted:function(){return!1},enqueueForceUpdate:function(){},enqueueReplaceState:function(){},enqueueSetState:function(){}},Ne=Object.assign,Oe={};function K(e,t,o){this.props=e,this.context=t,this.refs=Oe,this.updater=o||De}K.prototype.isReactComponent={};K.prototype.setState=function(e,t){if(typeof e!="object"&&typeof e!="function"&&e!=null)throw Error("takes an object of state variables to update or a function which returns an object of state variables.");this.updater.enqueueSetState(this,e,t,"setState")};K.prototype.forceUpdate=function(e){this.updater.enqueueForceUpdate(this,e,"forceUpdate")};function Be(){}Be.prototype=K.prototype;function fe(e,t,o){this.props=e,this.context=t,this.refs=Oe,this.updater=o||De}var ge=fe.prototype=new Be;ge.constructor=fe;Ne(ge,K.prototype);ge.isPureReactComponent=!0;var ze=Array.isArray;function de(){}var g={H:null,A:null,T:null,S:null},Ye=Object.prototype.hasOwnProperty;function me(e,t,o){var n=o.ref;return{$$typeof:pe,type:e,key:t,ref:n!==void 0?n:null,props:o}}function kt(e,t){return me(e.type,t,e.props)}function be(e){return typeof e=="object"&&e!==null&&e.$$typeof===pe}function St(e){var t={"=":"=0",":":"=2"};return"$"+e.replace(/[=:]/g,function(o){return t[o]})}var He=/\/+/g;function ce(e,t){return typeof e=="object"&&e!==null&&e.key!=null?St(""+e.key):t.toString(36)}function Rt(e){switch(e.status){case"fulfilled":return e.value;case"rejected":throw e.reason;default:switch(typeof e.status=="string"?e.then(de,de):(e.status="pending",e.then(function(t){e.status==="pending"&&(e.status="fulfilled",e.value=t)},function(t){e.status==="pending"&&(e.status="rejected",e.reason=t)})),e.status){case"fulfilled":return e.value;case"rejected":throw e.reason}}throw e}function G(e,t,o,n,r){var i=typeof e;(i==="undefined"||i==="boolean")&&(e=null);var a=!1;if(e===null)a=!0;else switch(i){case"bigint":case"string":case"number":a=!0;break;case"object":switch(e.$$typeof){case pe:case ft:a=!0;break;case Ie:return a=e._init,G(a(e._payload),t,o,n,r)}}if(a)return r=r(e),a=n===""?"."+ce(e,0):n,ze(r)?(o="",a!=null&&(o=a.replace(He,"$&/")+"/"),G(r,t,o,"",function(S){return S})):r!=null&&(be(r)&&(r=kt(r,o+(r.key==null||e&&e.key===r.key?"":(""+r.key).replace(He,"$&/")+"/")+a)),t.push(r)),1;a=0;var s=n===""?".":n+":";if(ze(e))for(var l=0;l<e.length;l++)n=e[l],i=s+ce(n,l),a+=G(n,t,o,i,r);else if(l=Et(e),typeof l=="function")for(e=l.call(e),l=0;!(n=e.next()).done;)n=n.value,i=s+ce(n,l++),a+=G(n,t,o,i,r);else if(i==="object"){if(typeof e.then=="function")return G(Rt(e),t,o,n,r);throw t=String(e),Error("Objects are not valid as a React child (found: "+(t==="[object Object]"?"object with keys {"+Object.keys(e).join(", ")+"}":t)+"). If you meant to render a collection of children, use an array instead.")}return a}function ie(e,t,o){if(e==null)return e;var n=[],r=0;return G(e,n,"","",function(i){return t.call(o,i,r++)}),n}function _t(e){if(e._status===-1){var t=e._result;t=t(),t.then(function(o){(e._status===0||e._status===-1)&&(e._status=1,e._result=o)},function(o){(e._status===0||e._status===-1)&&(e._status=2,e._result=o)}),e._status===-1&&(e._status=0,e._result=t)}if(e._status===1)return e._result.default;throw e._result}var je=typeof reportError=="function"?reportError:function(e){if(typeof window=="object"&&typeof window.ErrorEvent=="function"){var t=new window.ErrorEvent("error",{bubbles:!0,cancelable:!0,message:typeof e=="object"&&e!==null&&typeof e.message=="string"?String(e.message):String(e),error:e});if(!window.dispatchEvent(t))return}else if(typeof process=="object"&&typeof process.emit=="function"){process.emit("uncaughtException",e);return}console.error(e)},Tt={map:ie,forEach:function(e,t,o){ie(e,function(){t.apply(this,arguments)},o)},count:function(e){var t=0;return ie(e,function(){t++}),t},toArray:function(e){return ie(e,function(t){return t})||[]},only:function(e){if(!be(e))throw Error("React.Children.only expected to receive a single React element child.");return e}};u.Activity=Ct;u.Children=Tt;u.Component=K;u.Fragment=gt;u.Profiler=bt;u.PureComponent=fe;u.StrictMode=mt;u.Suspense=yt;u.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE=g;u.__COMPILER_RUNTIME={__proto__:null,c:function(e){return g.H.useMemoCache(e)}};u.cache=function(e){return function(){return e.apply(null,arguments)}};u.cacheSignal=function(){return null};u.cloneElement=function(e,t,o){if(e==null)throw Error("The argument must be a React element, but you passed "+e+".");var n=Ne({},e.props),r=e.key;if(t!=null)for(i in t.key!==void 0&&(r=""+t.key),t)!Ye.call(t,i)||i==="key"||i==="__self"||i==="__source"||i==="ref"&&t.ref===void 0||(n[i]=t[i]);var i=arguments.length-2;if(i===1)n.children=o;else if(1<i){for(var a=Array(i),s=0;s<i;s++)a[s]=arguments[s+2];n.children=a}return me(e.type,r,n)};u.createContext=function(e){return e={$$typeof:vt,_currentValue:e,_currentValue2:e,_threadCount:0,Provider:null,Consumer:null},e.Provider=e,e.Consumer={$$typeof:xt,_context:e},e};u.createElement=function(e,t,o){var n,r={},i=null;if(t!=null)for(n in t.key!==void 0&&(i=""+t.key),t)Ye.call(t,n)&&n!=="key"&&n!=="__self"&&n!=="__source"&&(r[n]=t[n]);var a=arguments.length-2;if(a===1)r.children=o;else if(1<a){for(var s=Array(a),l=0;l<a;l++)s[l]=arguments[l+2];r.children=s}if(e&&e.defaultProps)for(n in a=e.defaultProps,a)r[n]===void 0&&(r[n]=a[n]);return me(e,i,r)};u.createRef=function(){return{current:null}};u.forwardRef=function(e){return{$$typeof:ht,render:e}};u.isValidElement=be;u.lazy=function(e){return{$$typeof:Ie,_payload:{_status:-1,_result:e},_init:_t}};u.memo=function(e,t){return{$$typeof:wt,type:e,compare:t===void 0?null:t}};u.startTransition=function(e){var t=g.T,o={};g.T=o;try{var n=e(),r=g.S;r!==null&&r(o,n),typeof n=="object"&&n!==null&&typeof n.then=="function"&&n.then(de,je)}catch(i){je(i)}finally{t!==null&&o.types!==null&&(t.types=o.types),g.T=t}};u.unstable_useCacheRefresh=function(){return g.H.useCacheRefresh()};u.use=function(e){return g.H.use(e)};u.useActionState=function(e,t,o){return g.H.useActionState(e,t,o)};u.useCallback=function(e,t){return g.H.useCallback(e,t)};u.useContext=function(e){return g.H.useContext(e)};u.useDebugValue=function(){};u.useDeferredValue=function(e,t){return g.H.useDeferredValue(e,t)};u.useEffect=function(e,t){return g.H.useEffect(e,t)};u.useEffectEvent=function(e){return g.H.useEffectEvent(e)};u.useId=function(){return g.H.useId()};u.useImperativeHandle=function(e,t,o){return g.H.useImperativeHandle(e,t,o)};u.useInsertionEffect=function(e,t){return g.H.useInsertionEffect(e,t)};u.useLayoutEffect=function(e,t){return g.H.useLayoutEffect(e,t)};u.useMemo=function(e,t){return g.H.useMemo(e,t)};u.useOptimistic=function(e,t){return g.H.useOptimistic(e,t)};u.useReducer=function(e,t,o){return g.H.useReducer(e,t,o)};u.useRef=function(e){return g.H.useRef(e)};u.useState=function(e){return g.H.useState(e)};u.useSyncExternalStore=function(e,t,o){return g.H.useSyncExternalStore(e,t,o)};u.useTransition=function(){return g.H.useTransition()};u.version="19.2.3"});var I=re((It,Je)=>{"use strict";Je.exports=Ue()});var Fe=re(se=>{"use strict";var Mt=Symbol.for("react.transitional.element"),At=Symbol.for("react.fragment");function qe(e,t,o){var n=null;if(o!==void 0&&(n=""+o),t.key!==void 0&&(n=""+t.key),"key"in t){o={};for(var r in t)r!=="key"&&(o[r]=t[r])}else o=t;return t=o.ref,{$$typeof:Mt,type:e,key:n,ref:t!==void 0?t:null,props:o}}se.Fragment=At;se.jsx=qe;se.jsxs=qe});var h=re((Nt,Ve)=>{"use strict";Ve.exports=Fe()});var E=b(I());var ae=b(I()),U=b(h());function xe({value:e,onChange:t,isLoading:o,loadError:n}){let r=(0,ae.useRef)(null);return(0,ae.useEffect)(()=>{r.current&&(r.current.value=e||"")},[e]),(0,U.jsxs)("div",{class:"source-viewer-editor",style:{position:"relative",width:"100%",height:"100%"},children:[(0,U.jsx)("style",{children:`
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
      `}),o&&(0,U.jsx)("div",{class:"source-viewer-loading",children:"Loading editor..."}),n&&(0,U.jsx)("div",{class:"source-viewer-error",children:n}),!o&&!n&&(0,U.jsx)("textarea",{ref:r,defaultValue:e||"",onInput:i=>t&&t(i.target.value),style:{width:"100%",height:"100%",border:"none",outline:"none",background:"transparent",color:"inherit",padding:"10px",boxSizing:"border-box",resize:"vertical"}})]})}var Yt=b(I()),c=b(h());function ve({hasAuditPayload:e,visibleConcerns:t,dismissedConcerns:o,showDismissed:n,onToggleDismissed:r,onRestoreDismissed:i,expandedCards:a,technicalCards:s,hoveredCardId:l,onHoverCard:S,onToggleExpanded:R,onToggleTechnical:d,onAddPendingChange:w,onDismissConcern:z,onScrollToLines:H,onRunAudit:j}){let q=t.length===0,ee=e?`${t.length} concerns`:"No audit yet";return(0,c.jsxs)("div",{class:"audit-panel",children:[(0,c.jsx)("style",{children:`
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
      `}),(0,c.jsxs)("div",{class:"audit-panel-header",children:[(0,c.jsx)("span",{children:"Audit Overview"}),(0,c.jsx)("span",{children:ee})]}),q?(0,c.jsxs)("div",{class:"audit-empty",children:[e?"All audits resolved.":(0,c.jsxs)(c.Fragment,{children:["Run an audit to see findings. ",j&&(0,c.jsx)("button",{class:"audit-run-link",onClick:j,children:"Run an audit"})]}),Object.keys(o).length>0&&(0,c.jsxs)("div",{children:[(0,c.jsx)("button",{onClick:r,children:n?"Hide dismissed":"Show dismissed"}),n&&(0,c.jsx)("div",{class:"audit-dismissed-list",children:Object.entries(o).map(([p,m])=>(0,c.jsxs)("div",{class:"audit-dismissed-item",children:[(0,c.jsx)("span",{children:m}),(0,c.jsx)("button",{onClick:()=>i(p),children:"Restore"})]}))})]})]}):(0,c.jsx)("div",{class:"audit-grid",children:t.map(({concern:p,cardId:m,index:F})=>{let f=!!a[m],$=!!s[m],D=(p.impact||"low").toLowerCase(),Q=D==="high"?"#f87171":D==="medium"?"#f59e0b":"#34d399",P=Array.isArray(p.location)?p.location:[],O=P.length>0?`LINES ${Math.min(...P)}-${Math.max(...P)}`:"GLOBAL",te=p.summary||"",X=p.technical_summary||"",Z=p.details||"",V=X&&X!==te,oe=$&&V?X:te;return(0,c.jsxs)("div",{class:`audit-card ${l&&l!==m?"dimmed":""} ${l===m?"highlight":""}`,onClick:()=>R(m),children:[(0,c.jsxs)("div",{class:"audit-card-title",title:`Impact: ${D}`,children:[(0,c.jsx)("span",{class:"impact-dot",style:{background:Q}}),(0,c.jsx)("span",{children:p.id||"concern"})]}),(0,c.jsxs)("div",{class:"audit-card-actions",children:[(0,c.jsx)("button",{class:"audit-add-button",title:"Add to Changes",onClick:M=>{M.stopPropagation(),w(p,m,{itemId:`${m}-base`,source:"base"})},children:"+"}),(0,c.jsx)("button",{class:"audit-dismiss-button",title:"Dismiss",onClick:M=>{M.stopPropagation(),z(m,p.id||"concern")},children:"\xD7"})]}),(0,c.jsx)("div",{class:"audit-card-meta",children:(0,c.jsx)("button",{class:"audit-line-link",onClick:M=>{M.stopPropagation(),P.length>0&&H(P)},children:O})}),(0,c.jsx)("div",{class:"audit-card-summary",onClick:M=>{V&&(M.stopPropagation(),d(m))},title:V?"Click to toggle technical note":"",children:oe}),f&&Z&&(0,c.jsx)("div",{class:"audit-card-detail",children:Z}),f&&p.alternatives&&p.alternatives.length>0&&(0,c.jsxs)("div",{class:"audit-card-list",children:["Recommendations:"," ",Array.isArray(p.alternatives)?p.alternatives.map((M,W)=>{let B=M.option||M,le=W===p.alternatives.length-1;return(0,c.jsxs)("span",{children:[(0,c.jsx)("span",{class:"audit-alternative",role:"button",tabIndex:"0",onClick:Y=>{Y.stopPropagation(),w(p,m,{itemId:`${m}-alt-${W}`,label:`Recommendation: ${B}`,source:"recommendation",alternative:B})},onKeyDown:Y=>{(Y.key==="Enter"||Y.key===" ")&&(Y.preventDefault(),w(p,m,{itemId:`${m}-alt-${W}`,label:`Recommendation: ${B}`,source:"recommendation",alternative:B}))},children:B}),le?"":", "]})}):""]})]})})})]})}var qt=b(I()),A=b(h());function he({showApprove:e,auditIndicator:t,auditStatus:o,hasAuditPayload:n,showAuditPanel:r,onToggleAuditPanel:i,onRunAudit:a,onApprove:s,onClose:l}){return(0,A.jsxs)("div",{class:"source-viewer-header",children:[(0,A.jsx)("style",{children:`
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
      `}),(0,A.jsxs)("div",{class:"source-viewer-title",children:[(0,A.jsx)("span",{children:"Source Viewer"}),t&&(0,A.jsx)("span",{class:"audit-indicator",children:t}),o==="running"&&(0,A.jsx)("span",{class:"audit-indicator",children:"Auditing..."})]}),(0,A.jsxs)("div",{class:"source-viewer-actions",children:[!n&&(0,A.jsx)("button",{class:"source-viewer-button",disabled:o==="running",onClick:a,children:o==="running"?"Auditing...":"Audit"}),n&&(0,A.jsx)("button",{class:"source-viewer-button subtle",onClick:i,children:r?"Hide Audit":"Show Audit"}),e?(0,A.jsx)("button",{class:"source-viewer-button",onClick:s,children:"Approve"}):(0,A.jsx)("button",{class:"source-viewer-button subtle",onClick:l,children:"Close"})]})]})}var oo=b(I());var Gt=b(I()),T=b(h());function ye({logs:e=[],status:t="ready",fullHeight:o=!1,heading:n=null,footer:r=null}){let i=t!=="ready"&&t!=="error",a=t==="ready";return(0,T.jsxs)("div",{class:"progress-bezel",children:[(0,T.jsx)("style",{children:`
        .progress-bezel {
          width: 100%;
          height: 100%;
          box-sizing: border-box;
          color: #e2e8f0;
          background: #0b0b0b;
          border: 1px solid rgba(242, 240, 233, 0.08);
          border-radius: 4px;
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.02), 0 8px 24px rgba(0, 0, 0, 0.25);
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
        }
        .progress-heading .dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: ${a?"#22c55e":"#f97316"};
          box-shadow: 0 0 0 4px rgba(249, 115, 22, 0.15);
        }
        .progress-log-container {
          flex: 1;
          min-height: ${o?"100%":"120px"};
          max-height: ${o?"100%":"240px"};
          overflow: auto;
          background: linear-gradient(180deg, rgba(18, 18, 18, 0.9), rgba(18, 18, 18, 0.6));
          border: 1px solid rgba(242, 240, 233, 0.12);
          border-radius: 4px;
          padding: 10px;
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
        
        .log-entry {
          display: flex;
          align-items: baseline;
          gap: 4px;
          padding: 2px 0;
          color: #D1D5DB;
          opacity: 0;
          animation: fadeIn 0.3s ease-out forwards;
          animation-delay: calc(var(--entry-index) * 0.03s);
          white-space: pre-wrap;
          word-break: break-word;
        }

        .log-icon {
          width: 10px;
          flex: 0 0 10px;
          color: #6B7280;
          margin-left: 8px;
        }

        .log-icon--active {
          color: #f97316;
        }

        .log-entry--done .log-text {
          text-transform: uppercase;
          color: #D1D5DB;
        }

        .log-entry--active .log-text {
          background: #f97316;
          color: #000000;
          padding: 1px 4px;
          text-transform: uppercase;
          display: inline-block;
        }

        .log-entry--terminal .log-text {
          background: #334155;
          color: #e2e8f0;
          padding: 1px 4px;
          text-transform: uppercase;
          display: inline-block;
        }

        .log-icon--terminal {
          color: #9ca3af;
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
      `}),n&&(0,T.jsxs)("div",{class:"progress-heading",children:[(0,T.jsx)("span",{class:"dot","aria-hidden":"true"}),(0,T.jsx)("span",{children:n})]}),(0,T.jsx)("div",{class:"progress-log-container",children:(0,T.jsx)("ul",{class:"progress-log-list",children:e.map((s,l)=>{let S=typeof s=="string"?s:String(s),R=S.toLowerCase().includes("runtime error"),d=l===e.length-1&&i,w=["log-entry",a?"log-entry--done":"",i&&!R?"log-entry--active":"",R?"log-entry--terminal":""].filter(Boolean).join(" ");return(0,T.jsxs)("li",{class:w,style:{"--entry-index":l},children:[(0,T.jsx)("span",{class:`log-icon ${d?"log-icon--active":R?"log-icon--terminal":""}`,children:R?"!":">"}),(0,T.jsxs)("span",{class:"log-text",children:[S,d&&(0,T.jsx)("span",{class:"cursor",children:"\u2588"})]})]},l)})})}),r&&(0,T.jsx)("div",{class:"progress-footer",children:r})]})}var y=b(I()),L=b(h());function we({value:e,onChange:t,onSubmit:o,disabled:n=!1,maxHeight:r=200,blink:i=!0}){let a=(0,y.useRef)(null),s=(0,y.useRef)(null),l=(0,y.useRef)(null),S=(0,y.useRef)(null),[R,d]=(0,y.useState)(0),[w,z]=(0,y.useState)({left:0,top:0,height:14}),H=(e||"").replace(/\r\n/g,`
`),j=Math.min(R,H.length),q=H.slice(0,j),ee=H.slice(j),p=(0,y.useCallback)(()=>{let f=a.current;if(!f)return;let $=f.selectionStart??0;d($)},[]),m=(0,y.useCallback)(()=>{let f=s.current,$=a.current;if(!f||!$)return;let D=parseFloat(window.getComputedStyle($).lineHeight||"14"),Q=Number.isFinite(D)?D:14,P=$.scrollTop||0,O=$.scrollLeft||0;z({left:f.offsetLeft-O,top:f.offsetTop-P,height:Q})},[]),F=(0,y.useCallback)(()=>{let f=a.current;if(!f)return;f.style.height="auto";let $=Math.min(f.scrollHeight,r);f.style.height=`${$}px`,f.style.overflowY=f.scrollHeight>r?"auto":"hidden"},[r]);return(0,y.useLayoutEffect)(()=>{F(),m()},[H,j,F,m]),(0,y.useEffect)(()=>{let f=()=>m();return window.addEventListener("resize",f),()=>window.removeEventListener("resize",f)},[m]),(0,y.useEffect)(()=>{p()},[H,p]),(0,L.jsx)("div",{class:"state-input-row",children:(0,L.jsxs)("div",{class:"log-entry log-entry--active log-entry--input",children:[(0,L.jsx)("style",{children:`
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
        `}),(0,L.jsx)("span",{class:"log-icon log-icon--active",children:">"}),(0,L.jsx)("span",{class:"log-text",children:(0,L.jsxs)("span",{class:"state-input-wrapper",ref:S,children:[(0,L.jsx)("textarea",{ref:a,class:"state-input",value:H,disabled:n,rows:1,onInput:f=>{t(f.target.value),p(),F()},onKeyDown:f=>{f.key==="Enter"&&!f.shiftKey&&(f.preventDefault(),o())},onClick:p,onKeyUp:p,onSelect:p,onScroll:m}),(0,L.jsxs)("div",{class:"state-input-mirror",ref:l,"aria-hidden":"true",children:[q,(0,L.jsx)("span",{ref:s,children:"\u200B"}),ee]}),(0,L.jsx)("span",{class:`state-input-caret ${i?"is-blinking":""}`,style:{transform:`translate(${w.left}px, ${w.top}px)`,height:`${w.height}px`}})]})})]})})}var Wt=b(I()),C=b(h());function Ce({pendingChanges:e,codeChangeRanges:t,editingBubbleId:o,editingText:n,onStartEdit:r,onEditingTextChange:i,onSaveEdit:a,onRemovePending:s,onHoverCard:l,bubbleEditorRef:S}){let R=e.length;return(0,C.jsxs)("div",{class:"terminal-attachments",children:[(0,C.jsx)("style",{children:`
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
      `}),(0,C.jsxs)("div",{class:"terminal-attachments-row",children:[e.map(d=>{let w=o===d.itemId;return(0,C.jsxs)("div",{class:"audit-change-pill",onMouseEnter:()=>l(d.cardId),onMouseLeave:()=>l(null),onClick:()=>r(d),children:[(0,C.jsx)("span",{title:d.label,children:d.label}),(0,C.jsx)("button",{class:"audit-change-remove",title:"Remove",onClick:z=>{z.stopPropagation(),s(d.itemId)},children:"\xD7"}),w&&(0,C.jsxs)("div",{class:"audit-bubble-editor",ref:S,children:[(0,C.jsx)("textarea",{value:n,onInput:z=>i(z.target.value),placeholder:"Edit what will be sent..."}),(0,C.jsx)("div",{class:"audit-bubble-editor-actions",children:(0,C.jsx)("button",{onClick:z=>{z.stopPropagation(),a()},children:"Save"})})]})]})}),t.length>=3?(0,C.jsx)("div",{class:"audit-change-pill",title:`Changed: ${t.map(d=>d[0]===d[1]?`Line ${d[0]}`:`Lines ${d[0]}-${d[1]}`).join(", ")}`,children:(0,C.jsxs)("span",{children:["Code changes (",t.length,")"]})}):t.map(d=>{let w=d[0]===d[1]?`Line ${d[0]}`:`Lines ${d[0]}-${d[1]}`;return(0,C.jsx)("div",{class:"audit-change-pill",title:"Source code edits",children:(0,C.jsx)("span",{children:w})})})]})]})}var J=b(h());function Ee({logs:e,status:t,heading:o,promptValue:n,onPromptChange:r,onPromptSubmit:i,promptDisabled:a,attachments:s,promptBlink:l=!1}){let S=s&&(s.pendingChanges.length>0||s.codeChangeRanges.length>0||s.isDirty),R=(0,J.jsxs)("div",{class:"terminal-footer",children:[(0,J.jsx)("style",{children:`
        .terminal-footer {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
      `}),(0,J.jsx)(we,{value:n,onChange:r,onSubmit:i,disabled:a,blink:l,maxHeight:200}),S&&(0,J.jsx)(Ce,{pendingChanges:s.pendingChanges,codeChangeRanges:s.codeChangeRanges,editingBubbleId:s.editingBubbleId,editingText:s.editingText,onStartEdit:s.onStartEdit,onEditingTextChange:s.onEditingTextChange,onSaveEdit:s.onSaveEdit,onRemovePending:s.onRemovePending,onHoverCard:s.onHoverCard,bubbleEditorRef:s.bubbleEditorRef})]});return(0,J.jsx)(ye,{logs:e,status:t,fullHeight:!0,heading:o,footer:R})}function Ge({errorMessage:e,widgetError:t,logs:o,widgetLogs:n}){let r=[e,t].filter(Boolean).join(`
`),i=ke(r);if(i.length>0)return i;if(Array.isArray(n)&&n.length>0){let a=n.map(l=>l&&typeof l=="object"?l.message:l).filter(Boolean).join(`
`),s=ke(a);if(s.length>0)return s}return Array.isArray(o)&&o.length>0?ke(o.join(`
`)):[]}function ke(e){let t=String(e||"");if(!t)return[];let o=t.split(`
`).map(i=>i.trimEnd()).filter(i=>i.trim().length>0);if(o.length===0)return[];let n=o.findIndex(i=>/(^|\b)Error:/i.test(i));if(n>=0){let i=o.slice(n,n+8),a=i.filter((s,l)=>l===0||/^\s*at\s+/.test(s)).map((s,l)=>l===0?s:s.trimStart());return a.length>0?a:i.map((s,l)=>l===0?s:s.trimStart())}let r=o.findIndex(i=>i.toLowerCase().includes("traceback"));return r>=0?o.slice(r).slice(-8):[]}var k=b(h());function Se({code:e,errorMessage:t,status:o,logs:n,widgetLogs:r,stateErrorMessage:i,stateWidgetError:a,lastRuntimeError:s,auditStatus:l,auditReport:S,auditError:R,auditMeta:d,auditData:w,auditApplyStatus:z,auditApplyResponse:H,auditApplyError:j,onAudit:q,onApply:ee,onClose:p,onSubmitPrompt:m,approvalMode:F,isApproved:f,onApprove:$}){let[D,Q]=(0,E.useState)(e||""),[P,O]=(0,E.useState)(!1),[te,X]=(0,E.useState)([]),[Z,V]=(0,E.useState)({}),[oe,Re]=(0,E.useState)(!1),[_e,M]=(0,E.useState)(null),[W,B]=(0,E.useState)({}),[le,Y]=(0,E.useState)({}),[Ke,$t]=(0,E.useState)(null),[Qe,Xe]=(0,E.useState)(""),[Ze,Pt]=(0,E.useState)([]),[Te,We]=(0,E.useState)(""),[Lt,zt]=(0,E.useState)(!1),et=S&&S.length>0,ue=w?.fast_audit||w?.full_audit||null,Me=d?.saved_path||"",tt=Me?`Saved to ${Me}`:et?"Audit saved":"",Ae=!!ue,ot=F&&!f,nt=o!=="retrying",rt=(0,E.useMemo)(()=>{let x=Array.isArray(n)?n.slice():[];if(i&&x.push(`Generation error:
${i}`),a&&a!==i&&x.push(`Runtime error:
${a}`),s){let v=`Runtime error:
${s}`;x.some($e=>String($e).includes(s))||x.push(v)}if(Array.isArray(r)&&r.length>0&&r.filter(v=>v&&(v.level==="error"||v.level==="warn")).forEach(v=>{let N=v&&typeof v=="object"?v.message:v;N&&x.push(`Runtime log: ${N}`)}),o==="retrying"||Array.isArray(n)&&n.some(v=>String(v).toLowerCase().includes("repairing code"))){let v=Ge({errorMessage:i,widgetError:a,logs:n,widgetLogs:r});if(v.length>0){let N=`Stack trace (most recent):
${v.join(`
`)}`;if(!x.some(ne=>String(ne).startsWith("Stack trace (most recent):"))){let ne=x.findIndex(st=>String(st).toLowerCase().includes("repairing code"));ne>=0?x.splice(ne+1,0,N):x.push(N)}}}return x},[n,r,i,a,s,o]),it=ue?.concerns||ue?.concerns||[];return(0,k.jsxs)("div",{class:"source-viewer",children:[(0,k.jsx)("style",{children:`
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
          grid-template-columns: ${P?"minmax(0, 1fr) 320px":"minmax(0, 1fr)"};
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
      `}),(0,k.jsxs)("div",{class:"source-viewer-card",role:"dialog","aria-live":"polite",children:[(0,k.jsx)(he,{showApprove:ot,auditIndicator:tt,auditStatus:l,hasAuditPayload:Ae,showAuditPanel:P,onToggleAuditPanel:()=>O(!P),onRunAudit:()=>{O(!0),q("fast")},onApprove:$,onClose:p}),(0,k.jsxs)("div",{class:"source-viewer-body",children:[s&&(0,k.jsxs)("div",{class:"source-debug-banner",children:["Last runtime error:",`
`,s]}),t&&(0,k.jsx)("div",{class:"source-viewer-error-banner",children:t}),R&&(0,k.jsxs)("div",{class:"source-viewer-error-banner",children:["Audit failed: ",R]}),j&&(0,k.jsxs)("div",{class:"source-viewer-error-banner",children:["Apply failed: ",j]}),(0,k.jsxs)("div",{class:"source-viewer-main",children:[(0,k.jsx)(xe,{value:D,onChange:Q}),P&&(0,k.jsx)(ve,{hasAuditPayload:Ae,visibleConcerns:it,dismissedConcerns:Z,showDismissed:oe,onToggleDismissed:()=>Re(!oe),onRestoreDismissed:x=>{let _={...Z};delete _[x],V(_)},expandedCards:W,technicalCards:le,hoveredCardId:_e,onHoverCard:M,onToggleExpanded:x=>B(_=>({..._,[x]:!_[x]})),onToggleTechnical:x=>Y(_=>({..._,[x]:!_[x]})),onAddPendingChange:(x,_,v)=>{X(N=>N.concat([{itemId:v.itemId||`${_}-change`,cardId:_,label:v.label||x.summary||"Audit change"}]))},onDismissConcern:(x,_)=>{V(v=>({...v,[x]:_}))},onScrollToLines:x=>{},onRunAudit:()=>{O(!0),q("fast")}})]}),(0,k.jsx)("div",{class:"source-viewer-terminal",style:{height:"180px"},children:(0,k.jsx)(Ee,{logs:rt,status:o||"ready",heading:null,promptValue:Te,onPromptChange:We,onPromptSubmit:m?()=>m(Te):()=>{},promptDisabled:!nt,attachments:{pendingChanges:te,codeChangeRanges:Ze,isDirty:!1,editingBubbleId:Ke,editingText:Qe,onStartEdit:()=>{},onEditingTextChange:Xe,onSaveEdit:()=>{},onRemovePending:()=>{},onHoverCard:M,bubbleEditorRef:null}})})]})]})]})}var vo=Se;export{vo as default};
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
