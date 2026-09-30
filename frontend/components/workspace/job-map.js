"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Crosshair, Loader2, MapPin, Search, X } from "lucide-react";
import "leaflet/dist/leaflet.css";

export const DEFAULT_CENTER = { lat: 23.8103, lng: 90.4125 }; // Dhaka
export const USER_ZOOM = 16;
export const FALLBACK_ZOOM = 13;
const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';

const pin = (L, className = "") =>
  L.divIcon({
    className: "map-pin-wrap",
    html: `<span class="map-pin ${className}"></span>`,
    iconSize: [30, 40],
    iconAnchor: [15, 38],
    popupAnchor: [0, -34],
  });

const dot = (L) =>
  L.divIcon({ className: "map-pin-wrap", html: '<span class="map-you"></span>', iconSize: [22, 22], iconAnchor: [11, 11] });

/** Create a Leaflet map inside `ref` and keep it sized correctly (works inside modals and resizing panes). */
function useLeafletMap(containerRef, options, onReady) {
  const [ready, setReady] = useState(null);
  useEffect(() => {
    let cancelled = false;
    let map;
    let observer;
    import("leaflet").then(({ default: L }) => {
      if (cancelled || !containerRef.current) return;
      map = L.map(containerRef.current, { zoomControl: true, scrollWheelZoom: true, ...options.map });
      L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(map);
      map.setView([options.center.lat, options.center.lng], options.zoom);
      observer = new ResizeObserver(() => map.invalidateSize());
      observer.observe(containerRef.current);
      setReady({ L, map });
      onReady?.({ L, map });
    });
    return () => {
      cancelled = true;
      observer?.disconnect();
      map?.remove();
      setReady(null);
    };
    // The map is created once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ready;
}

const km = (value) => (value < 1 ? `${Math.round(value * 1000)} m` : `${value.toFixed(value < 10 ? 1 : 0)} km`);
export const formatDistance = km;

function popupContent(job, onOpen) {
  const box = document.createElement("div");
  box.className = "map-popup";
  const title = document.createElement("strong");
  title.textContent = job.title;
  const meta = document.createElement("span");
  meta.textContent = [job.creator_name, job.location].filter(Boolean).join(" · ");
  const salary = document.createElement("small");
  salary.textContent = job.distance_km != null ? `${km(job.distance_km)} away` : "";
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "View job";
  button.addEventListener("click", () => onOpen(job));
  box.append(title, meta, salary, button);
  return box;
}

/** Map of jobs around a point. `jobs` need latitude/longitude. */
export function JobsMap({ jobs, userPosition, onOpen }) {
  const container = useRef(null);
  const layers = useRef({ markers: new Map() });
  const openRef = useRef(onOpen);
  openRef.current = onOpen;
  const ready = useLeafletMap(container, { center: userPosition || DEFAULT_CENTER, zoom: userPosition ? USER_ZOOM : FALLBACK_ZOOM });

  useEffect(() => {
    if (!ready) return;
    const { L, map } = ready;
    layers.current.group?.remove();
    const group = L.layerGroup().addTo(map);
    layers.current.group = group;
    layers.current.markers = new Map();
    for (const job of jobs) {
      if (job.latitude == null || job.longitude == null) continue;
      const marker = L.marker([job.latitude, job.longitude], { icon: pin(L), title: job.title, keyboard: true }).addTo(group);
      marker.bindPopup(() => popupContent(job, (item) => openRef.current?.(item)), { closeButton: true, minWidth: 190 });
      layers.current.markers.set(job.id, marker);
    }
  }, [ready, jobs]);

  // Centre on the user (close up) or on Dhaka; runs when the position is found or refreshed.
  useEffect(() => {
    if (!ready) return;
    const { L, map } = ready;
    layers.current.user?.remove();
    layers.current.user = null;
    if (userPosition) {
      layers.current.user = L.marker([userPosition.lat, userPosition.lng], { icon: dot(L), interactive: false, keyboard: false, zIndexOffset: 2000 }).addTo(map);
      map.flyTo([userPosition.lat, userPosition.lng], USER_ZOOM, { duration: 0.8 });
    } else {
      map.setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], FALLBACK_ZOOM);
    }
  }, [ready, userPosition]);

  return <div className="job-map" ref={container} role="application" aria-label="Map of nearby jobs" />;
}

