import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PatientFormModal from '../src/components/PatientFormModal';

describe('PatientFormModal Component', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  test('renders form fields, title, and autofill button', () => {
    render(<PatientFormModal isOpen={true} onClose={() => {}} onStart={() => {}} />);
    expect(screen.getByText(/Start Your Assessment/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/^Name$/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/^Age$/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Region/i)).toBeInTheDocument();
    expect(screen.getByText(/✨ Autofill Details/i)).toBeInTheDocument();
  });

  test('autofills sample details when Autofill Details button is clicked', () => {
    render(<PatientFormModal isOpen={true} onClose={() => {}} onStart={() => {}} />);
    
    const autofillBtn = screen.getByText(/✨ Autofill Details/i);
    fireEvent.click(autofillBtn);

    expect(screen.getByDisplayValue('Rohan Sharma')).toBeInTheDocument();
    expect(screen.getByDisplayValue('32')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveValue('male');
    expect(screen.getByDisplayValue('New Delhi, India')).toBeInTheDocument();
    expect(screen.getByText(/Details autofilled!/i)).toBeInTheDocument();
    
    // Check localStorage persistence
    const saved = JSON.parse(localStorage.getItem('naturecure_visitor_profile'));
    expect(saved.name).toBe('Rohan Sharma');
  });

  test('hydrates saved profile from localStorage on open', () => {
    const savedData = {
      name: 'Priya Patel',
      age: '28',
      gender: 'female',
      region: 'Bangalore, India',
      investigations: 'Iron deficiency'
    };
    localStorage.setItem('naturecure_visitor_profile', JSON.stringify(savedData));

    render(<PatientFormModal isOpen={true} onClose={() => {}} onStart={() => {}} />);
    
    expect(screen.getByDisplayValue('Priya Patel')).toBeInTheDocument();
    expect(screen.getByDisplayValue('28')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Bangalore, India')).toBeInTheDocument();
    expect(screen.getByText(/Saved in browser memory/i)).toBeInTheDocument();
  });

  test('submits form with patient details when Begin Your Assessment is clicked', () => {
    const onStart = jest.fn();
    render(<PatientFormModal isOpen={true} onClose={() => {}} onStart={onStart} />);
    
    fireEvent.change(screen.getByPlaceholderText(/^Name$/i), { target: { value: 'Alex Chen' } });
    fireEvent.change(screen.getByPlaceholderText(/^Age$/i), { target: { value: '40' } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'other' } });
    fireEvent.change(screen.getByPlaceholderText(/Region/i), { target: { value: 'Singapore' } });

    fireEvent.click(screen.getByRole('button', { name: /Begin Your Assessment/i }));

    expect(onStart).toHaveBeenCalledWith('new', {
      name: 'Alex Chen',
      age: '40',
      gender: 'other',
      region: 'Singapore',
      investigations: ''
    });
  });

  test('closes modal when close icon is clicked', () => {
    const onClose = jest.fn();
    render(<PatientFormModal isOpen={true} onClose={onClose} onStart={() => {}} />);
    
    fireEvent.click(screen.getByRole('button', { name: '×' }));
    expect(onClose).toHaveBeenCalled();
  });
});

