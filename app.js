(() => {
  "use strict";

  const start = { lat: 37.805, lng: -122.43 };
  const map = L.map("map", { zoomControl: false, keyboard: false, worldCopyJump: true })
    .setView([start.lat, start.lng], 14);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: ""
  }).addTo(map);
  L.control.zoom({ position: "bottomright" }).addTo(map);

  const boatIcon = L.divIcon({
    className: "",
    html: '<div class="boat-icon" aria-label="Your boat"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 3 34 30 20 25 6 30Z" fill="#f3fbf9" stroke="#092b35" stroke-width="2.5" stroke-linejoin="round"/><path d="m20 9 8 17-8-3Z" fill="#69e0c0"/></svg></div>',
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  });
  const position = { ...start };
  const boat = L.marker([position.lat, position.lng], {
    icon: boatIcon,
    keyboard: false,
    title: "Your boat"
  }).addTo(map);

  const spawns = [
    { name: "San Francisco Bay (water)", lat: 37.82, lng: -122.42, zoom: 14, heading: 0 },
    { name: "Sydney Harbour (water)", lat: -33.85, lng: 151.25, zoom: 14, heading: 0 },
    { name: "Mediterranean (open water)", lat: 36.0, lng: 15.0, zoom: 11, heading: 90 },
    { name: "Atlantic (open water)", lat: 35.0, lng: -40.0, zoom: 10, heading: 90 },
    { name: "Amsterdam canals", lat: 52.372, lng: 4.893, zoom: 15, heading: 0 },
    { name: "New York City", lat: 40.7, lng: -74.02, zoom: 14, heading: 0 },
    { name: "Tokyo Bay", lat: 35.58, lng: 139.85, zoom: 13, heading: 180 },
    { name: "Bosphorus, Istanbul (water)", lat: 41.04, lng: 29.0, zoom: 13, heading: 0 },
    { name: "Venice", lat: 45.435, lng: 12.33, zoom: 15, heading: 90 },
    { name: "Rio de Janeiro", lat: -22.93, lng: -43.17, zoom: 13, heading: 90 }
  ];
  function spawnAt(spot) {
    position.lat = spot.lat;
    position.lng = spot.lng;
    heading = spot.heading;
    speed = 0;
    followBoat = true;
    map.setView([spot.lat, spot.lng], spot.zoom, { animate: false });
  }
  const spawnSelect = document.querySelector("#spawn");
  spawns.forEach((spot, i) => spawnSelect.add(new Option(`${i + 1}. ${spot.name}`, i)));
  spawnSelect.addEventListener("change", () => {
    spawnAt(spawns[Number(spawnSelect.value)]);
    spawnSelect.blur();
  });

  const keysDown = new Set();
  const controls = new Set();
  const speedElement = document.querySelector("#speed");
  const courseElement = document.querySelector("#course");
  const positionElement = document.querySelector("#position");
  const followButton = document.querySelector("#follow");
  const speedSlider = document.querySelector("#max-speed");
  const modeSwipe = document.querySelector("#mode-swipe");
  const modeTouch = document.querySelector("#mode-touch");
  const debugElement = document.querySelector("#debug");
  const speedValue = document.querySelector("#max-speed-value");
  const panel = document.querySelector(".panel");
  const menuToggle = document.querySelector("#menu-toggle");
  const debug = (text) => { debugElement.textContent = text; };
  menuToggle.addEventListener("click", () => {
    const hidden = panel.classList.toggle("is-hidden");
    menuToggle.setAttribute("aria-expanded", String(!hidden));
  });
  const mapElement = map.getContainer();
  let maxSpeed = Number(speedSlider.value);
  let dragMode = false;
  let drag = null;
  const cruise = true;
  const pointers = new Map();
  let heading = 0;
  let speed = 0;
  let followBoat = true;
  let previousTime = performance.now();
  let lastReadout = 0;

  const keyActions = new Map([
    ["ArrowUp", "forward"], ["w", "forward"], ["W", "forward"],
    ["ArrowDown", "reverse"], ["s", "reverse"], ["S", "reverse"],
    ["ArrowLeft", "left"], ["a", "left"], ["A", "left"],
    ["ArrowRight", "right"], ["d", "right"], ["D", "right"]
  ]);
  const actionKeys = {
    forward: ["ArrowUp", "w", "W"],
    reverse: ["ArrowDown", "s", "S"],
    left: ["ArrowLeft", "a", "A"],
    right: ["ArrowRight", "d", "D"]
  };

  function isEditable(target) {
    return target instanceof HTMLElement &&
      (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
  }

  function clearInputs() {
    keysDown.clear();
    controls.clear();
    document.querySelectorAll(".touch-controls button").forEach((button) => {
      button.classList.remove("is-active");
    });
  }

  const codeActions = new Map([
    ["ArrowUp", "forward"], ["KeyW", "forward"], ["ArrowDown", "reverse"], ["KeyS", "reverse"],
    ["ArrowLeft", "left"], ["KeyA", "left"], ["ArrowRight", "right"], ["KeyD", "right"]
  ]);
  const keyCodeActions = new Map([
    [38, "forward"], [87, "forward"], [40, "reverse"], [83, "reverse"],
    [37, "left"], [65, "left"], [39, "right"], [68, "right"]
  ]);
  const actionFor = (event) =>
    keyActions.get(event.key) || codeActions.get(event.code) || keyCodeActions.get(event.keyCode);

  // Titan-style keyboard touchpad: swipes arrive as arrow keys or wheel/scroll events.
  function nudge(action, amount = 1) {
    if (action === "left") heading = (heading - 12 * amount + 360) % 360;
    else if (action === "right") heading = (heading + 12 * amount) % 360;
    else if (action === "forward") speed = Math.min(speed + maxSpeed / 8 * amount, maxSpeed);
    else if (action === "reverse") speed = Math.max(speed - maxSpeed / 8 * amount, -maxSpeed / 4);
  }
  const swipeKeys = new Map([
    ["ArrowUp", "forward"], ["ArrowDown", "reverse"], ["ArrowLeft", "left"], ["ArrowRight", "right"]
  ]);
  const swipeKeyCodes = new Map([[38, "forward"], [40, "reverse"], [37, "left"], [39, "right"]]);

  window.addEventListener("keydown", (event) => {
    debug(`key ${event.key} code ${event.code} kc ${event.keyCode}`);
    if (isEditable(event.target)) return;
    if (event.key === "m" || event.key === "M") { setMode(!dragMode); return; }
    if (dragMode) return;
    if (/^[1-9]$/.test(event.key) && spawns[Number(event.key) - 1]) {
      spawnAt(spawns[Number(event.key) - 1]);
      return;
    }
    if (event.key === " " || event.key === "Enter") { event.preventDefault(); speed = 0; return; }
    const action = swipeKeys.get(event.key) || swipeKeyCodes.get(event.keyCode);
    if (!action) return;
    event.preventDefault();
    nudge(action);
  });

  window.addEventListener("wheel", (event) => {
    debug(`wheel dx ${Math.round(event.deltaX)} dy ${Math.round(event.deltaY)}`);
    if (dragMode || isEditable(event.target)) return;
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 1 : 1 / 40;
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      nudge(event.deltaX > 0 ? "right" : "left", Math.min(Math.abs(event.deltaX) * unit, 3));
    } else {
      nudge(event.deltaY < 0 ? "forward" : "reverse", Math.min(Math.abs(event.deltaY) * unit, 3));
    }
  }, { passive: false });

  // Fallback: swipe gestures that arrive as touch/pointer moves on the page itself.
  let swipeStart = null;
  window.addEventListener("scroll", () => debug("scroll event"), true);
  window.addEventListener("touchstart", (event) => {
    if (dragMode || event.target.closest?.("#map, .panel, .touch-controls, .menu-toggle")) return;
    const t = event.touches[0];
    swipeStart = { x: t.clientX, y: t.clientY };
  }, { passive: true });
  window.addEventListener("touchmove", (event) => {
    if (dragMode || !swipeStart) return;
    const t = event.touches[0];
    const dx = t.clientX - swipeStart.x;
    const dy = t.clientY - swipeStart.y;
    if (Math.abs(dx) > 25 || Math.abs(dy) > 25) {
      if (Math.abs(dx) > Math.abs(dy)) nudge(dx > 0 ? "right" : "left");
      else nudge(dy < 0 ? "forward" : "reverse");
      swipeStart = { x: t.clientX, y: t.clientY };
    }
  }, { passive: true });
  window.addEventListener("blur", clearInputs);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearInputs();
  });

  for (const button of document.querySelectorAll("[data-control]")) {
    const action = button.dataset.control;
    const release = () => {
      controls.delete(action);
      button.classList.remove("is-active");
    };
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      controls.add(action);
      button.classList.add("is-active");
      button.setPointerCapture(event.pointerId);
    });
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
  }

  followButton.addEventListener("click", () => {
    followBoat = !followBoat;
    followButton.setAttribute("aria-pressed", String(followBoat));
    followButton.textContent = followBoat ? "Following boat" : "Follow boat";
    if (followBoat) map.panTo([position.lat, position.lng]);
  });
  document.querySelector("#reset").addEventListener("click", () => {
    map.setView([position.lat, position.lng], Math.max(map.getZoom(), 14));
    followBoat = true;
    followButton.setAttribute("aria-pressed", "true");
    followButton.textContent = "Following boat";
  });

  speedSlider.addEventListener("input", () => {
    maxSpeed = Number(speedSlider.value);
    speedValue.textContent = speedSlider.value;
  });

  function setMode(drive) {
    dragMode = drive;
    drag = null;
    pointers.clear();
    if (drive) map.dragging.disable(); else map.dragging.enable();
    mapElement.style.touchAction = drive ? "none" : "";
    modeTouch.setAttribute("aria-pressed", String(drive));
    modeSwipe.setAttribute("aria-pressed", String(!drive));
    if (drive) keysDown.clear();
    
  }
  modeSwipe.addEventListener("click", () => setMode(false));
  modeTouch.addEventListener("click", () => setMode(true));
  setMode(false);

  function updateDrag() {
    if (!dragMode || pointers.size !== 1) { drag = null; return; }
    drag = [...pointers.values()][0];
  }
  mapElement.addEventListener("pointerdown", (event) => {
    if (!dragMode || event.target.closest(".leaflet-control")) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    mapElement.setPointerCapture(event.pointerId);
    updateDrag();
  });
  mapElement.addEventListener("pointermove", (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    updateDrag();
  });
  for (const type of ["pointerup", "pointercancel"]) {
    mapElement.addEventListener(type, (event) => {
      pointers.delete(event.pointerId);
      updateDrag();
    });
  }

  function active(action) {
    return keysDown.has(action) || controls.has(action);
  }

  function update(time) {
    const elapsed = Math.min((time - previousTime) / 1000, 0.1);
    previousTime = time;

    const accel = maxSpeed / 3;
    if (drag) {
      const rect = mapElement.getBoundingClientRect();
      const origin = map.latLngToContainerPoint([position.lat, position.lng]);
      const dx = drag.x - rect.left - origin.x;
      const dy = drag.y - rect.top - origin.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 12) heading = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
      const target = Math.min(dist / 150, 1) * maxSpeed;
      speed += Math.sign(target - speed) * Math.min(Math.abs(target - speed), accel * 3 * elapsed);
    } else {
      if (active("left")) heading -= 70 * elapsed;
      if (active("right")) heading += 70 * elapsed;
      heading = (heading + 360) % 360;

      if (active("forward")) speed = Math.min(speed + accel * elapsed, maxSpeed);
      else if (active("reverse")) speed = Math.max(speed - accel * elapsed, -maxSpeed / 4);
      else if (!cruise) {
        speed = speed > 0 ? Math.max(0, speed - accel * elapsed) : Math.min(0, speed + accel * elapsed);
      }
    }

    const zoomScale = Math.pow(2, 14 - map.getZoom()) * 6;
    const distance = speed * 0.514444 * zoomScale * elapsed;
    const bearing = heading * Math.PI / 180;
    const latitudeRadians = position.lat * Math.PI / 180;
    const earthRadius = 6371000;
    position.lat += (distance * Math.cos(bearing) / earthRadius) * 180 / Math.PI;
    position.lng += (distance * Math.sin(bearing) /
      (earthRadius * Math.max(Math.cos(latitudeRadians), 0.01))) * 180 / Math.PI;
    position.lat = Math.max(-85, Math.min(85, position.lat));
    position.lng = ((position.lng + 540) % 360) - 180;

    boat.setLatLng([position.lat, position.lng]);
    const icon = boat.getElement()?.querySelector(".boat-icon");
    if (icon) icon.style.transform = `rotate(${heading}deg)`;

    if (followBoat) {
      const point = map.latLngToContainerPoint([position.lat, position.lng]);
      const bounds = map.getSize();
      if (point.x < bounds.x * 0.3 || point.x > bounds.x * 0.7 ||
          point.y < bounds.y * 0.3 || point.y > bounds.y * 0.7) {
        map.panTo([position.lat, position.lng], { animate: false });
      }
    }

    if (time - lastReadout > 150) {
      positionElement.textContent =
        `${position.lat.toFixed(5)}°, ${position.lng.toFixed(5)}°`;
      courseElement.textContent = `${String(Math.round(heading) % 360).padStart(3, "0")}°`;
      speedElement.textContent = Math.abs(speed) < 0.05 ? "0.0" : speed.toFixed(1);
      lastReadout = time;
    }
    requestAnimationFrame(update);
  }

  requestAnimationFrame(update);
})();
