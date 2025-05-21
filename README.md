# Multi Engine Search (for Firefox)

[![License: MPL 2.0](https://img.shields.io/badge/License-MPL_2.0-brightgreen.svg)](https://opensource.org/licenses/MPL-2.0)

Multi Engine Search is a Firefox browser extension that allows you to quickly search using multiple search engines selected from a popup interface. It offers customization options for adding, editing, and organizing your favorite search engines.

## Features

*   **Quick Search Popup:** Access your search engines via a browser action (toolbar icon).
*   **Engine Selection:** Select multiple search engines using checkboxes.
*   **Categorized Engines:** Organize search engines into categories (e.g., Dictionary, Shopping, Developer Tools).
*   **Category Expansion/Collapse:** Show or hide engines within a category by clicking the category header.
*   **Search Options:**
    *   Search using all engines in a category.
    *   Search using only the checked engines in a category.
    *   Search using a single specific engine.
*   **Pre-fill Search Term:** Automatically populates the search input with selected text from the active tab when the popup opens.
*   **Character Encoding Specification:** Allows specifying character encodings (e.g., UTF-8, Shift_JIS, EUC-JP) for search engines. Non-UTF-8 encodings are processed using the `encoding.js (https://github.com/polygonplanet/encoding.js)` library. If an encoding is unsupported by the library or an error occurs during conversion, the process defaults to UTF-8 encoding.
*   **Space Handling Options:** Configurable space handling (Default `%20`, `+`).
*   **Context Menu Integration:** Adds checked search engines to the context menu for quick searching of selected text.
*   **Customizable Engine List:**
    *   Add new search engines and categories.
    *   Edit existing engine details (Name, URL, Encoding, Space Handling).
    *   Delete engines and categories.
    *   Reorder categories and engines within categories using Drag & Drop.
*   **Import/Export:** Backup and share your search engine configurations via JSON import/export.
*   **Reset to Defaults:** Option to reset the search engine list to the initial default set.
*   **Default Settings:** Option to collapse categories by default in the popup.
*   **Keyboard Shortcut:** Open the popup using a keyboard shortcut (Default: `Ctrl+Shift+9`, customizable in Firefox Add-ons manager).
*   **Theme Support:** Automatically adapts to your system's light or dark theme for the popup and options page.
*   **Configurable Context Menu:** Option to disable context menu integration if not needed.

## Installation

### From Firefox Add-ons (AMO)

[Mozilla Add-ons](https://addons.mozilla.org/en-US/firefox/addon/multi-engine-searcher/)

### Manual Installation (for Development/Testing)

1.  **Download:** Download the source code files or clone this repository.
2.  **Open Firefox:** Launch the Firefox browser.
3.  **Navigate to Debugging:** Enter `about:debugging` in the address bar and press Enter.
4.  **Select "This Firefox":** Click on "This Firefox" in the left-hand sidebar.
5.  **Load Temporary Add-on:** Click the "Load Temporary Add-on..." button.
6.  **Select Manifest:** Navigate to the directory where you saved the source code and select the `manifest.json` file.
7.  The extension icon should now appear in your Firefox toolbar.

**Note:** Temporary add-ons are removed when you close Firefox. For persistent installation during development, you might explore using `web-ext`.

## Usage

### Opening the Popup

*   Click the **Multi Engine Search icon** in your Firefox toolbar.
*   Use the keyboard shortcut (default: `Ctrl+Shift+9`).

### Searching from the Popup

1.  **Enter Search Term:** Type your search query into the input box at the top of the popup. If you had text selected on the current page when opening the popup, it will be pre-filled.
2.  **Select Engines (Optional):** Check the boxes next to the search engines you want to use.
3.  **Perform Search:**
    *   **Single Engine:** Click the "Search" button next to an individual engine.
    *   **Category (All):** Click the "All" button in a category header to search all engines in that category.
    *   **Category (Selected):** Click the "✔ Sel" button in a category header to search only the checked engines within that category.
    *   **All Checked (Global):** Press `Enter` in the search input box to search using *all* checked engines across *all* categories.
4.  Search results will open in new, inactive background tabs.

### Searching from the Context Menu

1.  Ensure the desired search engines are **checked** in the popup (this adds them to the context menu).
2.  **Select text** on any webpage.
3.  **Right-click** on the selected text.
4.  In the context menu, find the entry like `Search [Engine Name] for "%s"` (where `%s` represents your selected text).
5.  Click the desired engine entry to perform the search.

### Managing Categories and Engines

1.  **Open Options:** Right-click the extension icon in the toolbar and select "Manage Extension", then go to the "Options" tab. Alternatively, access it through the Firefox Add-ons manager (`about:addons`).
2.  **Add Category:** Click the "Add Category" button. Enter a name in the modal and save.
3.  **Add Engine:** Click the "Add Engine" button within a category header. Fill in the details (Name, Search URL with `%s`, Encoding, Space Handling) in the modal and save.
4.  **Edit:** Click the "Edit" button next to a category or engine to modify its details.
5.  **Delete:** Click the "Delete" button next to a category or engine. Confirmation will be required.
6.  **Reorder:** Click and drag the `☰` handle next to a category or engine to change its position within its list. Drop it onto another item (or the list container) to place it relative to that item (before if moving up, after if moving down).

### Import / Export

*   Use the "Export Engines" button on the options page to save your current configuration as a JSON file.
*   Use the "Import Engines" button to select a previously exported JSON file. **Warning:** Importing will replace your current list.

### Settings

*   On the options page, check/uncheck "Collapse categories by default in popup" to control the initial view when opening the popup.
*   On the options page, check/uncheck "Disable context menu" to control whether search engines appear in the browser's context menu.
*   On the options page, select your preferred theme (System, Light, Dark) for the popup and options page.

## Important Considerations

*   **Searching with Many Engines:** While this extension allows you to select and search with a large number of engines simultaneously (tests have been conducted with up to 20 engines at once), please be mindful of the potential impact.
    *   **Performance:** Opening a very large number of tabs at once can consume significant browser and system resources (CPU, RAM), potentially leading to slower browser performance or responsiveness.
    *   **Rate Limiting:** Some search engines may have rate limits that could be triggered by numerous rapid search requests originating from a single IP address. This could temporarily restrict your access to those specific search engines.
    It's generally recommended to select a reasonable number of engines pertinent to your current search needs for an optimal experience.

## Custom Search Engine URL Format

When adding or editing an engine, the "Search URL" field requires a specific format:

*   It must be a valid URL.
*   It **must** include the placeholder `%s` exactly where your search term should be inserted.

**Example:** `https://www.google.com/search?q=%s`

## Data Structure (for Import/Export JSON)

The exported/imported JSON follows this structure:

```json
[
  {
    "id": "unique-category-id-1",
    "name": "Category Name 1",
    "engines": [
      {
        "id": "unique-engine-id-a",
        "name": "Engine A Name",
        "searchEngine": "https://example.com/search?q=%s", // URL with %s as placeholder for search term
        "charCode": "Shift_JIS", // Optional. Specifies the character encoding (e.g., "UTF-8", "Shift_JIS", "EUC-JP").
        "spaceToPlus": true     // Optional (defaults to false)
      },
      {
        "id": "unique-engine-id-b",
        "name": "Engine B Name",
        "searchEngine": "https://other.example.com/find?term=%s"
        // Other properties are optional
      }
    ]
  },
  {
    "id": "unique-category-id-2",
    "name": "Category Name 2",
    "engines": [
        // ... more engines
    ]
  }
]
