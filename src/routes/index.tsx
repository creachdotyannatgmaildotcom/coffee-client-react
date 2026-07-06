import { createFileRoute, redirect } from '@tanstack/react-router'
import { defaultLocale } from '@/shared/config/i18n'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: '/$locale', params: { locale: defaultLocale } })
  },
})
