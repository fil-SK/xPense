import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ImportConfirmModal from '../components/ImportConfirmModal.jsx';

const current = {
  expenses: [{ id: '1' }, { id: '2' }, { id: '3' }],
  categories: ['Hrana', 'Transport'],
  budget: { 2025: {}, 2026: {} },
  recurrings: [{ id: 'r1' }],
  savingsGoals: [],
};

const incoming = {
  expenses: [{ id: 'a' }],
  categories: ['Hrana'],
  budget: {},
  recurrings: [],
  savingsGoals: [{ id: 'g1' }],
};

function renderModal(props = {}) {
  const onCancel = vi.fn();
  const onConfirm = vi.fn();
  render(
    <ImportConfirmModal
      current={current}
      incoming={incoming}
      skipped={0}
      onCancel={onCancel}
      onConfirm={onConfirm}
      {...props}
    />
  );
  return { onCancel, onConfirm };
}

function rowFor(label) {
  return screen.getByText(label).closest('tr');
}

describe('ImportConfirmModal', () => {
  test('warns that the import replaces everything', () => {
    renderModal();
    expect(screen.getByText(/zamenjuje sve trenutne podatke/i)).toBeInTheDocument();
  });

  test('shows current and incoming counts side by side', () => {
    renderModal();
    const cells = within(rowFor('Troškovi')).getAllByRole('cell');
    expect(cells[1]).toHaveTextContent('3');
    expect(cells[2]).toHaveTextContent('1');
  });

  test('counts budget years and savings goals', () => {
    renderModal();
    expect(within(rowFor('Godine budžeta')).getAllByRole('cell')[1]).toHaveTextContent('2');
    expect(within(rowFor('Ciljevi štednje')).getAllByRole('cell')[2]).toHaveTextContent('1');
  });

  test('flags counts that shrink', () => {
    renderModal();
    const after = within(rowFor('Troškovi')).getAllByRole('cell')[2];
    expect(after).toHaveClass('import-table__num--loss');
  });

  test('does not flag counts that grow', () => {
    renderModal();
    const after = within(rowFor('Ciljevi štednje')).getAllByRole('cell')[2];
    expect(after).not.toHaveClass('import-table__num--loss');
  });

  test('hides the skipped warning when nothing was skipped', () => {
    renderModal();
    expect(screen.queryByText(/preskočen/i)).not.toBeInTheDocument();
  });

  test('reports skipped rows when there are any', () => {
    renderModal({ skipped: 4 });
    expect(screen.getByText(/4 stavki je preskočeno/i)).toBeInTheDocument();
  });

  test('uses singular wording for one skipped row', () => {
    renderModal({ skipped: 1 });
    expect(screen.getByText(/1 stavka je preskočena/i)).toBeInTheDocument();
  });

  test('confirming calls onConfirm', async () => {
    const user = userEvent.setup();
    const { onConfirm, onCancel } = renderModal();
    await user.click(screen.getByRole('button', { name: /zameni podatke/i }));
    expect(onConfirm).toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  test('cancelling calls onCancel and not onConfirm', async () => {
    const user = userEvent.setup();
    const { onConfirm, onCancel } = renderModal();
    await user.click(screen.getByRole('button', { name: /otkaži/i }));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  test('Escape cancels', async () => {
    const user = userEvent.setup();
    const { onCancel, onConfirm } = renderModal();
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
