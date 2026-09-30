/* Reorder existing backend-configured blocks without changing their business logic. */
(function(){
  'use strict';
  var desired=['search','videos','best-sellers','campaign','categories'];
  function reorder(){
    var root=document.getElementById('storefront-home-root');
    if(!root)return;
    var sections=Array.prototype.slice.call(root.children);
    if(!sections.length)return;
    function kind(el){
      if(el.classList.contains('sf-search-block'))return 'search';
      if(el.classList.contains('sf-video-section'))return 'videos';
      if(el.classList.contains('sf-best-sellers'))return 'best-sellers';
      if(el.querySelector&&el.querySelector('.sf-campaign'))return 'campaign';
      if(el.id==='sf-categories')return 'categories';
      return '';
    }
    var map={};sections.forEach(function(el){var k=kind(el);if(k)map[k]=el;});
    var anchor=null;
    desired.forEach(function(k){var el=map[k];if(!el)return;if(!anchor){root.insertBefore(el,root.firstChild);anchor=el;}else{root.insertBefore(el,anchor.nextSibling);anchor=el;}});
    /* The old beauty hero is intentionally removed from the home composition. */
    var hero=root.querySelector('.sf-hero');if(hero)hero.remove();
    /* The extra generic collection is not part of the requested primary flow. */
    var primaryEnd=map.categories;
    if(primaryEnd) primaryEnd.classList.add('sf-primary-flow-end');
  }
  window.addEventListener('storefront:home-ready',reorder);
  var root=document.getElementById('storefront-home-root');
  if(root){new MutationObserver(function(){window.requestAnimationFrame(reorder);}).observe(root,{childList:true});}
})();
