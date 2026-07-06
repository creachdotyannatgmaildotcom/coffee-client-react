import type { Locale } from '@/shared/config/i18n'
import { formatPrice } from '@/shared/money/money'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import type { Coffee } from '../schemas/coffee'

export function CoffeeDetail({ coffee, locale }: { coffee: Coffee; locale: Locale }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{coffee.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{formatPrice(coffee.price, locale)}</p>
      </CardContent>
    </Card>
  )
}
