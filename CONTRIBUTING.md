# Contributing

Thanks for helping. Bug reports and pull requests are welcome at
https://github.com/evski/ha-glass-remote-card/issues.

- **Keep it dependency-free:** one JavaScript file, no build step.
- **Testing:**
  - Run `npm ci && npm test` before opening a pull request. Add a test for new behaviour.
  - Tests use a fake `hass` and never call real services.
  - If a change alters the look, re-render the screenshots with `python scripts/screenshots.py`.
- **New platforms:** add an entry to `PLATFORMS` in `glass-remote-card.js` with its key map and text sender, then document it in the README table.
