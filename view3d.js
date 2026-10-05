/* The optional 3D view: the projects become planets on a star map, each with
   its name above it, and a small ship flies between them. A project's
   description only shows once the ship has arrived. One press of an arrow key
   (or the on-screen arrows, or a click on a planet) sends the ship on, and the
   view follows it. The flat list is the default and the switch at the top of
   the page turns this on or off; the choice is remembered.

   The cards in .fleet are the only copy of each project, so a new card shows
   up in both views with nothing else to change. Only the cards the category
   tabs leave visible become planets. */

(function () {
  "use strict";

  var STORAGE_KEY = "view";
  var FLIGHT_MS = 2400; // one hop; longer trips take a little longer
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

  // The ship: a smaller copy of the header rocket, with its own gradient ids.
  var SHIP_SVG =
    '<svg viewBox="0 0 80 200" width="36" height="90" aria-hidden="true">' +
    "<defs>" +
    '<linearGradient id="ship-flame" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0%" stop-color="#fff0c2"/>' +
    '<stop offset="35%" stop-color="#ffb03c" stop-opacity=".9"/>' +
    '<stop offset="72%" stop-color="#ff6b3d" stop-opacity=".5"/>' +
    '<stop offset="100%" stop-color="#ff4d3d" stop-opacity="0"/>' +
    "</linearGradient>" +
    '<linearGradient id="ship-hull" x1="0" y1="0" x2="1" y2="0">' +
    '<stop offset="0%" stop-color="#c3cbe6"/>' +
    '<stop offset="42%" stop-color="#f4f7ff"/>' +
    '<stop offset="100%" stop-color="#8f98b8"/>' +
    "</linearGradient>" +
    "</defs>" +
    '<path class="plume" d="M40 128 C54 152 52 176 40 198 C28 176 26 152 40 128 Z" fill="url(#ship-flame)"/>' +
    '<path d="M40 8 C58 34 66 74 66 104 L66 132 L14 132 L14 104 C14 74 22 34 40 8 Z" fill="url(#ship-hull)"/>' +
    '<path d="M14 104 L2 140 L14 132 Z" fill="#e05a4a"/>' +
    '<path d="M66 104 L78 140 L66 132 Z" fill="#e05a4a"/>' +
    '<circle cx="40" cy="62" r="13" fill="#0d1730"/>' +
    '<circle cx="40" cy="62" r="9" fill="#5fd3c4" opacity=".85"/>' +
    '<rect x="14" y="122" width="52" height="10" rx="3" fill="#b9c1dd"/>' +
    "</svg>";

  document.addEventListener("DOMContentLoaded", function () {
    var fleet = document.querySelector(".fleet");
    var allCards = Array.prototype.slice.call(fleet.querySelectorAll(".planet-card"));
    var switchWrap = document.querySelector(".view-switch");
    var toggle = switchWrap.querySelector(".switch");
    var hud = document.querySelector(".hud");
    var hudCount = hud.querySelector(".hud-count");
    var controls = document.querySelector(".hud-controls");
    var floor = document.querySelector(".floor");
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    var ship = document.createElement("div");
    ship.className = "ship";
    ship.setAttribute("aria-hidden", "true");
    ship.innerHTML = SHIP_SVG;
    fleet.appendChild(ship);

    var cards = []; // the visible cards, in order
    var spots = []; // for each: the planet's centre and the ship's parking spot
    var current = 0; // the planet the ship is at, or flying to
    var shipPos = { x: 0, y: 0 };
    var flight = null; // { from, to, control, start, duration } while flying

    function is3d() {
      return root.dataset.view === "3d";
    }

    // Lay the planets out left to right on a gentle wave. Each card is placed
    // so that its planet, not its top edge, lands on the spot, because the
    // names above the planets wrap to different heights.
    function layout() {
      if (!is3d() || !cards.length) return;
      var gap = Math.min(340, Math.max(250, window.innerWidth * 0.7));
      var offsets = cards.map(function (card) {
        var slot = card.querySelector(".planet-slot");
        return slot.offsetTop + slot.offsetHeight / 2;
      });
      var top = Math.max.apply(null, offsets) + 40;
      var bottom = 0;
      spots = cards.map(function (card, i) {
        var x = i * gap;
        var y = top + (i % 2 ? 34 : -6);
        card.style.left = x - card.offsetWidth / 2 + "px";
        card.style.top = y - offsets[i] + "px";
        bottom = Math.max(bottom, y - offsets[i] + card.offsetHeight);
        var radius = card.querySelector(".planet-slot").offsetWidth / 2;
        return { x: x, y: y, park: { x: x - radius - 26, y: y + 4 } };
      });
      fleet.style.height = bottom + 30 + "px";
    }

    function placeShip(pos, angle) {
      shipPos = pos;
      ship.style.transform =
        "translate(" + pos.x + "px," + pos.y + "px) rotate(" + angle + "deg)";
      // The view follows the ship: the whole map shifts so the ship sits just
      // left of centre, leaving its planet in the middle, and the floor grid
      // drifts with it.
      var spot = spots[current];
      var camera = fleet.clientWidth / 2 - (pos.x + (spot.x - spot.park.x));
      fleet.style.setProperty("--camera", camera + "px");
      floor.style.backgroundPosition = camera * 0.6 + "px 0";
    }

    function name(card) {
      return card.querySelector("h3").textContent.trim();
    }

    function arrive() {
      flight = null;
      ship.classList.remove("is-flying");
      placeShip(spots[current].park, 0);
      cards.forEach(function (card, i) {
        card.classList.toggle("is-arrived", i === current);
      });
      hudCount.textContent =
        "Planet " + (current + 1) + " of " + cards.length + ": " + name(cards[current]);
    }

    function frame(now) {
      if (!flight) return;
      var t = Math.min(1, (now - flight.start) / flight.duration);
      // Ease in and out, along a curve that arcs up between the planets.
      var e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      var a = flight.from;
      var c = flight.control;
      var b = flight.to;
      var u = 1 - e;
      var x = u * u * a.x + 2 * u * e * c.x + e * e * b.x;
      var y = u * u * a.y + 2 * u * e * c.y + e * e * b.y;
      var dx = 2 * u * (c.x - a.x) + 2 * e * (b.x - c.x);
      var dy = 2 * u * (c.y - a.y) + 2 * e * (b.y - c.y);
      // The rocket is drawn nose up, so turn it to face the way it is going.
      var angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
      placeShip({ x: x, y: y }, angle);
      if (t < 1) requestAnimationFrame(frame);
      else arrive();
    }

    function flyTo(index) {
      if (!cards.length) return;
      index = ((index % cards.length) + cards.length) % cards.length;
      if (index === current && !flight) return;
      var hops = Math.abs(index - current) || 1;
      current = index;
      cards.forEach(function (card) {
        card.classList.remove("is-arrived");
      });
      hudCount.textContent = "Flying to " + name(cards[current]) + "…";

      // With reduced motion asked for, the ship is simply there.
      if (reduceMotion.matches) {
        arrive();
        return;
      }
      var from = shipPos;
      var to = spots[current].park;
      var lift = 110 + 30 * Math.min(hops, 4);
      var running = flight !== null;
      flight = {
        from: from,
        to: to,
        control: { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - lift },
        start: performance.now(),
        duration: Math.min(FLIGHT_MS + 500 * (hops - 1), 4200),
      };
      ship.classList.add("is-flying");
      // A press mid-flight just re-aims the ship; the loop already running
      // picks up the new course.
      if (!running) requestAnimationFrame(frame);
    }

    // Rebuild from whichever cards are visible now, with the ship parked at
    // the first planet.
    function refresh() {
      cards = allCards.filter(function (card) {
        return !card.hidden;
      });
      current = 0;
      flight = null;
      allCards.forEach(function (card) {
        card.classList.remove("is-arrived");
      });
      if (is3d() && cards.length) {
        layout();
        arrive();
      }
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
        flight = null;
        fleet.style.height = "";
        allCards.forEach(function (card) {
          card.style.left = "";
          card.style.top = "";
        });
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
      flyTo(current + Number(button.dataset.step));
    });

    // A click on a planet the ship is not at flies there instead of following
    // a link.
    fleet.addEventListener(
      "click",
      function (event) {
        if (!is3d()) return;
        var card = event.target.closest(".planet-card");
        if (!card || card.classList.contains("is-arrived")) return;
        event.preventDefault();
        flyTo(cards.indexOf(card));
      },
      true
    );

    // Arrow keys fly the ship from anywhere on the page, except while the
    // focus is on a control that uses them itself.
    document.addEventListener("keydown", function (event) {
      if (!is3d() || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.target.closest("input, textarea, select, [contenteditable], [role=tab]")) return;
      if (!cards.length) return;
      var key = event.key;
      if (key === "ArrowLeft" || key === "ArrowRight") {
        event.preventDefault();
        flyTo(current + (key === "ArrowRight" ? 1 : -1));
      } else if (key === "Enter" && !flight && !event.target.closest("a, button, [role]")) {
        var primary = cards[current].querySelector("a.link");
        if (primary) primary.click();
      }
    });

    window.addEventListener("resize", function () {
      if (!is3d() || !cards.length) return;
      flight = null;
      layout();
      arrive();
    });

    switchWrap.hidden = false;
    setView(savedView() === "3d" ? "3d" : "flat");
  });
})();
