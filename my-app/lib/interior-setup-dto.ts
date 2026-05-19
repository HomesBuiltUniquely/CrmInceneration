/**
 * Glead / Mlead interior setup — JSON uses camelCase (`interiorSetup`);
 * DB column is `interior_setup` (`@JsonProperty("interiorSetup")` on Java entities).
 * The request URL (`…/glead/…` vs `…/mlead/…`) selects the entity.
 */

/** Body for updating only interior setup (Glead or Mlead). */
export type InteriorSetupUpdateDto = {
  interiorSetup: string | null;
};

/** Optional: partial lead PUT — include this field when patching configuration only. */
export type GleadInteriorSetupPatch = Pick<InteriorSetupUpdateDto, "interiorSetup">;

export type MleadInteriorSetupPatch = Pick<InteriorSetupUpdateDto, "interiorSetup">;
