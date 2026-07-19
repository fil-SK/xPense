import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppContext } from '../App.jsx';
import CategoryManager from '../components/CategoryManager.jsx';

function renderCategoryManager(overrides = {}) {
  const archiveCategory = vi.fn();
  const deleteCategory = vi.fn();
  const updateCategory = vi.fn();
  const addCategory = vi.fn();
  const addCategoryGroup = vi.fn();
  const renameCategoryGroup = vi.fn();
  const deleteCategoryGroup = vi.fn();
  const updateCategoryGroupMembers = vi.fn();
  const ctx = {
    data: {
      expenses: [
        { id: '1', category: 'Hrana', title: 'test', amount: 100, date: '2026-01-01', note: '' },
        { id: '2', category: 'Hrana', title: 'test2', amount: 200, date: '2026-01-01', note: '' },
        { id: '3', category: 'Buket', title: 'buket', amount: 500, date: '2026-01-01', note: '' },
      ],
      categories: ['Hrana', 'Buket'],
      categoryGroups: [],
      ...overrides.data,
    },
    navigateTo: vi.fn(),
    addCategory,
    updateCategory,
    deleteCategory,
    archiveCategory,
    addCategoryGroup,
    renameCategoryGroup,
    deleteCategoryGroup,
    updateCategoryGroupMembers,
    ...overrides,
  };
  render(
    <AppContext.Provider value={ctx}>
      <CategoryManager />
    </AppContext.Provider>
  );
  return { archiveCategory, deleteCategory, updateCategory, addCategory, addCategoryGroup, renameCategoryGroup, deleteCategoryGroup, updateCategoryGroupMembers };
}

// ── Kategorije tab ────────────────────────────────────────────────────────────

describe('CategoryManager — archive vs delete', () => {
  test('clicking delete button reveals Arhiviraj and Obriši options', async () => {
    const user = userEvent.setup();
    renderCategoryManager();
    await user.click(screen.getAllByTitle('Ukloni kategoriju')[0]);
    expect(screen.getByRole('button', { name: /arhiviraj/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /obriši/i })).toBeInTheDocument();
  });

  test('Arhiviraj calls archiveCategory and not deleteCategory', async () => {
    const user = userEvent.setup();
    const { archiveCategory, deleteCategory } = renderCategoryManager();
    await user.click(screen.getAllByTitle('Ukloni kategoriju')[0]);
    await user.click(screen.getByRole('button', { name: /arhiviraj/i }));
    expect(archiveCategory).toHaveBeenCalledWith('Hrana');
    expect(deleteCategory).not.toHaveBeenCalled();
  });

  test('Obriši calls deleteCategory and not archiveCategory', async () => {
    const user = userEvent.setup();
    const { archiveCategory, deleteCategory } = renderCategoryManager();
    await user.click(screen.getAllByTitle('Ukloni kategoriju')[0]);
    await user.click(screen.getByRole('button', { name: /obriši/i }));
    expect(deleteCategory).toHaveBeenCalledWith('Hrana');
    expect(archiveCategory).not.toHaveBeenCalled();
  });

  test('confirm options disappear after choosing an action', async () => {
    const user = userEvent.setup();
    renderCategoryManager();
    await user.click(screen.getAllByTitle('Ukloni kategoriju')[0]);
    await user.click(screen.getByRole('button', { name: /arhiviraj/i }));
    expect(screen.queryByRole('button', { name: /arhiviraj/i })).not.toBeInTheDocument();
  });
});

describe('CategoryManager — usage count', () => {
  test('shows correct usage count per category', () => {
    renderCategoryManager();
    expect(screen.getByText('2 stavki')).toBeInTheDocument();
    expect(screen.getByText('1 stavki')).toBeInTheDocument();
  });
});

describe('CategoryManager — rename', () => {
  test('clicking ✏️ shows input pre-filled with current name', async () => {
    const user = userEvent.setup();
    renderCategoryManager();
    await user.click(screen.getAllByTitle('Preimenuj')[0]);
    expect(screen.getByDisplayValue('Hrana')).toBeInTheDocument();
  });

  test('saving a changed name calls updateCategory', async () => {
    const user = userEvent.setup();
    const { updateCategory } = renderCategoryManager();
    await user.click(screen.getAllByTitle('Preimenuj')[0]);
    const input = screen.getByDisplayValue('Hrana');
    await user.clear(input);
    await user.type(input, 'Namirnice');
    await user.click(screen.getByRole('button', { name: /sačuvaj/i }));
    expect(updateCategory).toHaveBeenCalledWith('Hrana', 'Namirnice');
  });

  test('pressing Escape cancels edit without saving', async () => {
    const user = userEvent.setup();
    const { updateCategory } = renderCategoryManager();
    await user.click(screen.getAllByTitle('Preimenuj')[0]);
    await user.keyboard('{Escape}');
    expect(updateCategory).not.toHaveBeenCalled();
    expect(screen.queryByDisplayValue('Hrana')).not.toBeInTheDocument();
  });
});

describe('CategoryManager — add', () => {
  test('typing a new name and pressing Enter calls addCategory', async () => {
    const user = userEvent.setup();
    const { addCategory } = renderCategoryManager();
    await user.type(screen.getByPlaceholderText(/ime nove kategorije/i), 'Transport{Enter}');
    expect(addCategory).toHaveBeenCalledWith('Transport');
  });

  test('does not call addCategory if name already exists', async () => {
    const user = userEvent.setup();
    const { addCategory } = renderCategoryManager();
    await user.type(screen.getByPlaceholderText(/ime nove kategorije/i), 'Hrana{Enter}');
    expect(addCategory).not.toHaveBeenCalled();
  });
});

// ── Grupe tab ─────────────────────────────────────────────────────────────────

