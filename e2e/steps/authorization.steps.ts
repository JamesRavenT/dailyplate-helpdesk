import { expect, mergeTests, type APIResponse } from '@playwright/test'
import { createBdd, test as bddTest } from 'playwright-bdd'
import { test as authTest } from '../tests/fixtures/auth'

const API_BASE_URL = 'http://localhost:3001/api'
const ARTICLE_DATA = {
  title: 'BDD authorization test article',
  content: 'Isolated article created for knowledge base authorization checks.',
  category: 'OTHER',
}

type ScenarioState = {
  articleId?: string
  response?: APIResponse
}

export const test = mergeTests(bddTest, authTest).extend<{ scenarioState: ScenarioState }>({
  scenarioState: async ({ adminPage }, use) => {
    const state: ScenarioState = {}
    await use(state)

    if (state.articleId) {
      const cleanupResponse = await adminPage.request.delete(
        `${API_BASE_URL}/articles/${state.articleId}`,
      )
      expect([204, 404]).toContain(cleanupResponse.status())
    }
  },
})

const { Given, When, Then } = createBdd(test)

Given('I am signed in as an agent', async ({ agentPage }) => {
  const response = await agentPage.request.get(`${API_BASE_URL}/auth/get-session`)
  expect(response.ok()).toBeTruthy()

  const session = await response.json()
  expect(session.user.role).toBe('AGENT')
})

When(
  'I attempt to create an article directly through the service',
  async ({ agentPage, scenarioState }) => {
    scenarioState.response = await agentPage.request.post(`${API_BASE_URL}/articles`, {
      data: ARTICLE_DATA,
    })

    if (scenarioState.response.ok()) {
      const article = await scenarioState.response.json()
      scenarioState.articleId = article.id
    }
  },
)

When(
  'I attempt to {string} an article directly through the service',
  async ({ adminPage, agentPage, scenarioState }, action: string) => {
    expect(['update', 'delete']).toContain(action)

    const createResponse = await adminPage.request.post(`${API_BASE_URL}/articles`, {
      data: {
        ...ARTICLE_DATA,
        title: `${ARTICLE_DATA.title} ${Date.now()}-${Math.random()}`,
      },
    })
    expect(createResponse.status()).toBe(201)

    const article = await createResponse.json()
    scenarioState.articleId = article.id

    scenarioState.response = action === 'update'
      ? await agentPage.request.patch(`${API_BASE_URL}/articles/${article.id}`, {
          data: {
            ...ARTICLE_DATA,
            title: `${ARTICLE_DATA.title} updated`,
          },
        })
      : await agentPage.request.delete(`${API_BASE_URL}/articles/${article.id}`)
  },
)

Then('the request is refused as forbidden', async ({ scenarioState }) => {
  expect(scenarioState.response).toBeDefined()
  expect(scenarioState.response?.status()).toBe(403)
})
