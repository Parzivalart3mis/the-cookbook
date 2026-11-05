/** A single configured owner. Missing configuration grants nobody access. */
export function isOwnerUser(userId: string | null | undefined): boolean {
  const owner = process.env.COOKBOOK_OWNER_USER_ID?.trim();
  return !!owner && !!userId && userId === owner;
}
