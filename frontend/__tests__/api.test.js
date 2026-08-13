import { naturopathyAPI } from '../src/services/api';

describe('naturopathyAPI service', () => {
  beforeEach(() => {
    fetch.resetMocks ? fetch.resetMocks() : (global.fetch = jest.fn());
  });

  test('signup sends POST to /api/auth/signup', async () => {
    const mockUser = { name: 'Jane', email: 'jane@example.com' };
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ user: mockUser }),
    });

    const res = await naturopathyAPI.signup(mockUser);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/signup'),
      expect.objectContaining({ method: 'POST', credentials: 'include' })
    );
    expect(res).toEqual({ user: mockUser });
  });

  test('login sends POST to /api/auth/login', async () => {
    const credentials = { login_id: 'jane@example.com', password: 'password' };
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Login successful' }),
    });

    const res = await naturopathyAPI.login(credentials);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/login'),
      expect.objectContaining({ method: 'POST' })
    );
    expect(res.message).toBe('Login successful');
  });

  test('logout sends POST to /api/auth/logout', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Logged out' }),
    });

    const res = await naturopathyAPI.logout();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/logout'),
      expect.objectContaining({ method: 'POST' })
    );
    expect(res.message).toBe('Logged out');
  });

  test('getMe sends GET to /api/auth/me', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ user: { name: 'Jane' } }),
    });

    const res = await naturopathyAPI.getMe();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/me'),
      expect.objectContaining({ method: 'GET' })
    );
    expect(res.user.name).toBe('Jane');
  });

  test('startSession calls /api/naturo/start', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ session_id: 'sess-123', message: 'Welcome' }),
    });

    const res = await naturopathyAPI.startSession({ name: 'Jane', age: '30', gender: 'female', region: 'India' }, 'treatment');
    expect(res).toEqual({ session_id: 'sess-123', message: 'Welcome' });
  });

  test('submitIntake sends POST to /api/naturo/submit_intake', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ step: 'complete', is_complete: true, message: 'Submitted' }),
    });

    const res = await naturopathyAPI.submitIntake('sess-123', { response_1: 'Headache' });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/naturo/submit_intake'),
      expect.objectContaining({ method: 'POST' })
    );
    expect(res.is_complete).toBe(true);
  });

  test('Template CRUD methods work correctly', async () => {
    // getTemplates
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => [{ id: 1, name: 'Template 1' }] });
    const templates = await naturopathyAPI.getTemplates();
    expect(templates).toHaveLength(1);

    // createTemplate
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 2, message: 'Created' }) });
    const createRes = await naturopathyAPI.createTemplate({ name: 'Template 2', category: 'Heart', prescription_text: 'Text' });
    expect(createRes.id).toBe(2);

    // updateTemplate
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ message: 'Updated' }) });
    const updateRes = await naturopathyAPI.updateTemplate(2, { name: 'Updated 2' });
    expect(updateRes.message).toBe('Updated');

    // deleteTemplate
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ message: 'Deleted' }) });
    const deleteRes = await naturopathyAPI.deleteTemplate(2);
    expect(deleteRes.message).toBe('Deleted');

    // generateAIPrescription
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ prescription_text: 'AI Text' }) });
    const aiRes = await naturopathyAPI.generateAIPrescription('sess-123');
    expect(aiRes.prescription_text).toBe('AI Text');
  });

  test('fetchWithCredentials throws error when response is not ok', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ detail: 'Bad Request' }),
    });

    await expect(naturopathyAPI.getPendingCases()).rejects.toThrow('API Error: 400');
  });
});
