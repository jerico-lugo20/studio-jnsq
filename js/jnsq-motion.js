/* ============================================================
   JNSQ Motion JS
   - IntersectionObserver-based scroll reveals
   - Number count-up animations
   - Auto-runs on DOMContentLoaded
   - Respects prefers-reduced-motion
   ============================================================ */
(function () {
  'use strict';

  var prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function init() {
    if (prefersReducedMotion) {
      // Show everything immediately, no animation
      document.querySelectorAll('.reveal, .reveal-fade, .reveal-scale, .underline-draw').forEach(function (el) {
        el.classList.add('is-visible');
      });
      runCounters(true);
      return;
    }

    setupRevealObserver();
    setupCounters();
  }

  function setupRevealObserver() {
    if (!('IntersectionObserver' in window)) {
      // Older browsers: just show everything
      document.querySelectorAll('.reveal, .reveal-fade, .reveal-scale, .underline-draw').forEach(function (el) {
        el.classList.add('is-visible');
      });
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
      rootMargin: '0px 0px -40px 0px'
    });

    document.querySelectorAll('.reveal, .reveal-fade, .reveal-scale, .underline-draw').forEach(function (el) {
      observer.observe(el);
    });
  }

  function setupCounters() {
    if (!('IntersectionObserver' in window)) {
      runCounters(true);
      return;
    }

    var counterObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          counterObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });

    document.querySelectorAll('.counter').forEach(function (el) {
      counterObserver.observe(el);
    });
  }

  function runCounters(immediate) {
    document.querySelectorAll('.counter').forEach(function (el) {
      if (immediate) {
        el.textContent = el.getAttribute('data-target') || el.textContent;
      } else {
        animateCounter(el);
      }
    });
  }

  function animateCounter(el) {
    var target = parseFloat(el.getAttribute('data-target') || el.textContent.replace(/[^0-9.\-]/g, ''));
    if (isNaN(target)) return;
    var duration = parseInt(el.getAttribute('data-duration') || '1400', 10);
    var prefix = el.getAttribute('data-prefix') || '';
    var suffix = el.getAttribute('data-suffix') || '';
    var decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
    var startTime = null;

    function step(now) {
      if (!startTime) startTime = now;
      var t = Math.min(1, (now - startTime) / duration);
      // ease-out-cubic
      var eased = 1 - Math.pow(1 - t, 3);
      var value = target * eased;
      el.textContent = prefix + value.toFixed(decimals) + suffix;
      if (t < 1) requestAnimationFrame(step);
      else el.textContent = prefix + target.toFixed(decimals) + suffix;
    }
    requestAnimationFrame(step);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
