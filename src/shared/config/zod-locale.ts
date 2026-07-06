import { z } from 'zod'

// Messages d'erreur Zod en français, hors des schémas : aucun schéma ne
// contient de texte. Migration vers un vrai catalogue i18n à venir.
z.config(z.locales.fr())
