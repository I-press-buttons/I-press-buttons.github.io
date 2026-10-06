/* Category tabs above the project list. Each card carries a data-category, and
   the selected tab hides every card outside it. The last tab picked is
   remembered. When the set of visible cards changes, .fleet gets a
   "fleetchange" event so the 3D view can redraw its star map. */

(function () {
  "use strict";

  // Every project site under this host shares one localStorage, so the key
  // carries a prefix to stay clear of theirs.
  var STORAGE_KEY = "homepage.tab";

  function savedTab() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function saveTab(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch (e) {
      /* Private windows can refuse storage; the tabs still work. */
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    var tablist = document.querySelector(".tabs");
    var fleet = document.querySelector(".fleet");
    var tabs = Array.prototype.slice.call(tablist.querySelectorAll("[role=tab]"));
    var cards = Array.prototype.slice.call(fleet.querySelectorAll(".planet-card"));

    fleet.setAttribute("role", "tabpanel");

    function select(tab, focus) {
      var category = tab.dataset.category;
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
      });
      fleet.setAttribute("aria-labelledby", tab.id);
      cards.forEach(function (card) {
        card.hidden = card.dataset.category !== category;
      });
      if (focus) tab.focus();
      fleet.dispatchEvent(new CustomEvent("fleetchange"));
    }

    tablist.addEventListener("click", function (event) {
      var tab = event.target.closest("[role=tab]");
      if (!tab) return;
      saveTab(tab.dataset.category);
      select(tab, false);
    });

    // The standard tab pattern: arrows move between tabs, Home and End jump to
    // the ends, and moving selects.
    tablist.addEventListener("keydown", function (event) {
      var i = tabs.indexOf(event.target);
      if (i < 0) return;
      var next = null;
      if (event.key === "ArrowRight") next = tabs[(i + 1) % tabs.length];
      else if (event.key === "ArrowLeft") next = tabs[(i - 1 + tabs.length) % tabs.length];
      else if (event.key === "Home") next = tabs[0];
      else if (event.key === "End") next = tabs[tabs.length - 1];
      if (!next) return;
      event.preventDefault();
      saveTab(next.dataset.category);
      select(next, true);
    });

    var initial = tabs.filter(function (t) {
      return t.dataset.category === savedTab();
    })[0];
    tablist.hidden = false;
    select(initial || tabs[0], false);
  });
})();
