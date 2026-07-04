import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Sans globals Vitest, RTL ne peut pas enregistrer son cleanup automatique.
afterEach(cleanup)
