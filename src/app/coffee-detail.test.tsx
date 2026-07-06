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
