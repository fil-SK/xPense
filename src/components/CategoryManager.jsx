import { useState } from 'react';
import { useApp } from '../App.jsx';

export default function CategoryManager() {
  const {
    data, navigateTo,
    addCategory, updateCategory, deleteCategory, archiveCategory,
    addCategoryGroup, renameCategoryGroup, deleteCategoryGroup, updateCategoryGroupMembers,
  } = useApp();

  const [activeTab, setActiveTab] = useState('categories');

  // ── Kategorije tab state ──
  const [newName, setNewName] = useState('');
  const [editingIdx, setEditingIdx] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  // ── Grupe tab state ──
  const [newGroupName, setNewGroupName] = useState('');
  const [expandedGroupId, setExpandedGroupId] = useState(null);
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editGroupValue, setEditGroupValue] = useState('');

  // ── Kategorije helpers ──
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
    setConfirmDelete(name);
    setTimeout(() => setConfirmDelete(null), 2500);
  }

  const usageCount = (cat) => data.expenses.filter((e) => e.category === cat).length;

  // ── Grupe helpers ──
  const groups = data.categoryGroups ?? [];

  function handleAddGroup() {
    const name = newGroupName.trim();
    if (!name) return;
    addCategoryGroup(name);
    setNewGroupName('');
  }

  function toggleExpand(id) {
    setExpandedGroupId((prev) => (prev === id ? null : id));
  }

  function startEditGroup(group) {
    setEditingGroupId(group.id);
    setEditGroupValue(group.name);
  }

  function commitEditGroup(id) {
    const name = editGroupValue.trim();
    if (name) renameCategoryGroup(id, name);
    setEditingGroupId(null);
  }

  function toggleMember(groupId, cat, currentMembers) {
    if (currentMembers.includes(cat)) {
      updateCategoryGroupMembers(groupId, currentMembers.filter((c) => c !== cat));
    } else {
      updateCategoryGroupMembers(groupId, [...currentMembers, cat]);
    }
  }

  function categoryGroupName(cat) {
    return groups.find((g) => g.categories.includes(cat))?.name ?? null;
  }

  return (
    <div className="categories-page">
      <div className="cat-header">
        <button className="month-header__back" onClick={() => navigateTo('home')}>←</button>
        <h1 className="cat-header__title">Upravljanje kategorijama</h1>
      </div>

      <div className="cat-tabs">
        <button
          className={`cat-tab ${activeTab === 'categories' ? 'cat-tab--active' : ''}`}
          onClick={() => setActiveTab('categories')}
        >
          Kategorije
        </button>
        <button
          className={`cat-tab ${activeTab === 'groups' ? 'cat-tab--active' : ''}`}
          onClick={() => setActiveTab('groups')}
        >
          Grupe
        </button>
      </div>

      {/* ── Kategorije tab ── */}
      {activeTab === 'categories' && (
        <>
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
                      <button className="btn btn--primary btn--sm" onClick={() => commitEdit(cat)}>Sačuvaj</button>
                      <button className="btn btn--ghost btn--sm" onClick={() => setEditingIdx(null)}>Otkaži</button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="cat-item__name">{cat}</span>
                    <span style={{ fontSize: 12, color: '#94a3b8', marginRight: 8 }}>
                      {usageCount(cat)} stavki
                    </span>
                    <div className="cat-item__actions">
                      {confirmDelete === cat ? (
                        <>
                          <button
                            className="btn btn--ghost btn--sm"
                            title="Ukloni iz liste – stare stavke ostaju nepromenjene"
                            onClick={() => { archiveCategory(cat); setConfirmDelete(null); }}
                          >
                            📦 Arhiviraj
                          </button>
                          <button
                            className="btn btn--sm btn--danger"
                            title="Obriši kategoriju i premesti sve stavke na Ostalo"
                            onClick={() => { deleteCategory(cat); setConfirmDelete(null); }}
                          >
                            🗑️ Obriši
                          </button>
                        </>
                      ) : (
                        <>
                          <button className="btn btn--icon btn--ghost btn--sm" title="Preimenuj" onClick={() => startEdit(idx)}>✏️</button>
                          <button className="btn btn--icon btn--ghost btn--sm" title="Ukloni kategoriju" onClick={() => handleDelete(cat)}>🗑️</button>
                        </>
                      )}
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
            <b>Arhiviraj</b> — uklanja kategoriju iz liste, stare stavke ostaju nepromenjene.{' '}
            <b>Obriši</b> — briše kategoriju i premešta sve stare stavke na "Ostalo".
          </div>
        </>
      )}

      {/* ── Grupe tab ── */}
      {activeTab === 'groups' && (
        <>
          <div className="cat-list">
            {groups.map((group) => (
              <div key={group.id} data-testid={`group-${group.id}`} className={`cat-group-item ${expandedGroupId === group.id ? 'cat-group-item--open' : ''}`}>
                <div
                  className="cat-group-item__header"
                  onClick={() => { if (editingGroupId !== group.id) toggleExpand(group.id); }}
                >
                  <span className="cat-group-item__arrow">{expandedGroupId === group.id ? '▾' : '▸'}</span>
                  {editingGroupId === group.id ? (
                    <input
                      className="cat-item__input"
                      value={editGroupValue}
                      onChange={(e) => setEditGroupValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitEditGroup(group.id);
                        if (e.key === 'Escape') setEditingGroupId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  ) : (
                    <span className="cat-group-item__name">{group.name}</span>
                  )}
                  <span className="cat-group-item__count">{group.categories.length} kategorija</span>
                  <div className="cat-item__actions" onClick={(e) => e.stopPropagation()}>
                    {editingGroupId === group.id ? (
                      <>
                        <button className="btn btn--primary btn--sm" onClick={() => commitEditGroup(group.id)}>Sačuvaj</button>
                        <button className="btn btn--ghost btn--sm" onClick={() => setEditingGroupId(null)}>Otkaži</button>
                      </>
                    ) : (
                      <>
                        <button className="btn btn--icon btn--ghost btn--sm" title="Preimenuj grupu" onClick={() => startEditGroup(group)}>✏️</button>
                        <button className="btn btn--icon btn--ghost btn--sm" title="Obriši grupu" onClick={() => deleteCategoryGroup(group.id)}>🗑️</button>
                      </>
                    )}
                  </div>
                </div>

                <div className="cat-group-item__body">
                  <div className="cat-group-item__inner">
                    {data.categories.length === 0 && (
                      <span style={{ color: '#94a3b8', fontSize: 13 }}>Nema kategorija.</span>
                    )}
                    {data.categories.map((cat) => {
                      const inThis = group.categories.includes(cat);
                      const otherGroup = !inThis ? categoryGroupName(cat) : null;
                      return (
                        <label key={cat} className="cat-group-check">
                          <input
                            type="checkbox"
                            checked={inThis}
                            onChange={() => toggleMember(group.id, cat, group.categories)}
                          />
                          <span className="cat-group-check__name">{cat}</span>
                          {otherGroup && (
                            <span className="cat-group-check__hint">← {otherGroup}</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}

            <div className="cat-add">
              <input
                className="cat-add__input"
                placeholder="Ime nove grupe..."
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddGroup()}
              />
              <button className="btn btn--primary btn--sm" onClick={handleAddGroup} disabled={!newGroupName.trim()}>
                + Dodaj grupu
              </button>
            </div>
          </div>

          <div style={{ color: '#64748b', fontSize: 13, padding: '4px 2px' }}>
            Grupe organizuju kategorije u tematske celine koje se prikazuju pri dodavanju troška.
            Svaka kategorija može biti u samo jednoj grupi — čekiranje je automatski premešta.
          </div>
        </>
      )}
    </div>
  );
}
