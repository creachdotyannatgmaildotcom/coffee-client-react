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
