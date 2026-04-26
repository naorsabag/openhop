/** Semantic exit codes per the CLI contract.
 *  See openhop-launch/16-cli-as-universal-api.md ("Exit codes"). */

export const ExitCode = {
  SUCCESS: 0,
  GENERIC: 1,
  USAGE: 2,
  VALIDATION: 3,
  NOT_FOUND: 4,
  CONFLICT: 5,
  NETWORK: 6,
  AUTH: 7,
} as const

export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode]
