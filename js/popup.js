document.addEventListener("DOMContentLoaded", async () => {
  // --- Elements ---
  const searchTermInput = document.getElementById("search-term");
  const totalCountsDiv = document.getElementById("total-counts");
  const categoriesContainer = document.getElementById("categories-container");
  const optionsButton = document.getElementById("open-options-btn");

  // --- State ---
  let userSearchEngines = []; // Holds the engine data from storage
  let checkedEngines = {}; // { "engineId": true/false } - Simplified check state
  let categoryCollapseState = {}; // { "categoryId": true/false }
  let collapseAllDefaultSetting = false;
  let currentTheme = "system"; // For popup state

  // Focus input on loaded
  const FOCUS_DELAY = 340;
  function focusSearchTermInput() {
    setTimeout(() => {
      searchTermInput.focus();
      searchTermInput.select();
    }, FOCUS_DELAY);
  }

  // --- Initialization ---
  async function init() {
    // 1. Load data from storage
    try {
      const data = await browser.storage.local.get([
        "userSearchEngines", // Load the user-defined engines
        "checkedEnginesMap", // Use a new key for the simplified check state
        "categoryCollapseState",
        "collapseAllDefault",
        "themeSettings", // Load theme
      ]);

      userSearchEngines = data.userSearchEngines || []; // Load saved engines
      // Handle case where no engines are configured yet
      if (!userSearchEngines || userSearchEngines.length === 0) {
        console.log(
          "No engines found in storage. Load defaults or show message."
        );
        categoriesContainer.textContent =
          "No search engines configured. Please configure them in the options page.";
      }

      checkedEngines = data.checkedEnginesMap || {};
      categoryCollapseState = data.categoryCollapseState || {};
      collapseAllDefaultSetting = data.collapseAllDefault === true;
      currentTheme = data.themeSettings || "system";
      console.log(
        "Init - Collapse Default Setting:",
        collapseAllDefaultSetting
      ); // Log initial setting value
    } catch (error) {
      console.error("Error loading data from storage:", error);
      categoriesContainer.textContent = "Error loading search engines.";
    }

    // 2. Render the engine list
    renderEngineList();

    applyThemeToPopup(currentTheme); // Apply theme to popup
    // 3. Update counts
    updateAllCounts();

    // 4. Get selected text
    try {
      const [activeTab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (activeTab?.id) {
        const results = await browser.scripting.executeScript({
          target: { tabId: activeTab.id },
          func: () => window.getSelection().toString(),
        });
        if (results && results[0] && results[0].result) {
          searchTermInput.value = results[0].result.trim();
          updateAllButtonStates();
        }
      }
    } catch (error) {
      if (
        error.message.includes("Missing host permission") ||
        error.message.includes("Extension context invalidated") ||
        error.message.includes("No window matching")
      ) {
        console.log(
          "Could not get selected text (page restrictions or context issues)."
        );
      } else {
        console.error("Error getting selected text:", error);
      }
    }

    // 5. Focus input reliably
    focusSearchTermInput();

    // 6. Add listeners
    searchTermInput.addEventListener("input", updateAllButtonStates);
    searchTermInput.addEventListener("keydown", handleInputKeydown);
    setupListEventListeners(); // Setup delegated listeners

    // 7. Add listener for the options button
    if (optionsButton) {
      optionsButton.addEventListener("click", () => {
        browser.runtime.openOptionsPage();
      });
    } else {
      console.error("Options button not found!");
    }
  }

  // --- Rendering ---
  function renderEngineList() {
    categoriesContainer.innerHTML = ""; // Clear current list
    if (!userSearchEngines || userSearchEngines.length === 0) {
      categoriesContainer.textContent =
        "No search engines configured. Go to options to add some.";
      updateTotalCounts();
      return;
    }

    userSearchEngines.forEach((category) => {
      const categoryId = category.id;

      let isCollapsed;
      if (collapseAllDefaultSetting === true) {
        // If default is "Collapse All", always collapse, ignore individual states.
        isCollapsed = true;
        // console.log(`Category ${category.name} (ID: ${categoryId}): Default is Collapse All, forcing collapse.`); // Debug
      } else {
        // If default is "Do Not Collapse All" (false), then check individual state.
        // Collapse only if explicitly set to true in categoryCollapseState.
        // If state is false or undefined, it remains open (isCollapsed = false).
        isCollapsed = categoryCollapseState[categoryId] === true;
        // console.log(`Category ${category.name} (ID: ${categoryId}): Default is Open, using state: ${isCollapsed} (Raw state: ${categoryCollapseState[categoryId]})`); // Debug
      }

      const categoryDiv = document.createElement("div");
      categoryDiv.className = "category";
      categoryDiv.id = `category-${categoryId}`;

      const categoryHeader = document.createElement("div");
      // Apply 'collapsed' class based on the determined state
      categoryHeader.className = `category-header ${
        isCollapsed ? "collapsed" : ""
      }`;
      categoryHeader.dataset.categoryId = categoryId; // Store ID for click handler

      // Generate category header HTML (Ensure button classes match event listener)
      categoryHeader.innerHTML = `
                <span class="category-toggle">▶</span>
                <span class="category-name">${escapeHtml(category.name)}</span>
                <span class="category-counts" id="counts-${categoryId}"></span>
                <div class="category-buttons">
                    <button class="search-all-cat-btn" title="Search all in ${escapeHtml(
                      category.name
                    )}" data-category-id="${categoryId}">All</button>
                    <button class="search-checked-cat-btn" title="Search checked in ${escapeHtml(
                      category.name
                    )}" data-category-id="${categoryId}">✔ Selected</button>
                </div>`;

      const engineList = document.createElement("ul");
      engineList.className = "engine-list";
      engineList.id = `engine-list-${categoryId}`;

      // Generate engine list items
      category.engines.forEach((engine) => {
        const engineId = engine.id;
        const isChecked = checkedEngines[engineId] === true;

        const engineItem = document.createElement("li");
        engineItem.className = "engine-item";
        engineItem.dataset.engineId = engineId;
        engineItem.dataset.categoryId = categoryId;

        // Generate engine item HTML (Ensure button class matches event listener)
        engineItem.innerHTML = `
                    <input type="checkbox" ${
                      isChecked ? "checked" : ""
                    } tabindex="-1">
                    <span class="engine-name" title="${escapeHtml(
                      engine.name
                    )}">${escapeHtml(engine.name)}</span>
                    <button class="engine-search-button" title="Search with ${escapeHtml(
                      engine.name
                    )}" data-engine-id="${engineId}">Search</button>
                `;
        engineList.appendChild(engineItem);
      });

      categoryDiv.appendChild(categoryHeader);
      categoryDiv.appendChild(engineList);
      categoriesContainer.appendChild(categoryDiv);

      updateCategoryCounts(categoryId);
      updateCategoryButtonState(categoryId);
    });

    updateTotalCounts();
    updateAllButtonStates();
  }

  // --- Event Listeners Setup ---
  function setupListEventListeners() {
    // Use event delegation on the container
    categoriesContainer.addEventListener("click", handleListClick);
    categoriesContainer.addEventListener("change", handleCheckboxChange);
  }

  // --- Event Handlers ---

  // Handles clicks within the categories list container (using event delegation)
  function handleListClick(event) {
    const target = event.target; // The element that was actually clicked

    // --- Interaction with Category Header ---
    const header = target.closest(".category-header");
    if (header) {
      const categoryId = header.dataset.categoryId;

      // Check if a button within the header was clicked
      if (target.classList.contains("search-all-cat-btn")) {
        console.log("All button clicked for category:", categoryId); // Debug
        event.stopPropagation(); // Prevent header toggle
        searchCategory(categoryId, false); // false = search all
      } else if (target.classList.contains("search-checked-cat-btn")) {
        console.log("Sel button clicked for category:", categoryId); // Debug
        event.stopPropagation(); // Prevent header toggle
        searchCategory(categoryId, true); // true = search checked
      }
      // If the click was on the header itself (not a button), toggle collapse
      else if (!target.closest("button")) {
        toggleCategory(categoryId, header);
      }
      return; // Handled category header interaction
    }

    // --- Interaction with Engine Item ---
    const engineItem = target.closest(".engine-item");
    if (engineItem) {
      // Check if the individual engine search button was clicked
      if (target.classList.contains("engine-search-button")) {
        console.log(
          "Search button clicked for engine:",
          target.dataset.engineId
        ); // Debug
        event.stopPropagation(); // Prevent item click (checkbox toggle)
        searchSingleEngine(target.dataset.engineId);
      }
      // Otherwise, if the click was on the item itself (not the button), toggle checkbox
      else {
        const checkbox = engineItem.querySelector('input[type="checkbox"]');
        if (checkbox) {
          checkbox.checked = !checkbox.checked;
          // Manually dispatch 'change' event for the checkbox handler
          checkbox.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
      return; // Handled engine item interaction
    }
  }

  // Handles checkbox changes (triggered by direct click or simulated click)
  async function handleCheckboxChange(event) {
    if (event.target.matches('.engine-item input[type="checkbox"]')) {
      const checkbox = event.target;
      const engineItem = checkbox.closest(".engine-item");
      if (!engineItem) return;

      const engineId = engineItem.dataset.engineId;
      const categoryId = engineItem.dataset.categoryId;
      const isChecked = checkbox.checked;

      if (isChecked) {
        checkedEngines[engineId] = true;
      } else {
        delete checkedEngines[engineId]; // Remove if unchecked
      }

      // Save updated state
      try {
        await browser.storage.local.set({ checkedEnginesMap: checkedEngines });
        await browser.runtime.sendMessage({ action: "updateContextMenu" });
      } catch (error) {
        console.error("Error saving checked state:", error);
      }

      // Update UI
      updateCategoryCounts(categoryId);
      updateTotalCounts();
      updateCategoryButtonState(categoryId);
    }
  }

  // Toggle category collapse state and save it (only if default is not "Collapse All")
  async function toggleCategory(categoryId, headerElement) {
    const isCurrentlyCollapsed = headerElement.classList.contains("collapsed");
    const newState = !isCurrentlyCollapsed; // The new state (true if collapsing, false if opening)

    // Toggle the visual state (class) regardless of the default setting
    // This provides immediate feedback to the user even if the state isn't saved.
    headerElement.classList.toggle("collapsed", newState);

    if (collapseAllDefaultSetting === false) {
      // If the default is NOT "Collapse All", then save the user's explicit state.
      categoryCollapseState[categoryId] = newState;
      console.log(`Saving collapse state for ${categoryId}: ${newState}`); // Debug

      // Persist the updated collapse state map to storage
      try {
        await browser.storage.local.set({ categoryCollapseState });
      } catch (error) {
        console.error("Error saving collapse state:", error);
      }
    } else {
      // If the default IS "Collapse All", do not save the individual state.
      // The category will revert to collapsed next time the popup opens.
      console.log(
        `Default is Collapse All, not saving individual state for ${categoryId}`
      ); // Debug
    }
  }

  // Handle Enter key press in the search input field
  function handleInputKeydown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      searchCheckedEnginesGlobal(); // Perform search using checked engines
    }
  }

  // --- Search Functions ---

  // Search using a single, specified engine
  function searchSingleEngine(engineId) {
    const term = searchTermInput.value.trim();
    if (!term) return;

    const engineConfig = findEngineByIdUtil(userSearchEngines, engineId);
    if (!engineConfig) {
      console.error(`Engine config not found for ID: ${engineId}`);
      return;
    }

    const url = buildSearchUrl(term, engineConfig); // Assumes buildSearchUrl is available
    if (url) {
      browser.tabs.create({ url: url, active: false }).catch((error) => {
        console.error(
          `Failed to create tab for single engine search (${engineConfig.name}):`,
          error
        );
      });
    } else {
      console.warn(`buildSearchUrl returned null for ${engineConfig.name}`);
    }
  }

  // Search within a specific category (all engines or only checked ones)
  function searchCategory(categoryId, checkedOnly) {
    console.log(
      `searchCategory called: categoryId=${categoryId}, checkedOnly=${checkedOnly}`
    ); // Debug
    const term = searchTermInput.value.trim();
    if (!term) {
      console.log("Search term is empty, aborting searchCategory.");
      searchTermInput.focus(); // Give feedback by focusing input
      return;
    }

    const category = userSearchEngines.find((cat) => cat.id === categoryId);
    if (!category) {
      console.error(`searchCategory: Category not found for ID: ${categoryId}`);
      return;
    }
    console.log(
      `Found category: ${category.name}, Engines: ${category.engines.length}`
    ); // Debug

    let searchPromises = []; // Collect promises from tab creation

    category.engines.forEach((engineConfig) => {
      const isChecked = checkedEngines[engineConfig.id] === true;
      console.log(
        `Checking engine: ${engineConfig.name} (ID: ${engineConfig.id}), isChecked: ${isChecked}`
      ); // Debug

      if (!checkedOnly || isChecked) {
        console.log(` -> Preparing search for engine: ${engineConfig.name}`); // Debug
        const url = buildSearchUrl(term, engineConfig); // Assumes buildSearchUrl is available
        if (url) {
          console.log(` -> Built URL: ${url}`); // Debug
          // Add the promise to the array
          searchPromises.push(
            browser.tabs
              .create({ url: url, active: false })
              .then(() =>
                console.log(` -> Tab created for ${engineConfig.name}`)
              )
              .catch((error) =>
                console.error(
                  ` -> Failed to create tab for ${engineConfig.name}:`,
                  error
                )
              )
          );
        } else {
          console.warn(
            ` -> buildSearchUrl returned null for ${engineConfig.name}`
          );
        }
      } else {
        console.log(
          ` -> Skipping engine (checkedOnly=${checkedOnly}, isChecked=${isChecked}): ${engineConfig.name}`
        );
      }
    });

    // Log after attempting all searches
    Promise.allSettled(searchPromises).then((results) => {
      const successfulSearches = results.filter(
        (r) => r.status === "fulfilled"
      ).length;
      if (successfulSearches === 0) {
        if (checkedOnly && category.engines.length > 0) {
          console.log(
            "searchCategory finished: No checked engines found or searched in this category."
          );
          // alert("No engines are checked in this category."); // Optional user feedback
        } else if (category.engines.length === 0) {
          console.log("searchCategory finished: Category is empty.");
        } else {
          console.log(
            "searchCategory finished: No searches initiated (possibly URL build errors or other issues)."
          );
        }
      } else {
        console.log(
          `searchCategory finished: ${successfulSearches} searches initiated.`
        );
      }
    });
  }

  // Search using all currently checked engines across all categories
  function searchCheckedEnginesGlobal() {
    const term = searchTermInput.value.trim();
    if (!term) return;
    let searchPromises = []; // Collect promises

    console.log("Performing global search for checked engines...");
    userSearchEngines.forEach((category) => {
      category.engines.forEach((engineConfig) => {
        if (checkedEngines[engineConfig.id] === true) {
          const url = buildSearchUrl(term, engineConfig); // Assumes buildSearchUrl is available
          if (url) {
            console.log(` -> Global search: Queuing ${engineConfig.name}`);
            searchPromises.push(
              browser.tabs
                .create({ url: url, active: false })
                .then(() =>
                  console.log(
                    ` -> Global search: Tab created for ${engineConfig.name}`
                  )
                )
                .catch((error) =>
                  console.error(
                    ` -> Global search: Failed tab for ${engineConfig.name}:`,
                    error
                  )
                )
            );
          } else {
            console.warn(
              ` -> Global search: buildSearchUrl null for ${engineConfig.name}`
            );
          }
        }
      });
    });

    Promise.allSettled(searchPromises).then((results) => {
      const successfulSearches = results.filter(
        (r) => r.status === "fulfilled"
      ).length;
      if (successfulSearches === 0) {
        console.log(
          "Global search finished: No engines were checked or no searches succeeded."
        );
        // alert("No search engines are checked."); // Optional user feedback
      } else {
        console.log(
          `Global search finished: ${successfulSearches} searches initiated.`
        );
      }
    });
  }

  // --- UI Updates (Counts, Buttons) ---

  // Update counts for a specific category
  function updateCategoryCounts(categoryId) {
    const category = userSearchEngines.find((cat) => cat.id === categoryId);
    if (!category) return;
    const countsSpan = document.getElementById(`counts-${categoryId}`);
    if (!countsSpan) return;

    const totalInCategory = category.engines.length;
    const checkedInCategory = category.engines.filter(
      (eng) => checkedEngines[eng.id] === true
    ).length;
    countsSpan.textContent = `${checkedInCategory}/${totalInCategory}`;
  }

  // Update the overall total counts
  function updateTotalCounts() {
    let totalEngines = 0;
    let totalChecked = 0;
    userSearchEngines.forEach((category) => {
      totalEngines += category.engines.length;
      totalChecked += category.engines.filter(
        (eng) => checkedEngines[eng.id] === true
      ).length;
    });
    totalCountsDiv.textContent = `Total: ${totalChecked}/${totalEngines}`;
  }

  // Update all category counts and the total count
  function updateAllCounts() {
    userSearchEngines.forEach((category) => {
      if (document.getElementById(`category-${category.id}`)) {
        updateCategoryCounts(category.id);
      }
    });
    updateTotalCounts();
  }

  // Update enabled/disabled state of buttons for a specific category
  function updateCategoryButtonState(categoryId) {
    const categoryDiv = document.getElementById(`category-${categoryId}`);
    if (!categoryDiv) return;
    const category = userSearchEngines.find((cat) => cat.id === categoryId);
    if (!category) return;

    const hasTerm = !!searchTermInput.value.trim();
    const checkedInCategory = category.engines.some(
      (eng) => checkedEngines[eng.id] === true
    );

    const searchAllButton = categoryDiv.querySelector(".search-all-cat-btn");
    const searchCheckedButton = categoryDiv.querySelector(
      ".search-checked-cat-btn"
    );

    if (searchAllButton) {
      searchAllButton.disabled = !hasTerm;
    }
    if (searchCheckedButton) {
      searchCheckedButton.disabled = !hasTerm || !checkedInCategory;
    }
  }

  // Update enabled/disabled state for ALL buttons based on search term
  function updateAllButtonStates() {
    const hasTerm = !!searchTermInput.value.trim();

    document.querySelectorAll(".engine-search-button").forEach((button) => {
      button.disabled = !hasTerm;
    });

    userSearchEngines.forEach((category) => {
      if (document.getElementById(`category-${category.id}`)) {
        updateCategoryButtonState(category.id);
      }
    });
  }

  // --- Utility ---

  // Listen for messages from other parts of the extension
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "enginesUpdated") {
      console.log("Popup received enginesUpdated message, reloading data...");
      browser.storage.local
        .get([
          "userSearchEngines",
          "checkedEnginesMap",
          "categoryCollapseState",
          "collapseAllDefault",
          // No need to reload theme here, settingsUpdated will handle it
        ])
        .then((data) => {
          userSearchEngines = data.userSearchEngines || [];
          checkedEngines = data.checkedEnginesMap || {};
          categoryCollapseState = data.categoryCollapseState || {};
          collapseAllDefaultSetting = data.collapseAllDefault === true;
          renderEngineList();
        })
        .catch((error) =>
          console.error("Error reloading data after engine update:", error)
        );
      return true;
    }
    if (message.action === "settingsUpdated") {
      console.log(
        "Popup received settingsUpdated message, reloading settings..."
      );
      // Reload theme and collapse settings
      browser.storage.local
        .get(["collapseAllDefault", "categoryCollapseState", "themeSettings"])
        .then((data) => {
          collapseAllDefaultSetting = data.collapseAllDefault === true;
          categoryCollapseState = data.categoryCollapseState || {};
          currentTheme = data.themeSettings || "system";

          console.log(
            "New Collapse Default Setting applied in popup:",
            collapseAllDefaultSetting
          );
          console.log("New Theme Setting applied in popup:", currentTheme);

          applyThemeToPopup(currentTheme); // Apply new theme
          renderEngineList(); // Re-render to apply new default setting behavior
        })
        .catch((error) =>
          console.error("Error reloading settings after update:", error)
        );
      return true;
    }
  });

  // --- Theme Application for Popup ---
  let prefersDarkSchemeMatcherPopup = window.matchMedia(
    "(prefers-color-scheme: dark)"
  );

  function applyThemeToPopup(theme) {
    document.body.classList.remove("theme-light", "theme-dark");
    if (theme === "dark") {
      document.body.classList.add("theme-dark");
    } else if (theme === "light") {
      document.body.classList.add("theme-light");
    } else {
      // System default
      if (prefersDarkSchemeMatcherPopup.matches) {
        document.body.classList.add("theme-dark");
      } else {
        document.body.classList.add("theme-light");
      }
    }
  }
  function handleSystemThemeChangePopup() {
    if (currentTheme === "system") {
      // Check against the popup's current understanding of the setting
      applyThemeToPopup("system");
    }
  }
  prefersDarkSchemeMatcherPopup.addEventListener(
    "change",
    handleSystemThemeChangePopup
  );

  // --- Start Initialization ---
  init();
});
