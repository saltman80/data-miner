# Data Miner

Data Miner is a Chrome extension that helps you scrape structured data from web pages and export it as CSV.
In auto mode the extension collects only `<h1>` headings from the current page and immediately downloads them as a CSV file.

## Usage

1. Load the extension in Chrome through the Extensions page in developer mode.
2. Click the extension icon to open the popup.
3. Choose **Auto Detect & Export** to automatically capture all `<h1>` and `<h2>` elements, or select **Select Data to Export** to manually pick elements.
4. When manual selection mode is active:
   - Focus returns to the page and the **Export to CSV** button in the popup is disabled.
   - Click each `<h1>` or `<h2>` you want to export. After each click a message in the popup confirms the element was added.
   - Press **Enter** while still focused on the page to finalize your selection and start the CSV download.
   - Press **Escape** if you want to cancel.

You do not need to reopen the popup to export. Finalizing with **Enter** inside the page avoids losing your selection due to popup focus changes.
