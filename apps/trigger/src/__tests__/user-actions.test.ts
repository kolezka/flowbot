import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dispatchUserAction } from '../lib/flow-engine/user-actions.js';

const mockDispatchAction = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ success: true, data: { id: 1 } }),
);

vi.mock('../lib/flow-engine/dispatcher.js', () => ({
  dispatchAction: mockDispatchAction,
}));

describe('dispatchUserAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject non-user_ actions', async () => {
    const result = await dispatchUserAction('send_message', {}, 'conn-1');
    expect(result.dispatched).toBe(false);
    expect(result.error).toContain('not a user account action');
    expect(mockDispatchAction).not.toHaveBeenCalled();
  });

  it('should dispatch user_send_message via pool HTTP', async () => {
    const result = await dispatchUserAction('user_send_message', {
      chatId: '123', text: 'Hello from user',
    }, 'conn-1');
    expect(result.dispatched).toBe(true);
    expect(result.response).toEqual({ id: 1 });
    expect(mockDispatchAction).toHaveBeenCalledWith(
      'user_send_message',
      { chatId: '123', text: 'Hello from user' },
      expect.stringContaining('http'),
      'conn-1',
    );
  });

  it('should dispatch user_get_chat_history via pool HTTP', async () => {
    const result = await dispatchUserAction('user_get_chat_history', {
      chatId: '123', limit: 50,
    }, 'conn-1');
    expect(result.dispatched).toBe(true);
    expect(mockDispatchAction).toHaveBeenCalledWith(
      'user_get_chat_history',
      expect.objectContaining({ chatId: '123', limit: 50 }),
      expect.any(String),
      'conn-1',
    );
  });

  it('should return error when pool dispatch fails', async () => {
    mockDispatchAction.mockResolvedValueOnce({ success: false, error: 'Worker not found: conn-1' });
    const result = await dispatchUserAction('user_send_message', { chatId: '123', text: 'test' }, 'conn-1');
    expect(result.dispatched).toBe(false);
    expect(result.error).toContain('Worker not found');
  });

  it('should return error when fetch throws', async () => {
    mockDispatchAction.mockRejectedValueOnce(new Error('Connection refused'));
    const result = await dispatchUserAction('user_send_message', { chatId: '123', text: 'test' }, 'conn-1');
    expect(result.dispatched).toBe(false);
    expect(result.error).toContain('Connection refused');
  });
});
