"""Render the README screenshots from docs/demo/demo.html (offline, fake hass, no devices).
Needs: pip install playwright && playwright install chromium (or a local Chrome).
Usage: python scripts/screenshots.py [chrome-path]"""
import asyncio, pathlib, sys
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parents[1]
DEMO = (ROOT / "docs/demo/demo.html").as_uri()
OUT = ROOT / "docs/images"
SHOTS = [  # name, query, viewport, safe-area (top, bottom), click
    ("remote-kodi", "", (393, 852), (59, 34), None),
    ("remote-apple-tv-wants-text", "?src=Apple%20TV&kodi=idle&kbd=on&atv=playing", (393, 852), (59, 34), None),
    ("picker", "", (393, 852), (59, 34), ".pill"),
    ("keyboard", "?src=Apple%20TV&kodi=idle&atv=playing", (393, 852), (59, 34), ".mic"),
    ("sources-menu", "", (393, 852), (59, 34), "row:.src"),
    ("bottom-row", "?src=Apple%20TV&kodi=idle&atv=playing", (393, 852), (59, 34), "row:"),
    ("more-menu", "", (393, 852), (59, 34), "row:.more"),
    ("sound-mode-menu", "", (393, 852), (59, 34), "hold:.badge"),
    ("remote-small-phone", "", (375, 667), (20, 0), None),
    ("card-layout", "?layout=card", (468, 690), (0, 0), None),
]
async def main():
    async with async_playwright() as p:
        kw = {"executable_path": sys.argv[1]} if len(sys.argv) > 1 else {}
        b = await p.chromium.launch(**kw)
        for name, query, (w, h), (it, ib), click in SHOTS:
            ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=2)
            pg = await ctx.new_page()
            cdp = await ctx.new_cdp_session(pg)
            try:
                await cdp.send("Emulation.setSafeAreaInsetsOverride", {"insets": {"top": it, "bottom": ib, "left": 0, "right": 0}})
            except Exception:
                pass
            await pg.goto(DEMO + query); await pg.wait_for_timeout(500)
            if click and click.startswith("hold:"):
                await pg.locator("glass-remote-card").locator(click[5:]).first.hover()
                await pg.mouse.down(); await pg.wait_for_timeout(700); await pg.mouse.up(); await pg.wait_for_timeout(400)
            elif click and click.startswith("row:"):  # 0.1.3: open the pad's bottom row first (tap CH)
                await pg.locator("glass-remote-card").locator(".chl").first.click(); await pg.wait_for_timeout(400)
                if click[4:]:
                    await pg.locator("glass-remote-card").locator(click[4:]).first.click(); await pg.wait_for_timeout(400)
            elif click:
                await pg.locator("glass-remote-card").locator(click).first.click(); await pg.wait_for_timeout(400)
                if click == ".mic":
                    await pg.keyboard.type("northern lights"); await pg.wait_for_timeout(300)
            await pg.screenshot(path=str(OUT / f"{name}.png"))
            await ctx.close()
            print("wrote", name)
        await b.close()
asyncio.run(main())
