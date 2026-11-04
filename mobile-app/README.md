# TOMAN Sales AI — Mobile App

Android-first, bare React Native Community CLI app for TOMAN Sales AI. **Expo is not used.**

## What works now

The live path uses the Spring API Gateway and never converts a real owner into demo data:

1. Register with name, business, work email, mobile number, and a strong password.
2. Verify the email, then create the owner workspace.
3. Keep the access token only in memory and store the rotating refresh token in Android secure storage (`react-native-keychain`).
4. Load the authenticated workspace's real settings, documents, notifications, and Jarvis tasks. A new workspace is intentionally empty.
5. Upload PDF, XLS, and XLSX files from the device to the Ingestion Service.
6. Update business and notification preferences, read notifications, and submit a Jarvis brief through the gateway.

For the local Auth profile only, the backend returns a development verification code and the app shows it in a temporary toast. SMTP delivery is not configured yet; a real deployment must send the code through an approved email provider and must not expose it in the API response.

The explicit **Use demo business** path remains fully isolated. It is the only place that displays Luma Living sample leads, campaigns, or integrations.

## Current boundaries

Jarvis uses the Meta-only backend contract. Without `META_AI_API_KEY`, the backend safely reports that planning is blocked; it does not fabricate a plan.

Social OAuth, Facebook/Instagram/YouTube/Google Ads publishing, WhatsApp/email delivery, telephony, video/image generation, campaign approval execution, analytics ingestion, and device push are not live yet. The app does not store any provider credentials or Meta keys. Those actions remain disabled for real owners until their dedicated workflow and integration services are built.

## Run on Android

```bash
npm install
npm start
```

With an emulator already running:

```bash
npm run android -- --device emulator-5554
```

With the connected physical Android device shown by `adb devices`:

```bash
npm run android -- --device NRPFAIHMHEQ4QOOB
```

If a USB device cannot find Metro, run once:

```bash
adb -s NRPFAIHMHEQ4QOOB reverse tcp:8081 tcp:8081
```

The Android SDK path is machine-local in `android/local.properties` and should not be committed.

## Gateway connection

`src/config/gateway.ts` defaults to `http://10.0.2.2:8080`, which lets an Android emulator reach the local Spring API Gateway. For a physical device, configure the app at bootstrap with the computer's reachable LAN address:

```ts
configureGatewayBaseUrl('http://192.168.x.x:8080');
```

The mobile app calls only the gateway routes below. It never sends a workspace authority header, provider credential, Meta key, or database credential.

- `/api/v1/auth`
- `/api/v1/workspaces` and `/api/v1/workspaces/current`
- `/api/v1/settings`
- `/api/v1/documents`
- `/api/v1/notifications`
- `/api/v1/jarvis`

Start the matching backend services using the instructions in [the backend README](../TOMAN-Sales-AI-Backend/README.md).

## Verification

```bash
./node_modules/.bin/tsc --noEmit
npm run lint
npm test -- --runInBand
cd android && ./gradlew --offline --no-daemon app:assembleDebug -x lint -PreactNativeDevServerPort=8081
```

The last command builds `android/app/build/outputs/apk/debug/app-debug.apk`.

## Demo sign-in

```text
Email:    owner@toman.demo
Password: Toman@2026
```

This account is local display data only. It is not a backend account and cannot access a real workspace.
