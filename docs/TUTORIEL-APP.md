# Coffee Client — coder l'application pas à pas (depuis la base)

Ce tutoriel s'adresse à un **débutant complet**. Il part du dossier **`coffee-client-base`**
(le squelette outillé du projet) et construit **toute l'application** : routeur, couche de
données, liste paginée, page détail, création et édition d'un café — jusqu'à la dernière
ligne de code et **22 tests verts**.

À la fin de **chaque étape**, le projet compile, se lance et passe toutes les vérifications
(`pnpm run verify`) — on ne passe jamais à l'étape suivante avec un projet cassé. Chaque
étape de ce document a été **rejouée et vérifiée** telle quelle.

> La construction de la base elle-même (Vite, TypeScript strict, Biome, ESLint/React
> Compiler, Tailwind, shadcn/ui, Vitest…) est racontée dans [TUTORIEL.md](./TUTORIEL.md)
> et les fiches [docs/steps](./steps/README.md). Ici, on **code l'application**.

| Étape | Contenu | Tests verts |
|---|---|---|
| 1 | Fondations : routeur typé, query client, i18n d'URL, infra de test | 4 |
| 2 | Couche données : `http()` + Zod, `Money`, schémas, query keys | 7 |
| 3 | La liste des cafés (page, composant, écran d'erreur) | 9 |
| 4 | Pagination pilotée par l'URL | 12 |
| 5 | Page détail et sémantique d'erreur (404 métier ≠ panne) | 16 |
| 6 | Création : formulaire + boucle 400 → champ | 19 |
| 7 | Édition : PATCH optimiste | 22 |

> **Convention de lecture** : les blocs `bash` sont des commandes à taper dans le terminal,
> depuis le dossier du projet. Un bloc de code dont la première ligne est un chemin en
> commentaire (ex. `// src/app/router.ts`) est le **contenu complet** du fichier à créer —
> ou à **remplacer intégralement** si le fichier existe déjà.

> **pnpm ou npm ?** Règle générale : `pnpm <script>` = `npm run <script>`, `pnpm add` =
> `npm install`, `pnpm exec` = `npx`. Choisissez un gestionnaire et gardez-le jusqu'au bout.

---

## Étape 0 — Installer et comprendre la base

### 0.1 Ce que contient la base

```bash
cd coffee-client-base
pnpm install
# npm : npm install
```

La base fournit **tout l'outillage, prêt à l'emploi** :

- **Vite 8 + React 19 + React Compiler** (`vite.config.ts`) — avec le plugin **TanStack
  Router** (génération des routes) et le **proxy** `/api` → `http://localhost:8080` déjà
  configurés ;
- **TypeScript strict total**, **Biome** (format + lint), **ESLint** réduit aux règles des
  hooks React ;
- le **kit UI** shadcn dans `src/shared/ui/` (`Button`, `Card`, `Input`, `Label`,
  `Skeleton`) et Tailwind v4 (`src/index.css`) ;
- **Vitest + React Testing Library + MSW** (dépendances installées, setup partiel) ;
- toutes les dépendances de l'application déjà dans `package.json` : TanStack Router et
  Query, Zod, react-hook-form… **aucun `pnpm add` ne sera nécessaire**.

### 0.2 Le fil conducteur : un projet qui ne compile pas (encore)

Ouvrir `src/main.tsx` :

```tsx
import '@/shared/config/zod-locale'
import { createAppQueryClient } from '@/app/query-client'
import { createAppRouter } from '@/app/router'
```

Ces trois modules **n'existent pas** — c'est voulu. `main.tsx` et `src/test/setup.ts`
(qui importe `./server`, absent lui aussi) sont le **cahier des charges** : la base
compile le jour où vous avez écrit les fondations. Vérifiez par vous-même :

```bash
pnpm typecheck   # ✖ erreurs "Cannot find module" — normal, au travail !
# npm : npm run typecheck
```

### 0.3 Le contrat backend (CoffeeMachine3)

L'API tourne sur `http://localhost:8080` (Spring Boot, profil `dev` = pas d'auth) :

| Requête | Réponse |
|---|---|
| `GET /coffees/paged?page&size` | Page Spring `{ content, number, size, totalElements, totalPages }` |
| `GET /coffees/{id}` | 200 `{ id, name, price }` ou 404 sans body |
| `POST /coffees` `{ name, price }` | 201 + body du café créé |
| `PATCH /coffees/{id}` body partiel | 200 ou 404 |
| Erreur de validation | **400 + body `{ [champ]: message }`** |

**Piège important** : `price` est un **entier en centimes** (250 = 2,50 €). C'est une dette
connue du backend — notre code va la confiner dans un seul endroit (étape 2).

Le backend n'est **pas nécessaire** pour suivre ce tutoriel : les tests simulent le réseau
avec MSW. Il ne sert qu'à voir l'application tourner "en vrai" avec `pnpm dev`.

---

## Étape 1 — Fondations : routeur, query client, i18n, infra de test

Objectif : faire compiler la base — une application avec des URL (`/fr`, `/en`), une page
d'accueil, et des tests qui pilotent l'app **par ses URL**.

### 1.1 La locale dans l'URL

L'i18n en retrofit est un chantier très coûteux : on paie le segment de langue (`/fr/…`)
dès maintenant. L'URL étant une **entrée utilisateur**, la locale est validée par Zod —
une locale inconnue (`/de`) retombe sur `fr` au lieu de planter :

```ts
// src/shared/config/i18n.ts
import { z } from 'zod'

export const locales = ['fr', 'en'] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'fr'

// Toute locale inconnue dans l'URL retombe silencieusement sur la locale par
// défaut : une URL ne doit jamais faire planter l'application.
export const LocaleSchema = z.enum(locales).catch(defaultLocale)
```

Et les messages d'erreur Zod en français, configurés **une fois pour toute l'app** (aucun
message ne sera jamais écrit dans un schéma) :

```ts
// src/shared/config/zod-locale.ts
import { z } from 'zod'

// Messages d'erreur Zod en français, hors des schémas : aucun schéma ne
// contient de texte. Migration vers un vrai catalogue i18n à venir.
z.config(z.locales.fr())
```

### 1.2 Le query client

TanStack Query gérera notre **état serveur** (étape 2). On crée sa fabrique — version
minimale pour l'instant :

```ts
// src/app/query-client.ts
import { QueryClient } from '@tanstack/react-query'

export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Une donnée est considérée fraîche 30 s : pendant ce délai, la
        // re-demander ne déclenche aucun appel réseau.
        staleTime: 30_000,
      },
    },
  })
}
```

### 1.3 Le routeur

TanStack Router est un routeur **par fichiers** : l'arborescence de `src/routes/` *est* la
carte des URL. Le plugin Vite (déjà configuré) génère `src/routeTree.gen.ts` à partir de
ces fichiers, et **tout devient typé** — un lien vers une route inexistante est une erreur
de compilation.

```ts
// src/app/router.ts
import type { QueryClient } from '@tanstack/react-query'
import { createRouter, type RouterHistory } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'

// Fabrique unique du routeur : l'application l'utilise avec l'history
// navigateur, les tests injectent une memory history pour piloter l'URL.
// Le queryClient passe par le contexte du routeur : les loaders y accèdent.
export function createAppRouter(queryClient: QueryClient, history?: RouterHistory) {
  return createRouter({
    routeTree,
    context: { queryClient },
    ...(history ? { history } : {}),
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
```

(L'import `@/routeTree.gen` est rouge dans l'éditeur : le fichier sera généré en 1.5.)

### 1.4 Les routes

La **route racine** : le layout global, avec les devtools chargées uniquement en dev :

```tsx
// src/routes/__root.tsx
import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'

// Les devtools ne sont chargées qu'en dev : jamais en prod, ni pendant les tests.
const devtoolsDisabled = import.meta.env.PROD || import.meta.env.TEST

const RouterDevtools = devtoolsDisabled
  ? () => null
  : lazy(() =>
      import('@tanstack/react-router-devtools').then((mod) => ({
        default: mod.TanStackRouterDevtools,
      })),
    )

const QueryDevtools = devtoolsDisabled
  ? () => null
  : lazy(() =>
      import('@tanstack/react-query-devtools').then((mod) => ({
        default: mod.ReactQueryDevtools,
      })),
    )

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
})

function RootLayout() {
  return (
    <>
      <Outlet />
      <Suspense>
        <RouterDevtools />
        <QueryDevtools />
      </Suspense>
    </>
  )
}
```

`<Outlet />` = "la route enfant se rend ici". La route `/` redirige vers la locale par
défaut (`throw redirect(...)` : dans TanStack Router, une redirection est une exception
que le routeur attrape) :

```tsx
// src/routes/index.tsx
import { createFileRoute, redirect } from '@tanstack/react-router'
import { defaultLocale } from '@/shared/config/i18n'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: '/$locale', params: { locale: defaultLocale } })
  },
})
```

Le **layout du segment de langue** (`$` = paramètre dynamique) : il parse la locale et
affiche l'en-tête avec le sélecteur FR/EN — des **liens typés** :

```tsx
// src/routes/$locale/route.tsx
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
```

Et la **page d'accueil** (une petite vitrine du kit UI, en attendant les vraies pages) :

```tsx
// src/routes/$locale/index.tsx
import { createFileRoute } from '@tanstack/react-router'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Skeleton } from '@/shared/ui/skeleton'

export const Route = createFileRoute('/$locale/')({
  component: HomePage,
})

function HomePage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fondations UI</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Button>Valider</Button>
      </CardContent>
    </Card>
  )
}
```

### 1.5 Générer l'arbre de routes

Le plugin génère `src/routeTree.gen.ts` au démarrage de Vite. **À chaque fois que vous
créez un fichier de route**, lancez le serveur quelques secondes :

```bash
pnpm dev    # attendre "ready", puis Ctrl+C — src/routeTree.gen.ts est généré
# npm : npm run dev
```

Ouvrir <http://localhost:5173> avant de couper : `/` redirige vers `/fr`, l'accueil
s'affiche, les liens FR/EN naviguent sans rechargement. (Ce fichier généré est ignoré par
Biome et ESLint — on ne lint pas du code généré — mais il est versionné avec le projet.)

