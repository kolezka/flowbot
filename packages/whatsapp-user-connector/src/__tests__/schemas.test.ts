import { describe, it, expect } from 'vitest'
import * as v from 'valibot'
import {
  sendMessageSchema,
  sendPhotoSchema,
  sendVideoSchema,
  sendDocumentSchema,
  sendAudioSchema,
  sendVoiceSchema,
  sendStickerSchema,
  sendLocationSchema,
  sendContactSchema,
  forwardMessageSchema,
  editMessageSchema,
  deleteMessageSchema,
  readHistorySchema,
  kickUserSchema,
  promoteUserSchema,
  demoteUserSchema,
  getGroupInfoSchema,
  getInviteLinkSchema,
  sendPresenceSchema,
} from '../actions/schemas.js'

describe('schemas', () => {
  describe('sendMessageSchema', () => {
    it('requires chatId and text', () => {
      expect(() => v.parse(sendMessageSchema, {})).toThrow()
      expect(() => v.parse(sendMessageSchema, { chatId: '123' })).toThrow()
      expect(() => v.parse(sendMessageSchema, { text: 'hi' })).toThrow()
      expect(() => v.parse(sendMessageSchema, { chatId: '123@s.whatsapp.net', text: 'hi' })).not.toThrow()
    })
  })

  describe('sendPhotoSchema', () => {
    it('requires chatId and photoUrl, caption is optional', () => {
      expect(() => v.parse(sendPhotoSchema, {})).toThrow()
      expect(() => v.parse(sendPhotoSchema, { chatId: '123', photoUrl: 'https://example.com/photo.jpg' })).not.toThrow()
      expect(() => v.parse(sendPhotoSchema, { chatId: '123', photoUrl: 'https://example.com/photo.jpg', caption: 'A photo' })).not.toThrow()
    })
  })

  describe('sendVideoSchema', () => {
    it('requires chatId and videoUrl, caption is optional', () => {
      expect(() => v.parse(sendVideoSchema, {})).toThrow()
      expect(() => v.parse(sendVideoSchema, { chatId: '123', videoUrl: 'https://example.com/video.mp4' })).not.toThrow()
      expect(() => v.parse(sendVideoSchema, { chatId: '123', videoUrl: 'https://example.com/video.mp4', caption: 'A video' })).not.toThrow()
    })
  })

  describe('sendDocumentSchema', () => {
    it('requires chatId and documentUrl, fileName and caption are optional', () => {
      expect(() => v.parse(sendDocumentSchema, {})).toThrow()
      expect(() => v.parse(sendDocumentSchema, { chatId: '123', documentUrl: 'https://example.com/doc.pdf' })).not.toThrow()
      expect(() =>
        v.parse(sendDocumentSchema, { chatId: '123', documentUrl: 'https://example.com/doc.pdf', fileName: 'doc.pdf', caption: 'A document' }),
      ).not.toThrow()
    })
  })

  describe('sendAudioSchema', () => {
    it('requires chatId and audioUrl', () => {
      expect(() => v.parse(sendAudioSchema, {})).toThrow()
      expect(() => v.parse(sendAudioSchema, { chatId: '123', audioUrl: 'https://example.com/audio.mp3' })).not.toThrow()
    })
  })

  describe('sendVoiceSchema', () => {
    it('requires chatId and voiceUrl', () => {
      expect(() => v.parse(sendVoiceSchema, {})).toThrow()
      expect(() => v.parse(sendVoiceSchema, { chatId: '123', voiceUrl: 'https://example.com/voice.ogg' })).not.toThrow()
    })
  })

  describe('sendStickerSchema', () => {
    it('requires chatId and sticker', () => {
      expect(() => v.parse(sendStickerSchema, {})).toThrow()
      expect(() => v.parse(sendStickerSchema, { chatId: '123', sticker: 'sticker-id' })).not.toThrow()
    })
  })

  describe('sendLocationSchema', () => {
    it('requires chatId, latitude, and longitude', () => {
      expect(() => v.parse(sendLocationSchema, {})).toThrow()
      expect(() => v.parse(sendLocationSchema, { chatId: '123' })).toThrow()
      expect(() => v.parse(sendLocationSchema, { chatId: '123', latitude: 48.8566, longitude: 2.3522 })).not.toThrow()
    })
  })

  describe('sendContactSchema', () => {
    it('requires chatId, phoneNumber, and fullName; organization is optional', () => {
      expect(() => v.parse(sendContactSchema, {})).toThrow()
      expect(() => v.parse(sendContactSchema, { chatId: '123', phoneNumber: '+1234567890', fullName: 'Alice' })).not.toThrow()
      expect(() =>
        v.parse(sendContactSchema, { chatId: '123', phoneNumber: '+1234567890', fullName: 'Alice', organization: 'Acme' }),
      ).not.toThrow()
    })
  })

  describe('forwardMessageSchema', () => {
    it('requires fromChatId, toChatId, and messageKey', () => {
      expect(() => v.parse(forwardMessageSchema, {})).toThrow()
      expect(() =>
        v.parse(forwardMessageSchema, {
          fromChatId: 'a@g.us',
          toChatId: 'b@g.us',
          messageKey: { remoteJid: 'a@g.us', fromMe: true, id: 'msg-1' },
        }),
      ).not.toThrow()
    })

    it('rejects messageKey without required fields', () => {
      expect(() =>
        v.parse(forwardMessageSchema, {
          fromChatId: 'a@g.us',
          toChatId: 'b@g.us',
          messageKey: { remoteJid: 'a@g.us' },
        }),
      ).toThrow()
    })
  })

  describe('editMessageSchema', () => {
    it('requires chatId, messageKey, and text', () => {
      expect(() => v.parse(editMessageSchema, {})).toThrow()
      expect(() =>
        v.parse(editMessageSchema, {
          chatId: '123@s.whatsapp.net',
          messageKey: { remoteJid: '123@s.whatsapp.net', fromMe: true, id: 'msg-1' },
          text: 'updated text',
        }),
      ).not.toThrow()
    })
  })

  describe('deleteMessageSchema', () => {
    it('requires chatId and messageKey', () => {
      expect(() => v.parse(deleteMessageSchema, {})).toThrow()
      expect(() =>
        v.parse(deleteMessageSchema, {
          chatId: '123@s.whatsapp.net',
          messageKey: { remoteJid: '123@s.whatsapp.net', fromMe: true, id: 'msg-1' },
        }),
      ).not.toThrow()
    })
  })

  describe('readHistorySchema', () => {
    it('requires chatId; count is optional', () => {
      expect(() => v.parse(readHistorySchema, {})).toThrow()
      expect(() => v.parse(readHistorySchema, { chatId: '123@s.whatsapp.net' })).not.toThrow()
      expect(() => v.parse(readHistorySchema, { chatId: '123@s.whatsapp.net', count: 50 })).not.toThrow()
    })
  })

  describe('kickUserSchema', () => {
    it('requires chatId and userId', () => {
      expect(() => v.parse(kickUserSchema, {})).toThrow()
      expect(() => v.parse(kickUserSchema, { chatId: 'g@g.us', userId: 'u@s.whatsapp.net' })).not.toThrow()
    })
  })

  describe('promoteUserSchema', () => {
    it('requires chatId and userId', () => {
      expect(() => v.parse(promoteUserSchema, {})).toThrow()
      expect(() => v.parse(promoteUserSchema, { chatId: 'g@g.us', userId: 'u@s.whatsapp.net' })).not.toThrow()
    })
  })

  describe('demoteUserSchema', () => {
    it('requires chatId and userId', () => {
      expect(() => v.parse(demoteUserSchema, {})).toThrow()
      expect(() => v.parse(demoteUserSchema, { chatId: 'g@g.us', userId: 'u@s.whatsapp.net' })).not.toThrow()
    })
  })

  describe('getGroupInfoSchema', () => {
    it('requires chatId', () => {
      expect(() => v.parse(getGroupInfoSchema, {})).toThrow()
      expect(() => v.parse(getGroupInfoSchema, { chatId: 'g@g.us' })).not.toThrow()
    })
  })

  describe('getInviteLinkSchema', () => {
    it('requires chatId', () => {
      expect(() => v.parse(getInviteLinkSchema, {})).toThrow()
      expect(() => v.parse(getInviteLinkSchema, { chatId: 'g@g.us' })).not.toThrow()
    })
  })

  describe('sendPresenceSchema', () => {
    it('requires chatId and type', () => {
      expect(() => v.parse(sendPresenceSchema, {})).toThrow()
      expect(() => v.parse(sendPresenceSchema, { chatId: '123@s.whatsapp.net', type: 'composing' })).not.toThrow()
    })
  })
})
