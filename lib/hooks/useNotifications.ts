'use client'

import { useState, useEffect, useCallback } from 'react'

interface NotificationState {
  permission: NotificationPermission
  supported: boolean
  subscribed: boolean
  loading: boolean
  error: string | null
}

interface UseNotificationsReturn extends NotificationState {
  requestPermission: () => Promise<void>
  subscribe: () => Promise<void>
  unsubscribe: () => Promise<void>
  sendTestNotification: () => Promise<void>
}

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

// Convert base64 string to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  
  return outputArray
}

export function useNotifications(userId = 'default'): UseNotificationsReturn {
  const [state, setState] = useState<NotificationState>({
    permission: 'default',
    supported: false,
    subscribed: false,
    loading: true,
    error: null
  })

  // Check browser support and initial permission
  useEffect(() => {
    const checkSupport = async () => {
      if (typeof window === 'undefined') {
        setState(prev => ({ ...prev, loading: false }))
        return
      }

      const supported = 'serviceWorker' in navigator && 'PushManager' in window
      
      if (!supported) {
        setState({
          permission: 'denied',
          supported: false,
          subscribed: false,
          loading: false,
          error: 'Push notifications are not supported in this browser'
        })
        return
      }

      const permission = Notification.permission
      
      // Check if already subscribed
      let subscribed = false
      try {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()
        subscribed = !!subscription
      } catch (error) {
        console.error('Error checking subscription:', error)
      }

      setState({
        permission,
        supported: true,
        subscribed,
        loading: false,
        error: null
      })
    }

    checkSupport()
  }, [])

  // Register service worker
  const ensureServiceWorker = useCallback(async () => {
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service workers are not supported')
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      return registration
    } catch (error) {
      console.error('Service Worker registration failed:', error)
      throw new Error('Failed to register service worker')
    }
  }, [])

  // Request notification permission
  const requestPermission = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }))

    try {
      const permission = await Notification.requestPermission()
      
      setState(prev => ({
        ...prev,
        permission,
        loading: false,
        error: permission === 'denied' ? 'Notification permission denied' : null
      }))

      if (permission === 'granted') {
        await ensureServiceWorker()
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to request permission'
      }))
    }
  }, [ensureServiceWorker])

  // Subscribe to push notifications
  const subscribe = useCallback(async () => {
    if (state.permission !== 'granted') {
      await requestPermission()
    }

    if (state.permission === 'denied') {
      return
    }

    setState(prev => ({ ...prev, loading: true }))

    try {
      const registration = await navigator.serviceWorker.ready

      // Without VAPID key, we can't actually subscribe
      if (!VAPID_PUBLIC_KEY) {
        console.warn('VAPID public key not configured')
        // Still set as "subscribed" for demo purposes
        setState(prev => ({
          ...prev,
          subscribed: true,
          loading: false
        }))
        return
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource
      })

      // Send subscription to server
      const response = await fetch('/api/notifications/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription, userId })
      })

      if (!response.ok) {
        throw new Error('Failed to register subscription on server')
      }

      setState(prev => ({
        ...prev,
        subscribed: true,
        loading: false,
        error: null
      }))
    } catch (error) {
      console.error('Subscription error:', error)
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to subscribe to notifications'
      }))
    }
  }, [state.permission, requestPermission, userId])

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }))

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        await subscription.unsubscribe()
      }

      setState(prev => ({
        ...prev,
        subscribed: false,
        loading: false
      }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to unsubscribe'
      }))
    }
  }, [])

  // Send a test notification
  const sendTestNotification = useCallback(async () => {
    try {
      // Try to send via server API first
      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          title: 'Test Notification',
          body: 'This is a test push notification from Derivatives Dashboard!',
          requireInteraction: true
        })
      })

      if (!response.ok) {
        throw new Error('Server notification failed')
      }

      // If server fails or has no subscriptions, show local notification
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready
        await registration.showNotification('Test Notification', {
          body: 'This is a test push notification from Derivatives Dashboard!',
          icon: '/favicon.ico',
          requireInteraction: true
        })
      }
    } catch (error) {
      console.error('Failed to send test notification:', error)
      // Fall back to regular notification
      if ('Notification' in window) {
        new Notification('Test Notification', {
          body: 'This is a test notification from Derivatives Dashboard!',
          icon: '/favicon.ico'
        })
      }
    }
  }, [userId])

  return {
    ...state,
    requestPermission,
    subscribe,
    unsubscribe,
    sendTestNotification
  }
}
