document.addEventListener("DOMContentLoaded", () => {
  // --- Globals ---
  let searchEngines = [];
  let draggedElement = null;
  const categoriesListDiv = document.getElementById("categories-list");
  const categoryModal = document.getElementById("category-modal");
  const engineModal = document.getElementById("engine-modal");
  const collapseDefaultCheckbox = document.getElementById(
    "collapse-all-default"
  );
  const disableContextMenuCheckbox = document.getElementById(
    "disable-context-menu"
  );
  const themeSelect = document.getElementById("theme-select");

  // --- Initialization ---
  async function init() {
    const data = await browser.storage.local.get([
      "userSearchEngines",
      "collapseAllDefault",
      "contextMenuDisabled",
      "themeSettings", // Load theme setting
    ]);
    // Assuming getDefaultEngines is available globally via initialEngines.js
    searchEngines =
      data.userSearchEngines && data.userSearchEngines.length > 0
        ? data.userSearchEngines
        : getDefaultEngines();
    collapseDefaultCheckbox.checked = data.collapseAllDefault === true;
    disableContextMenuCheckbox.checked = data.contextMenuDisabled === true;
    themeSelect.value = data.themeSettings || "system"; // Default to system

    let idsWereAdded = !data.userSearchEngines || needsIdUpdate(searchEngines);
    ensureUniqueIds(searchEngines);
    if (idsWereAdded) await saveEngines();
    renderEngineList();
    applyTheme(themeSelect.value); // Apply initial theme
    setupEventListeners();
  }
  function needsIdUpdate(dataArray) {
    if (!Array.isArray(dataArray)) return false;
    return dataArray.some(
      (cat) =>
        !cat ||
        !cat.id ||
        (cat.engines && cat.engines.some((eng) => !eng || !eng.id))
    );
  }

  // --- Rendering ---
  function renderEngineList() {
    categoriesListDiv.innerHTML = "";
    searchEngines.forEach((category, catIndex) => {
      const categoryItem = createCategoryElement(category, catIndex);
      categoriesListDiv.appendChild(categoryItem);
      const engineListContainer = categoryItem.querySelector(
        ".engine-list-container"
      );
      if (category.engines) {
        category.engines.forEach((engine, engIndex) => {
          const engineItem = createEngineElement(engine, category.id, engIndex);
          engineListContainer.appendChild(engineItem);
        });
      }
    });
    addDragDropListeners();
  }
  function createCategoryElement(category, index) {
    const div = document.createElement("div");
    div.className = "category-item draggable";
    div.setAttribute("draggable", "true");
    div.dataset.categoryId = category.id;
    div.dataset.index = index;
    div.innerHTML = `
            <div class="category-item-header">
                <span class="drag-handle" title="Drag to reorder">☰</span>
                <strong class="category-item-name">${escapeHtml(
                  category.name
                )}</strong>
                <div class="category-item-actions">
                    <button class="edit-category-btn" data-category-id="${
                      category.id
                    }" title="Edit category name">Edit</button>
                    <button class="delete-category-btn" data-category-id="${
                      category.id
                    }" title="Delete category (and its engines)">Delete</button>
                    <button class="add-engine-btn" data-category-id="${
                      category.id
                    }" title="Add a new engine to this category">Add Engine</button>
                </div>
            </div>
            <div class="engine-list-container"></div>`;
    return div;
  }
  function createEngineElement(engine, categoryId, index) {
    const div = document.createElement("div");
    div.className = "engine-item draggable";
    div.setAttribute("draggable", "true");
    div.dataset.engineId = engine.id;
    div.dataset.categoryId = categoryId;
    div.dataset.index = index;
    const charCodeText = engine.charCode
      ? `(${escapeHtml(engine.charCode)})`
      : "";
    const spaceHandlingText = engine.spaceToPlus ? `[Space:Plus]` : "";
    const detailsText = [charCodeText, spaceHandlingText]
      .filter(Boolean)
      .join(" ")
      .trim();
    div.innerHTML = `
             <span class="drag-handle" title="Drag to reorder">☰</span>
             <span class="engine-item-name" title="${escapeHtml(
               engine.name
             )}">${escapeHtml(engine.name)}</span>
             <span class="engine-item-url" title="${escapeHtml(
               engine.searchEngine
             )}">${escapeHtml(engine.searchEngine)}</span>
         ${
           detailsText
             ? `<span class="engine-item-details" style="font-size: 0.8em; color: #777; margin: 0 5px;">${detailsText}</span>`
             : ""
         }
             <div class="engine-item-actions">
                 <button class="edit-engine-btn" data-engine-id="${
                   engine.id
                 }" data-category-id="${categoryId}" title="Edit this engine">Edit</button>
                 <button class="delete-engine-btn" data-engine-id="${
                   engine.id
                 }" data-category-id="${categoryId}" title="Delete this engine">Delete</button>
             </div>`;
    return div;
  }

  // --- Event Listeners Setup ---
  function setupEventListeners() {
    collapseDefaultCheckbox.addEventListener(
      "change",
      handleCollapseDefaultChange
    );
    disableContextMenuCheckbox.addEventListener(
      "change",
      handleContextMenuDisableChange
    );
    themeSelect.addEventListener("change", handleThemeChange);
    document
      .getElementById("add-category-btn")
      .addEventListener("click", handleAddCategoryClick);
    document
      .getElementById("export-btn")
      .addEventListener("click", handleExportClick);
    document
      .getElementById("import-btn")
      .addEventListener("click", () =>
        document.getElementById("import-file").click()
      );
    document
      .getElementById("import-file")
      .addEventListener("change", handleImportFile);
    document
      .getElementById("reset-defaults-btn")
      .addEventListener("click", handleResetDefaults);
    document
      .querySelectorAll(".modal .close-btn")
      .forEach((btn) => btn.addEventListener("click", closeModal));
    document
      .getElementById("save-category-btn")
      .addEventListener("click", handleSaveCategory);
    document
      .getElementById("save-engine-btn")
      .addEventListener("click", handleSaveEngine);
    categoriesListDiv.addEventListener("click", (event) => {
      const target = event.target;
      if (target.classList.contains("edit-category-btn"))
        handleEditCategoryClick(target.dataset.categoryId);
      else if (target.classList.contains("delete-category-btn"))
        handleDeleteCategoryClick(target.dataset.categoryId);
      else if (target.classList.contains("add-engine-btn"))
        handleAddEngineClick(target.dataset.categoryId);
      else if (target.classList.contains("edit-engine-btn"))
        handleEditEngineClick(
          target.dataset.categoryId,
          target.dataset.engineId
        );
      else if (target.classList.contains("delete-engine-btn"))
        handleDeleteEngineClick(
          target.dataset.categoryId,
          target.dataset.engineId
        );
    });
    window.addEventListener("click", (event) => {
      if (event.target.classList.contains("modal")) closeModal();
    });
  }

  // --- Drag and Drop Handlers ---
  function addDragDropListeners() {
    const draggables = categoriesListDiv.querySelectorAll(".draggable");
    draggables.forEach((draggable) => {
      draggable.removeEventListener("dragstart", handleDragStart);
      draggable.removeEventListener("dragend", handleDragEnd);
      draggable.addEventListener("dragstart", handleDragStart);
      draggable.addEventListener("dragend", handleDragEnd);
    });
    categoriesListDiv.removeEventListener("dragover", handleDragOver);
    categoriesListDiv.removeEventListener("drop", handleDrop);
    categoriesListDiv.removeEventListener("dragenter", handleDragEnter);
    categoriesListDiv.removeEventListener("dragleave", handleDragLeave);
    categoriesListDiv.addEventListener("dragover", handleDragOver);
    categoriesListDiv.addEventListener("drop", handleDrop);
    categoriesListDiv.addEventListener("dragenter", handleDragEnter);
    categoriesListDiv.addEventListener("dragleave", handleDragLeave);
    const engineContainers = categoriesListDiv.querySelectorAll(
      ".engine-list-container"
    );
    engineContainers.forEach((container) => {
      container.removeEventListener("dragover", handleDragOver);
      container.removeEventListener("drop", handleDrop);
      container.removeEventListener("dragenter", handleDragEnter);
      container.removeEventListener("dragleave", handleDragLeave);
      container.addEventListener("dragover", handleDragOver);
      container.addEventListener("drop", handleDrop);
      container.addEventListener("dragenter", handleDragEnter);
      container.addEventListener("dragleave", handleDragLeave);
    });
  }
  function handleDragStart(e) {
    draggedElement = e.target.closest(".draggable");
    if (!draggedElement) return;
    e.dataTransfer.effectAllowed = "move";
    let dragData = {};
    if (draggedElement.classList.contains("category-item"))
      dragData = { type: "category", id: draggedElement.dataset.categoryId };
    else if (draggedElement.classList.contains("engine-item"))
      dragData = {
        type: "engine",
        id: draggedElement.dataset.engineId,
        sourceCategoryId: draggedElement.dataset.categoryId,
      };
    else {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData("application/json", JSON.stringify(dragData));
    setTimeout(() => {
      if (draggedElement) draggedElement.classList.add("dragging");
    }, 0);
  }
  function handleDragEnd(e) {
    if (draggedElement) draggedElement.classList.remove("dragging");
    document
      .querySelectorAll(".drag-over")
      .forEach((el) => el.classList.remove("drag-over"));
    draggedElement = null;
  }
  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const dropTarget = e.target.closest(
      ".category-item, .engine-item, .engine-list-container, #categories-list"
    );
    if (
      dropTarget &&
      dropTarget !== draggedElement &&
      !dropTarget.classList.contains("drag-over")
    ) {
      document
        .querySelectorAll(".drag-over")
        .forEach((el) => el.classList.remove("drag-over"));
      dropTarget.classList.add("drag-over");
    } else if (!dropTarget || dropTarget === draggedElement) {
      document
        .querySelectorAll(".drag-over")
        .forEach((el) => el.classList.remove("drag-over"));
    }
  }
  function handleDragEnter(e) {
    e.preventDefault();
  } // Keep it simple
  function handleDragLeave(e) {
    const dropTarget = e.target.closest(
      ".category-item, .engine-item, .engine-list-container, #categories-list"
    );
    if (
      dropTarget &&
      !dropTarget.contains(e.relatedTarget) &&
      dropTarget !== draggedElement
    )
      dropTarget.classList.remove("drag-over");
    if (!e.relatedTarget || !categoriesListDiv.contains(e.relatedTarget))
      document
        .querySelectorAll(".drag-over")
        .forEach((el) => el.classList.remove("drag-over"));
  }
  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedElement) return;
    const dropTargetElement =
      document.querySelector(".drag-over") ||
      e.target.closest(
        ".category-item, .engine-item, .engine-list-container, #categories-list"
      );
    if (!dropTargetElement) {
      handleDragEnd(e);
      return;
    }
    dropTargetElement.classList.remove("drag-over");
    let droppedData;
    try {
      droppedData = JSON.parse(e.dataTransfer.getData("application/json"));
    } catch (err) {
      handleDragEnd(e);
      return;
    }
    if (droppedData.type === "category")
      handleCategoryDrop(droppedData.id, dropTargetElement);
    else if (droppedData.type === "engine")
      handleEngineDrop(
        droppedData.id,
        droppedData.sourceCategoryId,
        dropTargetElement
      );
  }

  // --- Modified Category Drop Logic ---
  function handleCategoryDrop(draggedCategoryId, dropTargetElement) {
    const targetCategoryElement = dropTargetElement.closest(".category-item");
    const originalDraggedIndex = findCategoryIndexById(draggedCategoryId);

    if (originalDraggedIndex === -1) return; // Dragged item not found

    let originalTargetIndex = -1;
    const targetElementId = targetCategoryElement
      ? targetCategoryElement.dataset.categoryId
      : null;

    if (targetElementId) {
      originalTargetIndex = findCategoryIndexById(targetElementId);
      if (targetElementId === draggedCategoryId) return; // Dropped on itself
    } else if (
      dropTargetElement === categoriesListDiv ||
      dropTargetElement.closest("#categories-list")
    ) {
      originalTargetIndex = searchEngines.length; // Target is end of the list
    } else {
      return; // Invalid drop target
    }

    if (originalTargetIndex === -1) return; // Target index not found

    // --- Core Logic ---
    // 1. Remove the dragged element first
    const categoryToMove = searchEngines.splice(originalDraggedIndex, 1)[0];
    if (!categoryToMove) return;

    // 2. Determine the final insertion index based on relative positions
    let finalInsertIndex;
    if (targetElementId) {
      // Dropped onto another category
      // Find the target's index *after* removal
      const newTargetIndex = findCategoryIndexById(targetElementId);
      if (newTargetIndex === -1) {
        // Target disappeared? Revert.
        searchEngines.splice(originalDraggedIndex, 0, categoryToMove);
        return;
      }

      if (originalDraggedIndex < originalTargetIndex) {
        // Moved DOWN onto target B -> Insert AFTER target B
        finalInsertIndex = newTargetIndex + 1;
      } else {
        // Moved UP onto target D -> Insert BEFORE target D
        finalInsertIndex = newTargetIndex;
      }
    } else {
      // Dropped onto the container (or after the last element)
      finalInsertIndex = searchEngines.length; // Append to the end
    }

    // 3. Insert the element at the calculated index
    searchEngines.splice(finalInsertIndex, 0, categoryToMove);

    saveAndRerender();
  }

  // --- Modified Engine Drop Logic ---
  function handleEngineDrop(
    draggedEngineId,
    sourceCategoryId,
    dropTargetElement
  ) {
    let targetCategoryId = null;
    let targetEngineId = null; // ID of the engine being dropped ON
    let droppedOnContainer = false;

    const targetEngineElement = dropTargetElement.closest(".engine-item");
    const targetCategoryElement = dropTargetElement.closest(".category-item");
    const targetEngineListContainer = dropTargetElement.closest(
      ".engine-list-container"
    );

    // Determine target category and engine ID
    if (targetEngineElement) {
      targetEngineId = targetEngineElement.dataset.engineId;
      targetCategoryId = targetEngineElement.dataset.categoryId;
      if (
        targetEngineId === draggedEngineId &&
        sourceCategoryId === targetCategoryId
      )
        return; // Dropped on self
    } else if (targetEngineListContainer) {
      targetCategoryId =
        targetEngineListContainer.closest(".category-item")?.dataset.categoryId;
      droppedOnContainer = true; // Dropped onto the container space
    } else if (targetCategoryElement) {
      targetCategoryId = targetCategoryElement.dataset.categoryId;
      droppedOnContainer = true; // Dropped onto category header (treat as container)
    }

    if (!targetCategoryId) return; // Target category couldn't be determined

    // Get source indices
    const sourceCategoryIndex = findCategoryIndexById(sourceCategoryId);
    const originalSourceEngineIndex = findEngineIndexById(
      sourceCategoryId,
      draggedEngineId
    ); // Index before removal
    if (sourceCategoryIndex === -1 || originalSourceEngineIndex === -1) return; // Source not found

    // Get target category info
    const targetCategoryIndex = findCategoryIndexById(targetCategoryId);
    if (targetCategoryIndex === -1) return; // Target category not found
    const targetCategory = searchEngines[targetCategoryIndex];
    if (!targetCategory.engines) targetCategory.engines = []; // Ensure array exists

    // Get target engine index (original position)
    let originalTargetEngineIndex = -1;
    if (targetEngineId) {
      originalTargetEngineIndex = findEngineIndexById(
        targetCategoryId,
        targetEngineId
      );
    }

    // --- Core Logic ---
    // 1. Remove the engine from source first
    const engineToMove = searchEngines[sourceCategoryIndex].engines.splice(
      originalSourceEngineIndex,
      1
    )[0];
    if (!engineToMove) return; // Should not happen if indices were valid

    // 2. Determine the final insertion index
    let finalInsertIndex;

    if (droppedOnContainer) {
      // Dropped onto container -> Append to target category's engine list
      finalInsertIndex = targetCategory.engines.length;
    } else if (targetEngineId) {
      // Dropped onto a specific engine (targetEngineElement)

      // Find the target engine's index *after* potential removal from the same list
      let newTargetEngineIndex = findEngineIndexById(
        targetCategoryId,
        targetEngineId
      );
      if (newTargetEngineIndex === -1) {
        // Target engine disappeared? Revert.
        console.error(
          "Target engine not found after source removal. Reverting."
        );
        searchEngines[sourceCategoryIndex].engines.splice(
          originalSourceEngineIndex,
          0,
          engineToMove
        );
        return;
      }

      // Determine if moving up or down
      const movingWithinSameCategory = sourceCategoryId === targetCategoryId;

      // Compare original indices to determine direction
      if (
        movingWithinSameCategory &&
        originalSourceEngineIndex < originalTargetEngineIndex
      ) {
        // Moved DOWN onto target B -> Insert AFTER target B (its new index)
        finalInsertIndex = newTargetEngineIndex + 1;
      } else {
        // Moved UP onto target D OR moved between categories -> Insert BEFORE target D (its new index)
        finalInsertIndex = newTargetEngineIndex;
      }
    } else {
      // Invalid drop target within category? Revert.
      console.error(
        "Unhandled engine drop scenario within category. Reverting."
      );
      searchEngines[sourceCategoryIndex].engines.splice(
        originalSourceEngineIndex,
        0,
        engineToMove
      );
      return;
    }

    // 3. Insert into target category at the calculated index
    targetCategory.engines.splice(finalInsertIndex, 0, engineToMove);

    saveAndRerender();
  }

  // --- CRUD Operation Handlers (Remain the same) ---
  function handleAddCategoryClick() {
    openCategoryModal(null);
  }
  function handleEditCategoryClick(categoryId) {
    const cat = findCategoryById(categoryId);
    if (cat) openCategoryModal(cat);
  }
  function handleDeleteCategoryClick(categoryId) {
    const cat = findCategoryById(categoryId);
    if (cat && confirm(`Delete category "${cat.name}"?`)) {
      searchEngines = searchEngines.filter((c) => c.id !== categoryId);
      saveAndRerender();
    }
  }
  function handleAddEngineClick(categoryId) {
    if (findCategoryById(categoryId)) openEngineModal(null, categoryId);
    else alert("Category not found.");
  }
  function handleEditEngineClick(categoryId, engineId) {
    const eng = findEngineById(categoryId, engineId);
    if (eng) openEngineModal(eng, categoryId);
  }
  function handleDeleteEngineClick(categoryId, engineId) {
    const cat = findCategoryById(categoryId);
    const eng = findEngineById(categoryId, engineId);
    if (cat && eng && confirm(`Delete engine "${eng.name}"?`)) {
      cat.engines = cat.engines.filter((e) => e.id !== engineId);
      saveAndRerender();
    }
  }

  // --- Modal Display and Data Handling (Remain the same) ---
  function openCategoryModal(category) {
    /* ... as before ... */
    const title = document.getElementById("category-modal-title");
    const nameInput = document.getElementById("category-name-input");
    const idInput = document.getElementById("edit-category-id");
    if (category) {
      title.textContent = "Edit Category";
      nameInput.value = category.name;
      idInput.value = category.id;
    } else {
      title.textContent = "Add New Category";
      nameInput.value = "";
      idInput.value = "";
    }
    categoryModal.style.display = "flex";
    nameInput.focus();
  }
  function openEngineModal(engine, categoryId) {
    /* ... as before ... */
    const title = document.getElementById("engine-modal-title");
    const nameInput = document.getElementById("engine-name-input");
    const urlInput = document.getElementById("engine-url-input");
    const charcodeInput = document.getElementById("engine-charcode-select");
    const spaceRadios = document.querySelectorAll(
      'input[name="space-handling"]'
    );
    const engineIdInput = document.getElementById("edit-engine-id");
    const categoryIdInput = document.getElementById("edit-engine-category-id");
    categoryIdInput.value = categoryId;
    if (engine) {
      title.textContent = "Edit Engine";
      engineIdInput.value = engine.id;
      nameInput.value = engine.name;
      urlInput.value = engine.searchEngine;
      charcodeInput.value = engine.charCode || "";
      let spaceValue = engine.spaceToPlus ? "plus" : "default";
      spaceRadios.forEach(
        (radio) => (radio.checked = radio.value === spaceValue)
      );
    } else {
      title.textContent = "Add New Engine";
      engineIdInput.value = "";
      nameInput.value = "";
      urlInput.value = "";
      charcodeInput.value = "";
      document.querySelector(
        'input[name="space-handling"][value="default"]'
      ).checked = true;
    }
    engineModal.style.display = "flex";
    nameInput.focus();
  }
  function closeModal() {
    categoryModal.style.display = "none";
    engineModal.style.display = "none";
  }
  function handleSaveCategory() {
    /* ... as before ... */
    const name = document.getElementById("category-name-input").value.trim();
    const id = document.getElementById("edit-category-id").value;
    if (!name) return alert("Category name cannot be empty.");
    if (id) {
      const cat = findCategoryById(id);
      if (cat) cat.name = name;
      else return alert("Error: Category not found.");
    } else {
      searchEngines.push({ id: generateUniqueId(), name: name, engines: [] });
    }
    closeModal();
    saveAndRerender();
  }
  function handleSaveEngine() {
    /* ... as before ... */
    const name = document.getElementById("engine-name-input").value.trim();
    const url = document.getElementById("engine-url-input").value.trim();
    const charCode = document.getElementById("engine-charcode-select").value;
    const spaceHandling = document.querySelector(
      'input[name="space-handling"]:checked'
    ).value;
    const engineId = document.getElementById("edit-engine-id").value;
    const categoryId = document.getElementById("edit-engine-category-id").value;
    if (!name || !url) return alert("Engine name and URL required.");
    if (!url.includes("%s")) return alert("URL must include %s");
    const category = findCategoryById(categoryId);
    if (!category) return alert("Error: Category not found.");
    if (!category.engines) category.engines = [];
    const engineData = {
      id: engineId || generateUniqueId(),
      name: name,
      searchEngine: url,
      charCode: charCode || undefined,
      spaceToPlus: spaceHandling === "plus",
    };
    if (engineId) {
      const index = findEngineIndexById(categoryId, engineId);
      if (index !== -1) category.engines[index] = engineData;
      else return alert("Error: Engine not found.");
    } else {
      category.engines.push(engineData);
    }
    closeModal();
    saveAndRerender();
  }

  // --- General Settings Handler (Remains the same) ---
  async function handleCollapseDefaultChange(event) {
    /* ... as before ... */
    const isChecked = event.target.checked;
    try {
      await browser.storage.local.set({ collapseAllDefault: isChecked });
      browser.runtime.sendMessage({ action: "settingsUpdated" }).catch((e) => {
        console.error("Error sending settingsUpdated for collapse:", e);
      });
    } catch (error) {
      console.error("Error saving collapse setting:", error);
      alert("Error saving setting.");
    }
  }

  async function handleContextMenuDisableChange(event) {
    const isDisabled = event.target.checked;
    try {
      await browser.storage.local.set({ contextMenuDisabled: isDisabled });
      browser.runtime
        .sendMessage({ action: "settingsUpdated" }) // Notify background to update
        .catch((e) =>
          console.error(
            "Error sending settingsUpdated message for context menu:",
            e
          )
        );
      console.log(
        `Options: Context menu ${
          isDisabled ? "disabled" : "enabled"
        } and setting saved.`
      );
    } catch (error) {
      console.error(
        "Options: Error saving context menu disable setting:",
        error
      );
      alert("Error saving context menu setting.");
    }
  }

  async function handleThemeChange(event) {
    const newTheme = event.target.value;
    applyTheme(newTheme);
    try {
      await browser.storage.local.set({ themeSettings: newTheme });
      browser.runtime.sendMessage({ action: "settingsUpdated" }).catch((e) => {
        // Notify background/popup
        console.error("Error sending settingsUpdated for theme:", e);
      });
    } catch (error) {
      console.error("Error saving theme setting:", error);
      alert("Error saving theme setting.");
    }
  }
  // --- Import / Export / Reset Functions (Remain the same) ---
  function handleExportClick() {
    /* ... as before ... */
    try {
      const dataStr = JSON.stringify(searchEngines, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `multi-engine-search-backup-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting settings:", error);
      alert("Error exporting.");
    }
  }
  function handleImportFile(event) {
    /* ... as before ... */
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        if (!isValidEngineDataStructure(importedData)) {
          throw new Error("Invalid data structure.");
        }
        ensureUniqueIds(importedData);
        if (confirm("Replace current list?")) {
          searchEngines = importedData;
          await saveEngines();
          renderEngineList();
          alert("Import successful!");
        }
      } catch (error) {
        console.error("Import failed:", error);
        alert(`Import failed: ${error.message}`);
      } finally {
        event.target.value = null;
      }
    };
    reader.onerror = () => {
      console.error("Error reading import file.");
      alert("Error reading file.");
    };
    reader.readAsText(file);
  }
  function isValidEngineDataStructure(data) {
    /* ... as before ... */
    return (
      Array.isArray(data) &&
      data.every(
        (cat) =>
          typeof cat === "object" &&
          cat !== null &&
          typeof cat.name === "string" &&
          Array.isArray(cat.engines) &&
          cat.engines.every(
            (eng) =>
              typeof eng === "object" &&
              eng !== null &&
              typeof eng.name === "string" &&
              typeof eng.searchEngine === "string" &&
              eng.searchEngine.includes("%s")
          )
      )
    );
  }
  async function handleResetDefaults() {
    /* ... as before ... */
    if (confirm("Reset all engines to defaults?")) {
      searchEngines = getDefaultEngines();
      ensureUniqueIds(searchEngines);
      await saveEngines();
      renderEngineList();
      alert("Reset complete.");
    }
  }

  // --- Storage and Utility Functions (Remain the same) ---
  async function saveEngines() {
    /* ... as before ... */
    try {
      await browser.storage.local.set({ userSearchEngines: searchEngines });
      browser.runtime.sendMessage({ action: "enginesUpdated" }).catch((e) => {
        console.error("Error sending enginesUpdated message:", e);
      });
    } catch (error) {
      console.error("Error saving engines:", error);
      alert("Error saving.");
    }
  }
  function saveAndRerender() {
    saveEngines()
      .then(renderEngineList)
      .catch((e) => {
        console.error("Error in saveAndRerender chain:", e);
      });
  }
  function findCategoryById(id) {
    return findCategoryByIdUtil(searchEngines, id);
  }
  function findCategoryIndexById(id) {
    return searchEngines.findIndex((cat) => cat && cat.id === id);
  }
  function findEngineById(categoryId, engineId) {
    const cat = findCategoryById(categoryId);
    if (!cat || !Array.isArray(cat.engines)) return null;
    return cat.engines.find((eng) => eng && eng.id === engineId) || null;
  }
  function findEngineIndexById(categoryId, engineId) {
    const cat = findCategoryById(categoryId);
    return cat?.engines?.findIndex((eng) => eng && eng.id === engineId) ?? -1; // This one is index-specific, might keep or adapt
  }

  // --- Theme Application ---
  let prefersDarkSchemeMatcher = window.matchMedia(
    "(prefers-color-scheme: dark)"
  );

  function applyTheme(theme) {
    document.body.classList.remove("theme-light", "theme-dark");
    if (theme === "dark") {
      document.body.classList.add("theme-dark");
    } else if (theme === "light") {
      document.body.classList.add("theme-light");
    } else {
      // System default
      if (prefersDarkSchemeMatcher.matches) {
        document.body.classList.add("theme-dark");
      } else {
        document.body.classList.add("theme-light");
      }
    }
  }

  function handleSystemThemeChange() {
    if (themeSelect.value === "system") {
      applyTheme("system");
    }
  }
  prefersDarkSchemeMatcher.addEventListener("change", handleSystemThemeChange);

  // --- Start Initialization ---
  init();
});
