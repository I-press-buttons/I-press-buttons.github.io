/* The optional 3D view: the project cards stand on a turntable, game
   level-select style, and the arrows spin it. The flat list is the default and
   the switch at the top of the page turns this on or off; the choice is
   remembered. The cards in .fleet are the only copy of each project, so a new
   card shows up in both views with nothing else to change. Only the cards the
   category tabs leave visible go on the turntable. */

(function () {
  "use strict";

  var STORAGE_KEY = "view";
  var root = document.documentElement;

  function savedView() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function saveView(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch (e) {
      /* Private windows can refuse storage; the switch still works. */
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    var main = document.querySelector("main");
    var fleet = document.querySelector(".fleet");
    var allCards = Array.prototype.slice.call(fleet.querySelectorAll(".planet-card"));
    var switchWrap = document.querySelector(".view-switch");
    var toggle = switchWrap.querySelector(".switch");
    var hud = document.querySelector(".hud");
    var hudCount = hud.querySelector(".hud-count");
    var controls = document.querySelector(".hud-controls");
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    // Each card stands at --d steps round the table from the one in front,
    // ANGLE apart. Cards two or more steps away face backwards and are not
    // drawn, so any number of cards works, and a tab with two looks the same
    // as one with six.
    var ANGLE = 60;
    var cards = [];
    var n = 0;
    var active = 0;

    fleet.style.setProperty("--angle", ANGLE + "deg");

    function offset(i) {
      var d = (((i - active) % n) + n) % n;
      return d > n / 2 ? d - n : d;
    }

    function is3d() {
      return root.dataset.view === "3d";
    }

    // The ring's radius has to fit the cards side by side, and the stage has
    // to be tall enough for the tallest card, so both are measured, not set.
    function layout() {
      if (!is3d()) return;
      if (!n) return;
      var width = cards[0].offsetWidth;
      var tallest = 0;
      cards.forEach(function (card) {
        tallest = Math.max(tallest, card.offsetHeight);
      });
      var radius = (width / 2 + 48) / Math.tan(((ANGLE / 2) * Math.PI) / 180);
      fleet.style.setProperty("--radius", Math.round(radius) + "px");
      fleet.style.height = tallest + 60 + "px";
    }

    function render() {
      if (!n) return;
      cards.forEach(function (card, i) {
        var before = Number(card.style.getPropertyValue("--d")) || 0;
        var after = offset(i);
        // A card wrapping round from one end to the other would otherwise
        // sweep across the front on its way; it jumps there unseen instead.
        if (Math.abs(after - before) > 1) {
          card.classList.add("no-turn");
          card.style.setProperty("--d", after);
          void card.offsetWidth;
          card.classList.remove("no-turn");
        } else {
          card.style.setProperty("--d", after);
        }
        card.classList.toggle("is-active", i === active);
      });
      hudCount.textContent =
        "Project " + (active + 1) + " of " + n + ": " +
        cards[active].querySelector("h3").textContent.trim();
    }

    function select(index) {
      active = ((index % n) + n) % n;
      render();
    }

    function turn(by) {
      select(active + by);
    }

    // Rebuild from whichever cards are visible now. A hidden card keeps no
    // place on the table, and the first visible card comes to the front.
    function refresh() {
      cards = allCards.filter(function (card) {
        return !card.hidden;
      });
      n = cards.length;
      active = 0;
      allCards.forEach(function (card) {
        card.classList.add("no-turn");
        card.classList.remove("is-active");
        card.style.removeProperty("--d");
      });
      if (is3d()) {
        layout();
        render();
      }
      void fleet.offsetWidth;
      allCards.forEach(function (card) {
        card.classList.remove("no-turn");
      });
    }

    fleet.addEventListener("fleetchange", refresh);

    function setView(view) {
      root.dataset.view = view;
      toggle.setAttribute("aria-checked", view === "3d" ? "true" : "false");
      hud.hidden = view !== "3d";
      controls.hidden = view !== "3d";
      if (view === "3d") {
        refresh();
      } else {
        fleet.style.height = "";
        resetTilt();
      }
    }

    toggle.addEventListener("click", function () {
      var view = is3d() ? "flat" : "3d";
      saveView(view);
      setView(view);
    });

    controls.addEventListener("click", function (event) {
      var button = event.target.closest("[data-step]");
      if (!button) return;
      turn(Number(button.dataset.step));
    });

    // A click on a card that is not in front brings it to the front instead of
    // following its link, the way a level-select screen works.
    fleet.addEventListener(
      "click",
      function (event) {
        if (!is3d()) return;
        var card = event.target.closest(".planet-card");
        if (!card || card.classList.contains("is-active")) return;
        event.preventDefault();
        select(cards.indexOf(card));
      },
      true
    );

    // Tabbing to a link on another card turns that card to the front, so the
    // keyboard never lands on something facing away.
    fleet.addEventListener("focusin", function (event) {
      if (!is3d()) return;
      var card = event.target.closest(".planet-card");
      if (card && !card.classList.contains("is-active")) {
        select(cards.indexOf(card));
      }
    });

    // Arrow keys turn the table from anywhere on the page, except while the
    // focus is on a control that uses them itself.
    document.addEventListener("keydown", function (event) {
      if (!is3d() || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.target.closest("input, textarea, select, [contenteditable], [role=tab]")) return;
      if (!n) return;
      var key = event.key;
      if (key === "ArrowLeft" || key === "ArrowRight") {
        event.preventDefault();
        turn(key === "ArrowRight" ? 1 : -1);
        // Keep focus on the card that is now in front, if focus was on a card.
        if (fleet.contains(document.activeElement)) {
          var link = cards[active].querySelector("a");
          if (link) link.focus({ preventScroll: true });
        }
      } else if (key === "Enter" && !event.target.closest("a, button, [role]")) {
        var primary = cards[active].querySelector("a.link");
        if (primary) primary.click();
      }
    });

    // A slight tilt toward the pointer, for depth. Skipped entirely when the
    // visitor has asked for reduced motion.
    function resetTilt() {
      fleet.style.setProperty("--tilt-x", "0deg");
      fleet.style.setProperty("--tilt-y", "0deg");
    }

    main.addEventListener("pointermove", function (event) {
      if (!is3d() || reduceMotion.matches || event.pointerType !== "mouse") return;
      var box = main.getBoundingClientRect();
      var x = (event.clientX - box.left) / box.width - 0.5;
      var y = (event.clientY - box.top) / box.height - 0.5;
      fleet.style.setProperty("--tilt-x", (-y * 6).toFixed(2) + "deg");
      fleet.style.setProperty("--tilt-y", (x * 8).toFixed(2) + "deg");
    });
    main.addEventListener("pointerleave", resetTilt);

    window.addEventListener("resize", layout);

    switchWrap.hidden = false;
    setView(savedView() === "3d" ? "3d" : "flat");
  });
})();
