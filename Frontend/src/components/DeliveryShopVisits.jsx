
import {
    useCallback,
    useEffect,
    useState,
  } from "react";
  
  import {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    useMap,
    useMapEvents,
  } from "react-leaflet";
  
  import L from "leaflet";
  
  import {
    MapPin,
    Crosshair,
    Save,
    RefreshCw,
    Store,
    AlertTriangle,
  } from "lucide-react";
  
  import "leaflet/dist/leaflet.css";
  
  import markerIconUrl from
    "leaflet/dist/images/marker-icon.png";
  
  import markerShadowUrl from
    "leaflet/dist/images/marker-shadow.png";
  
  // ========================================
  // LEAFLET MARKER CONFIGURATION
  // ========================================
  
  const shopIcon = L.icon({
    iconUrl: markerIconUrl,
    shadowUrl: markerShadowUrl,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });
  
  // ========================================
  // API
  // ========================================
  
  const BASE_URL = (
    import.meta.env.VITE_API_URL ||
    "http://localhost:8080"
  ).replace(/\/$/, "");
  
  function getToken() {
    try {
      const auth = JSON.parse(
        sessionStorage.getItem("seventeen_auth") ||
          "null"
      );
  
      return (
        auth?.token ||
        auth?.accessToken ||
        auth?.jwt ||
        auth?.user?.token ||
        null
      );
    } catch {
      return null;
    }
  }
  
  async function visitApi(path = "", options = {}) {
    const token = getToken();
  
    if (!token) {
      throw new Error("Please log in again.");
    }
  
    let response;
  
    try {
      response = await fetch(
        `${BASE_URL}/api/delivery/shop-visits${path}`,
        {
          ...options,
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            ...(options.body
              ? { "Content-Type": "application/json" }
              : {}),
            ...options.headers,
          },
        }
      );
    } catch {
      throw new Error(
        "Cannot connect to the shop visits API."
      );
    }
  
    const raw = await response.text();
  
    let data = null;
  
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = raw;
    }
  
    if (!response.ok) {
      throw new Error(
        data?.message ||
        data?.detail ||
        (typeof data === "string" ? data : null) ||
        `Shop visit request failed (${response.status}).`
      );
    }
  
    return data;
  }
  
  // ========================================
  // STYLES
  // ========================================
  
  const inputClass =
    "w-full rounded-xl border border-slate-200 " +
    "bg-white px-4 py-3 text-sm outline-none " +
    "focus:border-[#3654FF]";
  
  const buttonClass =
    "rounded-xl bg-[#3654FF] px-5 py-3 " +
    "text-sm font-bold text-white " +
    "disabled:cursor-not-allowed disabled:opacity-50";
  
  // ========================================
  // MAP HELPERS
  // ========================================
  
  function MapClickSelector({ onChoose }) {
    useMapEvents({
      click(event) {
        onChoose({
          latitude: event.latlng.lat,
          longitude: event.latlng.lng,
        });
      },
    });
  
    return null;
  }
  
  function MapFocus({ location }) {
    const map = useMap();
  
    useEffect(() => {
      if (
        location &&
        Number.isFinite(location.latitude) &&
        Number.isFinite(location.longitude)
      ) {
        map.flyTo(
          [location.latitude, location.longitude],
          15
        );
      }
    }, [map, location]);
  
    return null;
  }
  
  function validCoordinates(latitude, longitude) {
    const lat = Number(latitude);
    const lng = Number(longitude);
  
    return (
      latitude !== "" &&
      longitude !== "" &&
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    );
  }
  
  // ========================================
  // MAIN COMPONENT
  //
  // vehicleNumber is optional and should
  // come from the dashboard's selected vehicle.
  // ========================================
  
  export default function DeliveryShopVisits({
    vehicleNumber = "",
  }) {
    const [shops, setShops] = useState([]);
  
    const [shopName, setShopName] = useState("");
    const [shopAddress, setShopAddress] = useState("");
    const [contactPerson, setContactPerson] =
      useState("");
    const [phone, setPhone] = useState("");
    const [visitNotes, setVisitNotes] =
      useState("");
  
    const [latitude, setLatitude] = useState("");
    const [longitude, setLongitude] = useState("");
  
    const [focusLocation, setFocusLocation] =
      useState(null);
  
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [locating, setLocating] = useState(false);
  
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
  
    // Default map view: Sri Lanka.
    // This is only a starting map viewport.
    const defaultCenter = [7.8731, 80.7718];
  
    // ======================================
    // LOAD SAVED SHOPS
    // ======================================
  
    const loadShops = useCallback(async () => {
      setLoading(true);
  
      try {
        const result = await visitApi();
  
        if (!Array.isArray(result)) {
          throw new Error(
            "Shop visits API must return an array."
          );
        }
  
        setShops(result);
        setError("");
      } catch (err) {
        setError(
          err.message ||
          "Unable to load saved shops."
        );
      } finally {
        setLoading(false);
      }
    }, []);
  
    useEffect(() => {
      loadShops();
    }, [loadShops]);
  
    // ======================================
    // SELECT LOCATION
    // ======================================
  
    function chooseLocation(point) {
      setLatitude(point.latitude.toFixed(6));
      setLongitude(point.longitude.toFixed(6));
  
      setFocusLocation({
        latitude: point.latitude,
        longitude: point.longitude,
      });
  
      setMessage(
        "Shop pin selected. Save the shop visit " +
        "to store this location."
      );
    }
  
    // ======================================
    // USE DEVICE GPS
    // ======================================
  
    function useCurrentGPS() {
      setError("");
      setMessage("");
  
      if (!navigator.geolocation) {
        setError(
          "Geolocation is not supported by this browser."
        );
        return;
      }
  
      setLocating(true);
  
      navigator.geolocation.getCurrentPosition(
        (position) => {
          chooseLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
  
          setLocating(false);
        },
        (err) => {
          setError(
            `Unable to obtain GPS location: ${err.message}. ` +
            "You can click the map to select the shop manually."
          );
  
          setLocating(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }
      );
    }
  
    // ======================================
    // SAVE SHOP VISIT
    // ======================================
  
    async function saveVisit(event) {
      event.preventDefault();
  
      if (saving) return;
  
      setError("");
      setMessage("");
  
      if (!shopName.trim() || !shopAddress.trim()) {
        setError(
          "Shop name and address are required."
        );
        return;
      }
  
      if (!validCoordinates(latitude, longitude)) {
        setError(
          "Select a valid shop location using GPS " +
          "or by clicking the map."
        );
        return;
      }
  
      if (
        !window.confirm(
          `Save shop visit?\n\n` +
          `Shop: ${shopName.trim()}\n` +
          `Address: ${shopAddress.trim()}\n` +
          `GPS: ${latitude}, ${longitude}`
        )
      ) {
        return;
      }
  
      setSaving(true);
  
      try {
        const result = await visitApi("", {
          method: "POST",
          body: JSON.stringify({
            shopName: shopName.trim(),
            shopAddress: shopAddress.trim(),
            contactPerson: contactPerson.trim(),
            phone: phone.trim(),
            latitude: Number(latitude),
            longitude: Number(longitude),
            vehicleNumber,
            visitNotes: visitNotes.trim(),
          }),
        });
  
        setShopName("");
        setShopAddress("");
        setContactPerson("");
        setPhone("");
        setVisitNotes("");
        setLatitude("");
        setLongitude("");
  
        setMessage(
          `Shop visit #${result?.id ?? ""} saved successfully.`
        );
  
        await loadShops();
      } catch (err) {
        setError(
          (err.message || "Unable to save shop visit.") +
          " If the request may have reached the server, " +
          "check Saved Shop Visits before trying again."
        );
      } finally {
        setSaving(false);
      }
    }
  
    // ======================================
    // CURRENT DRAFT PIN
    // ======================================
  
    const hasDraftLocation = validCoordinates(
      latitude,
      longitude
    );
  
    const draftPosition = hasDraftLocation
      ? [Number(latitude), Number(longitude)]
      : null;
  
    // ======================================
    // RENDER
    // ======================================
  
    return (
      <section className="space-y-6 text-[#17265B]">
  
        {/* HEADER */}
  
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-bold">
              <Store size={24} />
              Manual Shop Visits
            </h2>
  
            <p className="mt-2 text-sm text-slate-500">
              Record shops visited outside wholesale
              orders and save their GPS locations.
            </p>
          </div>
  
          <button
            type="button"
            disabled={loading || saving}
            onClick={loadShops}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold"
          >
            <RefreshCw size={17} />
            Refresh Shops
          </button>
        </div>
  
        {/* FEEDBACK */}
  
        {error && (
          <div
            role="alert"
            className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <AlertTriangle
              size={18}
              className="shrink-0"
            />
            <span>{error}</span>
          </div>
        )}
  
        {message && (
          <div
            role="status"
            className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"
          >
            {message}
          </div>
        )}
  
        <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
  
          {/* SHOP DETAILS FORM */}
  
          <form
            onSubmit={saveVisit}
            className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h3 className="text-lg font-bold">
              Add New Shop Visit
            </h3>
  
            <label className="block space-y-2 text-sm font-semibold">
              <span>Shop Name *</span>
  
              <input
                value={shopName}
                onChange={(e) =>
                  setShopName(e.target.value)
                }
                maxLength={150}
                placeholder="Enter shop name"
                required
                className={inputClass}
              />
            </label>
  
            <label className="block space-y-2 text-sm font-semibold">
              <span>Shop Address *</span>
  
              <textarea
                value={shopAddress}
                onChange={(e) =>
                  setShopAddress(e.target.value)
                }
                maxLength={2000}
                rows={3}
                placeholder="Street, area, city"
                required
                className={inputClass}
              />
            </label>
  
            <label className="block space-y-2 text-sm font-semibold">
              <span>Contact Person</span>
  
              <input
                value={contactPerson}
                onChange={(e) =>
                  setContactPerson(e.target.value)
                }
                maxLength={150}
                placeholder="Shop owner or manager"
                className={inputClass}
              />
            </label>
  
            <label className="block space-y-2 text-sm font-semibold">
              <span>Phone Number</span>
  
              <input
                type="tel"
                value={phone}
                onChange={(e) =>
                  setPhone(e.target.value)
                }
                maxLength={30}
                placeholder="07XXXXXXXX"
                className={inputClass}
              />
            </label>
  
            <label className="block space-y-2 text-sm font-semibold">
              <span>Visit Notes</span>
  
              <textarea
                value={visitNotes}
                onChange={(e) =>
                  setVisitNotes(e.target.value)
                }
                maxLength={2000}
                rows={3}
                placeholder="Reason for visit or other remarks"
                className={inputClass}
              />
            </label>
  
            {/* GPS */}
  
            <div className="space-y-3 rounded-xl bg-slate-50 p-4">
              <p className="text-sm font-bold">
                Shop GPS Location *
              </p>
  
              <button
                type="button"
                onClick={useCurrentGPS}
                disabled={locating || saving}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-semibold text-[#3654FF]"
              >
                <Crosshair size={18} />
                {locating
                  ? "Finding GPS..."
                  : "Use Current GPS Location"}
              </button>
  
              <p className="text-xs text-slate-500">
                Or click the exact shop position
                on the map to place a pin.
              </p>
  
              <div className="grid grid-cols-2 gap-2">
                <label className="block space-y-1 text-xs font-semibold">
                  <span>Latitude</span>
                  <input
                    type="number"
                    step="any"
                    min="-90"
                    max="90"
                    value={latitude}
                    onChange={(e) =>
                      setLatitude(e.target.value)
                    }
                    className={inputClass}
                    placeholder="Latitude"
                  />
                </label>
  
                <label className="block space-y-1 text-xs font-semibold">
                  <span>Longitude</span>
                  <input
                    type="number"
                    step="any"
                    min="-180"
                    max="180"
                    value={longitude}
                    onChange={(e) =>
                      setLongitude(e.target.value)
                    }
                    className={inputClass}
                    placeholder="Longitude"
                  />
                </label>
              </div>
  
              {hasDraftLocation && (
                <p className="text-xs font-semibold text-green-700">
                  Shop pin selected.
                </p>
              )}
            </div>
  
            <button
              type="submit"
              disabled={saving || !hasDraftLocation}
              className={
                buttonClass +
                " flex w-full items-center justify-center gap-2"
              }
            >
              <Save size={18} />
              {saving
                ? "Saving Shop..."
                : "Save Shop Visit"}
            </button>
          </form>
  
          {/* INTERACTIVE MAP */}
  
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-4">
              <h3 className="flex items-center gap-2 font-bold">
                <MapPin size={18} />
                Shop Visit Location Map
              </h3>
  
              <p className="mt-1 text-xs text-slate-500">
                Click to select a shop location.
                Saved shops remain visible as pins.
              </p>
            </div>
  
            <MapContainer
              center={defaultCenter}
              zoom={8}
              scrollWheelZoom={true}
              style={{
                height: 510,
                width: "100%",
                zIndex: 0,
              }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
  
              <MapClickSelector onChoose={chooseLocation} />
  
              <MapFocus location={focusLocation} />
  
              {/* DRAFT PIN */}
  
              {draftPosition && (
                <Marker
                  position={draftPosition}
                  icon={shopIcon}
                >
                  <Popup>
                    <strong>
                      {shopName.trim() || "New Shop"}
                    </strong>
                    <p>Unsaved shop location</p>
                  </Popup>
                </Marker>
              )}
  
              {/* SAVED SHOP PINS */}
  
              {shops
                .filter((shop) =>
                  validCoordinates(
                    shop.latitude,
                    shop.longitude
                  )
                )
                .map((shop) => (
                  <Marker
                    key={shop.id}
                    position={[
                      Number(shop.latitude),
                      Number(shop.longitude),
                    ]}
                    icon={shopIcon}
                  >
                    <Popup>
                      <div className="space-y-1">
                        <strong>{shop.shopName}</strong>
                        <p>{shop.shopAddress}</p>
  
                        {shop.phone && (
                          <p>Phone: {shop.phone}</p>
                        )}
  
                        {shop.vehicleNumber && (
                          <p>
                            Vehicle: {shop.vehicleNumber}
                          </p>
                        )}
  
                        {shop.visitedAt && (
                          <p>
                            Visited:{" "}
                            {new Date(
                              shop.visitedAt
                            ).toLocaleString("en-LK", {
                              timeZone: "Asia/Colombo",
                            })}
                          </p>
                        )}
  
                        {shop.visitNotes && (
                          <p>{shop.visitNotes}</p>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                ))}
            </MapContainer>
          </div>
        </div>
  
        {/* SAVED SHOPS */}
  
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold">
            Saved Shop Visits ({shops.length})
          </h3>
  
          {loading ? (
            <p className="mt-4 text-sm text-slate-500">
              Loading saved shops...
            </p>
          ) : shops.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              No manual shop visits recorded yet.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="p-3">Shop</th>
                    <th className="p-3">Address</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3">Visited At</th>
                    <th className="p-3">Location</th>
                  </tr>
                </thead>
  
                <tbody>
                  {shops.map((shop) => (
                    <tr
                      key={shop.id}
                      className="border-t border-slate-100"
                    >
                      <td className="p-3 font-semibold">
                        {shop.shopName}
                      </td>
  
                      <td className="p-3">
                        {shop.shopAddress}
                      </td>
  
                      <td className="p-3">
                        {shop.phone || "—"}
                      </td>
  
                      <td className="p-3">
                        {shop.visitedAt
                          ? new Date(
                              shop.visitedAt
                            ).toLocaleString("en-LK", {
                              timeZone: "Asia/Colombo",
                            })
                          : "—"}
                      </td>
  
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() =>
                            setFocusLocation({
                              latitude: Number(
                                shop.latitude
                              ),
                              longitude: Number(
                                shop.longitude
                              ),
                            })
                          }
                          className="font-bold text-[#3654FF]"
                        >
                          View Pin
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    );
  }
  