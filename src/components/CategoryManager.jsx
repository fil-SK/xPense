import { useState } from 'react';
import { useApp } from '../App.jsx';

export default function CategoryManager() {
  const { data, navigateTo, addCategory, updateCategory, deleteCategory } = useApp();
  const [newName, setNewName] = useState('');
  const [editingIdx, setEditingIdx] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  function handleAdd() {
    const name = newName.trim();
    if (!name || data.categories.includes(name)) return;
    addCategory(name);
    setNewName('');
  }

  function startEdit(idx) {
    setEditingIdx(idx);
    setEditValue(data.categories[idx]);
  }

  function commitEdit(oldName) {
    const name = editValue.trim();
    if (!name || (name !== oldName && data.categories.includes(name))) {
      setEditingIdx(null);
      return;
    }
    if (name !== oldName) updateCategory(oldName, name);
    setEditingIdx(null);
  }

  function handleDelete(name) {
    if (confirmDelete === name) {
      deleteCategory(name);
      setConfirmDelete(null);
    } else {
      setConfirmDelete(name);
      setTimeout(() => setConfirmDelete(null), 2500);
    }
  }

  const usageCount = (cat) =>
    data.expenses.filter((e) => e.category === cat).length;

  return (
    <div className="categories-page">
      <div className="cat-header">
        <button className="month-header__back" onClick={() => navigateTo('home')}>←</button>
        <h1 className="cat-header__title">Upravljanje kategorijama</h1>
      </div>

      <div className="cat-list">
        {data.categories.map((cat, idx) => (
          <div key={cat} className="cat-item">
            {editingIdx === idx ? (
              <>
                <input
                  className="cat-item__input"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit(cat);
                    if (e.key === 'Escape') setEditingIdx(null);
                  }}
                  autoFocus
                />
                <div className="cat-item__actions">
                  <button className="btn btn--primary btn--sm" onClick={() => commitEdit(cat)}>
                    Sačuvaj
                  </button>
                  <button className="btn btn--ghost btn--sm" onClick={() => setEditingIdx(null)}>
                    Otkaži
                  </button>
                </div>
              </>
            ) : (
              <>
                <span className="cat-item__name">{cat}</span>
                <span style={{ fontSize: 12, color: '#94a3b8', marginRight: 8 }}>
                  {usageCount(cat)} stavki
                </span>
                <div className="cat-item__actions">
                  <button
                    className="btn btn--icon btn--ghost btn--sm"
                    title="Preimenuj"
                    onClick={() => startEdit(idx)}
                  >
                    ✏️
                  </button>
                  <button
                    className={`btn btn--icon btn--sm ${confirmDelete === cat ? 'btn--danger' : 'btn--ghost'}`}
                    title={confirmDelete === cat ? 'Klikni ponovo za brisanje' : 'Obriši'}
                    onClick={() => handleDelete(cat)}
                  >
                    {confirmDelete === cat ? '⚠️' : '🗑️'}
                  </button>
                </div>
              </>
            )}
          </div>
        ))}

        <div className="cat-add">
          <input
            className="cat-add__input"
            placeholder="Ime nove kategorije..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <button className="btn btn--primary btn--sm" onClick={handleAdd} disabled={!newName.trim()}>
            + Dodaj
          </button>
        </div>
      </div>

      <div style={{ color: '#64748b', fontSize: 13, padding: '4px 2px' }}>
        Brisanjem kategorije, sve stavke te kategorije biće prebačene u "Ostalo".
      </div>
    </div>
  );
}
