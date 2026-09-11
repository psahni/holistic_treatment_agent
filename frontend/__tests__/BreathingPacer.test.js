import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import BreathingPacer from '../src/components/BreathingPacer';

describe('BreathingPacer Component', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('renders with 4-7-8 pattern by default', () => {
    render(<BreathingPacer />);
    expect(screen.getByText(/4-7-8 Calming Pranayama/i)).toBeInTheDocument();
    expect(screen.getByTestId('pacer-phase')).toHaveTextContent('Ready');
    expect(screen.getByTestId('pacer-timer')).toHaveTextContent('TAP START');
  });

  test('switches pattern to Box Breathing', () => {
    render(<BreathingPacer />);
    const boxBtn = screen.getByText(/Box 4-4-4-4/i);
    fireEvent.click(boxBtn);
    expect(screen.getByText(/Box Breathing \(Sama Vritti\)/i)).toBeInTheDocument();
  });

  test('switches pattern to Sheetali cooling breath', () => {
    render(<BreathingPacer />);
    const sheetaliBtn = screen.getByText(/Sheetali/i);
    fireEvent.click(sheetaliBtn);
    expect(screen.getByText(/Sheetali \(Cooling Breath\)/i)).toBeInTheDocument();
  });

  test('starts and pauses timer on toggle', () => {
    render(<BreathingPacer />);
    const startBtn = screen.getByRole('button', { name: /Start Pacer/i });
    
    // Start pacer
    fireEvent.click(startBtn);
    expect(screen.getByTestId('pacer-phase')).toHaveTextContent('Inhale');
    expect(screen.getByRole('button', { name: /Pause/i })).toBeInTheDocument();

    // Advance 1s
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId('pacer-timer')).toHaveTextContent(/3s|4s/);

    // Pause pacer
    const pauseBtn = screen.getByRole('button', { name: /Pause/i });
    fireEvent.click(pauseBtn);
    expect(screen.getByRole('button', { name: /Start Pacer/i })).toBeInTheDocument();
  });

  test('resets properly when Reset button clicked', () => {
    render(<BreathingPacer />);
    const startBtn = screen.getByRole('button', { name: /Start Pacer/i });
    fireEvent.click(startBtn);

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    const resetBtn = screen.getByRole('button', { name: /Reset/i });
    fireEvent.click(resetBtn);

    expect(screen.getByTestId('pacer-phase')).toHaveTextContent('Ready');
    expect(screen.getByTestId('pacer-timer')).toHaveTextContent('TAP START');
  });
});
