/* Small final guard for editor-managed header/footer visibility. */
(function(){
'use strict';
function apply(sections){if(!Array.isArray(sections))return;const header=sections.find(function(x){return x&&x.type==='header';});const footer=sections.find(function(x){return x&&x.type==='footer';});const h=document.querySelector('.site-header');const f=document.querySelector('#storefront-home-root .sf-footer');if(h&&header)h.style.display=header.enabled===false?'none':'';if(f&&footer)f.style.display=footer.enabled===false?'none':'';}
window.addEventListener('message',function(e){if(e.origin!==location.origin||!e.data||e.data.type!=='storefront-preview-config')return;apply(e.data.config&&e.data.config.sections);});
window.addEventListener('storefront:home-ready',function(){try{if(typeof apiFetch==='function'&&typeof SELLER_ID!=='undefined')apiFetch('/storefront/public/'+SELLER_ID+'/home').then(function(p){apply(p&&p.config&&p.config.sections);}).catch(function(){});}catch(e){}});
})();
