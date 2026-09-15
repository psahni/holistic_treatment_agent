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

  test('shows notice when intake autofill is clicked with no saved draft', async () => {
    localStorage.clear();
    render(<ChatInterface sessionId="test-session-123" user={{ name: 'Test User' }} initialMode="treatment" />);

    const autofillBtn = screen.getByText(/✨ Autofill Details/i);
    fireEvent.click(autofillBtn);

    expect(screen.getByText(/No saved assessment draft found yet/i)).toBeInTheDocument();
    expect(screen.queryByDisplayValue(/Chronic acid reflux/i)).not.toBeInTheDocument();
  });

  test('autofills saved draft when intake autofill is clicked with existing draft', async () => {
    const draft = {
      response_1: 'Persistent stomach gas and acidity',
      response_2: '2 weeks',
      response_3: '4',
      response_4: 'None',
      response_5: 'None',
      response_6: 'Vegetarian',
      response_7: '7 hours sleep',
      response_8: 'No allergies'
    };
    localStorage.setItem('naturecure_intake_draft', JSON.stringify(draft));

    render(<ChatInterface sessionId="test-session-123" user={{ name: 'Test User' }} initialMode="treatment" />);

    const autofillBtn = screen.getByText(/✨ Autofill Details/i);
    fireEvent.click(autofillBtn);

    expect(screen.getByDisplayValue(/Persistent stomach gas and acidity/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/2 weeks/i)).toBeInTheDocument();
    expect(screen.getByText(/Saved assessment details autofilled/i)).toBeInTheDocument();
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

  test('renders generic welcome message at top on initial question mode landing', async () => {
    render(<ChatInterface sessionId="test-session-123" user={{ name: 'Test User' }} initialMode="question" />);

    expect(screen.getByText(/Welcome to NatureCure AI. Please tell me about the main health challenge you are facing today./i)).toBeInTheDocument();
  });

  test('renders 3 sample questions after receiving assistant answer in question mode', async () => {
    naturopathyAPI.sendMessage.mockResolvedValueOnce({
      message: 'Here are natural remedies for your bloating.',
      step: 'intake',
      is_complete: false,
      suggested_questions: [
        'What specific foods should I strictly avoid for acid reflux and bloating?',
        'How quickly can I expect relief by following these natural remedies?',
        'Are there specific yoga asanas or breathing exercises for better digestion?'
      ]
    });

    render(<ChatInterface sessionId="test-session-123" user={{ name: 'Test User' }} initialMode="question" />);

    const input = screen.getByPlaceholderText(/Describe your symptoms/i);
    fireEvent.change(input, { target: { value: 'I have stomach bloating' } });
    fireEvent.submit(input.closest('form'));

    await waitFor(() => {
      expect(screen.getByTestId('suggested-followup-container')).toBeInTheDocument();
      expect(screen.getByText(/Do you want to ask this\? You want to ask this\?/i)).toBeInTheDocument();
      expect(screen.getByText(/What specific foods should I strictly avoid/i)).toBeInTheDocument();
      expect(screen.getByText(/How quickly can I expect relief/i)).toBeInTheDocument();
      expect(screen.getByText(/Are there specific yoga asanas/i)).toBeInTheDocument();
    });
  });

  test('enables submit button when input has text and disables when empty', async () => {
    render(<ChatInterface sessionId="test-session-123" user={{ name: 'Test User' }} initialMode="question" />);

    const input = screen.getByPlaceholderText(/Describe your symptoms/i);
    const submitBtn = screen.getByTitle(/Send message/i);

    expect(submitBtn).toBeDisabled();

    fireEvent.change(input, { target: { value: 'Can you suggest something for migraine?' } });
    expect(submitBtn).toBeEnabled();

    fireEvent.change(input, { target: { value: '   ' } });
    expect(submitBtn).toBeDisabled();
  });
});

