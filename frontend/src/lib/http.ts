import axios, { type AxiosError } from 'axios'

import { forceSignOut } from './session'

type ErrorResponse = {
  error?: string
}

axios.interceptors.response.use(
  response => response,
  async (error: AxiosError<ErrorResponse>) => {
    const url = error.config?.url
    const status = error.response?.status
    const message = error.response?.data?.error
    const sessionEnded =
      (status === 401 && message === 'Unauthorized') ||
      (status === 403 && message === 'Account is locked')

    if (sessionEnded && !url?.startsWith('/api/auth')) {
      await forceSignOut()
    }

    return Promise.reject(error)
  },
)
