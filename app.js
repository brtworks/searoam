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

  const keysDown = new Set();
  const controls = new Set();
  const speedElement = document.querySelector("#speed");
  const courseElement = document.querySelector("#course");
  const positionElement = document.querySelector("#position");
  const followButton = document.querySelector("#follow");
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

  window.addEventListener("keydown", (event) => {
    if (isEditable(event.target)) return;
    const action = keyActions.get(event.key);
    if (!action) return;
    event.preventDefault();
    keysDown.add(action);
  });

  window.addEventListener("keyup", (event) => {
    const action = keyActions.get(event.key);
    if (action) keysDown.delete(action);
  });
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

  function active(action) {
    return keysDown.has(action) || controls.has(action);
  }

  function update(time) {
    const elapsed = Math.min((time - previousTime) / 1000, 0.1);
    previousTime = time;

    if (active("left")) heading -= 45 * elapsed;
    if (active("right")) heading += 45 * elapsed;
    heading = (heading + 360) % 360;

    if (active("forward")) speed = Math.min(speed + 1.8 * elapsed, 8);
    else if (active("reverse")) speed = Math.max(speed - 1.8 * elapsed, -2);
    else if (speed > 0) speed = Math.max(0, speed - 0.7 * elapsed);
    else speed = Math.min(0, speed + 0.7 * elapsed);

    const distance = speed * 0.514444 * elapsed;
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
