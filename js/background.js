// encodingUtil.js and initialEngines.js are loaded via manifest (ensure order)

console.log("[Background] Script loading..."); // Add log to see when script loads

const CONTEXT_MENU_ID_PREFIX = "multi-engine-search-";
let currentEngines = []; // Cache engine data locally
let currentCheckedEngines = {}; // Cache check state
let contextMenuEnabled = true; // Default to enabled

// --- Top-Level Event Listener Registration ---
// MV3 Best Practice: Register event listeners, especially critical ones like onClicked,
// at the top level of the script. This ensures they are attached as soon as the
// script is loaded when an event fires, before other async operations complete.
try {
  if (browser.contextMenus && browser.contextMenus.onClicked) {
    // Remove listener first to prevent potential duplicates if script somehow re-executes without full unload
    // Note: This might not be strictly necessary if using the same function reference,
    // but can be safer. Alternatively, use hasListener if needed, but direct add is common for MV3.
    // browser.contextMenus.onClicked.removeListener(handleContextMenuClick); // Optional safeguard
    browser.contextMenus.onClicked.addListener(handleContextMenuClick);
    console.log(
      "[Background] contextMenus.onClicked listener attached at top level."
    );
  } else {
    console.error(
      "[Background] browser.contextMenus.onClicked API not available at top level!"
    );
  }
} catch (e) {
  console.error(
    "[Background] Error attaching contextMenus.onClicked listener:",
    e
  );
}

// --- Initialization Function ---
// This function will run when the script loads, setting up data and other listeners.
async function initializeBackground() {
  console.log("[Background] Initializing background script logic...");
  try {
    // Load data needed for click handler and menu updates
    await loadDataFromStorage();

    // Set up other listeners that are less critical for immediate event handling
    // or rely on initial data load.
    setupOtherListeners();

    // Initial context menu setup is primarily handled by onInstalled.
    // Calling updateContextMenu() here might be redundant if onInstalled works correctly,
    // but could be added as a fallback if menus sometimes don't appear on browser start.
    // await updateContextMenu(); // Consider if needed

    console.log("[Background] Initialization logic complete.");
  } catch (error) {
    console.error(
      "[Background] Error during background initialization:",
      error
    );
  }
}

async function loadDataFromStorage() {
  console.log("[Background] Loading data from storage...");
  try {
    let data = await browser.storage.local.get([
      "userSearchEngines",
      "checkedEnginesMap",
      "contextMenuDisabled", // Load the new setting
    ]);

    // Load engines
    if (!data.userSearchEngines || data.userSearchEngines.length === 0) {
      console.log("[Background] No engines in storage, loading defaults.");
      if (typeof getDefaultEngines !== "function") {
        console.error(
          "[Background] getDefaultEngines function is not defined."
        );
        currentEngines = [];
      } else {
        const defaultEngines = getDefaultEngines();
        ensureUniqueIds(defaultEngines);
        await browser.storage.local.set({ userSearchEngines: defaultEngines });
        currentEngines = defaultEngines;
        console.log("[Background] Default engines loaded and saved.");
      }
    } else {
      currentEngines = data.userSearchEngines;
      // Ensure loaded data has IDs, in case of data corruption or manual edit
      ensureUniqueIds(currentEngines);
      // console.log("[Background] Loaded engines from storage."); // Less verbose
    }

    // Load check state
    currentCheckedEngines = data.checkedEnginesMap || {};
    // console.log("[Background] Loaded checked engines map from storage."); // Less verbose

    // Load context menu enabled state
    contextMenuEnabled = !(data.contextMenuDisabled === true); // If undefined or false, it's enabled.
    console.log(
      `[Background] Context menu enabled state loaded: ${contextMenuEnabled}`
    );

    console.log("[Background] Data loading complete.");
  } catch (error) {
    console.error("[Background] Error loading data from storage:", error);
    currentEngines = []; // Fallback to empty
    currentCheckedEngines = {}; // Fallback to empty
    contextMenuEnabled = true; // Fallback to enabled
  }
}