/** Read-only map with one marker. */
export function LocationViewer({ latitude, longitude, label }) {
  const container = useRef(null);
  const ready = useLeafletMap(container, { center: { lat: latitude, lng: longitude }, zoom: 15, map: { scrollWheelZoom: false } });
  useEffect(() => {
    if (!ready) return;
    const marker = ready.L.marker([latitude, longitude], { icon: pin(ready.L), title: label }).addTo(ready.map);
    ready.map.setView([latitude, longitude], 15);
    return () => marker.remove();
  }, [ready, latitude, longitude, label]);
  return <div className="job-map small" ref={container} role="application" aria-label={label || "Job location"} />;
}

async function searchPlaces(query) {
  const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(query)}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("Place search is unavailable right now");
  return (await response.json()).map((item) => ({ name: item.display_name, lat: Number(item.lat), lng: Number(item.lon) }));
}

async function reverseGeocode(lat, lng) {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&lat=${lat}&lon=${lng}`, { headers: { Accept: "application/json" } });
    if (!response.ok) return "";
    return (await response.json()).display_name || "";
  } catch {
    return "";
  }
}

/** Let a hirer pick a job's position: click the map, drag the pin, search a place, or use their location. */
export function LocationPicker({ value, onChange, onAddress }) {
  const container = useRef(null);
  const state = useRef({});
  const changeRef = useRef(onChange);
  const addressRef = useRef(onAddress);
  changeRef.current = onChange;
  addressRef.current = onAddress;
  const [term, setTerm] = useState("");
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const place = useCallback(async (lat, lng, address) => {
    const rounded = { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
    changeRef.current(rounded);
    const text = address ?? (await reverseGeocode(rounded.lat, rounded.lng));
    if (text) addressRef.current?.(text);
  }, []);

  const ready = useLeafletMap(container, { center: value || DEFAULT_CENTER, zoom: value ? 15 : 11 }, ({ map }) => {
    map.on("click", (event) => place(event.latlng.lat, event.latlng.lng));
  });

  useEffect(() => {
    if (!ready) return;
    const { L, map } = ready;
    if (!value) {
      state.current.marker?.remove();
      state.current.marker = null;
      return;
    }
    if (!state.current.marker) {
      const marker = L.marker([value.lat, value.lng], { icon: pin(L), draggable: true, keyboard: true }).addTo(map);
      marker.on("dragend", () => {
        const at = marker.getLatLng();
        place(at.lat, at.lng);
      });
      state.current.marker = marker;
    } else state.current.marker.setLatLng([value.lat, value.lng]);
    map.setView([value.lat, value.lng], Math.max(map.getZoom(), 15), { animate: true });
  }, [ready, value, place]);

  async function search(event) {
    event.preventDefault();
    if (term.trim().length < 3) return;
    setBusy(true);
    setError("");
    try {
      const found = await searchPlaces(term.trim());
      setResults(found);
      if (!found.length) setError("No places found. Try a more specific search or click the map.");
    } catch (searchError) {
      setError(searchError.message);
    } finally {
      setBusy(false);
    }
  }

  function locate() {
    if (!navigator.geolocation) {
      setError("Your browser can’t share your location. Click the map instead.");
      return;
    }
    setBusy(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        place(position.coords.latitude, position.coords.longitude);
        setBusy(false);
      },
      () => {
        setError("We couldn’t get your location. Allow location access or click the map.");
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div className="location-picker">
      <div className="location-search">
        <div className="search-box">
          <Search size={18} />
          <input
            aria-label="Search for a place"
            placeholder="Search a place or address…"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") search(event);
            }}
          />
        </div>
        <button type="button" className="button secondary" onClick={search} disabled={busy || term.trim().length < 3}>
          {busy ? <Loader2 size={16} className="spin" /> : "Search"}
        </button>
        <button type="button" className="button secondary" onClick={locate} disabled={busy} title="Use my current location">
          <Crosshair size={16} /> <span>My location</span>
        </button>
      </div>
      {results.length > 0 && (
        <ul className="location-results" role="listbox">
          {results.map((item) => (
            <li key={`${item.lat},${item.lng},${item.name}`}>
              <button
                type="button"
                role="option"
                aria-selected="false"
                onClick={() => {
                  place(item.lat, item.lng, item.name);
                  setResults([]);
                }}
              >
                <MapPin size={15} /> {item.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="inline-error">{error}</p>}
      <div className="job-map picker" ref={container} role="application" aria-label="Pick the job location on the map" />
      <div className="location-status">
        {value ? (
          <>
            <span>
              <MapPin size={14} /> {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
            </span>
            <button type="button" className="text-link" onClick={() => changeRef.current(null)}>
              <X size={14} /> Clear
            </button>
          </>
        ) : (
          <span className="room-muted">Click the map to drop a pin, or drag it to fine-tune the position.</span>
        )}
      </div>
    </div>
  );
}
