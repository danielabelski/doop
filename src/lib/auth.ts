import { createAuthClient } from 'better-auth/react'

/** Same-origin better-auth client — cookies do the rest. */
export const authClient = createAuthClient()
