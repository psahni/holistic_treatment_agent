import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import HeroSection from '../src/components/HeroSection';
import { naturopathyAPI } from '../src/services/api';

jest.mock('../src/services/api', () => ({
  naturopathyAPI: {
    getMe: jest.fn(),
    logout: jest.fn(),
  },
}));

describe('HeroSection Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    naturopathyAPI.getMe.mockRejectedValue(new Error('Unauthenticated'));
  });

  test('renders hero title and subtitle', async () => {
    render(<HeroSection onStart={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText(/AI-Powered Holistic Healing/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Natural Healing\./i)).toBeInTheDocument();
    expect(screen.getByText(/Personalized for You\./i)).toBeInTheDocument();
  });

  test('opens patient modal when unauthenticated user starts journey', async () => {
    render(<HeroSection onStart={() => {}} />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Start Your Healing Journey/i })).toBeInTheDocument();
    });
    const startBtn = screen.getByRole('button', { name: /Start Your Healing Journey/i });
    fireEvent.click(startBtn);
    expect(screen.getByRole('button', { name: /Begin Your Assessment/i })).toBeInTheDocument();
  });

  test('opens auth modal when clicking log in / sign up', async () => {
    render(<HeroSection onStart={() => {}} />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Log In \/ Sign Up/i })).toBeInTheDocument();
    });
    const authBtn = screen.getByRole('button', { name: /Log In \/ Sign Up/i });
    fireEvent.click(authBtn);
    expect(screen.getByRole('heading', { name: /Welcome Back/i })).toBeInTheDocument();
  });
});

