/* Home educational video rail enhancements. */
(function(){
  'use strict';

  function enhanceEducationSection(){
    const section=document.querySelector('.sf-video-section');
    if(!section)return;

    section.id='education-videos';
    section.setAttribute('aria-label','آموزش‌ها');

    const allLink=section.querySelector('.sf-section-head > a');
    if(allLink){
      allLink.href='education.html';
      allLink.innerHTML='مشاهده همه <span aria-hidden="true">‹</span>';
      allLink.setAttribute('aria-label','مشاهده همه ویدیوهای آموزشی');
    }

    const rail=section.querySelector('.sf-video-grid, .sf-video-demo');
    if(rail){
      rail.setAttribute('role','region');
      rail.setAttribute('aria-label','فهرست افقی ویدیوهای آموزشی');
      rail.setAttribute('tabindex','0');
    }

    const videos=Array.from(section.querySelectorAll('video'));
    videos.forEach((video,index)=>{
      video.preload='metadata';
      video.playsInline=true;
      video.setAttribute('aria-label','ویدیوی آموزشی '+(index+1));
      video.addEventListener('play',()=>{
        videos.forEach(other=>{
          if(other!==video&&!other.paused)other.pause();
        });
      });
    });
  }

  window.addEventListener('storefront:home-ready',enhanceEducationSection);
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>setTimeout(enhanceEducationSection,0),{once:true});
  }else{
    setTimeout(enhanceEducationSection,0);
  }
})();
