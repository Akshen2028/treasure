/**
 * Single source of truth for URLs. Pages and links build URLs through these
 * helpers so route shapes can change in one place.
 */
export const paths = {
  welcome: '/',
  home: '/home',
  search: '/search',
  settings: '/settings',
  recentlyDeleted: '/settings/deleted',
  aiExport: '/settings/export',
  chat: '/chat',
  event: (eventId: string) => `/events/${eventId}`,
  category: (eventId: string, categoryId: string) => `/events/${eventId}/categories/${categoryId}`,
  activity: (eventId: string, categoryId: string, activityId: string) =>
    `/events/${eventId}/categories/${categoryId}/activities/${activityId}`,
  payments: (eventId: string, categoryId: string, activityId: string) =>
    `/events/${eventId}/categories/${categoryId}/activities/${activityId}/payments`,
} as const