### 1.6 L'infrastructure de test

`src/test/setup.ts` (fourni) attend deux choses. D'abord le serveur MSW — l'intercepteur
réseau des tests :

```ts
// src/test/server.ts
import { setupServer } from 'msw/node'

// Serveur MSW partagé par tous les tests : démarré sans handler, chaque test
// déclare les siens via server.use(...). Toute requête non déclarée est une
// erreur (onUnhandledRequest: 'error' dans setup.ts) — pas d'appel fantôme.
export const server = setupServer()
```

Ensuite le montage de l'app à une URL donnée — **les tests pilotent l'application par ses
URL**, comme un navigateur :

```tsx
// src/test/render.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { render } from '@testing-library/react'
import { createAppRouter } from '@/app/router'

// retry: false — en test, un échec doit échouer tout de suite, pas après
// trois tentatives espacées. Le reste du comportement reste celui de l'app.
export function makeTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
}

// Monte l'application complète (routeur + query client) à une URL donnée,
// comme le ferait un navigateur — les tests pilotent l'app par ses URL.
export function renderAt(url: string, queryClient = makeTestQueryClient()) {
  const router = createAppRouter(queryClient, createMemoryHistory({ initialEntries: [url] }))
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return { router, queryClient }
}
```

### 1.7 Les premiers tests

On teste par **rôles accessibles** (`heading`, `link`) : si le test passe, la page est
aussi correctement structurée pour un lecteur d'écran.

```tsx
// src/app/router.test.tsx
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderAt } from '@/test/render'

describe('routeur', () => {
  it('redirige / vers /fr et affiche la page d’accueil', async () => {
    const { router } = renderAt('/')

    expect(await screen.findByRole('heading', { level: 1, name: 'Coffee Client' })).toBeVisible()
    expect(screen.getByText('Fondations UI')).toBeVisible()
    expect(router.state.location.pathname).toBe('/fr')
  })

  it('sert la page d’accueil sous /en', async () => {
    const { router } = renderAt('/en')

    expect(await screen.findByRole('heading', { level: 1, name: 'Coffee Client' })).toBeVisible()
    expect(router.state.location.pathname).toBe('/en')
  })

  it('retombe sur la locale par défaut pour une locale inconnue', async () => {
    renderAt('/de')

    // La page rend sans planter : la locale invalide a été remplacée par 'fr'.
    expect(await screen.findByRole('heading', { level: 1, name: 'Coffee Client' })).toBeVisible()
  })

  it('un lien typé change de locale', async () => {
    const user = userEvent.setup()
    const { router } = renderAt('/fr')
    await screen.findByRole('heading', { level: 1, name: 'Coffee Client' })

    await user.click(screen.getByRole('link', { name: 'en' }))

    expect(router.state.location.pathname).toBe('/en')
  })
})
```

### ✅ Vérifier l'étape 1

```bash
pnpm run verify   # typecheck ✓ · biome ci ✓ · eslint ✓ · 4 tests ✓ · build ✓
# npm : npm run verify
git add -A && git commit -m "feat: fondations — routeur, query client, i18n, tests"
```

---

## Étape 2 — Couche données : `http()` + Zod, `Money`, schémas

Objectif : la tuyauterie entre l'app et l'API — avec deux principes non négociables :
**toute donnée entrante passe par un schéma Zod** (une API qui change de forme produit une
erreur franche à la frontière, pas un `NaN` trois composants plus loin), et **le prix
n'est jamais un `number` nu** dans l'application.

### 2.1 Le type `Money`

```ts
// src/shared/money/money.ts
// Le domaine ne manipule jamais un prix `number` nu : un montant est toujours
// un Money — centimes entiers + devise. La forme "wire" (ce que le backend
// envoie) ne sort jamais de l'adapter (schemas de feature).
export type Money = {
  readonly amount: number
  readonly currency: 'EUR'
}

export function eur(amount: number): Money {
  if (!Number.isInteger(amount)) {
    throw new TypeError(`Un montant Money est en centimes entiers, reçu : ${amount}`)
  }
  return { amount, currency: 'EUR' }
}

// Intl.NumberFormat est coûteux à construire : un formateur par couple
// locale+devise, mémorisé pour toute la durée de vie de l'application.
const formatters = new Map<string, Intl.NumberFormat>()

export function formatPrice(money: Money, locale = 'fr'): string {
  const key = `${locale}:${money.currency}`
  let formatter = formatters.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { style: 'currency', currency: money.currency })
    formatters.set(key, formatter)
  }
  return formatter.format(money.amount / 100)
}
```

Et son test unitaire :

```ts
// src/shared/money/money.test.ts
import { describe, expect, it } from 'vitest'
import { eur, formatPrice } from './money'

describe('eur', () => {
  it('construit un Money en centimes entiers', () => {
    expect(eur(250)).toEqual({ amount: 250, currency: 'EUR' })
  })

  it('refuse un montant non entier', () => {
    expect(() => eur(2.5)).toThrow(TypeError)
  })
})

describe('formatPrice', () => {
  it('formate en euros selon la locale', () => {
    expect(formatPrice(eur(250), 'fr')).toMatch(/2,50\s*€/)
    expect(formatPrice(eur(250), 'en')).toBe('€2.50')
  })
})
```

### 2.2 Le wrapper HTTP

Un point de passage **unique** pour tout le réseau : préfixe `/api` (le proxy Vite fait le
reste), en-têtes JSON, erreurs **typées** (`ApiError`, `ValidationError` qui parse le body
400 du backend), un emplacement pour le futur JWT, et le parse Zod de chaque réponse :

```ts
// src/shared/api/http.ts
import { z } from 'zod'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message = `HTTP ${status}`) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// Le backend répond 400 avec un body { [champ]: message } : on le parse pour
// pouvoir ventiler chaque message sous le bon champ de formulaire.
export class ValidationError extends ApiError {
  readonly fieldErrors: Record<string, string>

  constructor(fieldErrors: Record<string, string>) {
    super(400, 'Validation refusée par le serveur')
    this.name = 'ValidationError'
    this.fieldErrors = fieldErrors
  }
}

const FieldErrorsSchema = z.record(z.string(), z.string())

// Fournira le JWT quand l'authentification arrivera ; no-op en attendant.
type TokenProvider = () => string | null | Promise<string | null>
let tokenProvider: TokenProvider = () => null

export function registerTokenProvider(provider: TokenProvider): void {
  tokenProvider = provider
}

// Frontière HTTP unique : toute réponse traverse un schéma Zod avant
// d'entrer dans l'application. Aucune donnée non parsée ne circule.
export async function http<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  const token = await tokenProvider()
  const headers = new Headers(init?.headers)
  headers.set('Accept', 'application/json')
  if (init?.body != null) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const base = typeof location === 'undefined' ? 'http://localhost' : location.origin
  const response = await fetch(new URL(`/api${path}`, base), { ...init, headers })

  if (response.status === 400) {
    const body: unknown = await response.json().catch(() => null)
    const fields = FieldErrorsSchema.safeParse(body)
    throw new ValidationError(fields.success ? fields.data : {})
  }
  if (!response.ok) {
    throw new ApiError(response.status)
  }

  const data: unknown = await response.json()
  return schema.parse(data)
}
```

### 2.3 Les schémas de la feature coffees

C'est ici que la dette backend est confinée : **une seule ligne** (`WirePrice`) sait que
le wire est un entier en centimes. Le jour où le backend passe à BigDecimal-string, on
change cette ligne et rien d'autre.

```ts
// src/features/coffees/schemas/coffee.ts
import { z } from 'zod'
import { eur, type Money } from '@/shared/money/money'

// Toute la dette backend « price est un int en centimes » tient sur cette
// ligne : le jour où le serveur passe à BigDecimal sérialisé en chaîne, seul
// WirePrice change — le reste de l'application ne voit que des Money.
export const WirePrice = z.number().int().transform(eur)

// Écriture symétrique : Money du domaine → forme wire attendue par le backend.
export function toWirePrice(money: Money): number {
  return money.amount
}

export const CoffeeSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  price: WirePrice,
})

export type Coffee = z.infer<typeof CoffeeSchema>

// Page Spring générique : réutilisable pour n'importe quel contenu paginé.
export function pageOf<T extends z.ZodType>(item: T) {
  return z.object({
    content: z.array(item),
    number: z.number().int(),
    size: z.number().int(),
    totalElements: z.number().int(),
    totalPages: z.number().int(),
  })
}

export const CoffeePageSchema = pageOf(CoffeeSchema)
export type CoffeePage = z.infer<typeof CoffeePageSchema>
```

### 2.4 Les appels API et les query options

Les appels réseau de la feature — chaque appel donne son schéma à `http()`. Les imports
sont **relatifs** à l'intérieur d'une feature (l'alias `@/features/...` y est interdit par
la règle de lint sur les frontières) :

```ts
// src/features/coffees/api/coffees.ts
import { http } from '@/shared/api/http'
import { CoffeePageSchema, CoffeeSchema } from '../schemas/coffee'

export function listCoffeesPaged(page: number, size: number) {
  const search = new URLSearchParams({ page: String(page), size: String(size) })
  return http(`/coffees/paged?${search}`, CoffeePageSchema)
}

export function getCoffee(id: number) {
  return http(`/coffees/${id}`, CoffeeSchema)
}
```

Puis la **factory de query keys** et les `queryOptions` co-localisées — la clé et la
fonction de fetch définies ensemble, une seule fois :

```ts
// src/features/coffees/queries/coffees.ts
import { queryOptions } from '@tanstack/react-query'
import { getCoffee, listCoffeesPaged } from '../api/coffees'

export const PAGE_SIZE = 10

// Factory hiérarchique : invalider coffeeKeys.lists() touche toutes les pages
// sans toucher les détails ; coffeeKeys.all rase tout le domaine coffees.
export const coffeeKeys = {
  all: ['coffees'] as const,
  lists: () => [...coffeeKeys.all, 'list'] as const,
  list: (page: number, size: number) => [...coffeeKeys.lists(), { page, size }] as const,
  details: () => [...coffeeKeys.all, 'detail'] as const,
  detail: (id: number) => [...coffeeKeys.details(), id] as const,
}

export function coffeesPageOptions(page: number, size: number = PAGE_SIZE) {
  return queryOptions({
    queryKey: coffeeKeys.list(page, size),
    queryFn: () => listCoffeesPaged(page, size),
  })
}

export function coffeeDetailOptions(id: number) {
  return queryOptions({
    queryKey: coffeeKeys.detail(id),
    queryFn: () => getCoffee(id),
  })
}
```

