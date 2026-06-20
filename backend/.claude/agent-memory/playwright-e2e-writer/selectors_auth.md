---
name: selectors_auth
description: Reliable Playwright selectors for the login form, navbar, and route-guard loading states
metadata:
  type: reference
---

## Login page (`/login`)

| Element | Selector |
|---|---|
| Email field | `page.getByLabel('Email')` |
| Password field | `page.getByLabel('Password')` |
| Submit button (idle) | `page.getByRole('button', { name: 'Sign In' })` |
| Submit button (in-flight) | `page.getByRole('button', { name: 'Signing in…' })` |
| Zod error — email required | `page.getByText('Email is required')` |
| Zod error — invalid email | `page.getByText('Enter a valid email')` |
| Zod error — password required | `page.getByText('Password is required')` |
| Server error paragraph | `page.getByText(/invalid email or password/i)` |

Notes:
- The login form uses `noValidate` — browser native validation is suppressed; errors come from Zod + react-hook-form.
- The "Loading…" spinner (`<p>Loading…</p>`) appears while `authClient.useSession()` is pending. Wait for the Sign In button to be visible before filling the form.
- If already authenticated, the Login component's `useEffect` navigates to `/` — don't fill the form in that state.

## Navbar (shown on authenticated pages)

| Element | Selector |
|---|---|
| Sign Out button | `page.getByRole('button', { name: 'Sign Out' })` |
| Dashboard link | `page.getByRole('link', { name: 'Dashboard' })` |
| Users link (admin only) | `page.getByRole('link', { name: 'Users' })` |
| Current user name | `page.getByText(userName)` (rendered inline in a `<span>`) |

## Protected route loading state

ProtectedRoute and AdminRoute both render `<div>Loading...</div>` while the session check is pending. This is not role="status" — don't assert on it; instead wait for the final destination element to appear.

## Home page (`/`)

| Element | Selector |
|---|---|
| Welcome heading | `page.getByRole('heading', { name: /welcome back/i })` (or `getByText('Welcome back, Admin')`) |

## Users page (`/users`)

| Element | Selector |
|---|---|
| Page heading | `page.getByRole('heading', { name: 'Users' })` |
