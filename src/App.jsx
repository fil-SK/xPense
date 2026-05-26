import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { loadData, saveData } from './utils/storage.js';
import Header from './components/Header.jsx';
import Home from './components/Home.jsx';
import MonthView from './components/MonthView.jsx';
import PreviousSpendings from './components/PreviousSpendings.jsx';
import CategoryManager from './components/CategoryManager.jsx';
import BudgetView from './components/BudgetView.jsx';

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

export default function App() {
  const [data, setData] = useState(() => loadData());
  const [view, setView] = useState('home');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [toast, setToast] = useState(null);

  useEffect(() => { saveData(data); }, [data]);

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  }, []);

  const navigateTo = useCallback((v, year, month) => {
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
      categories: d.categories.map((c) => (c === oldName ? newName : c)),
      expenses: d.expenses.map((e) =>
        e.category === oldName ? { ...e, category: newName } : e
      ),
    }));
    showToast(`Kategorija preimenovana.`);
  }, [showToast]);

  const deleteCategory = useCallback((name) => {
    setData((d) => ({
      categories: d.categories.filter((c) => c !== name),
      expenses: d.expenses.map((e) =>
        e.category === name ? { ...e, category: 'Ostalo' } : e
      ),
    }));
    showToast(`Kategorija obrisana.`, 'danger');
  }, [showToast]);

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

  const ctx = {
    data,
    view,
    selectedYear,
    selectedMonth,
    navigateTo,
    addExpense,
    updateExpense,
    deleteExpense,
    addCategory,
    updateCategory,
    deleteCategory,
    importData,
    importBudgetData,
    showToast,
    updateBudgetIncome,
    updateBudgetFund,
    addBudgetFund,
    removeBudgetFund,
    renameBudgetFund,
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
