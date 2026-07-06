import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import { LocaleSchema, locales } from '@/shared/config/i18n'

export const Route = createFileRoute('/$locale')({
  params: {
    parse: (raw) => ({ locale: LocaleSchema.parse(raw.locale) }),
  },
  component: LocaleLayout,
})

function LocaleLayout() {
  const { locale } = Route.useParams()
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          <Link to="/$locale" params={{ locale }}>
            Coffee Client
          </Link>
        </h1>
        <nav aria-label="Langue" className="flex gap-2 text-sm">
          {locales.map((code) => (
            <Link
              key={code}
              to="/$locale"
              params={{ locale: code }}
              className="text-muted-foreground uppercase"
              activeProps={{ className: 'font-semibold text-foreground uppercase' }}
            >
              {code}
            </Link>
          ))}
        </nav>
      </header>
      <Outlet />
    </main>
  )
}
