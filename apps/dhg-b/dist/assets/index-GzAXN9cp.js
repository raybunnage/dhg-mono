import{r as p,a as m,R as y}from"./vendor-CYwr4TYv.js";(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const e of document.querySelectorAll('link[rel="modulepreload"]'))o(e);new MutationObserver(e=>{for(const r of e)if(r.type==="childList")for(const n of r.addedNodes)n.tagName==="LINK"&&n.rel==="modulepreload"&&o(n)}).observe(document,{childList:!0,subtree:!0});function i(e){const r={};return e.integrity&&(r.integrity=e.integrity),e.referrerPolicy&&(r.referrerPolicy=e.referrerPolicy),e.crossOrigin==="use-credentials"?r.credentials="include":e.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function o(e){if(e.ep)return;e.ep=!0;const r=i(e);fetch(e.href,r)}})();var d={exports:{}},u={};/**
 * @license React
 * react-jsx-runtime.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var _=p,x=Symbol.for("react.element"),h=Symbol.for("react.fragment"),R=Object.prototype.hasOwnProperty,O=_.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner,g={key:!0,ref:!0,__self:!0,__source:!0};function a(s,t,i){var o,e={},r=null,n=null;i!==void 0&&(r=""+i),t.key!==void 0&&(r=""+t.key),t.ref!==void 0&&(n=t.ref);for(o in t)R.call(t,o)&&!g.hasOwnProperty(o)&&(e[o]=t[o]);if(s&&s.defaultProps)for(o in t=s.defaultProps,t)e[o]===void 0&&(e[o]=t[o]);return{$$typeof:x,type:s,key:r,ref:n,props:e,_owner:O.current}}u.Fragment=h;u.jsx=a;u.jsxs=a;d.exports=u;var c=d.exports,f={},l=m;f.createRoot=l.createRoot,f.hydrateRoot=l.hydrateRoot;function E(){return c.jsx("div",{style:{textAlign:"center",marginTop:"50px"},children:c.jsx("h1",{children:"Welcome to DHG-B"})})}f.createRoot(document.getElementById("root")).render(c.jsx(y.StrictMode,{children:c.jsx(E,{})}));
//# sourceMappingURL=index-GzAXN9cp.js.map
