import json from '../../routine/routine.json'
import { RoutineSchema } from './schema'

// The routine.json test guarantees this doesn't fail in a build that reached deploy.
export const routine = RoutineSchema.parse(json)
