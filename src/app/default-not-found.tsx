// 404 par défaut du routeur : URL sans route correspondante (ou paramètre
// invalide, ex. /fr/coffees/banane — l'id refuse de se parser, la route ne
// matche pas). Aucune requête réseau n'a eu lieu.
export function DefaultNotFound() {
  return (
    <section className="mx-auto flex max-w-md flex-col gap-3 p-8">
      <h2 className="text-xl font-semibold">Page introuvable</h2>
      <p className="text-muted-foreground">Cette adresse ne correspond à aucune page.</p>
      <a href="/" className="text-sm underline">
        ← Retour à l'accueil
      </a>
    </section>
  )
}
