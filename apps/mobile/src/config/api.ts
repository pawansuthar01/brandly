import Constants from "expo-constants";
import { Platform } from "react-native";

// Keep the mobile endpoint in one file. Provider credentials never belong in
// this bundle; WhatsApp configuration is stored server-side by an admin.
const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim() ||
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl?.trim();
const expoHost = Constants.expoConfig?.hostUri?.replace(/^[a-z]+:\/\//i, "").split(":")[0];
const expoHostIsLoopback = !expoHost || expoHost === "localhost" || expoHost === "127.0.0.1";
const localApiHost = Platform.OS === "android" && expoHostIsLoopback
  ? "10.0.2.2"
  : expoHost || Platform.select({ android: "10.0.2.2", default: "127.0.0.1" }) || "127.0.0.1";
const fallbackApiUrl = __DEV__ ? `http://${localApiHost}:3000/v1` : "https://api.brandly.pawansuthar.in/v1";

export const API_BASE_URL = (configuredApiUrl || fallbackApiUrl).replace(/\/+$/, "");

// Expo can advertise a different LAN interface than the one saved in `.env`
// (for example after switching Wi-Fi/mobile hotspot). Keep the configured URL
// first, then retry against the host that delivered the current bundle.
const expoHostApiUrl = __DEV__ && expoHost ? `http://${expoHost}:3000/v1` : "";
export const API_BASE_URLS = Array.from(new Set([
  API_BASE_URL,
  expoHostApiUrl,
].filter(Boolean).map((url) => url.replace(/\/+$/, ""))));
