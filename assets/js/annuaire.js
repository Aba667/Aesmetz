(function () {
  "use strict";

  var form = document.getElementById("directory-filters");
  if (!form) return;

  var search = document.getElementById("directory-search");
  var region = document.getElementById("directory-region");
  var count = document.getElementById("directory-count");
  var reset = document.getElementById("directory-reset");
  var empty = document.getElementById("directory-empty");
  var more = document.getElementById("directory-more");
  var moreButton = document.getElementById("directory-more-button");
  var shown = document.getElementById("directory-shown");
  var cards = Array.prototype.slice.call(document.querySelectorAll(".directory-card"));
  var pageSize = 12;
  var limit = pageSize;

  function normalize(value) {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
  }

  var entries = cards.map(function (card) {
    return {card: card, words: normalize(card.getAttribute("data-search")).split(" "), region: card.getAttribute("data-region")};
  });

  function readUrl() {
    var params = new URLSearchParams(window.location.search);
    search.value = params.get("q") || "";
    var selected = params.get("region") || "";
    region.value = Array.prototype.some.call(region.options, function (option) {
      return option.value === selected;
    }) ? selected : "";
    limit = pageSize;
  }

  function updateUrl() {
    var url = new URL(window.location.href);
    var query = search.value.trim();
    if (query) url.searchParams.set("q", query);
    else url.searchParams.delete("q");
    if (region.value) url.searchParams.set("region", region.value);
    else url.searchParams.delete("region");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }

  function render(syncUrl) {
    var terms = normalize(search.value).split(" ").filter(Boolean);
    var matches = entries.filter(function (entry) {
      return (!region.value || entry.region === region.value) && terms.every(function (term) {
        return entry.words.some(function (word) { return word.indexOf(term) === 0; });
      });
    });
    cards.forEach(function (card) { card.hidden = true; });
    matches.slice(0, limit).forEach(function (entry) { entry.card.hidden = false; });
    var total = matches.length;
    count.textContent = total + (total === 1 ? " association trouvée" : " associations trouvées");
    empty.hidden = total > 0;
    reset.hidden = !search.value && !region.value;
    more.hidden = total === 0 || total <= limit;
    shown.textContent = Math.min(limit, total) + " sur " + total + " associations affichées";
    moreButton.textContent = "Afficher " + Math.min(pageSize, Math.max(0, total - limit)) + " associations de plus";
    if (syncUrl) updateUrl();
  }

  function filter() { limit = pageSize; render(true); }
  function clear() {
    search.value = "";
    region.value = "";
    filter();
    search.focus();
  }

  search.addEventListener("input", filter);
  region.addEventListener("change", filter);
  form.addEventListener("submit", function (event) { event.preventDefault(); filter(); });
  reset.addEventListener("click", clear);
  document.getElementById("directory-empty-reset").addEventListener("click", clear);
  moreButton.addEventListener("click", function () {
    var previousLimit = limit;
    limit += pageSize;
    render(false);
    var visible = cards.filter(function (card) { return !card.hidden; });
    if (visible[previousLimit]) visible[previousLimit].querySelector("h3").focus({preventScroll: true});
  });
  window.addEventListener("popstate", function () { readUrl(); render(false); });
  readUrl();
  render(false);
  form.hidden = false;
}());
