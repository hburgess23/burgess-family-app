export function isReminderDueOnDate(reminder, date = new Date()) {
  if (!reminder || reminder.active === false) return false

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const dateString = `${year}-${month}-${day}`

  const dayName = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ][date.getDay()]

  if (reminder.repeat_type === 'none') {
    return reminder.reminder_date === dateString
  }

  // If a repeating reminder has a start date,
  // do not treat it as due before that date.
  if (
    reminder.reminder_date &&
    dateString < reminder.reminder_date
  ) {
    return false
  }

  if (reminder.repeat_type === 'daily') {
    return true
  }

  if (reminder.repeat_type === 'selected_days') {
    return (reminder.repeat_days || []).includes(dayName)
  }

  if (reminder.repeat_type === 'weekly') {
    if (!reminder.reminder_date) return false

    const parts = reminder.reminder_date
      .split('-')
      .map(Number)

    const startDate = new Date(
      parts[0],
      parts[1] - 1,
      parts[2]
    )

    return startDate.getDay() === date.getDay()
  }

  return false
}