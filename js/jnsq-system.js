/* ============================================================
   STUDIO JNSQ — Motion + Interaction Layer
   - IntersectionObserver scroll reveals (data-reveal, data-reveal-fade)
   - Word-by-word hero reveal (data-reveal-words)
   - Scroll progress bar
   - Smooth anchor scroll
   - Number counters (data-target)
   - Respects prefers-reduced-motion
   ============================================================ */
(function () {
  'use strict';

  var prefersReducedMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function init() {
    setupWordSplit();
    setupScrollReveals();
    setupScrollProgress();
    setupSmoothAnchors();
    setupCounters();
    setupNavShadow();
  }

  /* === WORD SPLIT — wraps each word in a span for staggered animation === */
  function setupWordSplit() {
    var els = document.querySelectorAll('[data-reveal-words]');
    els.forEach(function (el) {
      // Skip if already split
      if (el.querySelector('.word')) return;

      // Walk text nodes inside the element
      var html = el.innerHTML;
      // Replace text content while preserving inner HTML tags by splitting on whitespace
      // For simplicity, we split each direct text child
      el.innerHTML = ''; // clear

      var temp = document.createElement('div');
      temp.innerHTML = html;

      function processNode(node, target) {
        if (node.nodeType === Node.TEXT_NODE) {
          var words = node.textContent.split(/(\s+)/);
          words.forEach(function (w) {
            if (/^\s+$/.test(w)) {
              target.appendChild(document.createTextNode(w));
            } else if (w) {
              var span = document.createElement('span');
              span.className = 'word';
              span.textContent = w;
              target.appendChild(span);
            }
          });
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          var clone = node.cloneNode(false);
          target.appendChild(clone);
          Array.prototype.forEach.call(node.childNodes, function (child) {
            processNode(child, clone);
          });
        }
      }
      Array.prototype.forEach.call(temp.childNodes, function (child) {
        processNode(child, el);
      });
    });
  }

  /* === SCROLL REVEALS === */
  function setupScrollReveals() {
    var selectors = '[data-reveal], [data-reveal-fade], [data-reveal-words], .jnsq-reveal';
    var els = document.querySelectorAll(selectors);

    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.12,
      rootMargin: '0px 0px -60px 0px'
    });

    els.forEach(function (el) { observer.observe(el); });
  }

  /* === SCROLL PROGRESS BAR === */
  function setupScrollProgress() {
    var bar = document.querySelector('.jnsq-scroll-progress');
    if (!bar) return;
    if (prefersReducedMotion) return;

    var ticking = false;
    function update() {
      var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      var scrollHeight = (document.documentElement.scrollHeight - window.innerHeight) || 1;
      var pct = Math.min(100, (scrollTop / scrollHeight) * 100);
      bar.style.width = pct + '%';
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    }, { passive: true });
    update();
  }

  /* === SMOOTH ANCHOR SCROLL === */
  function setupSmoothAnchors() {
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (!a) return;
      var hash = a.getAttribute('href');
      if (hash === '#' || hash.length < 2) return;
      var target = document.querySelector(hash);
      if (!target) return;
      e.preventDefault();
      var navHeight = document.querySelector('.jnsq-nav') ? 70 : 0;
      var top = target.getBoundingClientRect().top + window.pageYOffset - navHeight - 24;
      if (prefersReducedMotion) {
        window.scrollTo(0, top);
      } else {
        window.scrollTo({ top: top, behavior: 'smooth' });
      }
    });
  }

  /* === COUNTERS === */
  function setupCounters() {
    var counters = document.querySelectorAll('[data-target]');
    if (!counters.length) return;
    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      counters.forEach(function (el) {
        el.textContent = (el.getAttribute('data-prefix') || '') + el.getAttribute('data-target') + (el.getAttribute('data-suffix') || '');
      });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });

    counters.forEach(function (el) { observer.observe(el); });
  }

  function animateCounter(el) {
    var target = parseFloat(el.getAttribute('data-target') || el.textContent);
    if (isNaN(target)) return;
    var duration = parseInt(el.getAttribute('data-duration') || '1600', 10);
    var prefix = el.getAttribute('data-prefix') || '';
    var suffix = el.getAttribute('data-suffix') || '';
    var decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
    var startTime = null;

    function step(now) {
      if (!startTime) startTime = now;
      var t = Math.min(1, (now - startTime) / duration);
      var eased = 1 - Math.pow(1 - t, 3);
      var value = target * eased;
      el.textContent = prefix + value.toFixed(decimals) + suffix;
      if (t < 1) requestAnimationFrame(step);
      else el.textContent = prefix + target.toFixed(decimals) + suffix;
    }
    requestAnimationFrame(step);
  }

  /* === NAV SHADOW ON SCROLL === */
  function setupNavShadow() {
    var nav = document.querySelector('.jnsq-nav');
    if (!nav) return;
    var ticking = false;
    function update() {
      if (window.pageYOffset > 8) nav.classList.add('is-scrolled');
      else nav.classList.remove('is-scrolled');
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    update();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
