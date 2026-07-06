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
