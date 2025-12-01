// This file contains utility functions for interacting with localStorage.

/**
 * Retrieves an item from localStorage, validates its type against a default, and parses it.
 * @param key The key of the item to retrieve.
 * @param defaultValue The default value to return if the item is not found, parsing fails, or type is mismatched.
 * @returns The parsed and validated item from localStorage, or the defaultValue.
 */
export function getLocalStorageItem<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    // If no item exists, return the default value.
    if (item === null) {
      return defaultValue;
    }

    const parsedItem = JSON.parse(item);

    // Validate the type of the parsed item against the type of the default value.
    const defaultType = typeof defaultValue;
    const parsedType = typeof parsedItem;

    // Special handling for objects to differentiate between arrays and null.
    if (defaultType === 'object') {
      if (defaultValue === null) {
        // If default is null, any value is acceptable as long as it's parsed.
        return parsedItem;
      }
      if (Array.isArray(defaultValue)) {
        if (!Array.isArray(parsedItem)) {
          console.warn(`Data for key "${key}" in localStorage should be an array but is not. Resetting to default.`);
          localStorage.setItem(key, JSON.stringify(defaultValue)); // Correct the stored value
          return defaultValue;
        }
      } else if (typeof parsedItem !== 'object' || parsedItem === null || Array.isArray(parsedItem)) {
        console.warn(`Data for key "${key}" in localStorage should be a non-null object but is not. Resetting to default.`);
        localStorage.setItem(key, JSON.stringify(defaultValue)); // Correct the stored value
        return defaultValue;
      }
    } else if (parsedType !== defaultType) {
      // For primitive types (string, number, boolean), types must match.
      console.warn(`Data for key "${key}" in localStorage has type "${parsedType}" but expected "${defaultType}". Resetting to default.`);
      localStorage.setItem(key, JSON.stringify(defaultValue)); // Correct the stored value
      return defaultValue;
    }

    return parsedItem;
  } catch (error: unknown) {
    console.error(`Error reading or parsing localStorage key "${key}":`, error);
    // If there's a JSON parsing error, the data is definitely corrupted.
    // Remove the bad item and return the default.
    localStorage.removeItem(key);
    return defaultValue;
  }
}


/**
 * Stores an item in localStorage after stringifying it to JSON.
 * @param key The key under which to store the item.
 * @param value The value to store.
 */
export function setLocalStorageItem<T>(key: string, value: T) {
  try {
    // Storing null or undefined should be handled correctly by stringify.
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error: unknown) {
    console.error(`Error writing localStorage key "${key}":`, error);
  }
}