### 2.5 Affiner le retry du query client

Maintenant qu'on a des erreurs typées, on encode une réalité : réessayer un 500 ou une
coupure réseau peut réussir ; réessayer un 404 ou une réponse malformée redonnera
exactement la même erreur. **Remplacer** `src/app/query-client.ts` :

```ts
// src/app/query-client.ts
import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/shared/api/http'

export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // On ne réessaie que ce qui peut réussir au second coup : pannes
        // serveur (5xx) et échecs réseau. Un 4xx ou une dérive de contrat
        // (ZodError) donnera exactement la même réponse — inutile d'insister.
        retry: (failureCount, error) => {
          if (failureCount >= 3) return false
          if (error instanceof ApiError) return error.status >= 500
          return error instanceof TypeError
        },
      },
    },
  })
}
```

### ✅ Vérifier l'étape 2

```bash
pnpm run verify   # 7 tests ✓ (4 routeur + 3 money)
# npm : npm run verify
git add -A && git commit -m "feat: couche données — http+zod, Money, schémas, query keys"
```

---

## Étape 3 — La liste des cafés

Objectif : la première vraie page, `/fr/coffees` — et la preuve par les tests que la
frontière Zod protège réellement l'application.

### 3.1 Le composant liste

Un composant **présentationnel** : il reçoit les données en props, il ne sait pas d'où
elles viennent. Plus simple à tester, réutilisable partout :

```tsx
// src/features/coffees/components/coffee-list.tsx
import type { Locale } from '@/shared/config/i18n'
import { formatPrice } from '@/shared/money/money'
import type { Coffee } from '../schemas/coffee'

// Composant présentationnel : la donnée vient d'en haut (la route possède la
// query, car la page affichée est pilotée par l'URL).
export function CoffeeList({ coffees, locale }: { coffees: Coffee[]; locale: Locale }) {
  if (coffees.length === 0) {
    return <p className="text-muted-foreground">Aucun café pour l'instant.</p>
  }

  return (
    <ul className="flex flex-col gap-2">
      {coffees.map((coffee) => (
        <li
          key={coffee.id}
          className="flex items-center justify-between rounded-lg border border-border p-3"
        >
          <span>{coffee.name}</span>
          <span className="text-muted-foreground">{formatPrice(coffee.price, locale)}</span>
        </li>
      ))}
    </ul>
  )
}
```

### 3.2 Le barrel : l'API publique de la feature

Le reste de l'application importe `@/features/coffees`, **jamais** ses sous-dossiers (la
règle `noRestrictedImports` de Biome y veille) :

```ts
// src/features/coffees/index.ts
// Point d'entrée public de la feature "coffees" — seul chemin d'import autorisé
// depuis l'extérieur (app/, routes/, autres features). Les sous-dossiers
// (api, components, hooks, queries, schemas) ne s'importent jamais directement.
export { CoffeeList } from './components/coffee-list'
export { coffeeDetailOptions, coffeeKeys, coffeesPageOptions, PAGE_SIZE } from './queries/coffees'
export type { Coffee, CoffeePage } from './schemas/coffee'
```

### 3.3 La page

