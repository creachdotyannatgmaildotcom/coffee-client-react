import type { UseFormSetError } from 'react-hook-form'
import { ValidationError } from '@/shared/api/http'
import type { CoffeeCreateInput } from '../schemas/coffee'

const formFields = ['name', 'price'] as const
type FormField = (typeof formFields)[number]

// Prédicat qui "rembourse" le rétrécissement de type : le serveur peut
// renvoyer des erreurs sur des champs que le formulaire ne connaît pas.
function isFormField(key: string): key is FormField {
  return (formFields as readonly string[]).includes(key)
}

// Boucle 400 → champ, partagée par les formulaires de création et d'édition :
// chaque message serveur atterrit sous le champ concerné, le reste en erreur
// globale (root).
export function applyServerErrors(
  error: unknown,
  setError: UseFormSetError<CoffeeCreateInput>,
  fallback: string,
): void {
  if (error instanceof ValidationError) {
    for (const [field, message] of Object.entries(error.fieldErrors)) {
      if (isFormField(field)) {
        setError(field, { type: 'server', message })
      } else {
        setError('root', { type: 'server', message })
      }
    }
    return
  }
  setError('root', { type: 'server', message: fallback })
}
