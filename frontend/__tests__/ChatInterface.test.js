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

  test('renders assessment intake form with autofill button in treatment mode', async () => {
    render(<ChatInterface sessionId="test-session-123" user={{ name: 'Test User' }} initialMode="treatment" />);

    expect(screen.getByText(/Comprehensive Health Intake/i)).toBeInTheDocument();
    expect(screen.getByText(/✨ Autofill Details/i)).toBeInTheDocument();
  });

  test('autofills intake form details and persists to localStorage', async () => {
    localStorage.clear();
    render(<ChatInterface sessionId="test-session-123" user={{ name: 'Test User' }} initialMode="treatment" />);

    const autofillBtn = screen.getByText(/✨ Autofill Details/i);
    fireEvent.click(autofillBtn);

    expect(screen.getByDisplayValue(/Chronic acid reflux, burning sensation/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/About 6 months/i)).toBeInTheDocument();
    expect(screen.getByText(/Saved in browser memory/i)).toBeInTheDocument();

    const saved = JSON.parse(localStorage.getItem('naturecure_intake_draft'));
    expect(saved.response_1).toContain('Chronic acid reflux');
  });

  test('hydrates intake form draft from localStorage on mount in treatment mode', async () => {
    const draft = {
      response_1: 'Persistent lower back pain',
      response_2: '3 months',
      response_3: '7',
      response_4: 'Sciatica',
      response_5: 'None',
      response_6: 'Normal',
      response_7: 'Moderate stress',
      response_8: 'No allergies'
    };
    localStorage.setItem('naturecure_intake_draft', JSON.stringify(draft));

    render(<ChatInterface sessionId="test-session-123" user={{ name: 'Test User' }} initialMode="treatment" />);

    expect(screen.getByDisplayValue('Persistent lower back pain')).toBeInTheDocument();
    expect(screen.getByDisplayValue('3 months')).toBeInTheDocument();
    expect(screen.getByText(/Saved in browser memory/i)).toBeInTheDocument();
  });
});

