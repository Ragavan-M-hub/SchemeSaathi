import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet's default icon path issue with Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const userIcon = new L.DivIcon({
  className: "custom-div-icon",
  html: `<div style="background:#1e40af;width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const partnerIcon = new L.DivIcon({
  className: "custom-div-icon",
  html: `<div style="background:#16a34a;width:16px;height:16px;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function MapUpdater({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

export default function PartnerMap({ userLocation, partners }) {
  if (!userLocation) {
    return (
      <div className="h-full min-h-[400px] bg-slate-100 rounded-lg grid place-items-center text-slate-500">
        <div className="text-center">
          <div className="text-4xl mb-2">📍</div>
          <div>Enter your city or allow location access</div>
        </div>
      </div>
    );
  }

  return (
    <MapContainer
      center={[userLocation.lat, userLocation.lng]}
      zoom={12}
      scrollWheelZoom={true}
      className="h-full min-h-[400px] rounded-lg z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapUpdater center={[userLocation.lat, userLocation.lng]} zoom={12} />

      <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
        <Popup>
          <div className="font-semibold">Your Location</div>
          <div className="text-xs text-slate-600">{userLocation.label}</div>
        </Popup>
      </Marker>

      {partners.map((p) => (
        <Marker key={p.id} position={[p.lat, p.lng]} icon={partnerIcon}>
          <Popup>
            <div className="font-semibold text-navy-900">{p.name}</div>
            <div className="text-xs text-slate-600 mt-1">
              {p.type} · {p.city}
            </div>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-navy-700 underline mt-2 inline-block"
            >
              Get Directions →
            </a>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}