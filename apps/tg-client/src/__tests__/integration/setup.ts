/**
 * Global setup for integration tests.
 * Checks that INTEGRATION_TESTS_ENABLED is set before running any tests.
 * This runs as a vitest globalSetup file, outside the test sandbox.
 */
export default function setup() {
  if (!process.env.INTEGRATION_TESTS_ENABLED) {
    console.log(
      '\n⏭ Skipping integration tests: set INTEGRATION_TESTS_ENABLED=1 to run them.\n',
    )

    process.exit(0)
  }
}