// --- Setup for Other Listeners ---
// Register listeners that don't need to be at the absolute top level.
function setupOtherListeners() {
  console.log("[Background] Setting up other event listeners...");

  // On Install/Update: Crucial for initial menu setup and data initialization.
  if (!browser.runtime.onInstalled.hasListener(handleInstallOrUpdate)) {
    browser.runtime.onInstalled.addListener(handleInstallOrUpdate);
    console.log("[Background] runtime.onInstalled listener added.");
  }

  // Storage Changes: Update menus if settings change.
  if (!browser.storage.onChanged.hasListener(handleStorageChange)) {
    browser.storage.onChanged.addListener(handleStorageChange);
    console.log("[Background] storage.onChanged listener added.");
  }

  // Messages: Communication from popup/options.
  if (!browser.runtime.onMessage.hasListener(handleMessage)) {
    browser.runtime.onMessage.addListener(handleMessage);
    console.log("[Background] runtime.onMessage listener added.");
  }

  // Commands: Handle keyboard shortcuts.
  if (
    browser.commands &&
    browser.commands.onCommand && // Check if onCommand exists
    !browser.commands.onCommand.hasListener(handleCommand)
  ) {
    browser.commands.onCommand.addListener(handleCommand);
    console.log("[Background] commands.onCommand listener added.");
  } else if (browser.commands && !browser.commands.onCommand) {
    console.warn("[Background] browser.commands.onCommand API not available.");
  }

  console.log("[Background] Other listeners set up.");
}

// --- Event Handlers ---

// On Install/Update: Sets up initial state and menus.
async function handleInstallOrUpdate(details) {
  console.log(
    `[Background] Extension ${details.reason}. Triggering setup/update.`
  );
  // Load/initialize data FIRST, as menus depend on it.
  await loadDataFromStorage();
  console.log("[Background] Updating context menu via onInstalled handler.");
  // Create/recreate menus based on the loaded data.
  await updateContextMenu();
  console.log(
    "[Background] Context menu setup/update complete via onInstalled."
  );
}

// Context Menu Click Handler (Attached at top level)
async function handleContextMenuClick(info, tab) {
  console.log("[Background] contextMenus.onClicked event handler executed.");
  // console.log("[Background] Click info:", info); // Can be verbose, enable if needed

  // --- Data Check ---
  // Because this handler might run *before* initializeBackground completes fully
  // (or if the script wakes up *just* for this event), ensure necessary data is loaded.
  if (
    !currentEngines ||
    currentEngines.length === 0 ||
    Object.keys(currentCheckedEngines).length === 0
  ) {
    console.warn(
      "[Background] Engine data cache is empty in onClicked handler. Attempting to load..."
    );
    await loadDataFromStorage(); // Load data if it's missing
    if (!currentEngines || currentEngines.length === 0) {
      console.error(
        "[Background] Failed to load engine data. Cannot process context menu click."
      );
      return; // Stop if data couldn't be loaded
    }
    console.log("[Background] Engine data loaded within onClicked handler.");
  }
  // --- End Data Check ---

  // Filter clicks from other extensions or non-selection contexts
  if (!info.menuItemId || !info.menuItemId.startsWith(CONTEXT_MENU_ID_PREFIX)) {
    // console.log( // Can be verbose
    //   "[Background] Clicked menu item is not from this extension:",
    //   info.menuItemId
    // );
    return;
  }
  if (!info.selectionText) {
    // Should not happen if contexts: ["selection"] is used, but good to check.
    console.warn(
      "[Background] Context menu clicked, but no selectionText found in info."
    );
    return;
  }

  const selectedText = info.selectionText.trim();
  const engineId = info.menuItemId.substring(CONTEXT_MENU_ID_PREFIX.length);
  // console.log( // Can be verbose
  //   `[Background] Handling click for engine ID: ${engineId}, Text: "${selectedText}"`
  // );

  // Find engine config using the (potentially just loaded) data
  const engineConfig = findEngineByIdUtil(currentEngines, engineId);

  if (!engineConfig) {
    console.error(
      `[Background] Engine configuration not found for ID: ${engineId}. Menu might be stale or data is inconsistent.`
    );
    // Maybe schedule a menu update as something is wrong?
    // setTimeout(updateContextMenu, 1000);
    return;
  }

  // console.log( // Can be verbose
  //   `[Background] Found engine: ${engineConfig.name}. Building search URL...`
  // );

  // Ensure buildSearchUrl is available
  if (typeof buildSearchUrl !== "function") {
    console.error(
      "[Background] buildSearchUrl function is not defined. Check script loading order/availability."
    );
    return;
  }
  const url = buildSearchUrl(selectedText, engineConfig);

  if (url) {
    // console.log(`[Background] Search URL built: ${url}. Creating new tab...`); // Can be verbose
    try {
      await browser.tabs.create({
        url: url,
        active: false, // Open in background
        openerTabId: tab?.id, // Link to the originating tab
      });
      console.log(
        `[Background] New search tab created for ${engineConfig.name}.`
      );
    } catch (error) {
      console.error(
        `[Background] Failed to create new tab for ${engineConfig.name}:`,
        error
      );
    }
  } else {
    console.error(
      `[Background] Failed to build search URL for engine: ${engineConfig.name}. Check config and function.`
    );
  }
}

