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
