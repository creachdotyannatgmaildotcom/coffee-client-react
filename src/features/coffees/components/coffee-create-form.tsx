import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { useForm } from 'react-hook-form'
import { ValidationError } from '@/shared/api/http'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { useCreateCoffee } from '../hooks/use-create-coffee'
import {
  type Coffee,
  type CoffeeCreate,
  type CoffeeCreateInput,
  CoffeeCreateSchema,
} from '../schemas/coffee'

const formFields = ['name', 'price'] as const
type FormField = (typeof formFields)[number]

// Prédicat qui "rembourse" le rétrécissement de type : le serveur peut
// renvoyer des erreurs sur des champs que ce formulaire ne connaît pas.
function isFormField(key: string): key is FormField {
  return (formFields as readonly string[]).includes(key)
}

export function CoffeeCreateForm({ onCreated }: { onCreated: (coffee: Coffee) => void }) {
  const createCoffee = useCreateCoffee()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CoffeeCreateInput, unknown, CoffeeCreate>({
    // Zod 4 implémente Standard Schema : le resolver générique suffit, sans
    // couplage à une version précise de Zod.
    resolver: standardSchemaResolver(CoffeeCreateSchema),
  })

  const onSubmit = handleSubmit(async (values) => {
    try {
      const coffee = await createCoffee.mutateAsync(values)
      onCreated(coffee)
    } catch (error) {
      if (error instanceof ValidationError) {
        // Boucle 400 → champ : chaque message serveur atterrit sous le champ
        // concerné — y compris pour une règle que le client ne connaît pas.
        for (const [field, message] of Object.entries(error.fieldErrors)) {
          if (isFormField(field)) {
            setError(field, { type: 'server', message })
          } else {
            setError('root', { type: 'server', message })
          }
        }
        return
      }
      setError('root', { type: 'server', message: 'Impossible de créer le café. Réessayez.' })
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="coffee-name">Nom</Label>
        <Input
          id="coffee-name"
          aria-invalid={errors.name ? true : undefined}
          {...register('name')}
        />
        {errors.name ? (
          <p role="alert" className="text-destructive text-sm">
            {errors.name.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="coffee-price">Prix (€)</Label>
        <Input
          id="coffee-price"
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          aria-invalid={errors.price ? true : undefined}
          {...register('price')}
        />
        {errors.price ? (
          <p role="alert" className="text-destructive text-sm">
            {errors.price.message}
          </p>
        ) : null}
      </div>

      {errors.root ? (
        <p role="alert" className="text-destructive text-sm">
          {errors.root.message}
        </p>
      ) : null}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Création…' : 'Créer le café'}
      </Button>
    </form>
  )
}
