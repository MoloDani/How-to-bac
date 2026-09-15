import { useTranslation } from 'react-i18next'

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['week', 604_800],
  ['day', 86_400],
  ['hour', 3600],
  ['minute', 60],
]

/** "acum 5 minute" / "5 minutes ago", in the active language. */
export function formatRelative(
  date: Date,
  locale: string,
  now: Date = new Date(),
): string {
  const seconds = (date.getTime() - now.getTime()) / 1000
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) {
      return format.format(Math.round(seconds / size), unit)
    }
  }
  return format.format(Math.round(seconds), 'second')
}

export function RelativeTime({ value }: { value: string }) {
  const { i18n } = useTranslation()
  const date = new Date(value)
  const locale = i18n.resolvedLanguage ?? 'ro'

  return (
    <time dateTime={value} title={date.toLocaleString(locale)}>
      {formatRelative(date, locale)}
    </time>
  )
}
