#!/bin/bash
# install-on-watch.sh — build WatchRemote and install it on a paired Apple Watch.
# Run on a Mac from this directory with the watch awake, unlocked, on its charger
# near the Mac, and the iPhone nearby on the same Wi-Fi.
# Free Personal Team builds expire after 7 days: just re-run this script.
#
# Required environment variables (no defaults):
#   TEAM   Apple Developer Team ID (e.g. your free Personal Team id)
#   WATCH  Apple Watch UDID (`xcrun devicectl list devices`)
#
# Example:
#   TEAM=XXXXXXXXXX WATCH=<watch-udid> ./install-on-watch.sh
set -euo pipefail
cd "$(dirname "$0")"

if [[ -z "${TEAM:-}" || -z "${WATCH:-}" ]]; then
  echo "Set TEAM to your Apple Developer Team ID and WATCH to your Apple Watch UDID." >&2
  echo "  TEAM=XXXXXXXXXX WATCH=<watch-udid> $0" >&2
  echo "List devices with:  xcrun devicectl list devices" >&2
  exit 1
fi

export PATH="/opt/homebrew/bin:$PATH"
xcodegen generate
xcodebuild -project WatchRemote.xcodeproj -scheme WatchRemote -configuration Debug \
  -destination "id=$WATCH" -derivedDataPath build/DD DEVELOPMENT_TEAM="$TEAM" \
  -allowProvisioningUpdates -allowProvisioningDeviceRegistration build \
  | grep -E "error:|BUILD (SUCCEEDED|FAILED)" || true
xcrun devicectl device install app --device "$WATCH" build/DD/Build/Products/Debug-watchos/WatchRemote.app
echo "Installed. Open 'Remote' on the watch."
