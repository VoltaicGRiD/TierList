// The tier list's data and every change that can be made to it. All
// functions are pure: they take a state and return a new one.

// <input type="color"> only accepts #rrggbb values, so colors are stored as hex.
const defaultTiers = [
  { letter: "S", backgroundColor: "#ff0000", textColor: "#ffffff" },
  { letter: "A", backgroundColor: "#ffa500", textColor: "#ffffff" },
  { letter: "B", backgroundColor: "#ffff00", textColor: "#000000" },
  { letter: "C", backgroundColor: "#008000", textColor: "#ffffff" },
  { letter: "D", backgroundColor: "#0000ff", textColor: "#ffffff" },
  { letter: "F", backgroundColor: "#800080", textColor: "#ffffff" },
];

export const makeDefaultState = () => ({
  title: "",
  tiers: defaultTiers.map((tier, index) => ({ ...tier, id: index, itemIds: [] })),
  items: {}, // keyed by item id
  unrankedIds: [], // items not placed in a tier yet, in display order
});

export const nextIdAfter = (ids) => Math.max(-1, ...ids.map(Number)) + 1;

// Fills in fields missing from older saves and drops item ids that point at
// items which no longer exist, so rendering never looks up a missing item.
// Items that aren't in any tier or the pool are put back in the pool so they
// can't get lost.
export function normalizeState(saved) {
  const items = saved.items && typeof saved.items === "object" && !Array.isArray(saved.items) ? saved.items : {};
  const existing = (ids) => (Array.isArray(ids) ? ids : []).filter((itemId) => itemId in items);
  const tiers = saved.tiers.map((tier) => ({ ...tier, itemIds: existing(tier.itemIds) }));
  const unrankedIds = existing(saved.unrankedIds);

  const placed = new Set([...tiers.flatMap((tier) => tier.itemIds), ...unrankedIds].map(String));
  const orphans = Object.values(items).map((item) => item.id).filter((id) => !placed.has(String(id)));

  return { ...saved, tiers, items, unrankedIds: [...unrankedIds, ...orphans] };
}

export const setTitle = (state, title) => ({ ...state, title });

export const addTier = (state, { letter, backgroundColor, textColor }) => ({
  ...state,
  tiers: [
    ...state.tiers,
    { id: nextIdAfter(state.tiers.map((tier) => tier.id)), letter, backgroundColor, textColor, itemIds: [] },
  ],
});

export const updateTier = (state, id, changes) => ({
  ...state,
  tiers: state.tiers.map((tier) => (tier.id === id ? { ...tier, ...changes } : tier)),
});

// Deleting a tier sends its items back to the unranked pool.
export function deleteTier(state, id) {
  const deleted = state.tiers.find((tier) => tier.id === id);
  return {
    ...state,
    tiers: state.tiers.filter((tier) => tier.id !== id),
    unrankedIds: [...state.unrankedIds, ...(deleted ? deleted.itemIds : [])],
  };
}

// Adds the item and puts it in the unranked pool in one step, so the state
// never has one without the other.
export const insertItem = (state, item) => ({
  ...state,
  items: { ...state.items, [item.id]: item },
  unrankedIds: [...state.unrankedIds, item.id],
});

export const insertItems = (state, newItems) => newItems.reduce(insertItem, state);

export const updateItem = (state, id, changes) => ({
  ...state,
  items: { ...state.items, [id]: { ...state.items[id], ...changes } },
});

// Moves an item into a tier, or the unranked pool when tierId is null. It's
// inserted before the item `beforeId`, or at the end if that's null or not
// in the row. It's removed from wherever it was first.
export function moveItem(state, itemId, tierId, beforeId = null) {
  if (beforeId === itemId) return state; // dropped onto its own position
  const without = (ids) => ids.filter((id) => id !== itemId);
  const placeIn = (ids) => {
    const rest = without(ids);
    const at = beforeId === null ? -1 : rest.indexOf(beforeId);
    return at === -1 ? [...rest, itemId] : [...rest.slice(0, at), itemId, ...rest.slice(at)];
  };
  return {
    ...state,
    tiers: state.tiers.map((tier) => ({
      ...tier,
      itemIds: tier.id === tierId ? placeIn(tier.itemIds) : without(tier.itemIds),
    })),
    unrankedIds: tierId === null ? placeIn(state.unrankedIds) : without(state.unrankedIds),
  };
}

// Moves several items, keeping their order, to the same spot.
export const moveItems = (state, itemIds, tierId, beforeId = null) =>
  itemIds.reduce((acc, id) => moveItem(acc, id, tierId, beforeId), state);
