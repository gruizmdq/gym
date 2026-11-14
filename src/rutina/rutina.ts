import json from '../../rutina/rutina.json'
import { RutinaSchema } from './schema'

// El test de rutina.json garantiza que esto no falla en un build que llegó a deploy.
export const rutina = RutinaSchema.parse(json)
