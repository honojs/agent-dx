export async function slowDown(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 5))
}
