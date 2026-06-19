export default async function globalTeardown() {
  // Intentionally empty — test database persists between runs so globalSetup
  // can skip re-seeding already-existing users. Drop and recreate the
  // postgres-test container to reset state completely.
}
