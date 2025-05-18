// Site Search Helper Functions (moved here or kept in encodingUtil if needed globally)
function googleSiteSearch(domain) {
  return `https://www.google.com/search?q=site%3A${domain}+%s`;
}

function ddgSiteSearch(domain) {
  return `https://duckduckgo.com/?q=site%3A${domain}+%s`;
}

/**
 * The following properties can be configured for a search engine data object (each element in the `engines` array within a category).
 *
 * Properties configurable by the user on the options page:
 *
 * name: string
 * Description: The display name of the search engine. Shown in the popup and options page.
 * Required: Yes
 *
 * searchEngine: string
 * Description: The URL template for performing a search. Must include %s as a placeholder for the search term.
 * Required: Yes (and must include %s)
 *
 * charCode: string ("Shift_JIS", "EUC-JP") or undefined。
 * Description: Specifies the character encoding for URL-encoding the search term.
 *      If not specified (or if an empty string is selected), the default UTF-8 will be used.
 * Required: No (optional)
 *
 * spaceToPlus: boolean (true or false)
 * Description: If set to true, spaces represented as %20 (after URL encoding) will be replaced with a plus sign (+).
 * Required: No (optional, defaults to false)
 *
 * Internally managed properties:
 *
 * id: string (UUID format)
 * Description: An internal ID to uniquely identify each engine. It is automatically generated when an engine is added on the options page
 *      or when data without an ID is imported.
 * Required: Yes (required for internal processing). However, users do not set this directly as it's auto-generated if missing during import.
 *
 * isDefault (any, only the initial data): boolean (true)
 * Description: A flag indicating if this engine originates from the extension's initial data (initialEngines.js).
 *      It exists for potential future enhancements to the reset functionality but is not directly used by the current reset process.
 *      Engines added by the user typically do not have this flag.
 * Required: No
 *
 * When users manually create a JSON for import, the minimum required properties are `name` and `searchEngine` (including %s).
 * Other properties can be optionally added/configured. IDs will be automatically assigned if missing.
 */

// Function to get the initial default search engine data structure
function getDefaultEngines() {
  return [
    {
      id: generateUniqueId(),
      name: "General Search",
      isDefault: true,
      engines: [
        {
          id: generateUniqueId(),
          name: "Google",
          searchEngine: "https://www.google.com/search?q=%s",
          isDefault: true,
        },
        {
          id: generateUniqueId(),
          name: "DuckDuckGo",
          searchEngine: "https://duckduckgo.com/?q=%s",
          isDefault: true,
        },
      ],
    },
  ];
}

/**
 * Example of how to add more categories and engines
    {
      id: generateUniqueId(),
      name: "Dictionary",
      isDefault: true, // Mark as default category
      engines: [
        {
          id: generateUniqueId(),
          name: "Dict A (UTF-8)",
          searchEngine: "https://dict.example.com/search?q=%s",
          isDefault: true,
        },
        {
          id: generateUniqueId(),
          name: "Dict B (EUC-JP)",
          searchEngine: "https://eucdict.example.jp/search?query=%s",
          charCode: "EUC-JP",
          isDefault: true,
        },
        {
          id: generateUniqueId(),
          name: "Dict C (Shift_JIS)",
          searchEngine: "https://sjisdict.example.jp/find?word=%s",
          charCode: "Shift_JIS",
          isDefault: true,
        },
        {
          id: generateUniqueId(),
          name: "Dict E (Space->Plus)",
          searchEngine: "https://plusdict.example.com/search?term=%s",
          spaceToPlus: true,
          isDefault: true,
        },
      ],
    },
    {
      id: generateUniqueId(),
      name: "Shopping",
      isDefault: true,
      engines: [
        {
          id: generateUniqueId(),
          name: "Shop A",
          searchEngine: "https://shopA.example.com/search?keyword=%s",
          isDefault: true,
        },
        {
          id: generateUniqueId(),
          name: "Shop B",
          searchEngine: "https://shopB.example.jp/items?q=%s",
          isDefault: true,
        },
        {
          id: generateUniqueId(),
          name: "Shop C",
          searchEngine: "https://shopC.example.org/search?p=%s",
          isDefault: true,
        },
      ],
    },
    {
      id: generateUniqueId(),
      name: "Developer Tools",
      isDefault: true,
      engines: [
        {
          id: generateUniqueId(),
          name: "MDN Web Docs (Direct)",
          searchEngine: "https://developer.mozilla.org/en-US/search?q=%s",
          isDefault: true,
        },
        {
          id: generateUniqueId(),
          name: "Stack Overflow (Direct)",
          searchEngine: "https://stackoverflow.com/search?q=%s",
          isDefault: true,
        },
        {
          id: generateUniqueId(),
          name: "Search MDN (via DDG)",
          searchEngine: ddgSiteSearch("developer.mozilla.org"),
          isDefault: true,
        },
        {
          id: generateUniqueId(),
          name: "Search MDN (via Google)",
          searchEngine: googleSiteSearch("developer.mozilla.org"),
          isDefault: true,
        },
        {
          id: generateUniqueId(),
          name: "Search W3C (via Google)",
          searchEngine: googleSiteSearch("w3.org"),
          isDefault: true,
        },
      ],
    },
 */
