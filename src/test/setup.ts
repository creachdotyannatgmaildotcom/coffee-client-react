import '@testing-library/jest-dom/vitest'
import '@/shared/config/zod-locale'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from './server'

// Sans globals Vitest, RTL ne peut pas enregistrer son cleanup automatique.
afterEach(cleanup)

// MSW intercepte au niveau réseau : le code de production (fetch, http.ts)
// s'exécute tel quel, seule la réponse est simulée.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
