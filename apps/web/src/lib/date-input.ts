function isValidCalendarDate(day: number, month: number, year: number) {
  const candidate = new Date(year, month - 1, day)

  return candidate.getFullYear() === year
    && candidate.getMonth() === month - 1
    && candidate.getDate() === day
}

function isRealisticBirthDate(day: number, month: number, year: number) {
  const today = new Date()
  const currentYear = today.getFullYear()

  if (year < currentYear - 120 || year > currentYear) {
    return false
  }

  const birthDate = new Date(year, month - 1, day)
  const todayAtMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  return birthDate.getTime() <= todayAtMidnight.getTime()
}

function isPossibleDateDigits(value: string) {
  if (!/^\d{0,8}$/.test(value)) {
    return false
  }

  if (value.length >= 1) {
    const firstDayDigit = Number(value[0])

    if (firstDayDigit < 0 || firstDayDigit > 3) {
      return false
    }
  }

  if (value.length >= 2) {
    const day = Number(value.slice(0, 2))

    if (day < 1 || day > 31) {
      return false
    }
  }

  if (value.length >= 3) {
    const firstMonthDigit = Number(value[2])

    if (firstMonthDigit < 0 || firstMonthDigit > 1) {
      return false
    }
  }

  if (value.length >= 4) {
    const month = Number(value.slice(2, 4))

    if (month < 1 || month > 12) {
      return false
    }
  }

  if (value.length === 8) {
    const day = Number(value.slice(0, 2))
    const month = Number(value.slice(2, 4))
    const year = Number(value.slice(4, 8))

    if (!isValidCalendarDate(day, month, year) || !isRealisticBirthDate(day, month, year)) {
      return false
    }
  }

  return true
}

function sanitizeDateDigits(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  let sanitized = ''

  for (const digit of digits) {
    const nextValue = `${sanitized}${digit}`

    if (isPossibleDateDigits(nextValue)) {
      sanitized = nextValue
    }
  }

  return sanitized
}

export function formatDateInput(value: string) {
  const digits = sanitizeDateDigits(value)

  if (digits.length <= 2) {
    return digits
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`
  }

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

export function normalizeDateInputValue(value: string) {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return ''
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmedValue)) {
    return trimmedValue
  }

  const isoMatch = trimmedValue.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/)

  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`
  }

  return formatDateInput(trimmedValue)
}

export function formatDateForApi(value: string) {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return ''
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) {
    return trimmedValue
  }

  const match = trimmedValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)

  if (!match) {
    return trimmedValue
  }

  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])

  if (!isValidCalendarDate(day, month, year) || !isRealisticBirthDate(day, month, year)) {
    return trimmedValue
  }

  return `${match[3]}-${match[2]}-${match[1]}`
}

export function getDateInputError(value: string) {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return ''
  }

  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(trimmedValue)) {
    return 'Informe a data no formato dd/mm/aaaa.'
  }

  if (formatDateForApi(trimmedValue) === trimmedValue) {
    return 'Informe uma data de nascimento real.'
  }

  return ''
}

export function isValidDateInput(value: string) {
  return !getDateInputError(value)
}

export function formatDateForDisplay(value: string) {
  const normalizedValue = formatDateForApi(value)

  if (!normalizedValue || !/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
    return value
  }

  const [year, month, day] = normalizedValue.split('-')
  return `${day}/${month}/${year}`
}