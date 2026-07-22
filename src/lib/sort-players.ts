/**
 * Player sort helpers used by the view switcher, dashboard, and adopt picker.
 *
 * Rule: the player record corresponding to the guide themselves (the
 * "guide-as-player", marked by `is_guide_player` in the players table) is
 * pinned to the top. Everyone else is sorted alphabetically by first name,
 * case-insensitive and locale-aware.
 *
 * The is_guide_player flag is set when player 1 is created during onboarding
 * signup. The 00014 migration backfilled it for existing accounts via a name
 * match against guide auth metadata. Pre-onboarding-redesign accounts that
 * never had a self-player simply have no flag set; the entire list sorts
 * alphabetically in that case.
 */

type FlaggedPlayer = {
  first_name: string
  is_guide_player?: boolean | null
}

export function sortPlayersGuideFirst<T extends FlaggedPlayer>(
  players: T[]
): { guidePlayer: T | null; sorted: T[] } {
  const guidePlayer = players.find((p) => p.is_guide_player === true) ?? null
  const others = players
    .filter((p) => p !== guidePlayer)
    .sort((a, b) =>
      a.first_name.localeCompare(b.first_name, undefined, { sensitivity: 'base' })
    )
  return {
    guidePlayer,
    sorted: guidePlayer ? [guidePlayer, ...others] : others,
  }
}
