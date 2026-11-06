// Runs synchronously in <head>, before first paint — site.js can't do this
// job since it's loaded with `defer` and runs after the page has already
// rendered. Only sets data-theme when the visitor has explicitly chosen a
// theme before; otherwise the CSS's own @media (prefers-color-scheme)
// handles it, so this stays a no-op and the site just follows the OS.
(function(){
  try{
    var saved = localStorage.getItem('newsociety-theme');
    if(saved === 'light' || saved === 'dark'){
      document.documentElement.setAttribute('data-theme', saved);
    }
  }catch(e){}
})();

// Scroll-reveal opt-in. Sections marked .reveal are only hidden (and faded in
// on scroll by site.js) when this class is present, so the content is still
// visible if scripts fail, for crawlers and link previews, and for visitors
// who ask for reduced motion.
(function(){
  try{
    if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window){
      document.documentElement.classList.add('js-reveal');
    }
  }catch(e){}
})();
