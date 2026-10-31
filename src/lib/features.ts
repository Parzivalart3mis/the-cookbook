/**
 * Feature switches. A feature that is off keeps all of its code, pages and API
 * routes, but every way into it is hidden from the UI, and its pages return 404.
 * Flip a flag back to `true` to bring the feature back as it was.
 */
export const FEATURES = {
  shoppingList: false,
  mealPlanner: false,
  timeline: false,
} as const;
