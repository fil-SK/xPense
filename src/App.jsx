import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import { loadData, saveData } from './utils/storage.js';
import { generateRecurringExpenses, applyBudgetCopy } from './utils/dataTransforms.js';
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

export default function App() {
  const [data, setData] = useState(() => loadData());
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

  useEffect(() => { saveData(data); }, [data]);

  useEffect(() => {
    if (!fileHandleRef.current || autosaveStatus !== 'active') return;
    writeToFile(fileHandleRef.current, data).catch(() => setAutosaveStatus('error'));
  }, [data, autosaveStatus]);

  useEffect(() => {
    async function init() {
      const handle = await getStoredHandle();
      if (!handle) return;
      const perm = await checkPermission(handle);
      if (perm === 'granted') {
        fileHandleRef.current = handle;
        // Only load from file when localStorage was wiped (recovery mode).
        // Normally localStorage is the source of truth; file is the backup.
        const localStorageMissing = localStorage.getItem('expense-tracker-v1') === null;
        if (localStorageMissing) {
          try {
            const fileData = await readFromFile(handle);
            if (fileData && Array.isArray(fileData.expenses)) {
              setData({
                expenses: fileData.expenses ?? [],
                categories: fileData.categories ?? [],
                budget: fileData.budget ?? {},
                trackingMaps: fileData.trackingMaps ?? {},
                recurrings: fileData.recurrings ?? [],
                monthlyNotes: fileData.monthlyNotes ?? {},
                savingsGoals: fileData.savingsGoals ?? [],
                categoryGroups: fileData.categoryGroups ?? [],
              });
            }
          } catch { }
        }
        setAutosaveStatus('active');
      } else {
        fileHandleRef.current = handle;
        setAutosaveStatus('prompt');
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('expense-tracker-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('expense-tracker-theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    if (!data.recurrings?.length) return;
    const now = new Date();
    setData((d) => {
      if (!d.recurrings?.length) return d;
      const generated = generateRecurringExpenses(d.recurrings, d.expenses, now);
      if (generated.length === 0) return d;
      const withIds = generated.map((e) => ({ ...e, id: crypto.randomUUID() }));
      return { ...d, expenses: [...d.expenses, ...withIds] };
    });
  }, [data.recurrings]); // eslint-disable-line react-hooks/exhaustive-deps

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  }, []);

  const setupAutosave = useCallback(async () => {
    try {
      const handle = await pickFile();
      fileHandleRef.current = handle;
      setAutosaveStatus('active');
      showToast('Autosave podešen — podaci će se automatski čuvati.');
    } catch (e) {
      if (e.name !== 'AbortError') showToast('Greška pri podešavanju autosave.', 'danger');
    }
  }, [showToast]);

  const activateAutosave = useCallback(async () => {
    try {
      const perm = await grantPermission(fileHandleRef.current);
      if (perm === 'granted') {
        setAutosaveStatus('active');
        showToast('Autosave aktiviran.');
      } else {
        showToast('Dozvola odbijena.', 'danger');
      }
    } catch {
      showToast('Greška pri aktivaciji autosave.', 'danger');
    }
  }, [showToast]);

  const navigateTo = useCallback((v, year, month) => {
    setPrevView(prevViewRef.current);
    prevViewRef.current = v;
    setView(v);
    if (year != null) setSelectedYear(year);
    if (month != null) setSelectedMonth(month);
  }, []);

  const addExpense = useCallback((expense) => {
    setData((d) => ({
      ...d,
      expenses: [...d.expenses, { ...expense, id: crypto.randomUUID() }],
    }));
    showToast('Trošak dodat.');
  }, [showToast]);

  const updateExpense = useCallback((id, updates) => {
    setData((d) => ({
      ...d,
      expenses: d.expenses.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    }));
    showToast('Trošak izmenjen.');
  }, [showToast]);

  const deleteExpense = useCallback((id) => {
    setData((d) => ({ ...d, expenses: d.expenses.filter((e) => e.id !== id) }));
    showToast('Trošak obrisan.', 'danger');
  }, [showToast]);

  const addCategory = useCallback((name) => {
    setData((d) => ({ ...d, categories: [...d.categories, name] }));
    showToast(`Kategorija "${name}" dodata.`);
  }, [showToast]);

  const updateCategory = useCallback((oldName, newName) => {
    setData((d) => ({
      ...d,
      categories: d.categories.map((c) => (c === oldName ? newName : c)),
      categoryGroups: (d.categoryGroups ?? []).map((g) => ({
        ...g, categories: g.categories.map((c) => (c === oldName ? newName : c)),
      })),
      expenses: d.expenses.map((e) =>
        e.category === oldName ? { ...e, category: newName } : e
      ),
    }));
    showToast(`Kategorija preimenovana.`);
  }, [showToast]);

  const deleteCategory = useCallback((name) => {
    setData((d) => ({
      ...d,
      categories: d.categories.filter((c) => c !== name),
      categoryGroups: (d.categoryGroups ?? []).map((g) => ({
        ...g, categories: g.categories.filter((c) => c !== name),
      })),
      expenses: d.expenses.map((e) =>
        e.category === name ? { ...e, category: 'Ostalo' } : e
      ),
    }));
    showToast(`Kategorija obrisana.`, 'danger');
  }, [showToast]);

  const archiveCategory = useCallback((name) => {
    setData((d) => ({
      ...d,
      categories: d.categories.filter((c) => c !== name),
      categoryGroups: (d.categoryGroups ?? []).map((g) => ({
        ...g, categories: g.categories.filter((c) => c !== name),
      })),
    }));
    showToast(`Kategorija "${name}" arhivirana.`);
  }, [showToast]);

  const addCategoryGroup = useCallback((name) => {
    setData((d) => ({
      ...d,
      categoryGroups: [...(d.categoryGroups ?? []), { id: crypto.randomUUID(), name, categories: [] }],
    }));
  }, []);

  const renameCategoryGroup = useCallback((id, name) => {
    setData((d) => ({
      ...d,
      categoryGroups: (d.categoryGroups ?? []).map((g) => (g.id === id ? { ...g, name } : g)),
    }));
  }, []);

  const deleteCategoryGroup = useCallback((id) => {
    setData((d) => ({
      ...d,
      categoryGroups: (d.categoryGroups ?? []).filter((g) => g.id !== id),
    }));
  }, []);

  const updateCategoryGroupMembers = useCallback((groupId, members) => {
    setData((d) => ({
      ...d,
      categoryGroups: (d.categoryGroups ?? []).map((g) =>
        g.id === groupId
          ? { ...g, categories: members }
          : { ...g, categories: g.categories.filter((c) => !members.includes(c)) }
      ),
    }));
  }, []);

  const importData = useCallback((imported) => {
    setData(imported);
    showToast('Podaci uvezeni uspešno.');
  }, [showToast]);

  const importBudgetData = useCallback((budgetData) => {
    setData((d) => ({ ...d, budget: { ...d.budget, ...budgetData } }));
    showToast('Budžet uvezen uspešno.');
  }, [showToast]);

  function getYearBudget(data, year) {
    return data.budget?.[year] ?? {
      income: { plata: Array(12).fill(null), bonus: Array(12).fill(null) },
      funds: [],
    };
  }

  const updateBudgetIncome = useCallback((year, field, monthIdx, value) => {
    setData((d) => {
      const yb = getYearBudget(d, year);
      const newAmounts = yb.income[field].map((v, i) => (i === monthIdx ? value : v));
      return {
        ...d,
        budget: {
          ...d.budget,
          [year]: { ...yb, income: { ...yb.income, [field]: newAmounts } },
        },
      };
    });
  }, []);

  const updateBudgetFund = useCallback((year, fundId, monthIdx, value) => {
    setData((d) => {
      const yb = getYearBudget(d, year);
      const newFunds = yb.funds.map((f) =>
        f.id === fundId
          ? { ...f, amounts: f.amounts.map((v, i) => (i === monthIdx ? value : v)) }
          : f
      );
      return { ...d, budget: { ...d.budget, [year]: { ...yb, funds: newFunds } } };
    });
  }, []);

  const addBudgetFund = useCallback((year, name) => {
    setData((d) => {
      const yb = getYearBudget(d, year);
      const newFund = { id: crypto.randomUUID(), name, amounts: Array(12).fill(null) };
      return {
        ...d,
        budget: { ...d.budget, [year]: { ...yb, funds: [...yb.funds, newFund] } },
      };
    });
  }, []);

  const removeBudgetFund = useCallback((year, fundId) => {
    setData((d) => {
      const yb = getYearBudget(d, year);
      return {
        ...d,
        budget: {
          ...d.budget,
          [year]: { ...yb, funds: yb.funds.filter((f) => f.id !== fundId) },
        },
      };
    });
  }, []);

  const updateTrackingMap = useCallback((year, fundId, categories) => {
    setData((d) => ({
      ...d,
      trackingMaps: {
        ...d.trackingMaps,
        [year]: { ...(d.trackingMaps[year] ?? {}), [fundId]: categories },
      },
    }));
  }, []);

  const reorderBudgetFunds = useCallback((year, orderedIds) => {
    setData((d) => {
      const yb = getYearBudget(d, year);
      const indexed = Object.fromEntries(yb.funds.map((f) => [f.id, f]));
      const reordered = orderedIds.map((id) => indexed[id]).filter(Boolean);
      return { ...d, budget: { ...d.budget, [year]: { ...yb, funds: reordered } } };
    });
  }, []);

  const renameBudgetFund = useCallback((year, fundId, name) => {
    setData((d) => {
      const yb = getYearBudget(d, year);
      return {
        ...d,
        budget: {
          ...d.budget,
          [year]: { ...yb, funds: yb.funds.map((f) => (f.id === fundId ? { ...f, name } : f)) },
        },
      };
    });
  }, []);

  const copyBudgetToYear = useCallback((fromYear, toYear) => {
    setData((d) => applyBudgetCopy(d, fromYear, toYear));
  }, []);

  const setMonthlyNote = useCallback((year, month, text) => {
    setData((d) => ({
      ...d,
      monthlyNotes: {
        ...(d.monthlyNotes ?? {}),
        [year]: { ...(d.monthlyNotes?.[year] ?? {}), [month]: text },
      },
    }));
  }, []);

  const addSavingsGoal = useCallback((goal) => {
    setData((d) => ({
      ...d,
      savingsGoals: [...(d.savingsGoals ?? []), { ...goal, id: crypto.randomUUID() }],
    }));
    showToast('Cilj dodat.');
  }, [showToast]);

  const deleteSavingsGoal = useCallback((id) => {
    setData((d) => ({ ...d, savingsGoals: (d.savingsGoals ?? []).filter((g) => g.id !== id) }));
    showToast('Cilj obrisan.', 'danger');
  }, [showToast]);

  const addRecurring = useCallback((recurring) => {
    setData((d) => ({
      ...d,
      recurrings: [...(d.recurrings ?? []), { ...recurring, id: crypto.randomUUID() }],
    }));
  }, []);

  const deleteRecurring = useCallback((id) => {
    setData((d) => ({ ...d, recurrings: d.recurrings.filter((r) => r.id !== id) }));
    showToast('Ponavljajući trošak uklonjen.', 'danger');
  }, [showToast]);

  const ctx = {
    data,
    view,
    prevView,
    selectedYear,
    selectedMonth,
    navigateTo,
    addExpense,
    updateExpense,
    deleteExpense,
    addCategory,
    updateCategory,
    deleteCategory,
    archiveCategory,
    addCategoryGroup,
    renameCategoryGroup,
    deleteCategoryGroup,
    updateCategoryGroupMembers,
    importData,
    importBudgetData,
    showToast,
    updateBudgetIncome,
    updateBudgetFund,
    addBudgetFund,
    removeBudgetFund,
    renameBudgetFund,
    reorderBudgetFunds,
    updateTrackingMap,
    copyBudgetToYear,
    addRecurring,
    deleteRecurring,
    setMonthlyNote,
    addSavingsGoal,
    deleteSavingsGoal,
    darkMode,
    toggleDarkMode: () => setDarkMode((v) => !v),
    autosaveStatus,
    setupAutosave,
    activateAutosave,
  };

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
          <div className={`toast toast--${toast.type}`}>
            {toast.type === 'success' ? '✓' : '✕'} {toast.msg}
          </div>
        )}
      </div>
    </AppContext.Provider>
  );
}
