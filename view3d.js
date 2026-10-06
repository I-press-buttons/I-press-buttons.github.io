/* The optional 3D view: the projects become planets on a star map, each with
   its name above it, and a small ship flies between them. A project's
   description only shows once the ship has arrived. One press of an arrow key
   (or the on-screen arrows, or a click on a planet) sends the ship on, and the
   view follows it. The flat list is the default and the switch at the top of
   the page turns this on or off; the choice is remembered.

   Each category tab is a solar system. Past either end of one, a distant,
   out-of-focus planet stands for the next system over (the tabs wrap round),
   and flying on from the end planet, or clicking that distant one, switches
   the tab and brings the ship in from the system it left.

   The cards in .fleet are the only copy of each project, so a new card shows
   up in both views with nothing else to change. Only the cards the category
   tabs leave visible become planets. */

(function () {
  "use strict";

  // Every project site under this host shares one localStorage, so the key
  // carries a prefix to stay clear of theirs.
  var STORAGE_KEY = "homepage.view";
  var FLIGHT_MS = 2400; // one hop; longer trips take a little longer
  var SETTLE = 0.25; // the last share of a flight spent turning upright
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
    var tabs = Array.prototype.slice.call(document.querySelectorAll(".tabs [role=tab]"));
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    var ship = document.createElement("div");
    ship.className = "ship";
    ship.setAttribute("aria-hidden", "true");
    ship.innerHTML = SHIP_SVG;
    fleet.appendChild(ship);

    // The two distant planets, one past each end of the map. Each shows the
    // nearest planet of the system it leads to.
    var far = { prev: farMarker(-1), next: farMarker(1) };

    function farMarker(dir) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "far-system " + (dir < 0 ? "far-prev" : "far-next");
      button.dataset.dir = String(dir);
      button.hidden = true;
      button.innerHTML = '<span class="far-planet"></span><span class="far-name"></span>';
      fleet.appendChild(button);
      return button;
    }

    // A copy of a card's planet. Its gradient and clip ids get a suffix, as
    // ids must stay unique and the original may be hidden with its tab.
    function farPlanet(card, suffix) {
      var svg = card.querySelector(".planet").cloneNode(true);
      svg.removeAttribute("class");
      svg.setAttribute("aria-hidden", "true");
      Array.prototype.forEach.call(svg.querySelectorAll("*"), function (el) {
        if (el.id) el.id += suffix;
        ["fill", "stroke", "clip-path"].forEach(function (attr) {
          var value = el.getAttribute(attr);
          if (value && value.indexOf("url(#") === 0) {
            el.setAttribute(attr, value.replace(/\)$/, suffix + ")"));
          }
        });
      });
      return svg;
    }

    var cards = []; // the visible cards, in order
    var spots = []; // for each: the planet's centre and the ship's parking spot
    var current = 0; // the planet the ship is at, or flying to
    var shipPos = { x: 0, y: 0 };
    var flight = null; // { from, to, control, start, duration } while flying
    var looping = false; // whether a frame is already queued
    var systems = null; // { prev, next } tabs either side, or null if alone
    var farSpots = {}; // the distant planets' centres, as prev and next
    var arriving = 0; // set while switching systems: +1 going right, -1 left

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

      // The distant planets sit a little higher, as if further back, and close
      // enough to the end planets to stay on screen on a phone.
      var reach = Math.min(gap * 0.85, fleet.clientWidth / 2 - 20);
      [far.prev, far.next].forEach(function (button) {
        if (button.hidden) return;
        var dir = Number(button.dataset.dir);
        var x = dir < 0 ? -reach : (cards.length - 1) * gap + reach;
        var y = top - 40;
        var planet = button.querySelector(".far-planet");
        var centre = planet.offsetTop + planet.offsetHeight / 2;
        button.style.left = x - button.offsetWidth / 2 + "px";
        button.style.top = y - centre + "px";
        farSpots[dir < 0 ? "prev" : "next"] = { x: x, y: y };
      });
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
      if (!flight) {
        looping = false;
        return;
      }
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
      // Keep the heading within a half turn either side of upright, so the
      // settling below always takes the short way round.
      if (angle > 180) angle -= 360;
      // By the end of a hop the nose points down and forward, and arrive()
      // parks the ship upright. Easing it there over the last stretch stops
      // that from being a one-frame snap.
      var s = Math.min(1, Math.max(0, (t - (1 - SETTLE)) / SETTLE));
      angle *= 1 - s * s * (3 - 2 * s);
      placeShip({ x: x, y: y }, angle);
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        looping = false;
        arrive();
      }
    }

    function flyTo(index) {
      if (!cards.length) return;
      // Off either end of the map is the next system over.
      if (systems && (index < 0 || index >= cards.length)) {
        crossTo(index < 0 ? -1 : 1);
        return;
      }
      index = ((index % cards.length) + cards.length) % cards.length;
      if (index === current && !flight) return;
      var hops = Math.abs(index - current) || 1;
      current = index;
      launch(shipPos, hops);
    }

    // Send the ship from a point to the planet at `current`.
    function launch(from, hops) {
      cards.forEach(function (card) {
        card.classList.remove("is-arrived");
      });
      hudCount.textContent = "Flying to " + name(cards[current]) + "…";

      // With reduced motion asked for, the ship is simply there.
      if (reduceMotion.matches) {
        arrive();
        return;
      }
      var to = spots[current].park;
      var lift = 110 + 30 * Math.min(hops, 4);
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
      if (!looping) {
        looping = true;
        requestAnimationFrame(frame);
      }
    }

    // Switch to the system either side by selecting its tab. tabs.js then
    // fires "fleetchange", and refresh() below brings the ship in.
    function crossTo(dir) {
      arriving = dir;
      (dir < 0 ? systems.prev : systems.next).click();
    }

    // The nearest tabs either side of the selected one, wrapping round, that
    // have any projects. With no other such tab there is nowhere to cross to.
    function neighbours() {
      var selected = tabs.filter(function (tab) {
        return tab.getAttribute("aria-selected") === "true";
      })[0];
      var filled = tabs.filter(function (tab) {
        return tab === selected || allCards.some(function (card) {
          return card.dataset.category === tab.dataset.category;
        });
      });
      var i = filled.indexOf(selected);
      if (i < 0 || filled.length < 2) return null;
      return {
        prev: filled[(i - 1 + filled.length) % filled.length],
        next: filled[(i + 1) % filled.length],
      };
    }

    function cardsOf(tab) {
      return allCards.filter(function (card) {
        return card.dataset.category === tab.dataset.category;
      });
    }

    function label(tab) {
      return tab.textContent.trim();
    }

    // Dress each distant planet as the nearest planet of the system it leads
    // to: the last one of the system to the left, the first to the right.
    function dressFar() {
      systems = cards.length ? neighbours() : null;
      [["prev", -1], ["next", 1]].forEach(function (pair) {
        var button = far[pair[0]];
        button.hidden = !systems;
        if (!systems) return;
        var tab = systems[pair[0]];
        var list = cardsOf(tab);
        var card = pair[1] < 0 ? list[list.length - 1] : list[0];
        var slot = button.querySelector(".far-planet");
        slot.textContent = "";
        slot.appendChild(farPlanet(card, "-far-" + pair[0]));
        button.querySelector(".far-name").textContent =
          pair[1] < 0 ? "← " + label(tab) : label(tab) + " →";
        button.setAttribute("aria-label", "Fly to the " + label(tab) + " system");
      });
    }

    // Rebuild from whichever cards are visible now, with the ship parked at
    // the first planet. Arriving from another system, the ship instead flies
    // in from the distant planet that now stands for the one it left, to the
    // nearest planet on that side.
    function refresh() {
      var dir = arriving;
      arriving = 0;
      cards = allCards.filter(function (card) {
        return !card.hidden;
      });
      current = dir < 0 ? Math.max(0, cards.length - 1) : 0;
      flight = null;
      allCards.forEach(function (card) {
        card.classList.remove("is-arrived");
      });
      dressFar();
      if (!is3d() || !cards.length) return;
      layout();
      var entry = dir && farSpots[dir > 0 ? "prev" : "next"];
      if (entry && systems && !reduceMotion.matches) {
        var start = { x: entry.x + dir * 40, y: entry.y + 4 };
        placeShip(start, 0);
        launch(start, 1);
      } else {
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
        [far.prev, far.next].forEach(function (button) {
          button.style.left = "";
          button.style.top = "";
        });
      }
    }

    toggle.addEventListener("click", function (event) {
      // Same as the arrows below: after a mouse click the switch would keep
      // the focus, and the first Enter would turn the view straight back off.
      if (event.detail > 0) toggle.blur();
      var view = is3d() ? "flat" : "3d";
      saveView(view);
      setView(view);
    });

    controls.addEventListener("click", function (event) {
      var button = event.target.closest("[data-step]");
      if (!button) return;
      // A mouse or tap leaves the focus on the button, so the next Enter would
      // press it again instead of opening the project. A keyboard click has a
      // detail of 0 and keeps its focus.
      if (event.detail > 0) button.blur();
      flyTo(current + Number(button.dataset.step));
    });

    // A click on a planet the ship is not at flies there instead of following
    // a link, and a click on a distant planet flies to its system.
    fleet.addEventListener(
      "click",
      function (event) {
        if (!is3d()) return;
        var marker = event.target.closest(".far-system");
        if (marker) {
          if (event.detail > 0) marker.blur();
          if (systems) crossTo(Number(marker.dataset.dir));
          return;
        }
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
        // With no public link there is nothing to open, so say so in the live
        // region rather than leaving Enter a silent no-op.
        var primary = cards[current].querySelector("a.link");
        if (primary) primary.click();
        else hudCount.textContent = name(cards[current]) + " has no public link";
      }
    });

    // The layout depends only on the width the page has to lay out in. On a
    // phone the address bar sliding in and out fires resize with just the
    // height changed, and acting on that would cut a flight short, so those
    // are ignored. The document's width leaves out any scrollbar, so one that
    // comes or goes with the height still counts as a change.
    var lastWidth = root.clientWidth;
    window.addEventListener("resize", function () {
      if (root.clientWidth === lastWidth) return;
      lastWidth = root.clientWidth;
      if (!is3d() || !cards.length) return;
      flight = null;
      layout();
      arrive();
    });

    switchWrap.hidden = false;
    setView(savedView() === "3d" ? "3d" : "flat");
  });
})();
