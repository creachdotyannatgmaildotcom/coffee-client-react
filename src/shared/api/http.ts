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
