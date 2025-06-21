# Data Miner

Data Miner is a Chrome extension that helps you scrape structured data from web pages and export it as CSV.
In auto mode the extension collects only `<h1>` headings from the current page and immediately downloads them as a CSV file.

## Usage

1. Load the extension in Chrome through the Extensions page in developer mode.
2. Click the extension icon to open the popup.
3. Choose **Auto Detect & Export** to automatically capture all `<h1>` and `<h2>` elements, or select **Select Data to Export** to manually pick elements (only `<h1>`/`<h2>` are supported).
4. When manual selection mode is active:
   - Click a heading to add it to your selection. A small in‑page popup asks if you want to add more elements or export now.
   - Choose **Yes** to continue selecting more headings, or **Export** to finalize and download.
   - Press **Escape** at any time to cancel without exporting.

The extension popup can stay open while you select multiple headings.
