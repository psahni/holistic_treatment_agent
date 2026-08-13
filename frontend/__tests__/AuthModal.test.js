import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AuthModal from '../src/components/AuthModal';
import { naturopathyAPI } from '../src/services/api';

jest.mock('../src/services/api', () => ({
  naturopathyAPI: {
    login: jest.fn(),
    signup: jest.fn(),
  },
}));

describe('AuthModal Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders login form by default', () => {
    render(<AuthModal isOpen={true} onClose={() => {}} onSuccess={() => {}} />);
    expect(screen.getByRole('heading', { name: /Welcome Back/i })).toBeInTheDocument();
  });

  test('switches to signup form', () => {
    render(<AuthModal isOpen={true} onClose={() => {}} onSuccess={() => {}} />);
    fireEvent.click(screen.getByText(/Sign up/i));
    expect(screen.getByRole('heading', { name: /Create an Account/i })).toBeInTheDocument();
  });

  test('submits login form successfully', async () => {
    naturopathyAPI.login.mockResolvedValue({ user: { name: 'Test User' } });
    const onSuccess = jest.fn();
    render(<AuthModal isOpen={true} onClose={() => {}} onSuccess={onSuccess} />);
    
    fireEvent.change(screen.getByPlaceholderText(/Email or Phone Number/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByPlaceholderText(/Password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    await waitFor(() => {
      expect(naturopathyAPI.login).toHaveBeenCalledWith({ login_id: 'test@example.com', password: 'password123' });
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  test('submits signup form successfully', async () => {
    naturopathyAPI.signup.mockResolvedValue({ user: { name: 'New User' } });
    const onSuccess = jest.fn();
    render(<AuthModal isOpen={true} onClose={() => {}} onSuccess={onSuccess} />);
    
    // switch to signup
    fireEvent.click(screen.getByText(/Sign up/i));
    
    fireEvent.change(screen.getByPlaceholderText(/Full Name/i), { target: { value: 'New User' } });
    fireEvent.change(screen.getByPlaceholderText(/Age/i), { target: { value: '30' } });
    fireEvent.change(screen.getByPlaceholderText(/City/i), { target: { value: 'New York' } });
    fireEvent.change(screen.getByPlaceholderText(/Email Address/i), { target: { value: 'new@example.com' } });
    fireEvent.change(screen.getByPlaceholderText(/Phone Number/i), { target: { value: '1234567890' } });
    fireEvent.change(screen.getByPlaceholderText(/Password/i), { target: { value: 'password123' } });
    
    fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));

    await waitFor(() => {
      expect(naturopathyAPI.signup).toHaveBeenCalledWith({
        name: 'New User',
        age: 30,
        city: 'New York',
        email: 'new@example.com',
        phone_number: '1234567890',
        password: 'password123'
      });
      expect(onSuccess).toHaveBeenCalled();
    });
  });
});