const GROUP_DATA = {
  data: {
    expenses: [],
    categories: ['Hrana', 'Gorivo', 'Servis'],
    categoryGroups: [
      { id: 'g1', name: 'Namirnice', categories: ['Hrana'] },
      { id: 'g2', name: 'Auto', categories: ['Gorivo'] },
    ],
  },
};

async function openGroupsTab(user) {
  await user.click(screen.getByRole('button', { name: /grupe/i }));
}

describe('CategoryManager — Grupe tab navigation', () => {
  test('clicking Grupe tab shows groups content', async () => {
    const user = userEvent.setup();
    renderCategoryManager(GROUP_DATA);
    await openGroupsTab(user);
    expect(screen.getByText('Namirnice')).toBeInTheDocument();
    expect(screen.getByText('Auto')).toBeInTheDocument();
  });

  test('switching back to Kategorije tab shows category list', async () => {
    const user = userEvent.setup();
    renderCategoryManager(GROUP_DATA);
    await openGroupsTab(user);
    await user.click(screen.getByRole('button', { name: /kategorije/i }));
    expect(screen.getAllByTitle('Ukloni kategoriju').length).toBeGreaterThan(0);
  });
});

describe('CategoryManager — Grupe tab add/delete', () => {
  test('typing a group name and pressing Enter calls addCategoryGroup', async () => {
    const user = userEvent.setup();
    const { addCategoryGroup } = renderCategoryManager(GROUP_DATA);
    await openGroupsTab(user);
    await user.type(screen.getByPlaceholderText(/ime nove grupe/i), 'Zabava{Enter}');
    expect(addCategoryGroup).toHaveBeenCalledWith('Zabava');
  });

  test('clicking delete on a group calls deleteCategoryGroup with its id', async () => {
    const user = userEvent.setup();
    const { deleteCategoryGroup } = renderCategoryManager(GROUP_DATA);
    await openGroupsTab(user);
    const deleteButtons = screen.getAllByTitle('Obriši grupu');
    await user.click(deleteButtons[0]);
    expect(deleteCategoryGroup).toHaveBeenCalledWith('g1');
  });
});

describe('CategoryManager — Grupe tab expand and checkboxes', () => {
  test('clicking group header expands and shows category checkboxes', async () => {
    const user = userEvent.setup();
    renderCategoryManager(GROUP_DATA);
    await openGroupsTab(user);
    await user.click(screen.getByText('Namirnice'));
    const g1 = screen.getByTestId('group-g1');
    expect(within(g1).getAllByRole('checkbox').length).toBeGreaterThan(0);
  });

  test('checked category reflects group membership', async () => {
    const user = userEvent.setup();
    renderCategoryManager(GROUP_DATA);
    await openGroupsTab(user);
    await user.click(screen.getByText('Namirnice'));
    const g1 = screen.getByTestId('group-g1');
    expect(within(g1).getByRole('checkbox', { name: /hrana/i })).toBeChecked();
  });

  test('unchecked category in expanded group is not checked', async () => {
    const user = userEvent.setup();
    renderCategoryManager(GROUP_DATA);
    await openGroupsTab(user);
    await user.click(screen.getByText('Namirnice'));
    const g1 = screen.getByTestId('group-g1');
    expect(within(g1).getByRole('checkbox', { name: /servis/i })).not.toBeChecked();
  });

  test('checking a category calls updateCategoryGroupMembers', async () => {
    const user = userEvent.setup();
    const { updateCategoryGroupMembers } = renderCategoryManager(GROUP_DATA);
    await openGroupsTab(user);
    await user.click(screen.getByText('Namirnice'));
    const g1 = screen.getByTestId('group-g1');
    await user.click(within(g1).getByRole('checkbox', { name: /servis/i }));
    expect(updateCategoryGroupMembers).toHaveBeenCalledWith('g1', ['Hrana', 'Servis']);
  });

  test('unchecking a category calls updateCategoryGroupMembers without it', async () => {
    const user = userEvent.setup();
    const { updateCategoryGroupMembers } = renderCategoryManager(GROUP_DATA);
    await openGroupsTab(user);
    await user.click(screen.getByText('Namirnice'));
    const g1 = screen.getByTestId('group-g1');
    await user.click(within(g1).getByRole('checkbox', { name: /hrana/i }));
    expect(updateCategoryGroupMembers).toHaveBeenCalledWith('g1', []);
  });

  test('shows hint for categories already in another group', async () => {
    const user = userEvent.setup();
    renderCategoryManager(GROUP_DATA);
    await openGroupsTab(user);
    await user.click(screen.getByText('Namirnice'));
    const g1 = screen.getByTestId('group-g1');
    expect(within(g1).getByText(/← Auto/i)).toBeInTheDocument();
  });
});

describe('CategoryManager — Grupe tab rename', () => {
  test('clicking ✏️ on a group shows rename input', async () => {
    const user = userEvent.setup();
    renderCategoryManager(GROUP_DATA);
    await openGroupsTab(user);
    await user.click(screen.getAllByTitle('Preimenuj grupu')[0]);
    expect(screen.getByDisplayValue('Namirnice')).toBeInTheDocument();
  });

  test('saving rename calls renameCategoryGroup', async () => {
    const user = userEvent.setup();
    const { renameCategoryGroup } = renderCategoryManager(GROUP_DATA);
    await openGroupsTab(user);
    await user.click(screen.getAllByTitle('Preimenuj grupu')[0]);
    const input = screen.getByDisplayValue('Namirnice');
    await user.clear(input);
    await user.type(input, 'Hrana i piće');
    await user.click(screen.getByRole('button', { name: /sačuvaj/i }));
    expect(renameCategoryGroup).toHaveBeenCalledWith('g1', 'Hrana i piće');
  });
});
