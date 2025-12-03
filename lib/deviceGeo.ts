import { UAParser } from "ua-parser-js";

/** Server Action safe public IP lookup */
export async function extractIP() {
  try {
    const res = await fetch("https://api.ipify.org?format=json", {
      cache: "no-store",
    });
    const json = await res.json();
    return json.ip;
  } catch {
    return "0.0.0.0";
  }
}

/** GEO lookup */
export async function extractGeo(ip: string) {
  try {
    const res = await fetch(`https://ipwho.is/${ip}`, { cache: "no-store" });
    const json = await res.json();
    if (!json.success) return null;

    return {
      city: json.city,
      region: json.region,
      country: json.country,
      latitude: json.latitude,
      longitude: json.longitude,
      postal: json.postal,
      isp: json.connection?.isp,
      timezone: json.timezone?.id,
    };
  } catch {
    return null;
  }
}

/** Device parsing */
export function extractDevice(ua: string) {
  if (!ua || ua.trim() === "") ua = "Unknown";

  const parser = new UAParser(ua);
  const browser = parser.getBrowser();
  const os = parser.getOS();
  const dev = parser.getDevice();

  return {
    browser: browser.name || "Unknown",
    os: os.name || "Unknown",
    device: dev.type || "desktop",
    raw: ua,
  };
}
