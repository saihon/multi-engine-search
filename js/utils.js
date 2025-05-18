/**
 * Encodes a string to percent-encoding with the specified charset.
 * Falls back to encodeURIComponent (UTF-8) if encoding-japanese is unavailable
 * or the encoding is not supported.
 * @param {string} str The string to encode.
 * @param {string} [encoding='utf-8'] Target character encoding (e.g., 'utf-8', 'euc-jp', 'shift_jis').
 * @returns {string} The percent-encoded string.
 */
function encodeStringToPercentEncoding(str, encoding = "utf-8") {
  const lowerCaseEncoding = encoding.toLowerCase();

  // Use standard encodeURIComponent for UTF-8
  if (lowerCaseEncoding === "utf-8" || lowerCaseEncoding === "utf8") {
    return encodeURIComponent(str);
  }

  try {
    // lib/encoding.min.js (encoding-japanese)
    // https://www.npmjs.com/package/encoding-japanese
    // https://github.com/polygonplanet/encoding.js
    const encoded = Encoding.convert(
      str.split("").map((v) => v.charCodeAt(0)),
      { to: encoding, from: "UNICODE" }
    );
    return Encoding.urlEncode(encoded);
  } catch (e) {
    // Handle errors if the encoding is not supported
    console.error(
      `Encoding ${encoding} failed or is not supported by encoding.min.js(encoding-japanese). Falling back to UTF-8.`,
      e
    );
    return encodeURIComponent(str); // Fallback to UTF-8
  }
}

/**
 * Builds the search URL.
 * @param {string} term The search term.
 * @param {object} engineConfig The search engine configuration object.
 * @param {string} engineConfig.searchEngine The URL template.
 * @param {string} [engineConfig.charCode='UTF-8'] Character encoding.
 * @param {boolean} [engineConfig.spaceToPlus=false] Replace spaces with plus signs.
 * @returns {string | null} The constructed search URL, or null if the term is empty.
 */
function buildSearchUrl(term, engineConfig) {
  if (!term || term.trim() === "") {
    return null; // Do nothing if the search term is empty
  }

  let processedTerm = term.trim(); // Trim whitespace first

  // Encode the term with the specified character set
  let encodedTerm = encodeStringToPercentEncoding(
    processedTerm,
    engineConfig.charCode
  );

  // Replace encoded spaces (%20) with '+' if specified
  if (engineConfig.spaceToPlus) {
    // Make sure to replace only %20, not other encoded characters
    encodedTerm = encodedTerm.replace(/%20/g, "+");
  }

  // Replace the placeholder %s in the URL template
  const searchUrl = engineConfig.searchEngine.replace("%s", encodedTerm);

  return searchUrl;
}

// Escapes HTML special characters to prevent XSS when using innerHTML
function escapeHtml(unsafe) {
  if (typeof unsafe !== "string") return ""; // Handle non-string inputs
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;"); // &#039; or &apos; (HTML5)
}

/**
 * Finds a category by its ID from an array of categories.
 * @param {Array<Object>} categoriesArray The array of category objects.
 * @param {string} categoryId The ID of the category to find.
 * @returns {Object|null} The found category object or null if not found.
 */
function findCategoryByIdUtil(categoriesArray, categoryId) {
  if (!Array.isArray(categoriesArray)) return null;
  return categoriesArray.find((cat) => cat && cat.id === categoryId) || null;
}

/**
 * Finds an engine by its ID from an array of categories.
 * @param {Array<Object>} categoriesArray The array of category objects.
 * @param {string} engineId The ID of the engine to find.
 * @returns {Object|null} The found engine object or null if not found.
 */
function findEngineByIdUtil(categoriesArray, engineId) {
  if (!Array.isArray(categoriesArray)) return null;
  for (const category of categoriesArray) {
    if (category && Array.isArray(category.engines)) {
      const engine = category.engines.find((eng) => eng && eng.id === engineId);
      if (engine) return engine;
    }
  }
  return null;
}

// Helper to generate unique IDs (use crypto.randomUUID if available in the context)
// As this runs potentially outside secure context initially, provide fallback
function generateUniqueId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  } else {
    // Basic fallback for contexts where crypto.randomUUID isn't available
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
}

/**
 * Ensures all categories and engines within the provided dataArray have unique IDs.
 * Modifies the array in place. Uses the provided ID generator function.
 * @param {Array<Object>} dataArray The array of category objects.
 */
function ensureUniqueIds(dataArray) {
  if (!Array.isArray(dataArray)) return;
  const allGeneratedOrValidatedIds = new Set(); // Track IDs that are confirmed unique for this run

  dataArray.forEach((cat) => {
    if (!cat || typeof cat !== "object") return;

    let idIsMissingOrDuplicate =
      !cat.id || allGeneratedOrValidatedIds.has(cat.id);

    if (idIsMissingOrDuplicate) {
      // Ensure new ID if current one is missing or a duplicate among already processed/generated IDs
      let newId;
      do {
        newId = generateUniqueId();
      } while (allGeneratedOrValidatedIds.has(newId));
      cat.id = newId;
    }
    allGeneratedOrValidatedIds.add(cat.id);

    if (!Array.isArray(cat.engines)) cat.engines = [];
    cat.engines.forEach((eng) => {
      if (!eng || typeof eng !== "object") return;

      let engineIdIsMissingOrDuplicate =
        !eng.id || allGeneratedOrValidatedIds.has(eng.id);

      if (engineIdIsMissingOrDuplicate) {
        let newId;
        do {
          newId = generateUniqueId();
        } while (allGeneratedOrValidatedIds.has(newId));
        eng.id = newId;
      }
      allGeneratedOrValidatedIds.add(eng.id);
    });
  });
}
