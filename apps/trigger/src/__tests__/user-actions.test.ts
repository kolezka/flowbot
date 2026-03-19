import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dispatchUserAction } from '../lib/flow-engine/user-actions.js';

const mockClient = vi.hoisted(() => ({
  getEntity: vi.fn().mockResolvedValue({ id: 123 }),
  getMessages: vi.fn().mockResolvedValue([{ id: 1, message: 'hello' }]),
  getParticipants: vi.fn().mockResolvedValue([]),
  getDialogs: vi.fn().mockResolvedValue([]),
  invoke: vi.fn().mockResolvedValue({}),
}));

const mockTransport = vi.hoisted(() => ({
  sendMessage: vi.fn().mockResolvedValue({ id: 1, date: Date.now(), peerId: '123' }),
  sendPhoto: vi.fn().mockResolvedValue({ id: 2, date: Date.now(), peerId: '123' }),
  sendVideo: vi.fn().mockResolvedValue({ id: 3, date: Date.now(), peerId: '123' }),
  sendDocument: vi.fn().mockResolvedValue({ id: 4, date: Date.now(), peerId: '123' }),
  forwardMessage: vi.fn().mockResolvedValue([{ id: 5 }]),
  deleteMessages: vi.fn().mockResolvedValue(true),
  getClient: vi.fn(),
  isConnected: vi.fn().mockReturnValue(true),
  connect: vi.fn(),
  disconnect: vi.fn(),
}));

vi.mock('../lib/flow-engine/connection-transport.js', () => ({
  getTransportForConnection: vi.fn().mockResolvedValue(mockTransport),
}));

describe('dispatchUserAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransport.getClient.mockReturnValue(mockClient);
  });

  it('should reject non-user_ actions', async () => {
    const result = await dispatchUserAction('send_message', {}, 'conn-1');
    expect(result.dispatched).toBe(false);
    expect(result.error).toContain('not a user account action');
  });

  it('should dispatch user_send_message via transport.sendMessage', async () => {
    const result = await dispatchUserAction('user_send_message', {
      chatId: '123', text: 'Hello from user',
    }, 'conn-1');
    expect(result.dispatched).toBe(true);
    expect(mockTransport.sendMessage).toHaveBeenCalledWith('123', 'Hello from user', expect.any(Object));
  });

  it('should dispatch user_get_chat_history via client.getMessages', async () => {
    const result = await dispatchUserAction('user_get_chat_history', {
      chatId: '123', limit: 50,
    }, 'conn-1');
    expect(result.dispatched).toBe(true);
    expect(mockClient.getEntity).toHaveBeenCalledWith('123');
    expect(mockClient.getMessages).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ limit: 50 }));
  });

  it('should dispatch user_get_all_members via client.getParticipants', async () => {
    const result = await dispatchUserAction('user_get_all_members', {
      chatId: '123', limit: 200,
    }, 'conn-1');
    expect(result.dispatched).toBe(true);
    expect(mockClient.getParticipants).toHaveBeenCalled();
  });

  it('should dispatch user_get_dialogs via client.getDialogs', async () => {
    const result = await dispatchUserAction('user_get_dialogs', { limit: 100 }, 'conn-1');
    expect(result.dispatched).toBe(true);
    expect(mockClient.getDialogs).toHaveBeenCalledWith(expect.objectContaining({ limit: 100 }));
  });

  it('should return error when connection fails', async () => {
    const { getTransportForConnection } = await import('../lib/flow-engine/connection-transport.js');
    (getTransportForConnection as any).mockRejectedValueOnce(new Error('Connection inactive'));
    const result = await dispatchUserAction('user_send_message', { chatId: '123', text: 'test' }, 'conn-1');
    expect(result.dispatched).toBe(false);
    expect(result.error).toContain('Connection inactive');
  });

  it('should return error when getClient() returns null', async () => {
    mockTransport.getClient.mockReturnValue(null);
    const result = await dispatchUserAction('user_get_chat_history', { chatId: '123' }, 'conn-1');
    expect(result.dispatched).toBe(false);
    expect(result.error).toContain('no underlying client');
  });

  it('should return error for unknown user action', async () => {
    const result = await dispatchUserAction('user_nonexistent', {}, 'conn-1');
    expect(result.dispatched).toBe(false);
    expect(result.error).toContain('Unknown user action');
  });
});
