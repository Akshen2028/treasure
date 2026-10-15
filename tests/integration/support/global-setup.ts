import { sweepTestData } from './fixture'

/** Removes leftovers from any earlier crashed run before and after the suite. */
export async function setup() {
  await sweepTestData()
}

export async function teardown() {
  await sweepTestData()
}
