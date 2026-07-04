import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '@/App'

describe('App', () => {
  it('affiche le titre et le bouton de validation', () => {
    render(<App />)

    expect(screen.getByRole('heading', { level: 1, name: 'Coffee Client' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Valider' })).toBeInTheDocument()
  })
})
