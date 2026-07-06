import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createAppRouter } from '@/app/router'

function renderAt(url: string) {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [url] }))
  render(<RouterProvider router={router} />)
  return router
}

describe('routeur', () => {
  it('redirige / vers /fr et affiche la page d’accueil', async () => {
    const router = renderAt('/')

    expect(await screen.findByRole('heading', { level: 1, name: 'Coffee Client' })).toBeVisible()
    expect(screen.getByText('Fondations UI')).toBeVisible()
    expect(router.state.location.pathname).toBe('/fr')
  })

  it('sert la page d’accueil sous /en', async () => {
    const router = renderAt('/en')

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
    const router = renderAt('/fr')
    await screen.findByRole('heading', { level: 1, name: 'Coffee Client' })

    await user.click(screen.getByRole('link', { name: 'en' }))

    expect(router.state.location.pathname).toBe('/en')
  })
})
