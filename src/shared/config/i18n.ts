import { z } from 'zod'

export const locales = ['fr', 'en'] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'fr'

// Toute locale inconnue dans l'URL retombe silencieusement sur la locale par
// défaut : une URL ne doit jamais faire planter l'application.
export const LocaleSchema = z.enum(locales).catch(defaultLocale)