// Storage Change Handler
async function handleStorageChange(changes, areaName) {
  if (areaName !== "local") return;

  let needsMenuUpdate = false;
  let changedKeys = Object.keys(changes);
  // console.log("[Background] storage.onChanged detected for keys:", changedKeys.join(', '));

  if (changes.userSearchEngines) {
    console.log(
      "[Background] Change detected in 'userSearchEngines'. Reloading engines."
    );
    // Update local cache
    currentEngines = changes.userSearchEngines.newValue || [];
    ensureUniqueIds(currentEngines);
    needsMenuUpdate = true;
  }
  if (changes.checkedEnginesMap) {
    console.log(
      "[Background] Change detected in 'checkedEnginesMap'. Reloading checked state."
    );
    // Update local cache
    currentCheckedEngines = changes.checkedEnginesMap.newValue || {};
    needsMenuUpdate = true;
  }

  if (needsMenuUpdate) {
    console.log(
      "[Background] Updating context menu due to storage change for:",
      changedKeys.join(", ")
    );
    // Update the actual context menus shown to the user
    await updateContextMenu();
  } else {
    // console.log( // Can be verbose
    //   "[Background] Storage change did not require context menu update."
    // );
  }
}

// Message Handler
async function handleMessage(message, sender, sendResponse) {
  // console.log("[Background] Received message:", message); // Can be verbose

  if (message && message.action) {
    switch (message.action) {
      case "updateContextMenu":
        console.log(
          "[Background] Received explicit request ('updateContextMenu'). Updating check state and menus."
        );
        // Reload check state as it might have changed without saving yet
        // (e.g., popup changes it, then tells background to update menu)
        const data = await browser.storage.local.get("checkedEnginesMap");
        currentCheckedEngines = data.checkedEnginesMap || {};
        await updateContextMenu();
        // sendResponse({status: "Context menu update initiated"}); // Optional: acknowledge
        return true; // Indicate async work

      case "enginesUpdated":
        console.log(
          "[Background] Received notification ('enginesUpdated'). Reloading all data and updating menus."
        );
        // Ensure consistency after options save
        await loadDataFromStorage(); // Reloads both engines and checked states
        await updateContextMenu();
        // sendResponse({status: "Engines and context menu updated"}); // Optional
        return true;

      case "settingsUpdated":
        console.log("[Background] Received notification ('settingsUpdated').");
        // Reload all relevant data from storage, including contextMenuDisabled
        await loadDataFromStorage();
        // Update context menus based on potentially new settings
        await updateContextMenu();
        // sendResponse({status: "Settings notification received"}); // Optional
        return true; // Acknowledge if needed, even if no action

      default:
        console.log("[Background] Message action not handled:", message.action);
        return false; // Indicate message not handled
    }
  }
  console.log(
    "[Background] Received malformed message or message without action:",
    message
  );
  return false; // Indicate message not handled
}

