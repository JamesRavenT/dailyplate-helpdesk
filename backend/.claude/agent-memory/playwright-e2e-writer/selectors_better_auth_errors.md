---
name: selectors_better_auth_errors
description: Exact error message strings returned by Better Auth for credential failures — used in UI error assertions
metadata:
  type: reference
---

Source: `@better-auth/core/src/error/codes.ts`

| Scenario | `error.message` shown in UI |
|---|---|
| Wrong password | `"Invalid email or password"` |
| Unknown email | `"Invalid email or password"` |
| Invalid email format (Zod) | `"Invalid email"` (but Zod catches this first — UI shows `"Enter a valid email"`) |

The Login component renders `error.message ?? 'Invalid credentials'`. Better Auth always sets `error.message`, so the fallback `"Invalid credentials"` never appears in practice.

Assertion pattern:
```ts
await expect(page.getByText(/invalid email or password/i)).toBeVisible()
```

**Why this matters:** Using `/invalid credentials/i` as the pattern will never match; the regex must be `/invalid email or password/i`.
