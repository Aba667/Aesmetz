/* =========================================================================
   AESM — Interactions du site
   Vanilla JS, aucune dépendance. Chargé avec l'attribut `defer`.
   ========================================================================= */
(function () {
  "use strict";

  /* ---------- Navigation mobile ---------- */
  function initNav() {
    var toggle = document.querySelector(".nav-toggle");
    var nav = document.getElementById("nav-principal");
    if (!toggle || !nav) return;

    function close() {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    }

    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) close();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 1040) close();
    });
  }

  /* ---------- Lien de navigation de la page courante ---------- */
  function initCurrentLink() {
    var here = location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".nav-link").forEach(function (a) {
      var target = (a.getAttribute("href") || "").split("/").pop().split("#")[0];
      if (target && target === here) a.setAttribute("aria-current", "page");
    });
  }

  /* ---------- Galeries : « Voir toutes les photos » ---------- */
  function initGalleries() {
    document.querySelectorAll("[data-gallery-toggle]").forEach(function (btn) {
      var id = btn.getAttribute("data-gallery-toggle");
      var hidden = document.getElementById(id);
      if (!hidden) return;
      var labelMore = btn.getAttribute("data-label-more") || "Voir toutes les photos";
      var labelLess = btn.getAttribute("data-label-less") || "Réduire la galerie";

      btn.addEventListener("click", function () {
        var open = hidden.classList.toggle("is-open");
        btn.setAttribute("aria-expanded", open ? "true" : "false");
        btn.textContent = open ? labelLess : labelMore;
        if (!open) {
          btn.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      });
    });
  }

  /* ---------- Visionneuse d'images ---------- */
  function initLightbox() {
    var items = Array.prototype.slice.call(
      document.querySelectorAll("[data-lightbox]")
    );
    if (!items.length) return;

    var box = document.createElement("div");
    box.className = "lightbox";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", "Visionneuse d'images");
    box.innerHTML =
      '<button class="lightbox__close" type="button" aria-label="Fermer la visionneuse">&times;</button>' +
      '<button class="lightbox__nav lightbox__nav--prev" type="button" aria-label="Image précédente">&#8249;</button>' +
      '<img alt="">' +
      '<button class="lightbox__nav lightbox__nav--next" type="button" aria-label="Image suivante">&#8250;</button>' +
      '<p class="lightbox__counter" aria-live="polite"></p>';
    document.body.appendChild(box);

    var img = box.querySelector("img");
    var counter = box.querySelector(".lightbox__counter");
    var btnClose = box.querySelector(".lightbox__close");
    var btnPrev = box.querySelector(".lightbox__nav--prev");
    var btnNext = box.querySelector(".lightbox__nav--next");
    var index = 0;
    var lastFocus = null;

    function sourceFor(el) {
      // `data-lightbox` peut porter la version haute définition ; sinon on
      // remplace simplement le dossier "thumb" par "full".
      var big = el.getAttribute("data-lightbox");
      if (big) return big;
      var thumb = el.tagName === "IMG" ? el : el.querySelector("img");
      if (!thumb) return "";
      return thumb.getAttribute("src").replace("/thumb/", "/full/");
    }

    function labelFor(el) {
      var thumb = el.tagName === "IMG" ? el : el.querySelector("img");
      return (thumb && thumb.getAttribute("alt")) || "";
    }

    function show(i) {
      index = (i + items.length) % items.length;
      var el = items[index];
      img.src = sourceFor(el);
      img.alt = labelFor(el);
      counter.textContent = index + 1 + " / " + items.length;
    }

    function open(i) {
      lastFocus = document.activeElement;
      show(i);
      box.classList.add("is-open");
      document.body.style.overflow = "hidden";
      btnClose.focus();
    }

    function close() {
      box.classList.remove("is-open");
      document.body.style.overflow = "";
      img.src = "";
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    items.forEach(function (el, i) {
      el.addEventListener("click", function (e) {
        e.preventDefault();
        open(i);
      });
    });

    btnClose.addEventListener("click", close);
    btnPrev.addEventListener("click", function () { show(index - 1); });
    btnNext.addEventListener("click", function () { show(index + 1); });
    box.addEventListener("click", function (e) { if (e.target === box) close(); });

    document.addEventListener("keydown", function (e) {
      if (!box.classList.contains("is-open")) return;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") show(index - 1);
      else if (e.key === "ArrowRight") show(index + 1);
      else if (e.key === "Tab") {
        // Piège à focus : on garde la tabulation dans la visionneuse.
        var focusables = [btnClose, btnPrev, btnNext];
        var pos = focusables.indexOf(document.activeElement);
        e.preventDefault();
        var next = e.shiftKey ? pos - 1 : pos + 1;
        focusables[(next + focusables.length) % focusables.length].focus();
      }
    });

    // Balayage tactile
    var startX = null;
    box.addEventListener("touchstart", function (e) { startX = e.touches[0].clientX; }, { passive: true });
    box.addEventListener("touchend", function (e) {
      if (startX === null) return;
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 55) show(dx > 0 ? index - 1 : index + 1);
      startX = null;
    });
  }

  /* Note : il n'y a volontairement ni apparition au défilement ni compteur
     animé. Les chiffres sont écrits en clair dans le HTML et lisibles
     immédiatement, y compris sans JavaScript. */

  /* ---------- Année courante dans le pied de page ---------- */
  function initYear() {
    document.querySelectorAll("[data-current-year]").forEach(function (el) {
      el.textContent = String(new Date().getFullYear());
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initNav();
    initCurrentLink();
    initGalleries();
    initLightbox();
    initYear();
  });
})();
