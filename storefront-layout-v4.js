/* Exact requested storefront flow: search -> educational videos -> best sellers -> deals -> visual categories. */
(function(){
  'use strict';
  var root=document.getElementById('storefront-home-root');
  if(!root)return;
  var running=false;

  function kind(el){
    if(el.classList.contains('sf-search-block'))return 'search';
    if(el.classList.contains('sf-video-section'))return 'videos';
    if(el.classList.contains('sf-best-sellers'))return 'best-sellers';
    if(el.querySelector&&el.querySelector('.sf-campaign'))return 'campaign';
    if(el.id==='sf-categories')return 'categories';
    if(el.classList.contains('sf-footer'))return 'footer';
    return 'other';
  }

  function reorder(){
    if(running)return;
    running=true;
    var children=Array.prototype.slice.call(root.children);
    if(!children.length){running=false;return;}
    var buckets={search:null,videos:null,'best-sellers':null,campaign:null,categories:null,footer:null};
    children.forEach(function(el){var k=kind(el);if(k!=='other'&&!buckets[k])buckets[k]=el;});

    /* Remove every non-requested content section from the home page. */
    children.forEach(function(el){var k=kind(el);if(k==='other')el.remove();});

    /* Keep only the requested order. Missing dynamic sections simply collapse. */
    ['search','videos','best-sellers','campaign','categories','footer'].forEach(function(k){
      if(buckets[k])root.appendChild(buckets[k]);
    });
    running=false;
  }

  window.addEventListener('storefront:home-ready',reorder);
  new MutationObserver(function(){window.requestAnimationFrame(reorder);}).observe(root,{childList:true});
  window.requestAnimationFrame(reorder);
})();
