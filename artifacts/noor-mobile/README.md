# NoorPath Mobile

Expo/React Native mobile app for NoorPath. This app uses Expo Router and EAS.

## Change Log

### 2026-05-08

- Added app-wide appearance preferences for Light, Dark, and System modes.
- Themed the main mobile surfaces for dark mode, including home, sign-in, child dashboard, memorization, plan, progress, profile, more, notes/bookmarks, stories, du'aas, review sheets, and shared navigation/components.
- Updated child and standalone Mushaf reader chrome for dark mode while keeping Quran page bitmaps on their original white page surface.
- Added dark-mode support for memorization settings and removed lingering light-only surfaces that caused unreadable text on dark backgrounds.
- Restored the review Mushaf page frame so its visual size matches the previous review experience.

## Local Development

From this folder:

```bash
cd /Users/mothmanaurascape.ai/Desktop/Quranic-Journey/artifacts/noor-mobile
npx expo start --dev-client -c
```

Scan the Metro QR code with the installed development build. If the phone is really connected to Metro, the terminal will show bundling/downloading and runtime logs.

If the QR opens the app but Metro shows no bundling/log activity, the phone is probably opening the TestFlight build or another stale installed build.

## Development Build

Install a dev-capable iOS build with:

```bash
cd /Users/mothmanaurascape.ai/Desktop/Quranic-Journey/artifacts/noor-mobile
npx eas-cli@latest build --profile development --platform ios
```

Then open the Expo build link on the iPhone and install the app. After that, use `npx expo start --dev-client -c` for normal JS/UI development.

You do not need a new EAS development build for ordinary JS/React changes. Rebuild only for native/config changes such as native packages, permissions, bundle id, plugins, icons/splash, Expo SDK, or React Native upgrades.

## TestFlight

Current iOS/TestFlight config:

- Expo project: `@mothman123/noor-mobile`
- EAS project ID: `a9b0cbd2-b32a-4b97-9be1-23d7ebc7afdd`
- iOS bundle identifier: `com.mothman.noorpath`
- App Store Connect App ID: `6767622472`
- Apple Team ID: `M7KJJDN537`
- TestFlight internal group: `Team (Expo)`
- Build profiles live in `eas.json`
- iOS app config lives in `app.json`

Publish the current local code to TestFlight with:

```bash
cd /Users/mothmanaurascape.ai/Desktop/Quranic-Journey/artifacts/noor-mobile
npx testflight
```

After upload, wait for Apple processing, then check App Store Connect:

```text
https://appstoreconnect.apple.com/apps/6767622472/testflight/ios
```

If a build shows `Ready to Submit`, open the build, fill **What to Test**, make sure it is attached to `Team (Expo)`, and notify testers.

## Dev/TestFlight Bundle ID Collision

The development build and TestFlight build currently share the same iOS bundle id:

```text
com.mothman.noorpath
```

iOS can only keep one installed app per bundle id. Installing TestFlight can replace the dev build, and installing the dev build can replace TestFlight. When this happens, Metro will not show logs because the phone is running the frozen TestFlight binary instead of the local dev bundle.

Long-term fix: give the dev build its own bundle id, for example:

```text
com.mothman.noorpath.dev
```

That would allow both apps to stay installed at the same time.

## Verification

Typecheck the mobile app with:

```bash
/Users/mothmanaurascape.ai/Library/pnpm/pnpm --filter @workspace/noor-mobile exec tsc --noEmit
```
