import { useMemo, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { Icon } from '../components/Icon';
import { PageHead } from '../components/PageHead';
import { useFeedback } from '../state/feedback-context';
import { useUnlockedVault, useVault } from '../state/vault-context';
import type { VaultItemDraft } from '../vault/model';
import {
  createItem,
  insertItem,
  removeItem,
  searchItems,
  sortItems,
  toggleFavorite,
  updateItem,
} from '../vault/model';
import { displayHost } from '../vault/url';
import { ItemDetail } from './ItemDetail';
import { ItemEditor } from './ItemEditor';

type Mode = { kind: 'browse' } | { kind: 'create' } | { kind: 'edit'; id: string };

export function VaultView() {
  const { mutate } = useVault();
  const { data } = useUnlockedVault();
  const { notify } = useFeedback();

  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>({ kind: 'browse' });

  const visible = useMemo(() => sortItems(searchItems(data.items, query)), [data.items, query]);
  const selected = data.items.find((item) => item.id === selectedId) ?? null;
  const editing = mode.kind === 'edit' ? (data.items.find((item) => item.id === mode.id) ?? null) : null;

  // On a narrow screen only one pane fits, so the list steps aside whenever
  // there is something to show in the detail pane.
  const paneOpen = mode.kind !== 'browse' || selected !== null;

  const reportSaveFailure = () => notify('The change could not be saved to this browser.', 'error');

  // A failed save in the two handlers below rejects, and the editor that
  // called them shows the error next to its own Save button.
  const onCreate = async (draft: VaultItemDraft) => {
    const item = createItem(draft);
    await mutate((current) => insertItem(current, item));
    notify('Item added.', 'success');
    setSelectedId(item.id);
    setMode({ kind: 'browse' });
  };

  const onUpdate = async (id: string, draft: VaultItemDraft) => {
    await mutate((current) => updateItem(current, id, draft));
    notify('Item saved.', 'success');
    setMode({ kind: 'browse' });
  };

  const onDelete = (id: string) => {
    setSelectedId(null);
    mutate((current) => removeItem(current, id)).then(
      () => notify('Item deleted.', 'success'),
      reportSaveFailure,
    );
  };

  const onToggleFavorite = (id: string) => {
    mutate((current) => toggleFavorite(current, id)).catch(reportSaveFailure);
  };

  return (
    <div className="page">
      <PageHead tag="vault" title="Vault">
        Logins, passwords and two-factor keys. All of it is encrypted before it is saved.
      </PageHead>

      <div className={paneOpen ? 'split is-pane-open' : 'split'}>
        <section className="split__list" aria-label="Items">
          <div className="toolbar">
            <label className="search">
              <Icon name="search" size={16} />
              <input
                className="search__input"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search"
                aria-label="Search items"
              />
            </label>
            <button
              type="button"
              className="button button--large button--primary"
              onClick={() => setMode({ kind: 'create' })}
            >
              <Icon name="plus" size={16} />
              New item
            </button>
          </div>

          {visible.length > 0 ? (
            <ul className="item-list">
              {visible.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={item.id === selectedId && mode.kind === 'browse' ? 'item is-selected' : 'item'}
                    onClick={() => {
                      setSelectedId(item.id);
                      setMode({ kind: 'browse' });
                    }}
                  >
                    <Avatar title={item.title} />
                    <span className="item__text">
                      <span className="item__title">{item.title}</span>
                      <span className="item__subtitle">
                        {item.username || displayHost(item.url) || 'No username'}
                      </span>
                    </span>
                    <span className="item__badges">
                      {item.totp && (
                        <span className="badge" title="Has a one-time code">
                          2FA
                        </span>
                      )}
                      {item.favorite && (
                        <span className="item__star" title="Favourite">
                          <Icon name="star" size={14} filled />
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="list-empty">
              {data.items.length === 0 ? 'Your vault is empty.' : `Nothing matches “${query.trim()}”.`}
            </p>
          )}
        </section>

        <section className="split__pane" aria-label="Details">
          {mode.kind === 'create' && (
            <ItemEditor key="create" item={null} onSave={onCreate} onCancel={() => setMode({ kind: 'browse' })} />
          )}

          {mode.kind === 'edit' && editing && (
            <ItemEditor
              key={editing.id}
              item={editing}
              onSave={(draft) => onUpdate(editing.id, draft)}
              onCancel={() => setMode({ kind: 'browse' })}
            />
          )}

          {mode.kind === 'browse' && selected && (
            <ItemDetail
              key={selected.id}
              item={selected}
              onBack={() => setSelectedId(null)}
              onEdit={() => setMode({ kind: 'edit', id: selected.id })}
              onDelete={() => onDelete(selected.id)}
              onToggleFavorite={() => onToggleFavorite(selected.id)}
            />
          )}

          {mode.kind === 'browse' && !selected && (
            <div className="placeholder">
              <span className="placeholder__icon">
                <Icon name="vault" size={24} />
              </span>
              <h2 className="placeholder__title">
                {data.items.length === 0 ? 'Add your first item' : 'Select an item'}
              </h2>
              <p className="placeholder__text">
                {data.items.length === 0
                  ? 'Store a login, a password and its two-factor key together. Everything is encrypted before it is saved.'
                  : 'Choose something from the list to see its details and copy its secrets.'}
              </p>
              {data.items.length === 0 && (
                <button type="button" className="button button--primary" onClick={() => setMode({ kind: 'create' })}>
                  <Icon name="plus" size={16} />
                  New item
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
