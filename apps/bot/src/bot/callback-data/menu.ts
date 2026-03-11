import { createCallbackData } from 'callback-data'

export const menuData = createCallbackData('menu', {
  section: String, // 'language', 'profile'
})

export const profileData = createCallbackData('profile', {
  action: String, // 'back'
})
