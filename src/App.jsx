import {
  useState, useReducer, useEffect, useCallback, useMemo, useRef,
  createContext, useContext,
} from 'react';
import { loadData, saveData, hasStoredData, withDefaults } from './utils/storage.js';
import { generateRecurringExpenses, isEmptyData } from './utils/dataTransforms.js';
import { dataReducer } from './state/dataReducer.js';
import {
  getStoredHandle, checkPermission, grantPermission,
  readFromFile, writeToFile, pickFile,
} from './utils/fileStorage.js';
import Header from './components/Header.jsx';
import Home from './components/Home.jsx';
import MonthView from './components/MonthView.jsx';
import PreviousSpendings from './components/PreviousSpendings.jsx';
import CategoryManager from './components/CategoryManager.jsx';
import BudgetView from './components/BudgetView.jsx';
import GlobalSearch from './components/GlobalSearch.jsx';

export const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

const newId = () => crypto.randomUUID();

export default function App() {
  const [data, dispatch] = useReducer(dataReducer, undefined, loadData);
  const [view, setView] = useState('home');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [toast, setToast] = useState(null);
  const prevViewRef = useRef('home');
  const [prevView, setPrevView] = useState('home');
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('expense-tracker-theme') === 'dark';
  });
  const fileHandleRef = useRef(null);
  const [autosaveStatus, setAutosaveStatus] = useState('none');

  // Whether localStorage was empty when this session started has to be settled
  // during the initial render — once the save effect below fires, localStorage
  // always exists and the question can no longer be answered.
  // 'recovering' blocks all writes until we know whether the backup file needs
  // to be restored; 'ready' means localStorage and the file may be written.
  const [bootState, setBootState] = useState(() => (hasStoredData() ? 'ready' : 'recovering'));
  const recoveryPendingRef = useRef(bootState === 'recovering');

  // Lets async callbacks read the latest data without depending on it.
  const dataRef = useRef(data);
  useEffect(() => { dataRef.current = data; }, [data]);

  // `action` renders a button inside the toast (e.g. undo) and keeps it up
  // longer, since it needs to be read and clicked rather than just noticed.
  const toastTimerRef = useRef(null);
  const showToast = useCallback((msg, type = 'success', { action = null, duration } = {}) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ msg, type, action });
    toastTimerRef.current = setTimeout(() => setToast(null), duration ?? (action ? 9000 : 2800));
  }, []);

  useEffect(() => () => clearTimeout(toastTimerRef.current), []);

  // ── Undo ──────────────────────────────────────────────────────────────────
  // Deleting is a single click everywhere; the way back is this toast, not a
  // second click on the same button. Two-click confirms taxed every delete —
  // including the overwhelming majority the user meant — to guard the rare
  // misclick, and they still lost the record once the second click landed.
  //
  // `keys` names the top-level data fields the delete touched. Undo restores
  // only those (see 'data/restore'), so anything the user changed elsewhere in
  // the ~9s the toast is up is not rolled back with it. Pass every field the
  // handler writes: deleting an expense also appends to the parent template's
  // skippedMonths, so it owns `recurrings` as well as `expenses`.
  const deleteWithUndo = useCallback((keys, run, msg, undoMsg, type = 'danger') => {
    const snapshot = dataRef.current;
    run();
    showToast(msg, type, {
      action: {
        label: 'Poništi',
        onClick: () => {
          dispatch({ type: 'data/restore', payload: { snapshot, keys } });
          showToast(undoMsg);
        },
      },
    });
  }, [showToast]);

  // ── Persistence ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (bootState !== 'ready') return;
    saveData(data);
  }, [data, bootState]);

  useEffect(() => {
    if (bootState !== 'ready' || !fileHandleRef.current || autosaveStatus !== 'active') return;
    writeToFile(fileHandleRef.current, data).catch(() => setAutosaveStatus('error'));
  }, [data, autosaveStatus, bootState]);

  // Restores the backup file into state. Throws when the file can't be read or
  // isn't a valid export — callers must leave autosave off in that case, or the
  // write effect would overwrite the backup with empty data.
  const recoverFromFile = useCallback(async (handle) => {
    recoveryPendingRef.current = false;
    const fileData = await readFromFile(handle);
    if (!fileData || !Array.isArray(fileData.expenses)) {
      throw new Error('invalid backup');
    }
    // Never replace work the user has already entered while we were reading.
    if (!isEmptyData(dataRef.current)) return false;
    dispatch({ type: 'data/replace', payload: withDefaults(fileData) });
    return true;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      let handle = null;
      try {
        handle = await getStoredHandle();
      } catch {
        handle = null;
      }
      if (cancelled) return;

      if (!handle) {
        recoveryPendingRef.current = false;
        setBootState('ready');
        return;
      }
      fileHandleRef.current = handle;

      let perm = 'denied';
      try {
        perm = await checkPermission(handle);
      } catch {
        perm = 'denied';
      }
      if (cancelled) return;

      // Without permission we can't read the file yet. Let the app save to
      // localStorage normally; recovery is retried when the user grants access.
      if (perm !== 'granted') {
        setAutosaveStatus('prompt');
        setBootState('ready');
        return;
      }

      // localStorage is the source of truth; the file is only read back when
      // localStorage was wiped (recovery mode).
      if (!recoveryPendingRef.current) {
        setAutosaveStatus('active');
        setBootState('ready');
        return;
      }

      try {
        const restored = await recoverFromFile(handle);
        if (cancelled) return;
        setAutosaveStatus('active');
        setBootState('ready');
        if (restored) showToast('Podaci vraćeni iz backup fajla.');
      } catch {
        if (cancelled) return;
        setAutosaveStatus('error');
        setBootState('ready');
        showToast('Backup fajl se ne može pročitati — autosave je isključen.', 'danger');
      }
    }

    init();
    return () => { cancelled = true; };
  }, [recoverFromFile, showToast]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('expense-tracker-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('expense-tracker-theme', 'light');
    }
  }, [darkMode]);

  // Fills in any month a recurring template still owes. Ids are minted here so
  // the reducer handler stays pure. Runs on every startup, which is why
  // deletions are remembered on the template (see skippedMonths).
  useEffect(() => {
    if (!data.recurrings?.length) return;
    const generated = generateRecurringExpenses(data.recurrings, data.expenses, new Date());
    if (generated.length === 0) return;
    dispatch({
      type: 'expense/addGenerated',
      payload: generated.map((e) => ({ ...e, id: newId() })),
    });
  }, [data.recurrings]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Autosave wiring ───────────────────────────────────────────────────────

  const setupAutosave = useCallback(async () => {
    try {
      const handle = await pickFile();
      fileHandleRef.current = handle;
      // The user chose the target explicitly — current state wins over whatever
      // that file held, so there is nothing left to recover.
      recoveryPendingRef.current = false;
      setAutosaveStatus('active');
      showToast('Autosave podešen — podaci će se automatski čuvati.');
    } catch (e) {
      if (e.name !== 'AbortError') showToast('Greška pri podešavanju autosave.', 'danger');
    }
  }, [showToast]);

  const activateAutosave = useCallback(async () => {
    try {
      const perm = await grantPermission(fileHandleRef.current);
      if (perm !== 'granted') {
        showToast('Dozvola odbijena.', 'danger');
        return;
      }
      // Permission arrived late — this is the first chance to recover.
      if (recoveryPendingRef.current) {
        try {
          const restored = await recoverFromFile(fileHandleRef.current);
          showToast(restored ? 'Podaci vraćeni iz backup fajla.' : 'Autosave aktiviran.');
        } catch {
          setAutosaveStatus('error');
          showToast('Backup fajl se ne može pročitati — autosave je isključen.', 'danger');
          return;
        }
      } else {
        showToast('Autosave aktiviran.');
      }
      setAutosaveStatus('active');
    } catch {
      showToast('Greška pri aktivaciji autosave.', 'danger');
    }
  }, [showToast, recoverFromFile]);

  // ── Navigation and theme ──────────────────────────────────────────────────

  const navigateTo = useCallback((v, year, month) => {
    setPrevView(prevViewRef.current);
    prevViewRef.current = v;
    setView(v);
    if (year != null) setSelectedYear(year);
    if (month != null) setSelectedMonth(month);
  }, []);

  const toggleDarkMode = useCallback(() => setDarkMode((v) => !v), []);

  // ── Actions ───────────────────────────────────────────────────────────────
  // Thin wrappers over dispatch: they mint ids, raise toasts, and nothing else.
  // `dispatch`, `showToast` and `deleteWithUndo` are all stable, so this object
  // is built once — which is what keeps the context value from changing on
  // every render.

  const actions = useMemo(() => ({
    addExpense: (expense) => {
      dispatch({ type: 'expense/add', payload: { ...expense, id: newId() } });
      showToast('Trošak dodat.');
    },
    updateExpense: (id, updates) => {
      dispatch({ type: 'expense/update', payload: { id, updates } });
      showToast('Trošak izmenjen.');
    },
    // A generated row also writes skippedMonths on its template, so undoing it
    // has to lift that too — otherwise the row comes back only to be skipped
    // out again on the next generation pass. A hand-entered expense touches
    // nothing but `expenses`, and claiming `recurrings` there would roll back a
    // template added while the toast was up.
    deleteExpense: (id) => {
      const wasGenerated = !!dataRef.current.expenses.find((e) => e.id === id)?.recurringId;
      deleteWithUndo(
        wasGenerated ? ['expenses', 'recurrings'] : ['expenses'],
        () => dispatch({ type: 'expense/delete', payload: { id } }),
        wasGenerated ? 'Trošak obrisan — neće biti ponovo kreiran.' : 'Trošak obrisan.',
        'Trošak vraćen.'
      );
    },

    addRecurring: (recurring) =>
      dispatch({ type: 'recurring/add', payload: { ...recurring, id: newId() } }),
    // Only the template changes; the months it already produced keep their
    // values, so the toast says when the new ones take effect.
    updateRecurring: (id, updates) => {
      dispatch({ type: 'recurring/update', payload: { id, updates } });
      showToast('Ponavljajući trošak izmenjen — važi od sledećeg meseca.');
    },
    deleteRecurring: (id) => {
      deleteWithUndo(
        ['recurrings'],
        () => dispatch({ type: 'recurring/delete', payload: { id } }),
        'Ponavljajući trošak uklonjen.',
        'Ponavljajući trošak vraćen.'
      );
    },

    setMonthlyNote: (year, month, text) =>
      dispatch({ type: 'note/set', payload: { year, month, text } }),

    addCategory: (name) => {
      dispatch({ type: 'category/add', payload: { name } });
      showToast(`Kategorija "${name}" dodata.`);
    },
    updateCategory: (oldName, newName) => {
      dispatch({ type: 'category/rename', payload: { oldName, newName } });
      showToast('Kategorija preimenovana.');
    },
    // Deleting a category rewrites every expense that used it to "Ostalo", so
    // `expenses` is part of what undo has to put back, not just the name.
    deleteCategory: (name) => {
      deleteWithUndo(
        ['categories', 'categoryGroups', 'expenses'],
        () => dispatch({ type: 'category/delete', payload: { name } }),
        'Kategorija obrisana.',
        `Kategorija "${name}" vraćena.`
      );
    },
    archiveCategory: (name) => {
      deleteWithUndo(
        ['categories', 'categoryGroups'],
        () => dispatch({ type: 'category/archive', payload: { name } }),
        `Kategorija "${name}" arhivirana.`,
        `Kategorija "${name}" vraćena.`,
        'success'
      );
    },

    addCategoryGroup: (name) =>
      dispatch({ type: 'group/add', payload: { id: newId(), name } }),
    renameCategoryGroup: (id, name) =>
      dispatch({ type: 'group/rename', payload: { id, name } }),
    deleteCategoryGroup: (id) => {
      deleteWithUndo(
        ['categoryGroups'],
        () => dispatch({ type: 'group/delete', payload: { id } }),
        'Grupa obrisana.',
        'Grupa vraćena.'
      );
    },
    updateCategoryGroupMembers: (groupId, members) =>
      dispatch({ type: 'group/setMembers', payload: { groupId, members } }),

    updateBudgetIncome: (year, field, monthIdx, value) =>
      dispatch({ type: 'budget/setIncome', payload: { year, field, monthIdx, value } }),
    updateBudgetIncomeRow: (year, rowId, monthIdx, value) =>
      dispatch({ type: 'budget/setIncomeRowAmount', payload: { year, rowId, monthIdx, value } }),
    addBudgetIncomeRow: (year, name) =>
      dispatch({
        type: 'budget/addIncomeRow',
        payload: { year, row: { id: newId(), name, amounts: Array(12).fill(null) } },
      }),
    // Nothing but `budget` holds an income row — trackingMaps only maps funds.
    removeBudgetIncomeRow: (year, rowId) => {
      deleteWithUndo(
        ['budget'],
        () => dispatch({ type: 'budget/removeIncomeRow', payload: { year, rowId } }),
        'Prihod obrisan.',
        'Prihod vraćen.'
      );
    },
    renameBudgetIncomeRow: (year, rowId, name) =>
      dispatch({ type: 'budget/renameIncomeRow', payload: { year, rowId, name } }),
    updateBudgetFund: (year, fundId, monthIdx, value) =>
      dispatch({ type: 'budget/setFundAmount', payload: { year, fundId, monthIdx, value } }),
    addBudgetFund: (year, name) =>
      dispatch({
        type: 'budget/addFund',
        payload: { year, fund: { id: newId(), name, amounts: Array(12).fill(null) } },
      }),
    // A fund row is twelve amounts plus whatever categories were mapped to it,
    // so undo covers `trackingMaps` alongside `budget`.
    removeBudgetFund: (year, fundId) => {
      deleteWithUndo(
        ['budget', 'trackingMaps'],
        () => dispatch({ type: 'budget/removeFund', payload: { year, fundId } }),
        'Red obrisan.',
        'Red vraćen.'
      );
    },
    renameBudgetFund: (year, fundId, name) =>
      dispatch({ type: 'budget/renameFund', payload: { year, fundId, name } }),
    reorderBudgetFunds: (year, orderedIds) =>
      dispatch({ type: 'budget/reorderFunds', payload: { year, orderedIds } }),
    copyBudgetToYear: (fromYear, toYear) =>
      dispatch({ type: 'budget/copyToYear', payload: { fromYear, toYear } }),
    updateTrackingMap: (year, fundId, categories) =>
      dispatch({ type: 'tracking/set', payload: { year, fundId, categories } }),

    addSavingsGoal: (goal) => {
      dispatch({ type: 'goal/add', payload: { ...goal, id: newId() } });
      showToast('Cilj dodat.');
    },
    updateSavingsGoal: (id, updates) => {
      dispatch({ type: 'goal/update', payload: { id, updates } });
      showToast('Cilj izmenjen.');
    },
    deleteSavingsGoal: (id) => {
      deleteWithUndo(
        ['savingsGoals'],
        () => dispatch({ type: 'goal/delete', payload: { id } }),
        'Cilj obrisan.',
        'Cilj vraćen.'
      );
    },

    // Not routed through deleteWithUndo: import is the one action that replaces
    // *every* field, including ones the incoming file doesn't mention, so undo
    // here has to be a wholesale replace rather than a per-field restore.
    importData: (imported, { skipped = 0 } = {}) => {
      // Import replaces everything, so keep the previous state reachable for as
      // long as the toast is up.
      const snapshot = dataRef.current;
      dispatch({ type: 'data/replace', payload: imported });
      showToast(
        skipped > 0
          ? `Podaci uvezeni — ${skipped} stavki preskočeno.`
          : 'Podaci uvezeni uspešno.',
        'success',
        {
          action: {
            label: 'Poništi',
            onClick: () => {
              dispatch({ type: 'data/replace', payload: snapshot });
              showToast('Uvoz poništen.', 'danger');
            },
          },
        }
      );
    },
    importBudgetData: (budget) => {
      dispatch({ type: 'budget/import', payload: { budget } });
      showToast('Budžet uvezen uspešno.');
    },
  }), [showToast, deleteWithUndo]);

  const ctx = useMemo(() => ({
    data,
    view,
    prevView,
    selectedYear,
    selectedMonth,
    darkMode,
    autosaveStatus,
    navigateTo,
    toggleDarkMode,
    setupAutosave,
    activateAutosave,
    showToast,
    ...actions,
  }), [
    data, view, prevView, selectedYear, selectedMonth, darkMode, autosaveStatus,
    navigateTo, toggleDarkMode, setupAutosave, activateAutosave, showToast, actions,
  ]);

  return (
    <AppContext.Provider value={ctx}>
      <div className="app">
        <Header />
        <main className="main">
          {view === 'home' && <Home />}
          {view === 'current' && (
            <MonthView
              year={new Date().getFullYear()}
              month={new Date().getMonth()}
              isCurrent
            />
          )}
          {view === 'previous' && <PreviousSpendings />}
          {view === 'month' && (
            <MonthView year={selectedYear} month={selectedMonth} />
          )}
          {view === 'categories' && <CategoryManager />}
          {view === 'budget' && <BudgetView />}
          {view === 'search' && <GlobalSearch />}
        </main>

        {toast && (
          // The toast is now the only feedback a delete gives, and the only
          // route back from one — a screen reader user has to hear it arrive.
          <div className={`toast toast--${toast.type}`} role="status">
            <span>{toast.type === 'success' ? '✓' : '✕'} {toast.msg}</span>
            {toast.action && (
              <button
                className="toast__action"
                onClick={() => {
                  const dismissed = toast;
                  toast.action.onClick();
                  // Only clear if the action didn't raise a toast of its own,
                  // which would otherwise be wiped out immediately.
                  setToast((t) => (t === dismissed ? null : t));
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </AppContext.Provider>
  );
}
