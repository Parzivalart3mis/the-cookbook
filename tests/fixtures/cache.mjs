export const invalidations = [];
export function revalidatePath(path) { invalidations.push(path); }
