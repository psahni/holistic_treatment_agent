import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PatientFormModal from '../src/components/PatientFormModal';
import { naturopathyAPI } from '../src/services/api';

jest.mock('../src/services/api', () => ({
  naturopathyAPI: {
    startSession: jest.fn(),
  },
}));

describe('PatientFormModal Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders form fields', () => {
    render(<PatientFormModal isOpen={true} onClose={() => {}} onSubmit={() => {}} mode="question" />);
    expect(screen.getByPlaceholderText(/Full Name/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Age/i)).toBeInTheDocument();
  });

  test('submits form with patient details', async () => {
    const onSubmit = jest.fn();
    render(<PatientFormModal isOpen={true} onClose={() => {}} onSubmit={onSubmit} mode="question" />);
    
    fireEvent.change(screen.getByPlaceholderText(/Full Name/i), { target: { value: 'John Doe' } });
    fireEvent.change(screen.getByPlaceholderText(/Age/i), { target: { value: '35' } });
    fireEvent.change(screen.getByPlaceholderText(/City/i), { target: { value: 'Mumbai' } });
    fireEvent.change(screen.getByPlaceholderText(/Contact Number/i), { target: { value: '9876543210' } });
    fireEvent.change(screen.getByPlaceholderText(/Email/i), { target: { value: 'john@example.com' } });

    fireEvent.click(screen.getByRole('button', { name: /Start/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'John Doe',
        age: 35,
        city: 'Mumbai',
        phone: '9876543210',
        email: 'john@example.com'
      });
    });
  });

  test('closes modal when cancel is clicked', () => {
    const onClose = jest.fn();
    render(<PatientFormModal isOpen={true} onClose={onClose} onSubmit={() => {}} mode="question" />);
    
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