// Command Handler
function handleCommand(command) {
  console.log(`[Background] Keyboard command received: ${command}`);
  if (command === "_execute_action") {
    // Handled by the browser automatically (opens popup/action)
    // This command triggers the browser action (e.g., opening the popup).
    // It's typically handled by the browser itself, but logging it can be useful.
    console.log("[Background] Executing browser action via command.");
  }
  // Handle other custom commands here
  // Example:
  // if (command === "search_next_checked_engine") {
  //   // Logic to find the next checked engine and search with it
  // }
}

// --- Context Menu Update ---
// Removes all existing menu items and recreates them based on current state.
async function updateContextMenu() {
  console.log("[Background] Starting context menu update...");

  // Check if context menus are globally disabled by user setting
  if (!contextMenuEnabled) {
    try {
      await browser.contextMenus.removeAll();
      console.log(
        "[Background] Context menu is disabled by user setting. All items removed."
      );
    } catch (error) {
      console.error(
        "[Background] Error removing context menus while disabled by user setting:",
        error
      );
    }
    return; // Do not proceed to create new menu items
  }
  try {
    // Ensure data needed for menus is loaded.
    // This is a safeguard, as data should ideally be loaded by initializeBackground,
    // onInstall, or specific event handlers before this is called.
    if (
      !currentEngines ||
      currentEngines.length === 0 ||
      !currentCheckedEngines // Check if currentCheckedEngines is initialized
    ) {
      console.warn(
        "[Background] Data (engines/checkedState) not fully ready for updateContextMenu. Attempting load..."
      );
      await loadDataFromStorage();
      if (!currentEngines || currentEngines.length === 0) {
        console.error(
          "[Background] Cannot update context menu, data load failed."
        );
        return;
      }
      // No explicit check for currentCheckedEngines here, as loadDataFromStorage handles it.
    }

    await browser.contextMenus.removeAll();
    // console.log("[Background] Removed existing context menu items."); // Less verbose

    let addedCount = 0;
    if (!Array.isArray(currentEngines)) {
      console.error(
        "[Background] Cannot update context menu: currentEngines is not an array."
      );
      return;
    }

    for (const category of currentEngines) {
      if (category && category.engines && Array.isArray(category.engines)) {
        for (const engine of category.engines) {
          // Check if engine exists, has an ID, and is marked as checked
          if (
            engine &&
            engine.id &&
            currentCheckedEngines[engine.id] === true
          ) {
            const menuItemId = CONTEXT_MENU_ID_PREFIX + engine.id;
            const engineName = engine.name || "Unnamed Engine"; // Fallback for unnamed engines
            const title = `Search ${engineName} for "%s"`; // %s is placeholder for selection

            try {
              // Create the menu item.
              // The onClicked listener is attached globally at the top level.
              await browser.contextMenus.create({
                id: menuItemId,
                title: title,
                contexts: ["selection"], // Show only when text is selected
              });
              addedCount++;
            } catch (createError) {
              console.error(
                `[Background] Failed to create context menu item for ${engineName} (ID: ${engine.id}):`,
                createError
              );
              // Handle specific errors like duplicate ID if needed,
              // though removeAll should prevent it.
              // If "Error: An unexpected error occurred" happens, it might be related to
              // the service worker being in a strange state or too many updates too quickly.
            }
          }
        }
      } else {
        console.warn(
          "[Background] Skipping invalid category structure during menu update:",
          category
        );
      }
    }
    console.log(
      `[Background] Context menu update complete. Added ${addedCount} items.`
    );
  } catch (error) {
    // This catch block is for errors in the broader updateContextMenu logic,
    // like issues with removeAll() or unexpected errors not caught by inner try-catch.
    console.error(
      "[Background] Critical error during context menu update process:",
      error
    );
  }
}

// --- Background Utility Functions ---

// --- Start Initialization ---
// Call the main initialization function when the background script loads.
// This sets up data loading and registers secondary listeners.
// The primary contextMenus.onClicked listener is attached at the top level.
initializeBackground();

console.log("[Background] Script loaded and initial setup sequence started.");
