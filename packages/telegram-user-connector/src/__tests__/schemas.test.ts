import { describe, it, expect } from 'vitest'
import * as v from 'valibot'
import {
  sendMessageSchema,
  sendPhotoSchema,
  sendVideoSchema,
  sendDocumentSchema,
  sendStickerSchema,
  sendVoiceSchema,
  sendAudioSchema,
  sendAnimationSchema,
  sendLocationSchema,
  sendContactSchema,
  sendVenueSchema,
  sendDiceSchema,
  forwardMessageSchema,
  editMessageSchema,
  deleteMessageSchema,
  pinMessageSchema,
  unpinMessageSchema,
  copyMessageSchema,
  banUserSchema,
  restrictUserSchema,
  promoteUserSchema,
  setChatTitleSchema,
  setChatDescriptionSchema,
  exportInviteLinkSchema,
  getChatMemberSchema,
  leaveChatSchema,
  createPollSchema,
  sendMediaGroupSchema,
  createForumTopicSchema,
  resolveUsernameSchema,
} from '../actions/schemas.js'

const PEER = 'channel123'
const USER_ID = 'user456'

describe('schemas', () => {
  describe('sendMessageSchema', () => {
    it('requires peer and text', () => {
      expect(() => v.parse(sendMessageSchema, {})).toThrow()
      expect(() => v.parse(sendMessageSchema, { peer: PEER })).toThrow()
      expect(() => v.parse(sendMessageSchema, { text: 'hi' })).toThrow()
      expect(() => v.parse(sendMessageSchema, { peer: PEER, text: 'hello' })).not.toThrow()
    })

    it('accepts optional options', () => {
      expect(() =>
        v.parse(sendMessageSchema, { peer: PEER, text: 'hello', options: { parseMode: 'html', silent: true } }),
      ).not.toThrow()
    })
  })

  describe('sendPhotoSchema', () => {
    it('requires peer and photoUrl', () => {
      expect(() => v.parse(sendPhotoSchema, {})).toThrow()
      expect(() => v.parse(sendPhotoSchema, { peer: PEER, photoUrl: 'https://example.com/img.jpg' })).not.toThrow()
    })

    it('accepts optional caption via options', () => {
      expect(() =>
        v.parse(sendPhotoSchema, { peer: PEER, photoUrl: 'https://example.com/img.jpg', options: { caption: 'Nice' } }),
      ).not.toThrow()
    })
  })

  describe('sendVideoSchema', () => {
    it('requires peer and videoUrl', () => {
      expect(() => v.parse(sendVideoSchema, {})).toThrow()
      expect(() => v.parse(sendVideoSchema, { peer: PEER, videoUrl: 'https://example.com/vid.mp4' })).not.toThrow()
    })
  })

  describe('sendDocumentSchema', () => {
    it('requires peer and documentUrl', () => {
      expect(() => v.parse(sendDocumentSchema, {})).toThrow()
      expect(() => v.parse(sendDocumentSchema, { peer: PEER, documentUrl: 'https://example.com/doc.pdf' })).not.toThrow()
    })

    it('accepts optional fileName via options', () => {
      expect(() =>
        v.parse(sendDocumentSchema, {
          peer: PEER,
          documentUrl: 'https://example.com/doc.pdf',
          options: { fileName: 'doc.pdf' },
        }),
      ).not.toThrow()
    })
  })

  describe('sendStickerSchema', () => {
    it('requires peer and sticker', () => {
      expect(() => v.parse(sendStickerSchema, {})).toThrow()
      expect(() => v.parse(sendStickerSchema, { peer: PEER, sticker: 'sticker-file-id' })).not.toThrow()
    })

    it('accepts optional silent', () => {
      expect(() => v.parse(sendStickerSchema, { peer: PEER, sticker: 'sticker-file-id', silent: true })).not.toThrow()
    })
  })

  describe('sendVoiceSchema', () => {
    it('requires peer and voiceUrl', () => {
      expect(() => v.parse(sendVoiceSchema, {})).toThrow()
      expect(() => v.parse(sendVoiceSchema, { peer: PEER, voiceUrl: 'https://example.com/voice.ogg' })).not.toThrow()
    })
  })

  describe('sendAudioSchema', () => {
    it('requires peer and audioUrl', () => {
      expect(() => v.parse(sendAudioSchema, {})).toThrow()
      expect(() => v.parse(sendAudioSchema, { peer: PEER, audioUrl: 'https://example.com/audio.mp3' })).not.toThrow()
    })
  })

  describe('sendAnimationSchema', () => {
    it('requires peer and animationUrl', () => {
      expect(() => v.parse(sendAnimationSchema, {})).toThrow()
      expect(() =>
        v.parse(sendAnimationSchema, { peer: PEER, animationUrl: 'https://example.com/anim.gif' }),
      ).not.toThrow()
    })
  })

  describe('sendLocationSchema', () => {
    it('requires peer, latitude, and longitude', () => {
      expect(() => v.parse(sendLocationSchema, {})).toThrow()
      expect(() => v.parse(sendLocationSchema, { peer: PEER })).toThrow()
      expect(() => v.parse(sendLocationSchema, { peer: PEER, latitude: 48.8566, longitude: 2.3522 })).not.toThrow()
    })

    it('accepts optional livePeriod and silent', () => {
      expect(() =>
        v.parse(sendLocationSchema, { peer: PEER, latitude: 48.8566, longitude: 2.3522, livePeriod: 60, silent: true }),
      ).not.toThrow()
    })
  })

  describe('sendContactSchema', () => {
    it('requires peer, phoneNumber, and firstName; lastName is optional', () => {
      expect(() => v.parse(sendContactSchema, {})).toThrow()
      expect(() =>
        v.parse(sendContactSchema, { peer: PEER, phoneNumber: '+1234567890', firstName: 'Alice' }),
      ).not.toThrow()
      expect(() =>
        v.parse(sendContactSchema, { peer: PEER, phoneNumber: '+1234567890', firstName: 'Alice', lastName: 'Smith' }),
      ).not.toThrow()
    })
  })

  describe('sendVenueSchema', () => {
    it('requires peer, latitude, longitude, title, and address', () => {
      expect(() => v.parse(sendVenueSchema, {})).toThrow()
      expect(() =>
        v.parse(sendVenueSchema, {
          peer: PEER,
          latitude: 48.8566,
          longitude: 2.3522,
          title: 'Eiffel Tower',
          address: 'Paris',
        }),
      ).not.toThrow()
    })
  })

  describe('sendDiceSchema', () => {
    it('requires peer; emoji is optional', () => {
      expect(() => v.parse(sendDiceSchema, {})).toThrow()
      expect(() => v.parse(sendDiceSchema, { peer: PEER })).not.toThrow()
      expect(() => v.parse(sendDiceSchema, { peer: PEER, emoji: '🎰' })).not.toThrow()
    })
  })

  describe('forwardMessageSchema', () => {
    it('requires fromPeer, toPeer, and messageIds array', () => {
      expect(() => v.parse(forwardMessageSchema, {})).toThrow()
      expect(() =>
        v.parse(forwardMessageSchema, { fromPeer: 'chat1', toPeer: 'chat2', messageIds: [1, 2, 3] }),
      ).not.toThrow()
    })

    it('accepts optional silent and dropAuthor', () => {
      expect(() =>
        v.parse(forwardMessageSchema, {
          fromPeer: 'chat1',
          toPeer: 'chat2',
          messageIds: [42],
          silent: true,
          dropAuthor: false,
        }),
      ).not.toThrow()
    })
  })

  describe('editMessageSchema', () => {
    it('requires peer, messageId, and text', () => {
      expect(() => v.parse(editMessageSchema, {})).toThrow()
      expect(() => v.parse(editMessageSchema, { peer: PEER, messageId: 1, text: 'updated' })).not.toThrow()
    })
  })

  describe('deleteMessageSchema', () => {
    it('requires peer and messageIds array', () => {
      expect(() => v.parse(deleteMessageSchema, {})).toThrow()
      expect(() => v.parse(deleteMessageSchema, { peer: PEER, messageIds: [1, 2] })).not.toThrow()
    })
  })

  describe('pinMessageSchema', () => {
    it('requires peer and messageId; silent is optional', () => {
      expect(() => v.parse(pinMessageSchema, {})).toThrow()
      expect(() => v.parse(pinMessageSchema, { peer: PEER, messageId: 42 })).not.toThrow()
      expect(() => v.parse(pinMessageSchema, { peer: PEER, messageId: 42, silent: true })).not.toThrow()
    })
  })

  describe('unpinMessageSchema', () => {
    it('requires peer; messageId is optional', () => {
      expect(() => v.parse(unpinMessageSchema, {})).toThrow()
      expect(() => v.parse(unpinMessageSchema, { peer: PEER })).not.toThrow()
      expect(() => v.parse(unpinMessageSchema, { peer: PEER, messageId: 42 })).not.toThrow()
    })
  })

  describe('copyMessageSchema', () => {
    it('requires fromPeer, toPeer, and messageId', () => {
      expect(() => v.parse(copyMessageSchema, {})).toThrow()
      expect(() =>
        v.parse(copyMessageSchema, { fromPeer: 'chat1', toPeer: 'chat2', messageId: 99 }),
      ).not.toThrow()
    })
  })

  describe('banUserSchema', () => {
    it('requires peer and userId', () => {
      expect(() => v.parse(banUserSchema, {})).toThrow()
      expect(() => v.parse(banUserSchema, { peer: PEER, userId: USER_ID })).not.toThrow()
    })
  })

  describe('restrictUserSchema', () => {
    it('requires peer, userId, and permissions object', () => {
      expect(() => v.parse(restrictUserSchema, {})).toThrow()
      expect(() =>
        v.parse(restrictUserSchema, {
          peer: PEER,
          userId: USER_ID,
          permissions: { canSendMessages: false },
        }),
      ).not.toThrow()
    })

    it('accepts optional untilDate', () => {
      expect(() =>
        v.parse(restrictUserSchema, {
          peer: PEER,
          userId: USER_ID,
          permissions: {},
          untilDate: 1700000000,
        }),
      ).not.toThrow()
    })
  })

  describe('promoteUserSchema', () => {
    it('requires peer, userId, and privileges object', () => {
      expect(() => v.parse(promoteUserSchema, {})).toThrow()
      expect(() =>
        v.parse(promoteUserSchema, {
          peer: PEER,
          userId: USER_ID,
          privileges: { canDeleteMessages: true },
        }),
      ).not.toThrow()
    })
  })

  describe('setChatTitleSchema', () => {
    it('requires peer and title', () => {
      expect(() => v.parse(setChatTitleSchema, {})).toThrow()
      expect(() => v.parse(setChatTitleSchema, { peer: PEER, title: 'New Title' })).not.toThrow()
    })
  })

  describe('setChatDescriptionSchema', () => {
    it('requires peer and description', () => {
      expect(() => v.parse(setChatDescriptionSchema, {})).toThrow()
      expect(() => v.parse(setChatDescriptionSchema, { peer: PEER, description: 'New desc' })).not.toThrow()
    })
  })

  describe('exportInviteLinkSchema', () => {
    it('requires peer', () => {
      expect(() => v.parse(exportInviteLinkSchema, {})).toThrow()
      expect(() => v.parse(exportInviteLinkSchema, { peer: PEER })).not.toThrow()
    })
  })

  describe('getChatMemberSchema', () => {
    it('requires peer and userId', () => {
      expect(() => v.parse(getChatMemberSchema, {})).toThrow()
      expect(() => v.parse(getChatMemberSchema, { peer: PEER, userId: USER_ID })).not.toThrow()
    })
  })

  describe('leaveChatSchema', () => {
    it('requires peer', () => {
      expect(() => v.parse(leaveChatSchema, {})).toThrow()
      expect(() => v.parse(leaveChatSchema, { peer: PEER })).not.toThrow()
    })
  })

  describe('createPollSchema', () => {
    it('requires peer, question, and answers array', () => {
      expect(() => v.parse(createPollSchema, {})).toThrow()
      expect(() =>
        v.parse(createPollSchema, { peer: PEER, question: 'Favorite color?', answers: ['Red', 'Blue'] }),
      ).not.toThrow()
    })

    it('accepts optional isAnonymous and multipleChoice', () => {
      expect(() =>
        v.parse(createPollSchema, {
          peer: PEER,
          question: 'Best framework?',
          answers: ['React', 'Vue'],
          isAnonymous: false,
          multipleChoice: true,
        }),
      ).not.toThrow()
    })
  })

  describe('sendMediaGroupSchema', () => {
    it('requires peer and media array', () => {
      expect(() => v.parse(sendMediaGroupSchema, {})).toThrow()
      expect(() =>
        v.parse(sendMediaGroupSchema, {
          peer: PEER,
          media: [{ type: 'photo', url: 'https://example.com/img.jpg' }],
        }),
      ).not.toThrow()
    })

    it('accepts optional caption in media items', () => {
      expect(() =>
        v.parse(sendMediaGroupSchema, {
          peer: PEER,
          media: [{ type: 'video', url: 'https://example.com/vid.mp4', caption: 'A clip' }],
        }),
      ).not.toThrow()
    })
  })

  describe('createForumTopicSchema', () => {
    it('requires peer and name; iconColor and iconEmojiId are optional', () => {
      expect(() => v.parse(createForumTopicSchema, {})).toThrow()
      expect(() => v.parse(createForumTopicSchema, { peer: PEER, name: 'General' })).not.toThrow()
      expect(() =>
        v.parse(createForumTopicSchema, { peer: PEER, name: 'General', iconColor: 0xff0000, iconEmojiId: 'emoji123' }),
      ).not.toThrow()
    })
  })

  describe('resolveUsernameSchema', () => {
    it('requires username', () => {
      expect(() => v.parse(resolveUsernameSchema, {})).toThrow()
      expect(() => v.parse(resolveUsernameSchema, { username: 'telegram' })).not.toThrow()
    })
  })
})