Trois issues possibles, trois rendus : donnée → liste ; chargement → squelette ; panne →
`errorComponent` de la route (le `throw query.error` relance l'erreur vers cette boundary).

```tsx
// src/routes/$locale/coffees/index.tsx
import { useQuery, useQueryErrorResetBoundary } from '@tanstack/react-query'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'
import { CoffeeList, coffeesPageOptions } from '@/features/coffees'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'

export const Route = createFileRoute('/$locale/coffees/')({
  errorComponent: CoffeesError,
  component: CoffeesPage,
})

function CoffeesPage() {
  const { locale } = Route.useParams()
  // Toujours la première page pour l'instant — la pagination arrive à
  // l'étape suivante.
  const query = useQuery(coffeesPageOptions(0))

  if (query.isError) {
    throw query.error
  }
  if (query.isPending) {
    return <CoffeeListSkeleton />
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">Nos cafés</h2>
      <CoffeeList coffees={query.data.content} locale={locale} />
    </section>
  )
}

function CoffeeListSkeleton() {
  return (
    <div role="status" className="flex flex-col gap-2" aria-label="Chargement des cafés">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  )
}

// Panne (réseau, 5xx, dérive de contrat) : on l'affiche, on propose de
// réessayer. Le reset de React Query est indispensable : sans lui, la query
// en erreur resterait en erreur et le retry re-planterait immédiatement.
function CoffeesError() {
  const router = useRouter()
  const { reset } = useQueryErrorResetBoundary()

  useEffect(() => {
    reset()
  }, [reset])

  return (
    <div role="alert" className="flex flex-col gap-3 rounded-lg border border-destructive p-4">
      <p className="font-medium text-destructive">Impossible de charger les cafés.</p>
      <p className="text-muted-foreground text-sm">
        Le serveur est peut-être indisponible, ou sa réponse n'a pas la forme attendue.
      </p>
      <Button variant="outline" onClick={() => router.invalidate()}>
        Réessayer
      </Button>
    </div>
  )
}
```

### 3.4 Le lien dans l'en-tête

Dans `src/routes/$locale/route.tsx`, ajouter la navigation principale **entre** `</h1>` et
`<nav aria-label="Langue"…>` :

```tsx
        <nav aria-label="Principal" className="text-sm">
          <Link
            to="/$locale/coffees"
            params={{ locale }}
            className="text-muted-foreground"
            activeProps={{ className: 'font-semibold text-foreground' }}
          >
            Cafés
          </Link>
        </nav>
```

### 3.5 Les tests signature

MSW intercepte **au niveau réseau** : `fetch`, `http()`, Zod, Query — tout le code de
production s'exécute réellement, seule la réponse est simulée. Les handlers parlent le
**format wire** (centimes entiers), comme le vrai backend :

```tsx
// src/features/coffees/components/coffee-list.test.tsx
import { screen } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { renderAt } from '@/test/render'
import { server } from '@/test/server'

// Les handlers MSW parlent le format WIRE (price en centimes entiers) : ils
// simulent le backend réel, pas notre modèle de domaine.
function wirePage(content: Array<{ id: number; name: string; price: unknown }>) {
  return {
    content,
    number: 0,
    size: 10,
    totalElements: content.length,
    totalPages: 1,
  }
}

describe('liste des cafés', () => {
  it('affiche les cafés avec leur prix formaté', async () => {
    server.use(
      http.get('/api/coffees/paged', () =>
        HttpResponse.json(
          wirePage([
            { id: 1, name: 'Espresso', price: 250 },
            { id: 2, name: 'Cappuccino', price: 420 },
          ]),
        ),
      ),
    )

    renderAt('/fr/coffees')

    expect(await screen.findByText('Espresso')).toBeVisible()
    expect(screen.getByText('Cappuccino')).toBeVisible()
    // 250 centimes wire → Money → 2,50 € formaté (l'adapter a traduit).
    expect(screen.getByText(/2,50\s*€/)).toBeVisible()
    expect(screen.getByText(/4,20\s*€/)).toBeVisible()
  })

  it('détecte une dérive de contrat : price en string déclenche l’écran d’erreur', async () => {
    server.use(
      http.get('/api/coffees/paged', () =>
        HttpResponse.json(wirePage([{ id: 1, name: 'Espresso', price: '2.50' }])),
      ),
    )

    renderAt('/fr/coffees')

    // Le schéma Zod refuse le payload à la frontière : l'app affiche une
    // panne franche au lieu de propager des données corrompues.
    expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de charger les cafés')
    expect(screen.queryByText('Espresso')).not.toBeInTheDocument()
  })
})
```

Le deuxième test est le plus important du projet : si le backend change le type de
`price`, l'application affiche une **panne franche** — jamais des données corrompues.

### ✅ Vérifier l'étape 3

```bash
pnpm dev          # régénérer routeTree.gen.ts (nouvelle route), Ctrl+C
pnpm run verify   # 9 tests ✓
# npm : npm run dev · npm run verify
git add -A && git commit -m "feat: liste des cafés + test de dérive de contrat"
```

Avec le backend lancé : <http://localhost:5173/fr/coffees> affiche la vraie liste via le
proxy. Sans backend : l'écran d'erreur avec « Réessayer ».

---

## Étape 4 — Pagination pilotée par l'URL

Objectif : la page affichée vit dans l'URL (`?page=2`), pas dans un `useState`.
Rechargement, partage de lien, bouton Retour : tout marche, parce que **l'URL est l'état**.

### 4.1 `keepPreviousData` dans les query options

Dans `src/features/coffees/queries/coffees.ts` : ajouter `keepPreviousData` à l'import et
`placeholderData` aux options de page —

```ts
import { keepPreviousData, queryOptions } from '@tanstack/react-query'
```

```ts
export function coffeesPageOptions(page: number, size: number = PAGE_SIZE) {
  return queryOptions({
    queryKey: coffeeKeys.list(page, size),
    queryFn: () => listCoffeesPaged(page, size),
    // Pendant le chargement de la page N+1, on continue d'afficher la page N
    // au lieu d'un flash de skeleton — la navigation paraît instantanée.
    placeholderData: keepPreviousData,
  })
}
```

### 4.2 Le préchargement à l'intention

Dans `src/app/router.ts`, ajouter deux options à `createRouter` (après
`context: { queryClient },`) :

```ts
    // Survoler un lien précharge sa route (loader compris) : la page suivante
    // est souvent déjà en cache au moment du clic. staleTime 0 côté routeur :
    // c'est React Query qui décide de la fraîcheur, pas le routeur.
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
```

### 4.3 La page paginée

**Remplacer intégralement** `src/routes/$locale/coffees/index.tsx`. Les nouveautés :
`validateSearch` (la query string est parsée — `?page=banane` retombe sur 0), `loaderDeps`
+ `loader` (le routeur demande à Query de remplir le cache **sans bloquer** la
navigation), et les liens Précédent/Suivant avec **updater fonctionnel** sur la search
string :

```tsx
// src/routes/$locale/coffees/index.tsx
import { useQuery, useQueryErrorResetBoundary } from '@tanstack/react-query'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'
import { z } from 'zod'
import { CoffeeList, coffeesPageOptions } from '@/features/coffees'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'

// La query string est une entrée utilisateur : on la parse. Tout ce qui n'est
// pas un entier ≥ 0 (`?page=banane`, `?page=-3`) retombe sur la page 0.
const CoffeesSearchSchema = z.object({
  page: z.coerce.number().int().min(0).catch(0),
})

export const Route = createFileRoute('/$locale/coffees/')({
  validateSearch: (search) => CoffeesSearchSchema.parse(search),
  // Le loader ne dépend que de `page` : il ne re-tourne pas si un autre
  // paramètre de recherche change un jour.
  loaderDeps: ({ search }) => ({ page: search.page }),
  // Réchauffe le cache sans bloquer la navigation : l'URL change tout de
  // suite, keepPreviousData affiche l'ancienne page pendant le chargement.
  // L'erreur éventuelle est déjà portée par la query (le composant la relance
  // vers l'errorComponent) — le catch évite juste une rejection non gérée.
  loader: ({ context: { queryClient }, deps: { page } }) => {
    void queryClient.ensureQueryData(coffeesPageOptions(page)).catch(() => {})
  },
  errorComponent: CoffeesError,
  component: CoffeesPage,
})

function CoffeesPage() {
  const { locale } = Route.useParams()
  const { page } = Route.useSearch()
  const query = useQuery(coffeesPageOptions(page))

  if (query.isError) {
    throw query.error
  }
  if (query.isPending) {
    return <CoffeeListSkeleton />
  }

  const { content, number, totalPages } = query.data
  const isFirst = number <= 0
  const isLast = number + 1 >= totalPages

  return (
    <section className={`flex flex-col gap-4 ${query.isPlaceholderData ? 'opacity-60' : ''}`}>
      <h2 className="text-xl font-semibold">Nos cafés</h2>
      <CoffeeList coffees={content} locale={locale} />
      <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
        <Link
          from={Route.fullPath}
          search={(prev) => ({ ...prev, page: number - 1 })}
          disabled={isFirst}
          aria-disabled={isFirst}
          className={isFirst ? 'text-muted-foreground/50' : 'text-foreground'}
        >
          ← Précédent
        </Link>
        <span className="text-muted-foreground">
          Page {number + 1} / {Math.max(totalPages, 1)}
        </span>
        <Link
          from={Route.fullPath}
          search={(prev) => ({ ...prev, page: number + 1 })}
          disabled={isLast}
          aria-disabled={isLast}
          className={isLast ? 'text-muted-foreground/50' : 'text-foreground'}
        >
          Suivant →
        </Link>
      </nav>
    </section>
  )
}

function CoffeeListSkeleton() {
  return (
    <div role="status" className="flex flex-col gap-2" aria-label="Chargement des cafés">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  )
}

// Panne (réseau, 5xx, dérive de contrat) : on l'affiche, on propose de
// réessayer. Le reset de React Query est indispensable : sans lui, la query
// en erreur resterait en erreur et le retry re-planterait immédiatement.
function CoffeesError() {
  const router = useRouter()
  const { reset } = useQueryErrorResetBoundary()

  useEffect(() => {
    reset()
  }, [reset])

  return (
    <div role="alert" className="flex flex-col gap-3 rounded-lg border border-destructive p-4">
      <p className="font-medium text-destructive">Impossible de charger les cafés.</p>
      <p className="text-muted-foreground text-sm">
        Le serveur est peut-être indisponible, ou sa réponse n'a pas la forme attendue.
      </p>
      <Button variant="outline" onClick={() => router.invalidate()}>
        Réessayer
      </Button>
    </div>
  )
}
```

### 4.4 Le lien « Cafés » doit fournir la page

La route a maintenant une search string obligatoire : le typage **exige** de la fournir.
Dans `src/routes/$locale/route.tsx`, ajouter `search={{ page: 0 }}` au lien Cafés :

```tsx
          <Link
            to="/$locale/coffees"
            params={{ locale }}
            search={{ page: 0 }}
            className="text-muted-foreground"
            activeProps={{ className: 'font-semibold text-foreground' }}
          >
            Cafés
          </Link>
```

(C'est le routeur typé au travail : oublier ce paramètre est une **erreur de
compilation**, pas un bug en production.)

### 4.5 Les tests

```tsx
// src/app/coffees-pagination.test.tsx
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { renderAt } from '@/test/render'
import { server } from '@/test/server'

// Le handler simule un backend paginé au format wire : la page demandée est
// lue dans l'URL, exactement comme le ferait Spring.
const wireCoffees = [
  { id: 1, name: 'Espresso', price: 250 },
  { id: 2, name: 'Ristretto', price: 230 },
]

function pagedHandler() {
  return http.get('/api/coffees/paged', ({ request }) => {
    const page = Number(new URL(request.url).searchParams.get('page') ?? '0')
    const coffee = wireCoffees[page]
    return HttpResponse.json({
      content: coffee ? [coffee] : [],
      number: page,
      size: 10,
      totalElements: wireCoffees.length,
      totalPages: wireCoffees.length,
    })
  })
}

describe('pagination pilotée par l’URL', () => {
  it('?page=banane retombe sur la page 0 sans crash', async () => {
    server.use(pagedHandler())

    const { router } = renderAt('/fr/coffees?page=banane')

    expect(await screen.findByText('Espresso')).toBeVisible()
    expect(screen.getByText('Page 1 / 2')).toBeVisible()
    expect(router.state.location.search).toEqual({ page: 0 })
  })

  it('naviguer avec Suivant change l’URL et les données', async () => {
    server.use(pagedHandler())
    const user = userEvent.setup()

    const { router } = renderAt('/fr/coffees')
    expect(await screen.findByText('Espresso')).toBeVisible()

    await user.click(screen.getByRole('link', { name: /Suivant/ }))

    expect(await screen.findByText('Ristretto')).toBeVisible()
    expect(router.state.location.search).toEqual({ page: 1 })
    expect(screen.queryByText('Espresso')).not.toBeInTheDocument()
    expect(screen.getByText('Page 2 / 2')).toBeVisible()
  })

  it('une page négative retombe aussi sur 0', async () => {
    server.use(pagedHandler())

    const { router } = renderAt('/fr/coffees?page=-3')

    expect(await screen.findByText('Espresso')).toBeVisible()
    expect(router.state.location.search).toEqual({ page: 0 })
  })
})
```

### ✅ Vérifier l'étape 4

```bash
pnpm run verify   # 12 tests ✓
# npm : npm run verify
git add -A && git commit -m "feat: pagination pilotée par l'URL"
```

Avec le backend : F5 sur `?page=2` ré-affiche la page 2 ; `?page=banane` affiche la
page 0 ; survoler « Suivant » précharge la page suivante (onglet Réseau).

---

## Étape 5 — Détail et sémantique d'erreur

Objectif : la page `/fr/coffees/42` — et une discipline d'erreur stricte : **le fait
métier** (« ce café n'existe pas » → page 404 calme) n'est pas **la panne technique**
(« le serveur ne répond pas » → écran rouge avec retry). Confondre les deux, c'est mentir
à l'utilisateur.

### 5.1 Le seed-from-list dans les queries

L'utilisateur vient presque toujours de la liste : le café qu'il veut voir est **déjà dans
le cache**. On s'en sert pour une navigation instantanée. **Remplacer intégralement**
`src/features/coffees/queries/coffees.ts` (la signature de `coffeeDetailOptions` change :
le seed a besoin du `queryClient`) :

```ts
// src/features/coffees/queries/coffees.ts
import { keepPreviousData, type QueryClient, queryOptions } from '@tanstack/react-query'
import { getCoffee, listCoffeesPaged } from '../api/coffees'
import type { Coffee, CoffeePage } from '../schemas/coffee'

export const PAGE_SIZE = 10

// Factory hiérarchique : invalider coffeeKeys.lists() touche toutes les pages
// sans toucher les détails ; coffeeKeys.all rase tout le domaine coffees.
export const coffeeKeys = {
  all: ['coffees'] as const,
  lists: () => [...coffeeKeys.all, 'list'] as const,
  list: (page: number, size: number) => [...coffeeKeys.lists(), { page, size }] as const,
  details: () => [...coffeeKeys.all, 'detail'] as const,
  detail: (id: number) => [...coffeeKeys.details(), id] as const,
}

export function coffeesPageOptions(page: number, size: number = PAGE_SIZE) {
  return queryOptions({
    queryKey: coffeeKeys.list(page, size),
    queryFn: () => listCoffeesPaged(page, size),
    // Pendant le chargement de la page N+1, on continue d'afficher la page N
    // au lieu d'un flash de skeleton — la navigation paraît instantanée.
    placeholderData: keepPreviousData,
  })
}

// Seed-from-list : si le café est déjà passé dans une page de liste en cache
// (ou dans le cache détail), on peut l'afficher immédiatement pendant que la
// version fraîche arrive en arrière-plan.
export function coffeeFromCache(queryClient: QueryClient, id: number): Coffee | undefined {
  const detail = queryClient.getQueryData<Coffee>(coffeeKeys.detail(id))
  if (detail) return detail
  for (const [, page] of queryClient.getQueriesData<CoffeePage>({ queryKey: coffeeKeys.lists() })) {
    const hit = page?.content.find((coffee) => coffee.id === id)
    if (hit) return hit
  }
  return undefined
}

export function coffeeDetailOptions(queryClient: QueryClient, id: number) {
  return queryOptions({
    queryKey: coffeeKeys.detail(id),
    queryFn: () => getCoffee(id),
    placeholderData: () => coffeeFromCache(queryClient, id),
  })
}
```

### 5.2 La carte détail

```tsx
// src/features/coffees/components/coffee-detail.tsx
import type { Locale } from '@/shared/config/i18n'
import { formatPrice } from '@/shared/money/money'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import type { Coffee } from '../schemas/coffee'

export function CoffeeDetail({ coffee, locale }: { coffee: Coffee; locale: Locale }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{coffee.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{formatPrice(coffee.price, locale)}</p>
      </CardContent>
    </Card>
  )
}
```

### 5.3 Les lignes de la liste deviennent des liens

**Remplacer intégralement** `src/features/coffees/components/coffee-list.tsx` — avec le
préchargement à l'intention (étape 4), survoler une ligne précharge son détail :

```tsx
// src/features/coffees/components/coffee-list.tsx
import { Link } from '@tanstack/react-router'
import type { Locale } from '@/shared/config/i18n'
import { formatPrice } from '@/shared/money/money'
import type { Coffee } from '../schemas/coffee'

// Composant présentationnel : la donnée vient d'en haut (la route possède la
// query, car la page affichée est pilotée par l'URL).
export function CoffeeList({ coffees, locale }: { coffees: Coffee[]; locale: Locale }) {
  if (coffees.length === 0) {
    return <p className="text-muted-foreground">Aucun café pour l'instant.</p>
  }

  return (
    <ul className="flex flex-col gap-2">
      {coffees.map((coffee) => (
        <li key={coffee.id}>
          <Link
            to="/$locale/coffees/$coffeeId"
            params={{ locale, coffeeId: coffee.id }}
            className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted"
          >
            <span>{coffee.name}</span>
            <span className="text-muted-foreground">{formatPrice(coffee.price, locale)}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
```

### 5.4 La route détail

Le cœur de l'étape. Trois idées :

1. **L'id n'a pas de valeur de repli** : la locale (`/de` → `fr`) et la page
   (`?page=banane` → 0) avaient un défaut raisonnable ; remplacer `/coffees/banane` par
   `/coffees/1` afficherait un café au hasard. Un id illisible = une URL qui n'existe pas
   → `notFound()`, levé **avant** qu'une requête parte.
2. **Le loader traduit le protocole en métier** : l'API dit « HTTP 404 », le domaine dit
   « ce café n'existe pas » (`ApiError(404)` → `throw notFound()`).
3. **Deux écrans distincts** : `notFoundComponent` (métier, calme) et `errorComponent`
   (panne, rouge, avec retry).

```tsx
// src/routes/$locale/coffees/$coffeeId.tsx
import { useQuery, useQueryClient, useQueryErrorResetBoundary } from '@tanstack/react-query'
import { createFileRoute, Link, notFound, useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'
import { z } from 'zod'
import { CoffeeDetail, coffeeDetailOptions, coffeeFromCache } from '@/features/coffees'
import { ApiError } from '@/shared/api/http'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'

// `.parse`, pas `.catch` : contrairement à la locale ou à la pagination, il
// n'existe aucun id "par défaut" raisonnable. /coffees/banane ne veut rien
// dire — c'est une URL qui n'existe pas (404), pas une valeur à corriger.
const CoffeeIdSchema = z.coerce.number().int().positive()

export const Route = createFileRoute('/$locale/coffees/$coffeeId')({
  params: {
    parse: (raw) => {
      const parsed = CoffeeIdSchema.safeParse(raw.coffeeId)
      // Pas de valeur de repli : un id illisible est une URL qui n'existe
      // pas. On lève notFound() avant même qu'un fetch soit envisagé.
      if (!parsed.success) throw notFound()
      return { coffeeId: parsed.data }
    },
    stringify: ({ coffeeId }) => ({ coffeeId: String(coffeeId) }),
  },
  loader: async ({ context: { queryClient }, params: { coffeeId } }) => {
    const ensure = queryClient.ensureQueryData(coffeeDetailOptions(queryClient, coffeeId))
    if (coffeeFromCache(queryClient, coffeeId)) {
      // Déjà de quoi afficher (seed-from-list) : navigation instantanée, la
      // version fraîche arrive en arrière-plan ; une éventuelle erreur sera
      // portée par la query et traitée au rendu.
      ensure.catch(() => {})
      return
    }
    try {
      await ensure
    } catch (error) {
      // 404 = fait métier ("ce café n'existe pas"), pas une panne : on le
      // convertit en notFound() pour rendre la page 404 métier.
      if (error instanceof ApiError && error.status === 404) throw notFound()
      throw error
    }
  },
  notFoundComponent: CoffeeNotFound,
  errorComponent: CoffeeDetailError,
  component: CoffeeDetailPage,
})

function CoffeeDetailPage() {
  const { locale, coffeeId } = Route.useParams()
  const queryClient = useQueryClient()
  const query = useQuery(coffeeDetailOptions(queryClient, coffeeId))

  if (query.isError) {
    // Cas seed-from-list : le fetch en arrière-plan peut découvrir que le
    // café a été supprimé entre-temps — même sémantique que dans le loader.
    if (query.error instanceof ApiError && query.error.status === 404) throw notFound()
    throw query.error
  }
  if (query.isPending) {
    return (
      <div role="status" aria-label="Chargement du café">
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  return (
    <section className="flex flex-col gap-4">
      <CoffeeDetail coffee={query.data} locale={locale} />
      <Link
        to="/$locale/coffees"
        params={{ locale }}
        search={{ page: 0 }}
        className="text-muted-foreground text-sm"
      >
        ← Tous les cafés
      </Link>
    </section>
  )
}

// 404 métier : l'application fonctionne parfaitement, c'est la ressource qui
// n'existe pas. Ton calme, pas de rouge, une porte de sortie.
function CoffeeNotFound() {
  const { locale } = Route.useParams()
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <h2 className="text-xl font-semibold">Café introuvable</h2>
      <p className="text-muted-foreground">
        Ce café n'existe pas ou n'existe plus. Il a peut-être été retiré de la carte.
      </p>
      <Link
        to="/$locale/coffees"
        params={{ locale }}
        search={{ page: 0 }}
        className="text-sm underline"
      >
        ← Retour à la liste des cafés
      </Link>
    </section>
  )
}

// Panne technique (5xx, réseau, dérive de contrat) : rouge, et un retry.
function CoffeeDetailError() {
  const router = useRouter()
  const { reset } = useQueryErrorResetBoundary()

  useEffect(() => {
    reset()
  }, [reset])

  return (
    <div role="alert" className="flex flex-col gap-3 rounded-lg border border-destructive p-4">
      <p className="font-medium text-destructive">Impossible de charger ce café.</p>
      <p className="text-muted-foreground text-sm">
        Le serveur est peut-être indisponible. Ce n'est pas un problème avec ce café en particulier.
      </p>
      <Button variant="outline" onClick={() => router.invalidate()}>
        Réessayer
      </Button>
    </div>
  )
}
```

### 5.5 Le 404 générique du routeur

Pour toute URL sans route correspondante :

```tsx
// src/app/default-not-found.tsx
// 404 par défaut du routeur : URL sans route correspondante (ou paramètre
// invalide, ex. /fr/coffees/banane — l'id refuse de se parser, la route ne
// matche pas). Aucune requête réseau n'a eu lieu.
export function DefaultNotFound() {
  return (
    <section className="mx-auto flex max-w-md flex-col gap-3 p-8">
      <h2 className="text-xl font-semibold">Page introuvable</h2>
      <p className="text-muted-foreground">Cette adresse ne correspond à aucune page.</p>
      <a href="/" className="text-sm underline">
        ← Retour à l'accueil
      </a>
    </section>
  )
}
```

Puis dans `src/app/router.ts` : ajouter l'import et l'option —

```ts
import { DefaultNotFound } from '@/app/default-not-found'
```

```ts
    defaultNotFoundComponent: DefaultNotFound,
```

(juste après `defaultPreloadStaleTime: 0,`).

### 5.6 Le barrel s'enrichit

**Remplacer intégralement** `src/features/coffees/index.ts` :

```ts
// src/features/coffees/index.ts
// Point d'entrée public de la feature "coffees" — seul chemin d'import autorisé
// depuis l'extérieur (app/, routes/, autres features). Les sous-dossiers
// (api, components, hooks, queries, schemas) ne s'importent jamais directement.
export { CoffeeDetail } from './components/coffee-detail'
export { CoffeeList } from './components/coffee-list'
export {
  coffeeDetailOptions,
  coffeeFromCache,
  coffeeKeys,
  coffeesPageOptions,
  PAGE_SIZE,
} from './queries/coffees'
export type { Coffee, CoffeePage } from './schemas/coffee'
```

### 5.7 Les tests signature

Le troisième test est subtil : **aucun handler n'est déclaré**, donc la moindre requête
ferait échouer le test (`onUnhandledRequest: 'error'`). La page 404 qui s'affiche prouve
qu'aucun `GET /coffees/NaN` n'a été tenté.

```tsx
// src/app/coffee-detail.test.tsx
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { renderAt } from '@/test/render'
import { server } from '@/test/server'

const wireEspresso = { id: 7, name: 'Espresso', price: 250 }

describe('détail d’un café et sémantique d’erreur', () => {
  it('affiche le détail d’un café', async () => {
    server.use(http.get('/api/coffees/7', () => HttpResponse.json(wireEspresso)))

    renderAt('/fr/coffees/7')

    expect(await screen.findByText('Espresso')).toBeVisible()
    expect(screen.getByText(/2,50\s*€/)).toBeVisible()
  })

  it('id inconnu → page 404 métier, pas un écran de panne', async () => {
    server.use(http.get('/api/coffees/999', () => new HttpResponse(null, { status: 404 })))

    renderAt('/fr/coffees/999')

    expect(await screen.findByText('Café introuvable')).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('id non numérique → 404 sans aucune requête réseau', async () => {
    // Aucun handler déclaré : la moindre requête (GET /coffees/NaN…) serait
    // une "unhandled request" et ferait apparaître l'écran de panne — la
    // page 404 prouve donc qu'aucun fetch n'a été tenté.
    renderAt('/fr/coffees/banane')

    expect(await screen.findByText('Café introuvable')).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('un 500 → écran de panne avec retry, PAS la page 404', async () => {
    let calls = 0
    server.use(
      http.get('/api/coffees/7', () => {
        calls += 1
        if (calls === 1) return new HttpResponse(null, { status: 500 })
        return HttpResponse.json(wireEspresso)
      }),
    )
    const user = userEvent.setup()

    renderAt('/fr/coffees/7')

    // Panne technique : l'alerte s'affiche, pas le message métier.
    expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de charger ce café')
    expect(screen.queryByText('Café introuvable')).not.toBeInTheDocument()

    // Le retry relance le loader : le serveur répond cette fois.
    await user.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(await screen.findByText('Espresso')).toBeVisible()
  })
})
```

### ✅ Vérifier l'étape 5

```bash
pnpm dev          # régénérer routeTree.gen.ts (nouvelle route), Ctrl+C
pnpm run verify   # 16 tests ✓
# npm : npm run dev · npm run verify
git add -A && git commit -m "feat: page détail + sémantique 404 métier vs panne"
```

---

## Étape 6 — Création : formulaire + boucle 400 → champ

Objectif : le formulaire « Nouveau café ». Principe clé : **le client valide pour l'UX, le
serveur valide pour de vrai**. Le front doit savoir afficher un 400 serveur **sous le bon
champ**, même pour une règle qu'il ne connaît pas (ex. unicité du nom).

### 6.1 Le schéma de saisie

Dans `src/features/coffees/schemas/coffee.ts`, ajouter ce bloc **après** `toWirePrice` :

```ts
// Saisie du formulaire de création : l'utilisateur tape un prix en EUROS
// ("4.20"), le schéma le transforme en Money (centimes). Aucun message
// personnalisé ici : les defaults Zod (locale fr) s'appliquent.
export const CoffeeCreateSchema = z.object({
  name: z.string().trim().min(1).max(60),
  price: z
    .string()
    .transform((raw) => Number(raw.replace(',', '.')))
    .pipe(z.number().positive())
    .transform((euros) => eur(Math.round(euros * 100))),
})

export type CoffeeCreateInput = z.input<typeof CoffeeCreateSchema>
export type CoffeeCreate = z.output<typeof CoffeeCreateSchema>
```

Un schéma avec `transform` a **deux types** : `z.input` (ce que tape l'utilisateur —
`price` est une `string`, c'est ce qu'émet un `<input>`) et `z.output` (ce que reçoit le
domaine — `price` est un `Money`). La conversion euros → centimes vit dans le schéma, à
la frontière.

### 6.2 L'appel API

Dans `src/features/coffees/api/coffees.ts` : compléter l'import des schémas puis ajouter
`createCoffee` —

```ts
import { type CoffeeCreate, CoffeePageSchema, CoffeeSchema, toWirePrice } from '../schemas/coffee'
```

```ts
export function createCoffee(input: CoffeeCreate) {
  return http('/coffees', CoffeeSchema, {
    method: 'POST',
    // L'adapter écrit le format wire : Money → centimes entiers.
    body: JSON.stringify({ name: input.name, price: toWirePrice(input.price) }),
  })
}
```

### 6.3 La mutation

```ts
// src/features/coffees/hooks/use-create-coffee.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createCoffee } from '../api/coffees'
import { coffeeKeys } from '../queries/coffees'

export function useCreateCoffee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createCoffee,
    onSuccess: (coffee) => {
      // Les pages de liste sont périmées (un élément de plus quelque part) :
      // on invalide. Le détail, lui, est déjà connu : la réponse du POST fait
      // foi, on l'écrit directement dans le cache — la navigation vers la
      // page du nouveau café sera instantanée, sans GET supplémentaire.
      queryClient.invalidateQueries({ queryKey: coffeeKeys.lists() })
      queryClient.setQueryData(coffeeKeys.detail(coffee.id), coffee)
    },
  })
}
```

Retenir la règle : **invalider ce qui est périmé, écrire ce qui est connu.**

### 6.4 La ventilation des erreurs serveur

Le backend répond 400 avec `{ [champ]: message }`. Ventiler ces clés (`string` venues du
réseau) vers `setError` (qui exige `'name' | 'price'`) demande un rétrécissement de type —
doctrine du projet : jamais de `as`, un **prédicat** vérifié à l'exécution :

```ts
// src/features/coffees/components/server-errors.ts
import type { UseFormSetError } from 'react-hook-form'
import { ValidationError } from '@/shared/api/http'
import type { CoffeeCreateInput } from '../schemas/coffee'

const formFields = ['name', 'price'] as const
type FormField = (typeof formFields)[number]

// Prédicat qui "rembourse" le rétrécissement de type : le serveur peut
// renvoyer des erreurs sur des champs que le formulaire ne connaît pas.
function isFormField(key: string): key is FormField {
  return (formFields as readonly string[]).includes(key)
}

// Boucle 400 → champ, partagée par les formulaires de création et d'édition :
// chaque message serveur atterrit sous le champ concerné, le reste en erreur
// globale (root).
export function applyServerErrors(
  error: unknown,
  setError: UseFormSetError<CoffeeCreateInput>,
  fallback: string,
): void {
  if (error instanceof ValidationError) {
    for (const [field, message] of Object.entries(error.fieldErrors)) {
      if (isFormField(field)) {
        setError(field, { type: 'server', message })
      } else {
        setError('root', { type: 'server', message })
      }
    }
    return
  }
  setError('root', { type: 'server', message: fallback })
}
```

### 6.5 Le formulaire

react-hook-form + le resolver **Standard Schema** (Zod 4 implémente nativement cette
interface commune — aucun couplage à une version précise de Zod). Champs accessibles :
`Label htmlFor`, `aria-invalid`, erreurs en `role="alert"`.

```tsx
// src/features/coffees/components/coffee-create-form.tsx
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { useForm } from 'react-hook-form'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { useCreateCoffee } from '../hooks/use-create-coffee'
import {
  type Coffee,
  type CoffeeCreate,
  type CoffeeCreateInput,
  CoffeeCreateSchema,
} from '../schemas/coffee'
import { applyServerErrors } from './server-errors'

export function CoffeeCreateForm({ onCreated }: { onCreated: (coffee: Coffee) => void }) {
  const createCoffee = useCreateCoffee()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CoffeeCreateInput, unknown, CoffeeCreate>({
    // Zod 4 implémente Standard Schema : le resolver générique suffit, sans
    // couplage à une version précise de Zod.
    resolver: standardSchemaResolver(CoffeeCreateSchema),
  })

  const onSubmit = handleSubmit(async (values) => {
    try {
      const coffee = await createCoffee.mutateAsync(values)
      onCreated(coffee)
    } catch (error) {
      applyServerErrors(error, setError, 'Impossible de créer le café. Réessayez.')
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="coffee-name">Nom</Label>
        <Input
          id="coffee-name"
          aria-invalid={errors.name ? true : undefined}
          {...register('name')}
        />
        {errors.name ? (
          <p role="alert" className="text-destructive text-sm">
            {errors.name.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="coffee-price">Prix (€)</Label>
        <Input
          id="coffee-price"
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          aria-invalid={errors.price ? true : undefined}
          {...register('price')}
        />
        {errors.price ? (
          <p role="alert" className="text-destructive text-sm">
            {errors.price.message}
          </p>
        ) : null}
      </div>

      {errors.root ? (
        <p role="alert" className="text-destructive text-sm">
          {errors.root.message}
        </p>
      ) : null}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Création…' : 'Créer le café'}
      </Button>
    </form>
  )
}
```

### 6.6 La route et les liens

```tsx
// src/routes/$locale/coffees/new.tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { CoffeeCreateForm } from '@/features/coffees'

export const Route = createFileRoute('/$locale/coffees/new')({
  component: NewCoffeePage,
})

function NewCoffeePage() {
  const { locale } = Route.useParams()
  const navigate = useNavigate()

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">Nouveau café</h2>
      <CoffeeCreateForm
        onCreated={(coffee) =>
          navigate({
            to: '/$locale/coffees/$coffeeId',
            params: { locale, coffeeId: coffee.id },
          })
        }
      />
    </section>
  )
}
```

(`/coffees/new` et `/coffees/$coffeeId` cohabitent : un segment **statique** gagne
toujours sur un segment dynamique.)

Dans `src/routes/$locale/coffees/index.tsx`, remplacer la ligne
`<h2 className="text-xl font-semibold">Nos cafés</h2>` par :

```tsx
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Nos cafés</h2>
        <Link
          to="/$locale/coffees/new"
          params={{ locale }}
          className="text-sm underline underline-offset-4"
        >
          + Ajouter un café
        </Link>
      </div>
```

### 6.7 Le barrel

**Remplacer intégralement** `src/features/coffees/index.ts` :

```ts
// src/features/coffees/index.ts
// Point d'entrée public de la feature "coffees" — seul chemin d'import autorisé
// depuis l'extérieur (app/, routes/, autres features). Les sous-dossiers
// (api, components, hooks, queries, schemas) ne s'importent jamais directement.
export { CoffeeCreateForm } from './components/coffee-create-form'
export { CoffeeDetail } from './components/coffee-detail'
export { CoffeeList } from './components/coffee-list'
export { useCreateCoffee } from './hooks/use-create-coffee'
export {
  coffeeDetailOptions,
  coffeeFromCache,
  coffeeKeys,
  coffeesPageOptions,
  PAGE_SIZE,
} from './queries/coffees'
export type { Coffee, CoffeePage } from './schemas/coffee'
```

### 6.8 Les tests signature

```tsx
// src/app/coffee-create.test.tsx
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { renderAt } from '@/test/render'
import { server } from '@/test/server'

describe('création d’un café', () => {
  it('la validation client bloque avant tout appel réseau', async () => {
    const postSpy = vi.fn()
    server.use(
      http.post('/api/coffees', () => {
        postSpy()
        return HttpResponse.json({ id: 1, name: 'x', price: 100 }, { status: 201 })
      }),
    )
    const user = userEvent.setup()

    renderAt('/fr/coffees/new')
    await screen.findByRole('heading', { name: 'Nouveau café' })

    // Formulaire vide : nom manquant, prix manquant.
    await user.click(screen.getByRole('button', { name: 'Créer le café' }))

    const alerts = await screen.findAllByRole('alert')
    expect(alerts.length).toBeGreaterThanOrEqual(2)
    expect(postSpy).not.toHaveBeenCalled()
  })

  it('une règle serveur inconnue du client s’affiche sous le bon champ', async () => {
    // Le client ne connaît aucune règle d'unicité : elle n'existe que côté
    // serveur, qui répond 400 { name: message }.
    server.use(
      http.post('/api/coffees', () =>
        HttpResponse.json({ name: 'Un café porte déjà ce nom' }, { status: 400 }),
      ),
    )
    const user = userEvent.setup()

    renderAt('/fr/coffees/new')
    await screen.findByRole('heading', { name: 'Nouveau café' })

    await user.type(screen.getByLabelText('Nom'), 'Espresso')
    await user.type(screen.getByLabelText('Prix (€)'), '2.50')
    await user.click(screen.getByRole('button', { name: 'Créer le café' }))

    const nameInput = screen.getByLabelText('Nom')
    expect(await screen.findByText('Un café porte déjà ce nom')).toBeVisible()
    expect(nameInput).toHaveAttribute('aria-invalid', 'true')
  })

  it('création réussie : POST au format wire puis navigation vers le détail', async () => {
    let wireBody: unknown
    server.use(
      http.post('/api/coffees', async ({ request }) => {
        wireBody = await request.json()
        return HttpResponse.json({ id: 42, name: 'Lungo', price: 310 }, { status: 201 })
      }),
      // Le détail est déjà semé par setQueryData, mais le client de test a
      // staleTime 0 : un refetch d'arrière-plan est légitime.
      http.get('/api/coffees/42', () => HttpResponse.json({ id: 42, name: 'Lungo', price: 310 })),
    )
    const user = userEvent.setup()

    const { router } = renderAt('/fr/coffees/new')
    await screen.findByRole('heading', { name: 'Nouveau café' })

    await user.type(screen.getByLabelText('Nom'), 'Lungo')
    await user.type(screen.getByLabelText('Prix (€)'), '3.10')
    await user.click(screen.getByRole('button', { name: 'Créer le café' }))

    // L'adapter a écrit le wire : 3.10 € saisis → 310 centimes envoyés.
    expect(await screen.findByText(/3,10\s*€/)).toBeVisible()
    expect(wireBody).toEqual({ name: 'Lungo', price: 310 })
    expect(router.state.location.pathname).toBe('/fr/coffees/42')
  })
})
```

### ✅ Vérifier l'étape 6

```bash
pnpm dev          # régénérer routeTree.gen.ts, Ctrl+C
pnpm run verify   # 19 tests ✓
# npm : npm run dev · npm run verify
git add -A && git commit -m "feat: création — formulaire + boucle 400→champ"
```

---

## Étape 7 — Édition : PATCH optimiste

Objectif : le formulaire d'édition, avec un **PATCH partiel** (seuls les champs modifiés
voyagent) et une **mutation optimiste** : l'UI affiche la nouvelle valeur *avant* la
réponse du serveur — et la restaure s'il refuse. L'optimisme est une promesse **tenue ou
remboursée**.

### 7.1 L'appel PATCH

Dans `src/features/coffees/api/coffees.ts`, ajouter à la fin :

```ts
// PATCH partiel : seuls les champs réellement modifiés partent sur le réseau.
export function patchCoffee(id: number, patch: Partial<CoffeeCreate>) {
  const body: Record<string, string | number> = {}
  if (patch.name !== undefined) body.name = patch.name
  if (patch.price !== undefined) body.price = toWirePrice(patch.price)
  return http(`/coffees/${id}`, CoffeeSchema, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}
```

### 7.2 La mutation optimiste — la chorégraphie en quatre temps

Les quatre temps sont **non négociables** : en sauter un produit les bugs classiques
(donnée fantôme après échec, liste incohérente avec le détail, spéculation écrasée par un
refetch tardif).

```ts
// src/features/coffees/hooks/use-update-coffee.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { patchCoffee } from '../api/coffees'
import { coffeeKeys } from '../queries/coffees'
import type { Coffee, CoffeeCreate, CoffeePage } from '../schemas/coffee'

type UpdateCoffeeVariables = { id: number; patch: Partial<CoffeeCreate> }

// Mutation optimiste complète : on écrit la valeur spéculée dans le cache
// AVANT la réponse serveur (l'UI réagit instantanément), on restaure le
// snapshot si le serveur refuse, on écrit la vérité serveur s'il accepte,
// et on invalide dans tous les cas pour resynchroniser.
export function useUpdateCoffee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: UpdateCoffeeVariables) => patchCoffee(id, patch),

    onMutate: async ({ id, patch }) => {
      // 1. Stopper les fetchs en vol : une réponse en retard écraserait
      //    notre écriture spéculative avec une donnée périmée.
      await Promise.all([
        queryClient.cancelQueries({ queryKey: coffeeKeys.detail(id) }),
        queryClient.cancelQueries({ queryKey: coffeeKeys.lists() }),
      ])

      // 2. Snapshot : de quoi tout restaurer en cas d'échec.
      const previousDetail = queryClient.getQueryData<Coffee>(coffeeKeys.detail(id))
      const previousLists = queryClient.getQueriesData<CoffeePage>({
        queryKey: coffeeKeys.lists(),
      })

      // 3. Écriture spéculative : le détail ET toutes les pages de liste en
      //    cache montrent la nouvelle valeur immédiatement (immutabilité :
      //    on reconstruit, on ne modifie jamais en place).
      if (previousDetail) {
        queryClient.setQueryData(coffeeKeys.detail(id), { ...previousDetail, ...patch })
      }
      queryClient.setQueriesData<CoffeePage>({ queryKey: coffeeKeys.lists() }, (page) =>
        page
          ? {
              ...page,
              content: page.content.map((coffee) =>
                coffee.id === id ? { ...coffee, ...patch } : coffee,
              ),
            }
          : page,
      )

      return { previousDetail, previousLists }
    },

    onError: (_error, { id }, context) => {
      // Rollback : le serveur a refusé, le cache retrouve son état d'avant.
      if (!context) return
      if (context.previousDetail) {
        queryClient.setQueryData(coffeeKeys.detail(id), context.previousDetail)
      }
      for (const [queryKey, data] of context.previousLists) {
        queryClient.setQueryData(queryKey, data)
      }
    },

    onSuccess: (coffee) => {
      // La réponse du PATCH fait foi : elle remplace la spéculation.
      queryClient.setQueryData(coffeeKeys.detail(coffee.id), coffee)
    },

    onSettled: (_data, _error, { id }) => {
      // Succès ou échec, on resynchronise avec le serveur.
      queryClient.invalidateQueries({ queryKey: coffeeKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: coffeeKeys.lists() })
    },
  })
}
```

### 7.3 Le formulaire d'édition

Deux nouveautés par rapport à la création : **`values:`** (le formulaire est pré-rempli
depuis l'état serveur et reste synchronisé si le cache change) et **`dirtyFields`** (le
PATCH ne transporte que ce que l'utilisateur a réellement touché).

```tsx
// src/features/coffees/components/coffee-edit-form.tsx
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { useForm } from 'react-hook-form'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { useUpdateCoffee } from '../hooks/use-update-coffee'
import {
  type Coffee,
  type CoffeeCreate,
  type CoffeeCreateInput,
  CoffeeCreateSchema,
} from '../schemas/coffee'
import { applyServerErrors } from './server-errors'

export function CoffeeEditForm({ coffee, onSaved }: { coffee: Coffee; onSaved: () => void }) {
  const updateCoffee = useUpdateCoffee()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<CoffeeCreateInput, unknown, CoffeeCreate>({
    resolver: standardSchemaResolver(CoffeeCreateSchema),
    // `values` (et non defaultValues) : le formulaire reste synchronisé avec
    // l'état serveur — si le cache change, les champs non touchés suivent.
    values: {
      name: coffee.name,
      price: (coffee.price.amount / 100).toFixed(2),
    },
    // En cas de rollback, on garde la saisie de l'utilisateur : il peut
    // corriger et réessayer sans tout retaper.
    resetOptions: { keepDirtyValues: true },
  })

  const onSubmit = handleSubmit(async (parsed) => {
    // Filtre dirtyFields : le PATCH ne transporte que ce qui a changé.
    const patch: Partial<CoffeeCreate> = {}
    if (dirtyFields.name) patch.name = parsed.name
    if (dirtyFields.price) patch.price = parsed.price
    if (Object.keys(patch).length === 0) {
      onSaved()
      return
    }
    try {
      await updateCoffee.mutateAsync({ id: coffee.id, patch })
      onSaved()
    } catch (error) {
      applyServerErrors(error, setError, 'La modification a échoué. Réessayez.')
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="edit-name">Nom</Label>
        <Input id="edit-name" aria-invalid={errors.name ? true : undefined} {...register('name')} />
        {errors.name ? (
          <p role="alert" className="text-destructive text-sm">
            {errors.name.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="edit-price">Prix (€)</Label>
        <Input
          id="edit-price"
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          aria-invalid={errors.price ? true : undefined}
          {...register('price')}
        />
        {errors.price ? (
          <p role="alert" className="text-destructive text-sm">
            {errors.price.message}
          </p>
        ) : null}
      </div>

      {errors.root ? (
        <p role="alert" className="text-destructive text-sm">
          {errors.root.message}
        </p>
      ) : null}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
    </form>
  )
}
```

### 7.4 La route d'édition

Détail de nommage : le fichier s'appelle `$coffeeId_.edit.tsx` — le suffixe `_` sort la
route de l'**imbrication** sous la route détail (elle est *sœur*, pas enfant : elle
remplace la page au lieu de s'afficher dedans). L'en-tête de la page affiche le prix **lu
depuis le cache** : c'est là qu'on *verra* l'écriture optimiste.

```tsx
// src/routes/$locale/coffees/$coffeeId_.edit.tsx
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, notFound, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { CoffeeEditForm, coffeeDetailOptions } from '@/features/coffees'
import { ApiError } from '@/shared/api/http'
import { formatPrice } from '@/shared/money/money'
import { Skeleton } from '@/shared/ui/skeleton'

// Mêmes règles que la route détail : un id illisible est une URL inexistante.
const CoffeeIdSchema = z.coerce.number().int().positive()

export const Route = createFileRoute('/$locale/coffees/$coffeeId_/edit')({
  params: {
    parse: (raw) => {
      const parsed = CoffeeIdSchema.safeParse(raw.coffeeId)
      if (!parsed.success) throw notFound()
      return { coffeeId: parsed.data }
    },
    stringify: ({ coffeeId }) => ({ coffeeId: String(coffeeId) }),
  },
  loader: async ({ context: { queryClient }, params: { coffeeId } }) => {
    try {
      await queryClient.ensureQueryData(coffeeDetailOptions(queryClient, coffeeId))
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) throw notFound()
      throw error
    }
  },
  component: EditCoffeePage,
})

function EditCoffeePage() {
  const { locale, coffeeId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const query = useQuery(coffeeDetailOptions(queryClient, coffeeId))

  if (query.isError) {
    throw query.error
  }
  if (query.isPending) {
    return (
      <div role="status" aria-label="Chargement du café">
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  const coffee = query.data

  return (
    <section className="flex flex-col gap-4">
      {/* Le prix affiché vient du CACHE : l'écriture optimiste le fait
          changer avant même la réponse du serveur. */}
      <h2 className="text-xl font-semibold">
        {coffee.name} — {formatPrice(coffee.price, locale)}
      </h2>
      <CoffeeEditForm
        coffee={coffee}
        onSaved={() =>
          navigate({
            to: '/$locale/coffees/$coffeeId',
            params: { locale, coffeeId },
          })
        }
      />
    </section>
  )
}
```

### 7.5 Le lien « Modifier » et le barrel final

Dans `src/routes/$locale/coffees/$coffeeId.tsx`, remplacer le lien « ← Tous les cafés »
(le bloc `<Link …>← Tous les cafés</Link>` sous `<CoffeeDetail …/>`) par :

```tsx
      <div className="flex items-center justify-between">
        <Link
          to="/$locale/coffees"
          params={{ locale }}
          search={{ page: 0 }}
          className="text-muted-foreground text-sm"
        >
          ← Tous les cafés
        </Link>
        <Link
          to="/$locale/coffees/$coffeeId/edit"
          params={{ locale, coffeeId }}
          className="text-sm underline underline-offset-4"
        >
          Modifier
        </Link>
      </div>
```

**Remplacer intégralement** `src/features/coffees/index.ts` (version finale) :

```ts
// src/features/coffees/index.ts
// Point d'entrée public de la feature "coffees" — seul chemin d'import autorisé
// depuis l'extérieur (app/, routes/, autres features). Les sous-dossiers
// (api, components, hooks, queries, schemas) ne s'importent jamais directement.
export { CoffeeCreateForm } from './components/coffee-create-form'
export { CoffeeDetail } from './components/coffee-detail'
export { CoffeeEditForm } from './components/coffee-edit-form'
export { CoffeeList } from './components/coffee-list'
export { useCreateCoffee } from './hooks/use-create-coffee'
export { useUpdateCoffee } from './hooks/use-update-coffee'
export {
  coffeeDetailOptions,
  coffeeFromCache,
  coffeeKeys,
  coffeesPageOptions,
  PAGE_SIZE,
} from './queries/coffees'
export type { Coffee, CoffeePage } from './schemas/coffee'
```

### 7.6 Les tests signature — tester le temps

Le `delay(250)` de MSW transforme une course invisible en fenêtre observable : si le
nouveau prix apparaît **tout de suite**, c'est l'écriture spéculative du cache, pas le
serveur.

```tsx
// src/app/coffee-edit.test.tsx
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { renderAt } from '@/test/render'
import { server } from '@/test/server'

// Un faux backend avec état : GET sert le prix courant, PATCH l'applique
// après un délai — c'est ce délai qui rend l'optimisme observable.
function statefulCoffee(initialWirePrice: number, patchStatus = 200) {
  const state = { wirePrice: initialWirePrice }
  server.use(
    http.get('/api/coffees/5', () =>
      HttpResponse.json({ id: 5, name: 'Espresso', price: state.wirePrice }),
    ),
    http.patch('/api/coffees/5', async ({ request }) => {
      const body = await request.json()
      await delay(250)
      if (patchStatus !== 200) return new HttpResponse(null, { status: patchStatus })
      if (typeof body === 'object' && body !== null && 'price' in body) {
        state.wirePrice = Number(body.price)
      }
      return HttpResponse.json({ id: 5, name: 'Espresso', price: state.wirePrice })
    }),
  )
  return state
}

async function editPriceTo(newPrice: string) {
  const user = userEvent.setup()
  const rendered = renderAt('/fr/coffees/5/edit')
  const priceInput = await screen.findByLabelText('Prix (€)')

  await user.clear(priceInput)
  await user.type(priceInput, newPrice)
  await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
  return rendered
}

describe('édition optimiste (PATCH)', () => {
  it('le nouveau prix s’affiche AVANT la réponse du serveur', async () => {
    statefulCoffee(250)

    const { router } = await editPriceTo('3.90')

    // La réponse PATCH mettra 250 ms : si ce texte apparaît tout de suite,
    // c'est bien l'écriture spéculative du cache, pas le serveur.
    expect(await screen.findByText(/3,90\s*€/)).toBeVisible()
    expect(router.state.location.pathname).toBe('/fr/coffees/5/edit')

    // Puis le serveur confirme et la navigation vers le détail a lieu.
    await waitFor(() => expect(router.state.location.pathname).toBe('/fr/coffees/5'))
    expect(await screen.findByText(/3,90\s*€/)).toBeVisible()
  })

  it('sur 500 : spéculation → rollback → alerte (trois états)', async () => {
    statefulCoffee(250, 500)

    const { router } = await editPriceTo('3.90')

    // État 2 : la spéculation s'affiche pendant que le PATCH est en vol.
    expect(await screen.findByText(/3,90\s*€/)).toBeVisible()

    // État 3 : le serveur refuse → rollback (l'ancien prix revient) + alerte.
    expect(await screen.findByRole('alert')).toHaveTextContent('La modification a échoué')
    expect(screen.getByText(/2,50\s*€/)).toBeVisible()
    expect(screen.queryByText(/3,90\s*€/)).not.toBeInTheDocument()

    // Pas de navigation : l'utilisateur garde sa saisie pour corriger.
    expect(router.state.location.pathname).toBe('/fr/coffees/5/edit')
  })

  it('le PATCH ne transporte que les champs modifiés, au format wire', async () => {
    let patchBody: unknown
    const state = { wirePrice: 250 }
    server.use(
      http.get('/api/coffees/5', () =>
        HttpResponse.json({ id: 5, name: 'Espresso', price: state.wirePrice }),
      ),
      http.patch('/api/coffees/5', async ({ request }) => {
        patchBody = await request.json()
        state.wirePrice = 390
        return HttpResponse.json({ id: 5, name: 'Espresso', price: 390 })
      }),
    )

    const { router } = await editPriceTo('3.90')

    await waitFor(() => expect(router.state.location.pathname).toBe('/fr/coffees/5'))
    // Le nom n'a pas été touché : il ne part pas. 3.90 € saisis → 390 envoyés.
    expect(patchBody).toEqual({ price: 390 })
  })
})
```

### ✅ Vérifier l'étape 7 — et l'ensemble

```bash
pnpm dev          # régénérer routeTree.gen.ts, Ctrl+C
pnpm run verify   # typecheck ✓ · biome ci ✓ · eslint ✓ · 22 tests ✓ · build ✓
# npm : npm run dev · npm run verify
git add -A && git commit -m "feat: édition — PATCH optimiste"
```

Avec le backend (throttler le réseau dans les DevTools pour voir l'optimisme) : détail →
Modifier → changer le prix → Enregistrer : l'en-tête change **instantanément**, puis la
navigation a lieu au retour serveur. Backend coupé : le prix revient + alerte, la saisie
est conservée.

---

## Récapitulatif

Vous avez construit, en 7 étapes toujours vertes, une application React complète :

1. un **routeur typé par fichiers** avec la locale dans l'URL et des tests qui pilotent
   l'app par ses URL ;
2. une **frontière de données** infranchissable : `http()` + Zod, `Money` qui confine la
   dette backend sur une ligne, retry sélectif ;
3. une **liste** dont le test le plus important prouve qu'une dérive de contrat produit
   une panne franche, jamais des données corrompues ;
4. une **pagination** dont l'état vit dans l'URL — validée, préchargée, sans flash ;
5. un **détail** qui distingue le fait métier (404 calme) de la panne technique (retry) et
   réutilise le cache de la liste ;
6. une **création** qui affiche les erreurs serveur sous le bon champ, même inconnues du
   client ;
7. une **édition optimiste** qui tient sa promesse ou la rembourse (rollback), prouvée par
   des tests qui observent le temps.

Votre `src/` est identique à celui du
[repo de référence](https://github.com/creachdotyannatgmaildotcom/coffee-client-react) —
chaque étape y correspond à une fiche détaillée dans
[docs/steps](https://github.com/creachdotyannatgmaildotcom/coffee-client-react/tree/main/docs/steps)
(fiches 06 à 11). La suite naturelle : l'authentification (le `registerTokenProvider` de
`http.ts` attend son JWT) et le vrai catalogue i18n (le segment `/$locale` attend ses
traductions).

### En cas de problème

- **`Cannot find module '@/routeTree.gen'`** ou une route qui « n'existe pas » pour le
  typage : lancer `pnpm dev` quelques secondes — le plugin régénère `src/routeTree.gen.ts`
  à chaque démarrage. À refaire après **chaque création de fichier de route**.
- **Un test échoue avec `[MSW] Error: intercepted a request without a matching request
  handler`** : le code a émis une requête que le test n'a pas déclarée — c'est voulu
  (`onUnhandledRequest: 'error'`). Ajouter le handler manquant… ou comprendre pourquoi ce
  fetch part.
- **`biome ci` échoue sur le formatage** : `pnpm exec biome check --write .`
  (npm : `npx biome check --write .`) reformate tout.
- **Les versions ont bougé** : ce tutoriel a été validé avec React 19.2, Vite 8,
  TypeScript 6, TanStack Router 1.170 / Query 5.101, Zod 4.4, react-hook-form 7.81,
  MSW 2.14, Node 24, pnpm 11 — comparer votre `package.json` avec celui du repo de
  référence en cas de comportement différent.
