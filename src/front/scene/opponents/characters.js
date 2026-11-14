/**
 * characters.js — What each AI opponent looks like
 *
 * Models come from Quaternius' Ultimate Animated Character Pack (CC0), the
 * pack of the dealer: every character shares his skeleton and animations
 * (SitDown, Victory, Defeat, RecieveHit, Punch, Death…), so Opponents.js
 * works with any of them.
 *
 * For now every opponent uses the dealer's Cowboy_Male as a stand-in,
 * recoloured by material name. To use a real model, drop its .gltf in
 * public/models/characters/ and set `model` (and remove or adapt `colors`:
 * other characters have other material names).
 * Planned: Le Baron → Suit_Male, Lucky Lou → Cowboy_Hair,
 * Madame Rouge → Suit_Female (in red), Doc Holliday → OldClassy_Male.
 */

const STAND_IN = '/models/dealer/Cowboy_Male.gltf';

/**
 * @typedef {{ model: string, colors?: Record<string, number> }} Look
 * colors: material name → new colour (Cowboy_Male's materials: Skin, Jacket,
 * Top, Scarf, HatBrown, HatLightBrown, Pants, Hair, Face = the eyes)
 */

/** @type {Record<string, Look>} */
export const LOOKS = {
  'Le Baron': {
    model: STAND_IN,
    colors: {
      Skin: 0xf0c4a0, Jacket: 0x2a2a38, Top: 0xece4d2, Scarf: 0x7a1f2b,
      HatBrown: 0x1b1b22, HatLightBrown: 0x7a1f2b, Pants: 0x23232d, Hair: 0xc8c8c8,
    },
  },
  'Lucky Lou': {
    model: STAND_IN,
    colors: {
      Skin: 0xc68a5c, Jacket: 0x2f7a3a, Top: 0xe8c860, Scarf: 0xf2b632,
      HatBrown: 0xd9c29a, HatLightBrown: 0x6b3f22, Pants: 0x3b5a8a, Hair: 0x3a2414,
    },
  },
  'Madame Rouge': {
    model: STAND_IN,
    colors: {
      Skin: 0xf3d0b5, Jacket: 0xb3261e, Top: 0x1a1a1a, Scarf: 0xf2e6c8,
      HatBrown: 0xb3261e, HatLightBrown: 0x1a1a1a, Pants: 0x7a1a14, Hair: 0x1a1a1a,
    },
  },
  'Doc Holliday': {
    model: STAND_IN,
    colors: {
      Skin: 0xe8b88f, Jacket: 0x3a3f4a, Top: 0xd8d0c0, Scarf: 0x2a2a2a,
      HatBrown: 0x2a2a2a, HatLightBrown: 0x5a5a5a, Pants: 0x2b2b30, Hair: 0xc9a36a,
    },
  },
};

/** Anyone not listed above (renamed opponents…) */
export const DEFAULT_LOOK = { model: STAND_IN };

/** @param {string} name */
export function lookFor(name) {
  return LOOKS[name] ?? DEFAULT_LOOK;
}
