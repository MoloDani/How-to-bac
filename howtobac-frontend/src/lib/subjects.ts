/** The Subject enum from the API, in the order the backend declares it. */
export const SUBJECTS = [
  'MATHEMATICS',
  'ROMANIAN',
  'HISTORY',
  'PHYSICS',
  'ORGANIC_CHEMISTRY',
  'INORGANIC_CHEMISTRY',
  'PLANT_ANIMAL_BIOLOGY',
  'HUMAN_ANATOMY_GENETICS',
  'COMPUTER_SCIENCE',
  'GEOGRAPHY',
  'LOGIC',
  'PSYCHOLOGY',
  'SOCIOLOGY',
  'ECONOMICS',
  'PHILOSOPHY',
] as const

export type Subject = (typeof SUBJECTS)[number]

/** Mirrors MAX_USER_SUBJECTS in the backend; the API rejects more. */
export const MAX_SUBJECTS = 3
