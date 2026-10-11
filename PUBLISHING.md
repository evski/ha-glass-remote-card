# Publishing checklist

This is for the maintainer. The repo is **private** and nothing is released yet.

## 0. Before going public
- [ ] Evan reviews the code, README and images.
- [ ] Test on a real phone, on a spare dashboard, with each platform:
  - touchpad swipe, tap and long-press
  - volume hold-repeat
  - keyboard and dictation
  - power
- [ ] Optional: add a visual config editor (YAML-only today).
- [ ] Run `npm ci && npm test`. All checks must pass.

## 1. Repository settings (with `gh`)
- **Name:** `ha-glass-remote-card`. Card type: `custom:glass-remote-card`.
  - No GitHub repository or npm package used either name when checked on 11 Oct 2026.
  - The nearest projects are `PRProd/HA-Firemote`, `Nerwyn/universal-remote-card` and a few single-platform remote cards; none uses the "glass remote" name.
- **Description:**
  > Frosted-glass touchpad remote card for Home Assistant. Follows whatever you're watching: Kodi, LG webOS, the Apple TV integration or any media_player. Touchpad, volume, keyboard & dictation, artwork. Single file, no dependencies. HACS.
- **Topics** are already set (18): home-assistant, homeassistant, hacs, hacs-plugin, hacs-dashboard, lovelace, lovelace-card, lovelace-custom-card, home-assistant-frontend, remote, remote-control, kodi, webos, lg-tv, media-player, touchpad, frosted-glass, home-automation. No trademarked product names.
- **Social preview:** upload `docs/images/social-preview.png` under Settings → General → Social preview. This is web UI only.

## README images
README images use **relative paths** (`docs/images/...`), so they show while the repo is private and after it goes public. HACS's "images" check only looks for `<img` or `![` in the README text (hacs/integration `validate/images.py`), so relative paths pass and there's no need to switch to absolute URLs at publish time. If the HACS store page ever shows broken images after release, switch them to `https://raw.githubusercontent.com/evski/ha-glass-remote-card/main/docs/images/...`.

## Trademarks
Keep "Apple TV" only as the device or integration name (`apple_tv` platform, links to HA's Apple TV integration), with the README notice: "Not affiliated with or endorsed by Apple Inc. Apple TV is a trademark of Apple Inc." Don't compare the design to other companies' products, and don't use their style names or logos.

## 2. Go public
```bash
gh repo edit evski/ha-glass-remote-card --visibility public --accept-visibility-change-consequences
gh repo edit evski/ha-glass-remote-card --enable-discussions --enable-issues
```
Then check that the **HACS validation** and **Tests** workflows pass on `main`.

## 3. First release
1. Make sure `const VERSION` in `glass-remote-card.js`, `package.json` and the `## [x.y.z]` heading in `CHANGELOG.md` all match. Change "unreleased" to the date (done for 0.1.10: 2026-10-11).
2. `git tag v0.1.10 && git push origin v0.1.10`. The **Release** workflow runs the tests, checks the version and publishes the release with the JS attached.

## 4. Getting it found
- Post in the Home Assistant Community forum (Dashboards & Frontend → Custom cards) with screenshots, and set the repo homepage to that thread.
- Submit to HACS default once the repo is public, has a release and has passed validation: open a PR to `hacs/default` adding the repo to the `plugin` list.
- Cross-link from the Sidebar Mini Player README (its `remote_path` option).
