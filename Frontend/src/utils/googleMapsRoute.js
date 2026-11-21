
export function hasValidGps(latitude, longitude) {
    if (
      latitude === null ||
      latitude === undefined ||
      latitude === "" ||
      longitude === null ||
      longitude === undefined ||
      longitude === ""
    ) {
      return false;
    }
  
    const lat = Number(latitude);
    const lng = Number(longitude);
  
    return (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    );
  }
  
  export function openDeliveryRoute(
    latitude,
    longitude,
    originLatitude = null,
    originLongitude = null
  ) {
    if (!hasValidGps(latitude, longitude)) {
      throw new Error(
        "The customer shop GPS location is unavailable."
      );
    }
  
    const destination = `${Number(latitude)},${Number(
      longitude
    )}`;
  
    const params = new URLSearchParams({
      api: "1",
      destination,
      travelmode: "driving",
    });
  
    // Use the latest vehicle coordinates if available.
    // Otherwise Google Maps can use the driver's device
    // current location, subject to its permissions.
    if (
      hasValidGps(originLatitude, originLongitude)
    ) {
      params.set(
        "origin",
        `${Number(originLatitude)},${Number(
          originLongitude
        )}`
      );
    }
  
    window.open(
      `https://www.google.com/maps/dir/?${params.toString()}`,
      "_blank",
      "noopener,noreferrer"
    );
  }
  