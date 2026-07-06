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
