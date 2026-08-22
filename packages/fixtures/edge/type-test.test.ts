import { describe, expectTypeOf, it } from 'vitest'

type User = {
  id: string
  name: string
  email?: string
}

describe('User type', () => {
  // This is a legitimate type test — no runtime assertion, but verifies the type shape.
  // Trash Tests should emit this as `info`, not `warning` or `critical`.
  it('has the right shape', () => {
    expectTypeOf<User>().toMatchTypeOf<{ id: string; name: string }>()
  })

  it('has optional email', () => {
    expectTypeOf<User>().toHaveProperty('email').toEqualTypeOf<string | undefined>()
  })
})
