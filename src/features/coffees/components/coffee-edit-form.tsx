import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { useForm } from 'react-hook-form'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { useUpdateCoffee } from '../hooks/use-update-coffee'
import {
  type Coffee,
  type CoffeeCreate,
  type CoffeeCreateInput,
  CoffeeCreateSchema,
} from '../schemas/coffee'
import { applyServerErrors } from './server-errors'

export function CoffeeEditForm({ coffee, onSaved }: { coffee: Coffee; onSaved: () => void }) {
  const updateCoffee = useUpdateCoffee()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<CoffeeCreateInput, unknown, CoffeeCreate>({
    resolver: standardSchemaResolver(CoffeeCreateSchema),
    // `values` (et non defaultValues) : le formulaire reste synchronisé avec
    // l'état serveur — si le cache change, les champs non touchés suivent.
    values: {
      name: coffee.name,
      price: (coffee.price.amount / 100).toFixed(2),
    },
    // En cas de rollback, on garde la saisie de l'utilisateur : il peut
    // corriger et réessayer sans tout retaper.
    resetOptions: { keepDirtyValues: true },
  })

  const onSubmit = handleSubmit(async (parsed) => {
    // Filtre dirtyFields : le PATCH ne transporte que ce qui a changé.
    const patch: Partial<CoffeeCreate> = {}
    if (dirtyFields.name) patch.name = parsed.name
    if (dirtyFields.price) patch.price = parsed.price
    if (Object.keys(patch).length === 0) {
      onSaved()
      return
    }
    try {
      await updateCoffee.mutateAsync({ id: coffee.id, patch })
      onSaved()
    } catch (error) {
      applyServerErrors(error, setError, 'La modification a échoué. Réessayez.')
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="edit-name">Nom</Label>
        <Input id="edit-name" aria-invalid={errors.name ? true : undefined} {...register('name')} />
        {errors.name ? (
          <p role="alert" className="text-destructive text-sm">
            {errors.name.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="edit-price">Prix (€)</Label>
        <Input
          id="edit-price"
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
        {isSubmitting ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
    </form>
  )
}
