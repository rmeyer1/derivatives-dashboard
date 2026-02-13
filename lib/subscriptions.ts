// Shared in-memory store for push notification subscriptions
// In production, replace with Redis or database

interface StoredSubscription {
  endpoint: string
  expirationTime?: number | null
  keys?: {
    p256dh: string
    auth: string
  }
}

class SubscriptionStore {
  private store: Map<string, StoredSubscription>

  constructor() {
    this.store = new Map()
  }

  add(subscription: StoredSubscription): void {
    if (subscription.endpoint) {
      this.store.set(subscription.endpoint, subscription)
    }
  }

  remove(endpoint: string): boolean {
    return this.store.delete(endpoint)
  }

  get(endpoint: string): StoredSubscription | undefined {
    return this.store.get(endpoint)
  }

  getAll(): StoredSubscription[] {
    return Array.from(this.store.values())
  }

  has(endpoint: string): boolean {
    return this.store.has(endpoint)
  }

  get size(): number {
    return this.store.size
  }

  getEndpoints(): string[] {
    return Array.from(this.store.keys())
  }
}

// Singleton instance
const subscriptionStore = new SubscriptionStore()

export { subscriptionStore, type StoredSubscription }
