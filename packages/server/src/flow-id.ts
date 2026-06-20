/** Matches nanoid-generated IDs and seeded `example-*` flow names. */
export const FLOW_ID_PATTERN = /^[A-Za-z0-9_-]+$/

export const FLOW_ID_JSON_PATTERN = '^[A-Za-z0-9_-]+$'

export class InvalidFlowIdError extends Error {
  constructor(id: string) {
    super(`Invalid flow id: ${id}`)
    this.name = 'InvalidFlowIdError'
  }
}

export function assertValidFlowId(id: string): void {
  if (!FLOW_ID_PATTERN.test(id)) {
    throw new InvalidFlowIdError(id)
  }
}
