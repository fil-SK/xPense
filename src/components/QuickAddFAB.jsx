import { useState } from 'react';
import { todayISO } from '../utils/helpers.js';
import ExpenseModal from './ExpenseModal.jsx';

export default function QuickAddFAB() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="fab"
        onClick={() => setOpen(true)}
        title="Dodaj trošak"
        aria-label="Dodaj trošak"
      >
        +
      </button>
      {open && (
        <ExpenseModal
          defaultDate={todayISO()}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
