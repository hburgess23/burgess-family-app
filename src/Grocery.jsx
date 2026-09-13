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

export default function Grocery({ householdId, activeUser }) {
  const [items, setItems] = useState([])
  const [itemName, setItemName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [brand, setBrand] = useState('')
  const [category, setCategory] = useState('Produce')
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
        'id, item_name, quantity, brand, category, is_checked, checked_at, created_at'
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

  async function addItem(event) {
    event.preventDefault()

    const name = itemName.trim()

    if (!name || !householdId) {
      setErrorMessage('Please enter an item.')
      return
    }

    setSaving(true)
    setMessage('')
    setErrorMessage('')

    const { error } = await supabase
      .from('grocery_items')
      .insert({
        household_id: householdId,
        item_name: name,
        quantity: quantity.trim(),
        brand: brand.trim() || null,
        category,
      })

    setSaving(false)

    if (error) {
      console.error('Could not add grocery item:', error)
      setErrorMessage('Could not add this item.')
      return
    }

    setItemName('')
    setQuantity('')
    setBrand('')
    setMessage('Item added.')
    await loadItems()
  }

  async function toggleChecked(item) {
    if (!isParent || !householdId) return

    const nextChecked = !item.is_checked

    // Update the screen immediately
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

      // Roll back if Supabase fails
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

  const groupedItems = categories
    .map((categoryName) => ({
      category: categoryName,
      items: items.filter((item) => item.category === categoryName),
    }))
    .filter((group) => group.items.length > 0)

  return (
    <section className="grocery-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">More</p>
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
        <h3>Add Grocery Item</h3>

        <form className="grocery-add-form" onSubmit={addItem}>
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
              onChange={(event) => setQuantity(event.target.value)}
            />
          </label>

          <label>
            Brand
            <input
              type="text"
              value={brand}
              placeholder="Optional"
              onChange={(event) => setBrand(event.target.value)}
            />
          </label>

          <label>
            Category
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              {categories.map((categoryName) => (
                <option value={categoryName} key={categoryName}>
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
            {saving ? 'Adding…' : 'Add Item'}
          </button>
        </form>

        {errorMessage && (
          <p className="form-message error">{errorMessage}</p>
        )}

        {message && (
          <p className="form-message success">{message}</p>
        )}
      </div>

      {loading ? (
        <div className="card">
          <p>Loading grocery list…</p>
        </div>
      ) : groupedItems.length === 0 ? (
        <div className="card">
          <p>Your grocery list is empty.</p>
        </div>
      ) : (
        <div className="grocery-groups">
          {groupedItems.map((group) => (
            <div className="card grocery-group" key={group.category}>
              <h3>{group.category}</h3>

              <div className="grocery-items">
                {group.items.map((item) => (
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
                        onClick={() => toggleChecked(item)}
                        aria-label={
                          item.is_checked
                            ? `Uncheck ${item.item_name}`
                            : `Check ${item.item_name}`
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
                      <strong>{item.item_name}</strong>

                      <div className="grocery-meta">
                        {item.quantity && (
                          <span>Qty: {item.quantity}</span>
                        )}

                        {item.brand && (
                          <span>{item.brand}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}