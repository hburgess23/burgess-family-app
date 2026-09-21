import React, { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

const categories = [
  'Produce',
  'Dairy & Eggs',
  'Pantry',
  'Frozen',
  'Snacks',
  'Household',
  'Other',
]

const storeBrands = [
  {
    match: ['costco'],
    domain: 'costco.ca',
    background: '#fff1f1',
    border: '#efcaca',
    accent: '#d71920',
  },
  {
    match: ['walmart'],
    domain: 'walmart.ca',
    background: '#eef6ff',
    border: '#c9ddf4',
    accent: '#0071ce',
  },
  {
    match: ['save-on', 'save on', 'saveonfoods'],
    domain: 'saveonfoods.com',
    background: '#eef8ef',
    border: '#c9e4cb',
    accent: '#287a3b',
  },
  {
    match: ['superstore', 'real canadian'],
    domain: 'realcanadiansuperstore.ca',
    background: '#fff4e8',
    border: '#efd5b5',
    accent: '#df6c00',
  },
  {
    match: ['no frills', 'nofrills'],
    domain: 'nofrills.ca',
    background: '#fffbe2',
    border: '#ece096',
    accent: '#d6b500',
  },
  {
    match: ['safeway'],
    domain: 'safeway.ca',
    background: '#fff0f1',
    border: '#efc9cc',
    accent: '#d71920',
  },
  {
    match: ['t&t', 't & t', 'tnt'],
    domain: 'tntsupermarket.com',
    background: '#fff0f3',
    border: '#f0c9d1',
    accent: '#c81939',
  },
  {
    match: ['freshco'],
    domain: 'freshco.com',
    background: '#eff9ec',
    border: '#cee6c7',
    accent: '#4c9b2a',
  },
  {
    match: ['whole foods', 'wholefoods'],
    domain: 'wholefoodsmarket.com',
    background: '#eff7ee',
    border: '#cde1cb',
    accent: '#557a3e',
  },
  {
    match: ['shoppers'],
    domain: 'shoppersdrugmart.ca',
    background: '#fff0f0',
    border: '#ebcccc',
    accent: '#d9272e',
  },
  {
    match: ['london drugs'],
    domain: 'londondrugs.com',
    background: '#eef4ff',
    border: '#cad8f0',
    accent: '#214f9c',
  },
  {
    match: ['dollarama'],
    domain: 'dollarama.com',
    background: '#eef9f2',
    border: '#c9e5d1',
    accent: '#168447',
  },
  {
    match: ['thrifty foods', 'thrifty'],
    domain: 'thriftyfoods.com',
    background: '#f0f8ef',
    border: '#cce2c9',
    accent: '#397c37',
  },
]

const fallbackStoreColours = [
  ['#f4f0ff', '#dcd2f2', '#7359a5'],
  ['#edf8fb', '#c9e3e8', '#318091'],
  ['#fff2e9', '#edd2bf', '#b66a32'],
  ['#fff6df', '#eadba7', '#9b7a15'],
  ['#f6eff8', '#dfd0e4', '#865b91'],
  ['#eff8f4', '#cae3d8', '#3d8066'],
]

function capitalizeFirst(value) {
  if (!value) return ''

  const characters = Array.from(value)

  const index = characters.findIndex((character) =>
    /[a-zà-öø-ÿ]/.test(character)
  )

  if (index === -1) {
    return value
  }

  characters[index] =
    characters[index].toLocaleUpperCase()

  return characters.join('')
}

function getStoreDisplayName(storeName) {
  const cleanName = (storeName || '').trim()
  const lowerName = cleanName.toLowerCase()

  if (!cleanName) return 'Unassigned'

  if (lowerName.includes('costco')) return 'Costco'
  if (lowerName.includes('walmart')) return 'Walmart'
  if (
    lowerName.includes('save-on') ||
    lowerName.includes('save on')
  ) {
    return 'Save-On-Foods'
  }

  if (
    lowerName.includes('superstore') ||
    lowerName.includes('real canadian')
  ) {
    return 'Real Canadian Superstore'
  }

  if (
    lowerName.includes('no frills') ||
    lowerName.includes('nofrills')
  ) {
    return 'No Frills'
  }

  if (lowerName.includes('safeway')) return 'Safeway'
  if (lowerName.includes('freshco')) return 'FreshCo'

  if (
    lowerName.includes('t&t') ||
    lowerName.includes('t & t') ||
    lowerName === 'tnt'
  ) {
    return 'T&T'
  }

  if (lowerName.includes('whole foods')) {
    return 'Whole Foods'
  }

  if (lowerName.includes('shoppers')) {
    return 'Shoppers Drug Mart'
  }

  if (lowerName.includes('london drugs')) {
    return 'London Drugs'
  }

  if (lowerName.includes('dollarama')) {
    return 'Dollarama'
  }

  if (lowerName.includes('thrifty')) {
    return 'Thrifty Foods'
  }

  return capitalizeFirst(cleanName)
}

function getStoreInfo(storeName) {
  const cleanName = (storeName || '').toLowerCase().trim()

  const knownBrand = storeBrands.find((brand) =>
    brand.match.some((name) => cleanName.includes(name))
  )

  if (knownBrand) {
    return {
      ...knownBrand,
      logo: `https://www.google.com/s2/favicons?domain=${knownBrand.domain}&sz=128`,
    }
  }

  if (cleanName === 'unassigned') {
    return {
      background: '#f5f4f7',
      border: '#dfdce5',
      accent: '#76717f',
      logo: null,
    }
  }

  const colourIndex =
    Array.from(cleanName).reduce(
      (total, character) => total + character.charCodeAt(0),
      0
    ) % fallbackStoreColours.length

  const [background, border, accent] =
    fallbackStoreColours[colourIndex]

  return {
    background,
    border,
    accent,
    logo: null,
  }
}

export default function Grocery({ householdId, activeUser }) {
  const [items, setItems] = useState([])
  const [itemName, setItemName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [brand, setBrand] = useState('')
  const [storeName, setStoreName] = useState('')
  const [category, setCategory] = useState('Produce')
  const [editingId, setEditingId] = useState(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const isParent = activeUser.role === 'Parent'

  async function loadItems() {
    if (!householdId) return

    setLoading(true)

    const { data, error } = await supabase
      .from('grocery_items')
      .select(
        'id, item_name, quantity, brand, category, store_name, is_checked, checked_at, created_at'
      )
      .eq('household_id', householdId)
      .order('is_checked', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Could not load grocery items:', error)
      setErrorMessage('Could not load the grocery list.')
      setLoading(false)
      return
    }

    setItems(data || [])
    setErrorMessage('')
    setLoading(false)
  }

  useEffect(() => {
    loadItems()
  }, [householdId])

  function resetForm() {
    setEditingId(null)
    setItemName('')
    setQuantity('')
    setBrand('')
    setStoreName('')
    setCategory('Produce')
    setMessage('')
    setErrorMessage('')
  }

  function editItem(item) {
    setEditingId(item.id)
    setItemName(item.item_name || '')
    setQuantity(item.quantity || '')
    setBrand(item.brand || '')
    setStoreName(item.store_name || '')
    setCategory(item.category || 'Other')
    setMessage('')
    setErrorMessage('')

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  async function saveItem(event) {
    event.preventDefault()

    const name = itemName.trim()

    if (!name || !householdId) {
      setErrorMessage('Please enter an item.')
      return
    }

    setSaving(true)
    setMessage('')
    setErrorMessage('')

    const payload = {
      item_name: name,
      quantity: quantity.trim(),
      brand: brand.trim() || null,
      store_name: storeName.trim()
        ? getStoreDisplayName(storeName)
        : null,
      category,
      updated_at: new Date().toISOString(),
    }

    let error

    if (editingId) {
      ;({ error } = await supabase
        .from('grocery_items')
        .update(payload)
        .eq('id', editingId)
        .eq('household_id', householdId))
    } else {
      ;({ error } = await supabase
        .from('grocery_items')
        .insert({
          household_id: householdId,
          ...payload,
        }))
    }

    setSaving(false)

    if (error) {
      console.error('Could not save grocery item:', error)
      setErrorMessage(
        editingId
          ? 'Could not update this item.'
          : 'Could not add this item.'
      )
      return
    }

    setMessage(
      editingId
        ? 'Item updated.'
        : 'Item added.'
    )

    setEditingId(null)
    setItemName('')
    setQuantity('')
    setBrand('')
    setStoreName('')
    setCategory('Produce')

    await loadItems()
  }

  async function deleteItem(item) {
    if (!householdId) return

    const confirmed = window.confirm(
      `Delete ${capitalizeFirst(item.item_name)}?`
    )

    if (!confirmed) return

    const { error } = await supabase
      .from('grocery_items')
      .delete()
      .eq('id', item.id)
      .eq('household_id', householdId)

    if (error) {
      console.error('Could not delete grocery item:', error)
      setErrorMessage('Could not delete this item.')
      return
    }

    if (editingId === item.id) {
      resetForm()
    }

    setMessage('Item deleted.')
    await loadItems()
  }

  async function toggleChecked(item) {
    if (!isParent || !householdId) return

    const nextChecked = !item.is_checked

    setItems((current) =>
      current.map((currentItem) =>
        currentItem.id === item.id
          ? {
              ...currentItem,
              is_checked: nextChecked,
              checked_at: nextChecked
                ? new Date().toISOString()
                : null,
            }
          : currentItem
      )
    )

    const { error } = await supabase
      .from('grocery_items')
      .update({
        is_checked: nextChecked,
        checked_at: nextChecked
          ? new Date().toISOString()
          : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.id)
      .eq('household_id', householdId)

    if (error) {
      console.error('Could not update grocery item:', error)

      setItems((current) =>
        current.map((currentItem) =>
          currentItem.id === item.id
            ? {
                ...currentItem,
                is_checked: item.is_checked,
                checked_at: item.checked_at,
              }
            : currentItem
        )
      )

      setErrorMessage('Could not update this item.')
    }
  }

  async function clearChecked() {
    if (!isParent || !householdId) return

    const { error } = await supabase
      .from('grocery_items')
      .delete()
      .eq('household_id', householdId)
      .eq('is_checked', true)

    if (error) {
      console.error('Could not clear checked items:', error)
      setErrorMessage('Could not clear checked items.')
      return
    }

    setMessage('Checked items cleared.')
    await loadItems()
  }

  const storeMap = new Map()

  items.forEach((item) => {
    const rawStore =
      item.store_name?.trim() || 'Unassigned'

    const displayStore =
      getStoreDisplayName(rawStore)

    const storeKey =
      displayStore.toLocaleLowerCase()

    const existing = storeMap.get(storeKey)

    if (existing) {
      existing.items.push(item)
    } else {
      storeMap.set(storeKey, {
        store: displayStore,
        items: [item],
      })
    }
  })

  const storeGroups = Array.from(
    storeMap.values()
  ).sort((a, b) => {
    if (a.store === 'Unassigned') return 1
    if (b.store === 'Unassigned') return -1

    return a.store.localeCompare(b.store)
  })

  return (
    <section className="grocery-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Family shopping</p>
          <h2>Grocery List</h2>
        </div>

        {isParent && items.some((item) => item.is_checked) && (
          <button
            className="action-button secondary"
            type="button"
            onClick={clearChecked}
          >
            Clear Checked
          </button>
        )}
      </div>

      <div className="card grocery-add-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">
              {editingId ? 'Edit item' : 'Add to list'}
            </p>

            <h3>
              {editingId
                ? 'Update Grocery Item'
                : 'New Grocery Item'}
            </h3>
          </div>

          {editingId && (
            <button
              className="action-button secondary"
              type="button"
              onClick={resetForm}
            >
              Cancel
            </button>
          )}
        </div>

        <form
          className="grocery-add-form"
          onSubmit={saveItem}
        >
          <label className="grocery-item-name">
            Item
            <input
              type="text"
              value={itemName}
              placeholder="Example: Apples"
              onChange={(event) => {
                setItemName(event.target.value)
                setErrorMessage('')
              }}
            />
          </label>

          <label>
            Quantity
            <input
              type="text"
              value={quantity}
              placeholder="Example: 6"
              onChange={(event) =>
                setQuantity(event.target.value)
              }
            />
          </label>

          <label>
            Brand
            <input
              type="text"
              value={brand}
              placeholder="Optional"
              onChange={(event) =>
                setBrand(event.target.value)
              }
            />
          </label>

          <label>
            Store
            <input
              type="text"
              value={storeName}
              placeholder="Costco, Walmart..."
              onChange={(event) =>
                setStoreName(event.target.value)
              }
            />
          </label>

          <label>
            Category
            <select
              value={category}
              onChange={(event) =>
                setCategory(event.target.value)
              }
            >
              {categories.map((categoryName) => (
                <option
                  value={categoryName}
                  key={categoryName}
                >
                  {categoryName}
                </option>
              ))}
            </select>
          </label>

          <button
            className="action-button grocery-add-button"
            type="submit"
            disabled={saving}
          >
            {saving
              ? 'Saving…'
              : editingId
                ? 'Update Item'
                : 'Add Item'}
          </button>
        </form>

        {errorMessage && (
          <p className="form-message error">
            {errorMessage}
          </p>
        )}

        {message && (
          <p className="form-message success">
            {message}
          </p>
        )}
      </div>

      {loading ? (
        <div className="card">
          <p>Loading grocery list…</p>
        </div>
      ) : storeGroups.length === 0 ? (
        <div className="card">
          <p>Your grocery list is empty.</p>
        </div>
      ) : (
        <div className="grocery-stores">
          {storeGroups.map((storeGroup) => {
            const storeInfo =
              getStoreInfo(storeGroup.store)

            return (
              <section
                className="card grocery-store-card"
                key={storeGroup.store}
                style={{
                  '--store-background':
                    storeInfo.background,
                  '--store-border':
                    storeInfo.border,
                  '--store-accent':
                    storeInfo.accent,
                }}
              >
                <div className="grocery-store-header">
                  <div className="grocery-store-icon">
                    {storeInfo.logo ? (
                      <img
                        src={storeInfo.logo}
                        alt=""
                        className="grocery-store-logo"
                        onError={(event) => {
                          event.currentTarget.style.display =
                            'none'
                        }}
                      />
                    ) : (
                      <span>🛒</span>
                    )}
                  </div>

                  <div>
                    <p className="eyebrow">Store</p>
                    <h3>{storeGroup.store}</h3>
                  </div>

                  <span className="grocery-store-count">
                    {storeGroup.items.length}{' '}
                    {storeGroup.items.length === 1
                      ? 'item'
                      : 'items'}
                  </span>
                </div>

                <div className="grocery-store-categories">
                  {categories.map((categoryName) => {
                    const categoryItems =
                      storeGroup.items.filter(
                        (item) =>
                          item.category === categoryName
                      )

                    if (categoryItems.length === 0) {
                      return null
                    }

                    return (
                      <section
                        className="grocery-store-category"
                        key={categoryName}
                      >
                        <h4>{categoryName}</h4>

                        <div className="grocery-store-items">
                          {categoryItems.map((item) => (
                            <div
                              className={
                                item.is_checked
                                  ? 'grocery-row checked'
                                  : 'grocery-row'
                              }
                              key={item.id}
                            >
                              {isParent ? (
                                <button
                                  className="grocery-check"
                                  type="button"
                                  onClick={() =>
                                    toggleChecked(item)
                                  }
                                  aria-label={
                                    item.is_checked
                                      ? `Uncheck ${capitalizeFirst(item.item_name)}`
                                      : `Check ${capitalizeFirst(item.item_name)}`
                                  }
                                >
                                  {item.is_checked ? '✓' : ''}
                                </button>
                              ) : (
                                <span className="grocery-check readonly">
                                  {item.is_checked ? '✓' : ''}
                                </span>
                              )}

                              <div className="grocery-item-details">
                                <div className="grocery-item-title-row">
                                  <strong>
                                    {capitalizeFirst(item.item_name)}
                                  </strong>

                                  {item.quantity && (
                                    <span className="grocery-quantity-inline">
                                      ×{item.quantity}
                                    </span>
                                  )}
                                </div>

                                {item.brand && (
                                  <div className="grocery-meta">
                                    <span>
                                      {item.brand}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="grocery-item-actions">
                                <button
                                  className="action-button secondary"
                                  type="button"
                                  onClick={() => editItem(item)}
                                >
                                  Edit
                                </button>

                                <button
                                  className="action-button secondary grocery-delete-button"
                                  type="button"
                                  onClick={() => deleteItem(item)}
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </section>
  )
}
