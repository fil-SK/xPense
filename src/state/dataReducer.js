// The single reducer behind `data`. It owns no logic of its own — it routes an
// action to the domain slice that handles it, so adding a feature means adding
// one handler to one slice rather than another closure in App.jsx.

import { expenseHandlers } from './expensesSlice.js';
import { categoryHandlers } from './categoriesSlice.js';
import { budgetHandlers } from './budgetSlice.js';

const rootHandlers = {
  // Wholesale replacement: JSON import, undoing an import, and restoring the
  // backup file all land here.
  'data/replace': (_data, next) => next,
};

const handlers = {
  ...rootHandlers,
  ...expenseHandlers,
  ...categoryHandlers,
  ...budgetHandlers,
};

export const ACTION_TYPES = Object.keys(handlers);

export function dataReducer(data, action) {
  const handler = handlers[action.type];
  if (!handler) {
    // A typo in an action type would otherwise silently do nothing, which is
    // far harder to notice than a thrown error.
    throw new Error(`dataReducer: unknown action "${action.type}"`);
  }
  return handler(data, action.payload);
}
