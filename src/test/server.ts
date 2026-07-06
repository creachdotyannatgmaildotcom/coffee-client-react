import { setupServer } from 'msw/node'

// Serveur MSW partagé par tous les tests : démarré sans handler, chaque test
// déclare les siens via server.use(...). Toute requête non déclarée est une
// erreur (onUnhandledRequest: 'error' dans setup.ts) — pas d'appel fantôme.
export const server = setupServer()
