/**
 * Whether to show planner controls: signed in as a planner and, inside a wedding's URLs,
 * looking at the wedding they plan (anyone else's wedding shows the guest view). Outside a
 * wedding (`weddingSlug` null) it only says whether a planner is signed in.
 */
export function showsPlannerControls(plannerSlug: string | null, weddingSlug: string | null) {
  return plannerSlug !== null && (weddingSlug === null || weddingSlug === plannerSlug)
}
