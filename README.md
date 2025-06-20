# Data Miner

Data Miner is a Chrome extension that helps you scrape structured data from web pages and export it as CSV.

## Usage

1. Load the extension in Chrome through the Extensions page in developer mode.
2. Click the extension icon to open the popup.
3. Choose **Auto Detect & Export** to automatically capture all `<h1>` elements, or select **Select Data to Export** to manually pick elements.
4. When manual selection mode is active:
   - Focus returns to the page.
   - Click each `<h1>` you want to export. After each click you'll see a short alert confirming the element was added.
   - Press **Enter** while still focused on the page to finalize your selection and start the CSV download.
   - Press **Escape** if you want to cancel.

You do not need to reopen the popup to export. Finalizing with **Enter** inside the page avoids losing your selection due to popup focus changes.
