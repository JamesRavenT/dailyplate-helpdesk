interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>
}

interface Env {
  ASSETS: Fetcher
  BACKEND_ORIGIN: string
}

interface WorkerHandler<TEnv> {
  fetch(request: Request, env: TEnv): Response | Promise<Response>
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // Keep one canonical origin for Better Auth session cookies and trustedOrigins
    if (url.hostname.startsWith('www.')) {
      url.hostname = url.hostname.slice(4)
      return Response.redirect(url.toString(), 301)
    }

    const p = url.pathname

    if (p === '/api/internal' || p.startsWith('/api/internal/')) {
      return new Response('Not found', { status: 404 })
    }

    if (p === '/health' || p === '/api' || p.startsWith('/api/')) {
      const target = `${env.BACKEND_ORIGIN}${p}${url.search}`
      const headers = new Headers(request.headers)
      headers.delete('Host')
      headers.set('X-Forwarded-Host', url.host)
      headers.set('X-Forwarded-Proto', 'https')

      const clientIp = request.headers.get('CF-Connecting-IP')
      if (clientIp) {
        headers.set('X-Forwarded-For', clientIp)
      }

      try {
        const upstream = await fetch(target, {
          method: request.method,
          headers,
          body: request.method === 'GET' || request.method === 'HEAD'
            ? undefined
            : request.body,
          redirect: 'manual',
        })

        const location = upstream.headers.get('Location')
        if (location?.startsWith(env.BACKEND_ORIGIN)) {
          const rewritten = new Response(upstream.body, upstream)
          rewritten.headers.set(
            'Location',
            `${url.origin}${location.slice(env.BACKEND_ORIGIN.length)}`,
          )
          return rewritten
        }

        return upstream
      } catch {
        return new Response('Bad gateway', { status: 502 })
      }
    }

    return env.ASSETS.fetch(request)
  },
} satisfies WorkerHandler<Env>