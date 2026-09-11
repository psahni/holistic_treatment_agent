import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import BentoRemedyGrid from '../src/components/BentoRemedyGrid';

const mockData = {
  isStructured: true,
  elements: [
    { id: 'water', name: 'Water', sanskrit: 'Jala', icon: '💧' },
    { id: 'fire', name: 'Fire', sanskrit: 'Agni', icon: '🔥' }
  ],
  kitchen: {
    title: 'Warm Cumin & Fennel Tea',
    steps: ['Boil 1 tsp crushed cumin seeds in 250ml water for 5 minutes', 'Strain and sip slowly warm after lunch'],
    image: '/images/remedies/kitchen/herbal_tea.svg'
  },
  hydrotherapy: {
    title: 'Cold Wet Abdominal Compress',
    duration: '15 mins',
    steps: ['Dip a cotton cloth in cold water, wring well and place across abdomen', 'Cover with dry wool flannel'],
    image: '/images/remedies/hydrotherapy/cold_compress.svg'
  },
  breath: {
    title: 'Diaphragmatic Deep Breathing',
    steps: ['Inhale slowly through the nose for 4 counts', 'Exhale gently through mouth for 6 counts'],
    image: '/images/remedies/breath_mind/pranayama.svg'
  },
  safety: 'Avoid spicy or fried meals. Consult a physician if pain is severe.'
};

describe('BentoRemedyGrid Component', () => {
  test('renders protocol title and elemental pills', () => {
    render(<BentoRemedyGrid data={mockData} onConsultDoctor={() => {}} />);
    
    expect(screen.getByText(/Instant Holistic Protocol/i)).toBeInTheDocument();
    expect(screen.getByText('Water')).toBeInTheDocument();
    expect(screen.getByText('Fire')).toBeInTheDocument();
  });

  test('renders all 3 bento card sections with titles and steps', () => {
    render(<BentoRemedyGrid data={mockData} onConsultDoctor={() => {}} />);
    
    expect(screen.getByText('Warm Cumin & Fennel Tea')).toBeInTheDocument();
    expect(screen.getByText('Cold Wet Abdominal Compress')).toBeInTheDocument();
    expect(screen.getByText('Diaphragmatic Deep Breathing')).toBeInTheDocument();
    expect(screen.getByText('⏱ 15 mins')).toBeInTheDocument();
    expect(screen.getByText(/Boil 1 tsp crushed cumin seeds/i)).toBeInTheDocument();
  });

  test('renders safety alert strip and action buttons', () => {
    const handleConsult = jest.fn();
    render(<BentoRemedyGrid data={mockData} onConsultDoctor={handleConsult} />);
    
    expect(screen.getByText(/Safety:/i)).toBeInTheDocument();
    expect(screen.getByText(/Avoid spicy or fried meals/i)).toBeInTheDocument();

    const saveBtn = screen.getByText(/Save Protocol/i);
    fireEvent.click(saveBtn);
    expect(screen.getByText(/✓ Saved!/i)).toBeInTheDocument();

    const switchBtn = screen.getByText(/Switch to Full Treatment/i);
    fireEvent.click(switchBtn);
    expect(handleConsult).toHaveBeenCalledTimes(1);
  });

  test('returns null if data is missing', () => {
    const { container } = render(<BentoRemedyGrid data={null} />);
    expect(container.firstChild).toBeNull();
  });
});
