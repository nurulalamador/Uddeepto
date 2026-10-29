import { useMemo } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";
import { useApi } from "@/lib/hooks";
import { label, salary } from "@/lib/format";
import { colors } from "@/lib/config";
import { Empty, ErrorBox, Loading } from "./ui";
import type { JobRow } from "@/app/(tabs)/jobs";

type Pin = JobRow & { latitude: number | null; longitude: number | null };
const esc = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] as string);

/** Jobs that have a place on the map, shown on OpenStreetMap; tapping a pin offers to open the job. */
export function JobsMap({ query, onOpen }: { query: string; onOpen: (id: string) => void }) {
  const jobs = useApi<Pin[]>(`frontend/jobs?${query}&map=1&limit=100`);
  const pins = useMemo(() => (jobs.data || []).filter((job) => job.latitude != null && job.longitude != null), [jobs.data]);

  const html = useMemo(() => {
    const data = JSON.stringify(pins.map((job) => ({ id: job.id, lat: job.latitude, lng: job.longitude, title: esc(job.title), company: esc(job.creator_name), meta: esc(`${label(job.type)} · ${salary(job)}`) })));
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{height:100%;margin:0}body{font-family:sans-serif}.pop b{display:block;font-size:14px}.pop span{display:block;color:#5d6e64;font-size:12px;margin-top:2px}.pop button{margin-top:8px;background:#19704f;color:#fff;border:0;border-radius:8px;padding:7px 12px;font-weight:700}</style></head>
<body><div id="map"></div><script>
var jobs=${data};
var map=L.map('map',{zoomControl:true}).setView([23.8103,90.4125],7);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map);
var icon=L.divIcon({className:'',html:'<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;background:#e77b38;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);transform:rotate(-45deg)"></div>',iconSize:[26,26],iconAnchor:[13,26],popupAnchor:[0,-26]});
var bounds=[];
jobs.forEach(function(j){
  var m=L.marker([j.lat,j.lng],{icon:icon}).addTo(map);
  m.bindPopup('<div class="pop"><b>'+j.title+'</b><span>'+j.company+'</span><span>'+j.meta+'</span><button onclick="window.ReactNativeWebView.postMessage(\\''+j.id+'\\')">View job</button></div>');
  bounds.push([j.lat,j.lng]);
});
if(bounds.length)map.fitBounds(bounds,{padding:[40,40],maxZoom:14});
</script></body></html>`;
  }, [pins]);

  if (jobs.loading) return <Loading />;
  if (jobs.error && !jobs.data) return <ErrorBox message={jobs.error} onRetry={jobs.reload} />;
  if (!pins.length) return <Empty icon="map-outline" title="No jobs on the map" text="Jobs with a pinned location appear here. Try different filters, or use the list view." />;
  return (
    <View style={{ flex: 1, margin: 14, borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: colors.border }}>
      <WebView key={pins.map((job) => job.id).join(",")} originWhitelist={["*"]} source={{ html, baseUrl: "https://uddeepto.local/" }} onMessage={(event) => onOpen(event.nativeEvent.data)} javaScriptEnabled domStorageEnabled />
    </View>
  );
}
