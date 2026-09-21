import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './styles.css'
import App from './App.jsx'

registerSW({ immediate: true })

const letterPattern = /[A-Za-zÀ-ÖØ-öø-ÿ]/
const lowercaseLetterPattern = /[a-zà-öø-ÿ]/

function isAutoFormatField(target) {
  if (
    !(target instanceof HTMLInputElement) &&
    !(target instanceof HTMLTextAreaElement)
  ) {
    return false
  }

  if (target.dataset.autoCapitalize === 'off') {
    return false
  }

  if (target instanceof HTMLInputElement) {
    const allowedTypes = [
      'text',
      'search',
    ]

    if (!allowedTypes.includes(target.type)) {
      return false
    }
  }

  return true
}

function capitalizeFirstLetter(value) {
  const characters = Array.from(value)

  const index = characters.findIndex((character) =>
    lowercaseLetterPattern.test(character)
  )

  if (index === -1) {
    return value
  }

  characters[index] =
    characters[index].toLocaleUpperCase()

  return characters.join('')
}

document.addEventListener(
  'focusin',
  (event) => {
    const target = event.target

    if (!isAutoFormatField(target)) return

    target.setAttribute(
      'autocapitalize',
      'sentences'
    )
  },
  true
)

document.addEventListener(
  'beforeinput',
  (event) => {
    const target = event.target

    if (
      !isAutoFormatField(target) ||
      event.isComposing ||
      !event.inputType?.startsWith('insert') ||
      !event.data
    ) {
      return
    }

    const start =
      target.selectionStart ??
      target.value.length

    const end =
      target.selectionEnd ??
      start

    const textBeforeCursor =
      target.value.slice(0, start)

    if (letterPattern.test(textBeforeCursor)) {
      return
    }

    const formattedText =
      capitalizeFirstLetter(event.data)

    if (formattedText === event.data) {
      return
    }

    event.preventDefault()

    target.setRangeText(
      formattedText,
      start,
      end,
      'end'
    )

    target.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        inputType: event.inputType,
        data: formattedText,
      })
    )
  },
  true
)

ReactDOM.createRoot(
  document.getElementById('root')
).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)