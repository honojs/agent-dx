export type User = { id: number; name: string; email: string }
export type Product = { id: number; name: string; price: number; stock: number }
export type Order = {
  id: number
  userId: number
  productIds: number[]
  status: 'pending' | 'shipped' | 'delivered'
}

export const users: User[] = [
  { id: 1, name: 'Alice', email: 'alice@example.com' },
  { id: 2, name: 'Bob', email: 'bob@example.com' },
  { id: 3, name: 'Carol', email: 'carol@example.com' },
]

export const products: Product[] = [
  { id: 1, name: 'Keyboard', price: 120, stock: 12 },
  { id: 2, name: 'Mouse', price: 45, stock: 30 },
  { id: 3, name: 'Monitor', price: 300, stock: 7 },
  { id: 4, name: 'Desk', price: 450, stock: 3 },
]

export const orders: Order[] = [
  { id: 1, userId: 1, productIds: [1, 2], status: 'shipped' },
  { id: 2, userId: 2, productIds: [3], status: 'pending' },
  { id: 3, userId: 1, productIds: [4], status: 'delivered' },
]
