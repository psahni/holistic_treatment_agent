import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ChatInterface from '../src/components/ChatInterface';
import { naturopathyAPI } from '../src/services/api';

jest.mock('../src/services/api', () => ({
  naturopathyAPI: {
    startSession: jest.fn(),
    sendMessage: jest.fn(),
    streamMessage: jest.fn(),
    submitIntake: jest.fn(),
    getMe: jest.fn().mockResolvedValue({ id: 1, name: 'Test User' }),
    getPatientHistory: jest.fn().mockResolvedValue({ cases: [] }),
    getPatientCaseDetails: jest.fn().mockResolvedValue({}),
  },
}));

describe('ChatInterface Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    naturopathyAPI.startSession.mockResolvedValue({
      session_id: 'test-sess',
      message: 'Welcome to NatureCure AI. Please tell me about your health concern.',
      step: 'intake',
      is_complete: false,
    });
    naturopathyAPI.streamMessage.mockImplementation(async function* () {
      yield { chunk: 'Here are natural remedies' };
      yield { done: true, state: { message: 'Here are natural remedies', step: 'intake' } };
    });
    naturopathyAPI.sendMessage.mockResolvedValue({
      message: 'Here are natural remedies',
      step: 'intake',
      is_complete: false,
    });
  });

  test('renders chat and starts session when sessionId is new', async () => {
    render(<ChatInterface sessionId="new" user={{ name: 'Test User' }} />);

    await waitFor(() => {
      expect(naturopathyAPI.startSession).toHaveBeenCalled();
    });
  });

  test('renders symptom starter chips on initial empty state', async () => {
    render(<ChatInterface sessionId="test-session-123" user={{ name: 'Test User' }} />);

    await waitFor(() => {
      expect(screen.getByText(/Popular Health Queries/i)).toBeInTheDocument();
      expect(screen.getByText(/Acid Reflux & Bloating/i)).toBeInTheDocument();
    });
  });

  test('sends message when a symptom chip is clicked', async () => {
    render(<ChatInterface sessionId="test-session-123" user={{ name: 'Test User' }} />);

    await waitFor(() => {
      expect(screen.getByText(/Acid Reflux & Bloating/i)).toBeInTheDocument();
    });

    const chip = screen.getByText(/Acid Reflux & Bloating/i);
    fireEvent.click(chip);

    await waitFor(() => {
      expect(naturopathyAPI.sendMessage).toHaveBeenCalledWith('test-session-123', 'I have severe acid reflux and stomach bloating after meals. What natural remedies do you suggest?', 'question');
    });
  });
});
