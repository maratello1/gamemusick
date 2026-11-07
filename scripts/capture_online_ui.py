import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        
        # Desktop 1440x900
        page = await browser.new_page(viewport={"width": 1440, "height": 900})
        await page.goto("http://localhost:3001", wait_until="networkidle")
        await page.wait_for_timeout(2000)
        
        # Click on "🎧 Мои артисты"
        artists_btn = page.locator("button:has-text('Мои артисты')")
        if await artists_btn.count() > 0:
            await artists_btn.first.click()
            await page.wait_for_timeout(2500)
        
        await page.screenshot(path=r"C:\Users\maratello\.gemini\antigravity\brain\f0df7040-5201-4400-afc7-35902c148f05\gamemusick-dota2-artists-desktop-1440x900.png")
        print("Desktop screenshot captured with 'Мои артисты' active")
        
        # Mobile 390x844
        mobile_page = await browser.new_page(viewport={"width": 390, "height": 844})
        await mobile_page.goto("http://localhost:3001", wait_until="networkidle")
        await mobile_page.wait_for_timeout(2500)
        await mobile_page.screenshot(path=r"C:\Users\maratello\.gemini\antigravity\brain\f0df7040-5201-4400-afc7-35902c148f05\gamemusick-dota2-artists-mobile-390x844.png")
        print("Mobile screenshot captured")
        
        await browser.close()

asyncio.run(main())
