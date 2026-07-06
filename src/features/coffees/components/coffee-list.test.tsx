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
