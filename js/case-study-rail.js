// Sticky rail — highlight the section currently in view.
// Wraps IntersectionObserver so we do not thrash scroll events.
(function () {
  var rail = document.querySelector('.csx-rail');
  if (!rail) return;
  var links = Array.prototype.slice.call(rail.querySelectorAll('a[href^="#"]'));
  if (!links.length) return;

  var idToLink = {};
  var sections = [];
  links.forEach(function (a) {
    var id = a.getAttribute('href').slice(1);
    var el = document.getElementById(id);
    if (el) {
      idToLink[id] = a;
      sections.push(el);
    }
  });
  if (!sections.length) return;

  function clearAll() {
    links.forEach(function (a) { a.classList.remove('is-active'); });
  }

  var observer = new IntersectionObserver(function (entries) {
    // Pick the entry with the largest visible ratio near the top.
    var best = null;
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        if (!best || entry.intersectionRatio > best.intersectionRatio) best = entry;
      }
    });
    if (best) {
      clearAll();
      var link = idToLink[best.target.id];
      if (link) link.classList.add('is-active');
    }
  }, { rootMargin: '-25% 0px -60% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] });

  sections.forEach(function (s) { observer.observe(s); });

  // Smooth scroll with offset for the top nav
  rail.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href').slice(1);
    var el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    var top = el.getBoundingClientRect().top + window.pageYOffset - 24;
    window.scrollTo({ top: top, behavior: 'smooth' });
    history.replaceState(null, '', '#' + id);
  });
})();
