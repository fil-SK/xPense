// Categories and the groups they belong to. Category names are the join key
// between expenses, groups and tracking maps, so renaming or removing one has
// to fan out — that fan-out is the reason these live together in one slice.

// Where expenses land when their category is deleted outright.
const FALLBACK_CATEGORY = 'Ostalo';

const withoutCategory = (groups, name) =>
  (groups ?? []).map((g) => ({ ...g, categories: g.categories.filter((c) => c !== name) }));

export const categoryHandlers = {
  'category/add': (data, { name }) => ({
    ...data,
    categories: [...data.categories, name],
  }),

  'category/rename': (data, { oldName, newName }) => ({
    ...data,
    categories: data.categories.map((c) => (c === oldName ? newName : c)),
    categoryGroups: (data.categoryGroups ?? []).map((g) => ({
      ...g,
      categories: g.categories.map((c) => (c === oldName ? newName : c)),
    })),
    expenses: data.expenses.map((e) =>
      e.category === oldName ? { ...e, category: newName } : e
    ),
  }),

  // Delete: the name disappears and its expenses are reassigned.
  'category/delete': (data, { name }) => ({
    ...data,
    categories: data.categories.filter((c) => c !== name),
    categoryGroups: withoutCategory(data.categoryGroups, name),
    expenses: data.expenses.map((e) =>
      e.category === name ? { ...e, category: FALLBACK_CATEGORY } : e
    ),
  }),

  // Archive: the name leaves the pickable list, but past expenses keep it.
  'category/archive': (data, { name }) => ({
    ...data,
    categories: data.categories.filter((c) => c !== name),
    categoryGroups: withoutCategory(data.categoryGroups, name),
  }),

  'group/add': (data, { id, name }) => ({
    ...data,
    categoryGroups: [...(data.categoryGroups ?? []), { id, name, categories: [] }],
  }),

  'group/rename': (data, { id, name }) => ({
    ...data,
    categoryGroups: (data.categoryGroups ?? []).map((g) => (g.id === id ? { ...g, name } : g)),
  }),

  'group/delete': (data, { id }) => ({
    ...data,
    categoryGroups: (data.categoryGroups ?? []).filter((g) => g.id !== id),
  }),

  // A category belongs to at most one group, so adding it here removes it
  // from wherever else it was.
  'group/setMembers': (data, { groupId, members }) => ({
    ...data,
    categoryGroups: (data.categoryGroups ?? []).map((g) =>
      g.id === groupId
        ? { ...g, categories: members }
        : { ...g, categories: g.categories.filter((c) => !members.includes(c)) }
    ),
  }),
};
