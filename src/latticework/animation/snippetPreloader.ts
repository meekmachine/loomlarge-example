/**
 * Preloads animation snippets from the bundled JSON files into localStorage.
 * This enables the PlaybackControls dropdown menus to list available snippets.
 *
 * Call preloadAllSnippets() once at app startup (e.g., in main.tsx or App.tsx).
 */

// Use Vite's import.meta.glob to statically import all snippet JSON files
const emotionSnippets = import.meta.glob('./snippets/emotion/*.json', { eager: true }) as Record<string, { default?: unknown } | unknown>;
const speakingSnippets = import.meta.glob('./snippets/speaking/*.json', { eager: true }) as Record<string, { default?: unknown } | unknown>;
const visemeSnippets = import.meta.glob('./snippets/visemes/*.json', { eager: true }) as Record<string, { default?: unknown } | unknown>;
const eyeHeadTrackingSnippets = import.meta.glob('./snippets/eyeHeadTracking/*.json', { eager: true }) as Record<string, { default?: unknown } | unknown>;

interface SnippetCategory {
  listKey: string;  // localStorage key for the list of snippet names
  storePrefix: string;  // localStorage key prefix for individual snippets
  modules: Record<string, { default?: unknown } | unknown>;
}

const CATEGORIES: SnippetCategory[] = [
  { listKey: 'emotionAnimationsList', storePrefix: 'emotionAnimationsList', modules: emotionSnippets },
  { listKey: 'speakingAnimationsList', storePrefix: 'speakingAnimationsList', modules: speakingSnippets },
  { listKey: 'visemeAnimationsList', storePrefix: 'visemeAnimationsList', modules: visemeSnippets },
  { listKey: 'eyeHeadTrackingAnimationsList', storePrefix: 'eyeHeadTrackingAnimationsList', modules: eyeHeadTrackingSnippets },
];

/**
 * Extract the snippet name from a file path like "./snippets/emotion/happy.json" -> "happy"
 */
function extractName(filePath: string): string {
  const parts = filePath.split('/');
  const filename = parts[parts.length - 1];
  return filename.replace('.json', '');
}

/**
 * Preload all animation snippets from bundled JSON files into localStorage.
 * This makes them available to PlaybackControls dropdown menus.
 */
export function preloadAllSnippets(): void {
  for (const category of CATEGORIES) {
    const names: string[] = [];

    for (const [filePath, moduleData] of Object.entries(category.modules)) {
      const snippetName = extractName(filePath);
      // Handle both ESM default exports and direct objects
      const snippetData = (moduleData as { default?: unknown }).default ?? moduleData;

      if (snippetData && typeof snippetData === 'object') {
        // Store individual snippet
        const key = `${category.storePrefix}/${snippetName}`;
        localStorage.setItem(key, JSON.stringify(snippetData));
        names.push(snippetName);
      }
    }

    // Store the list of snippet names for this category
    localStorage.setItem(category.listKey, JSON.stringify(names));
  }

  console.log('[snippetPreloader] Preloaded animation snippets to localStorage');
}

/**
 * Clear all preloaded snippets from localStorage.
 * Useful for debugging or resetting state.
 */
export function clearPreloadedSnippets(): void {
  for (const category of CATEGORIES) {
    // Get the list of names first
    const namesStr = localStorage.getItem(category.listKey);
    if (namesStr) {
      try {
        const names = JSON.parse(namesStr) as string[];
        for (const name of names) {
          localStorage.removeItem(`${category.storePrefix}/${name}`);
        }
      } catch {}
    }
    localStorage.removeItem(category.listKey);
  }
  console.log('[snippetPreloader] Cleared all preloaded snippets from localStorage');
}
