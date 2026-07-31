import React from 'react';

export default function GeminiLoader() {
  return (
    <div className="gemini-loader-container">
      <div className="gemini-star-wrapper">
        <div className="gemini-star">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C12 2 12.5 9.5 20 10C12.5 10.5 12 18 12 18C12 18 11.5 10.5 4 10C11.5 9.5 12 2 12 2Z" fill="url(#paint0_linear)"/>
            <defs>
              <linearGradient id="paint0_linear" x1="4" y1="10" x2="20" y2="10" gradientUnits="userSpaceOnUse">
                <stop stopColor="#3B82F6"/>
                <stop offset="0.5" stopColor="#8B5CF6"/>
                <stop offset="1" stopColor="#EC4899"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
      <div className="gemini-text-shimmer">Thinking...</div>
    </div>
  );
}
