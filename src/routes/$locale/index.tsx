import { createFileRoute } from '@tanstack/react-router'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Skeleton } from '@/shared/ui/skeleton'

export const Route = createFileRoute('/$locale/')({
  component: HomePage,
})

function HomePage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fondations UI</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Button>Valider</Button>
      </CardContent>
    </Card>
  )
}
