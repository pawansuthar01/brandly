const fs = require("node:fs");
const path = require("node:path");
const appConfig = require("./app.json").expo;

const configuredGoogleServicesFile =
  process.env.EXPO_GOOGLE_SERVICES_FILE || "./google-services.json";
const googleServicesFile = path.resolve(
  __dirname,
  configuredGoogleServicesFile,
);
const hasGoogleServicesFile = fs.existsSync(googleServicesFile);
let googleServicesMatchesApp = false;

if (hasGoogleServicesFile) {
  try {
    const googleServices = JSON.parse(
      fs.readFileSync(googleServicesFile, "utf8"),
    );
    googleServicesMatchesApp =
      googleServices.client?.some(
        (client) =>
          client.client_info?.android_client_info?.package_name ===
          appConfig.android.package,
      ) === true;
  } catch {
    throw new Error(
      `Android push config is not valid JSON: ${configuredGoogleServicesFile}`,
    );
  }
  if (!googleServicesMatchesApp) {
    throw new Error(
      `Android push config must contain package ${appConfig.android.package}: ${configuredGoogleServicesFile}`,
    );
  }
}

if (process.env.EAS_BUILD_PLATFORM === "android" && !googleServicesMatchesApp) {
  throw new Error(
    `Android Expo Push requires the FCM client config at ${configuredGoogleServicesFile}. ` +
      "Set EXPO_GOOGLE_SERVICES_FILE to the provided google-services.json path before building.",
  );
}

module.exports = ({ config }) => ({
  ...config,
  ...appConfig,
  android: {
    ...appConfig.android,
    ...(hasGoogleServicesFile
      ? { googleServicesFile: configuredGoogleServicesFile }
      : {}),
  },
  experiments: {
    ...appConfig.experiments,
    ...(process.env.BRANDLY_ADMIN_PREVIEW_BUILD === "1"
      ? { baseUrl: "/mobile-preview" }
      : {}),
  },
});
