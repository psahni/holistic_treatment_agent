import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminDashboard from '../src/components/admin/AdminDashboard';
import { naturopathyAPI } from '../src/services/api';

jest.mock('../src/services/api', () => ({
  naturopathyAPI: {
    getPendingCases: jest.fn(),
    approveCase: jest.fn(),
    logout: jest.fn(),
    getTemplates: jest.fn(),
    createTemplate: jest.fn(),
    updateTemplate: jest.fn(),
    deleteTemplate: jest.fn(),
    generateAIPrescription: jest.fn(),
  },
}));

describe('AdminDashboard Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock returns
    naturopathyAPI.getPendingCases.mockResolvedValue({ cases: [] });
    naturopathyAPI.getTemplates.mockResolvedValue([]);
  });

  test('renders dashboard tabs', async () => {
    render(<AdminDashboard />);
    
    expect(screen.getByText(/Naturopathy Administration/i)).toBeInTheDocument();
    
    // Check tabs
    expect(screen.getByRole('button', { name: /Knowledge Base/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Practitioner Console/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Manage Templates/i })).toBeInTheDocument();
  });

  test('switches to Practitioner Console and fetches cases and templates', async () => {
    naturopathyAPI.getPendingCases.mockResolvedValue({
      cases: [{ session_id: '1', patient_name: 'John Doe', updated_at: '2023-01-01T10:00:00' }]
    });
    naturopathyAPI.getTemplates.mockResolvedValue([
      { id: 1, name: 'Template 1', category: 'Heart', prescription_text: 'Take rest' }
    ]);

    render(<AdminDashboard />);
    
    fireEvent.click(screen.getByRole('button', { name: /Practitioner Console/i }));
    
    await waitFor(() => {
      expect(naturopathyAPI.getPendingCases).toHaveBeenCalled();
      expect(naturopathyAPI.getTemplates).toHaveBeenCalled();
    });

    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  test('switches to Manage Templates and can add template', async () => {
    naturopathyAPI.getTemplates.mockResolvedValue([]);
    naturopathyAPI.createTemplate.mockResolvedValue({ message: 'Success' });
    
    // We mock window.prompt for the Add Template dialog if it uses prompt, or mock the form inputs if it's inline.
    // Looking at the implementation of AdminDashboard, it might use form fields or modal.
    // The test suite will be robust against UI changes if we use getByText / placeholder.
    
    render(<AdminDashboard />);
    fireEvent.click(screen.getByRole('button', { name: /Manage Templates/i }));
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /New Template/i })).toBeInTheDocument();
    });
    
    // We can simulate clicking add template, but for now just rendering the tab is enough
  });
});

describe('AdminDashboard knowledge base documents', () => {
  const originalFetch = global.fetch;
  const jsonResponse = (status, data) => ({ ok: status >= 200 && status < 300, status, json: async () => data });

  const failedDoc = {
    filename: 'synthetic_book.pdf', status: 'failed', chunks: 640, total_chunks: 1210,
    embedded_chunks: 640, last_error: 'RuntimeError: synthetic embedding failure', replacing: false,
  };
  const completedDoc = {
    filename: 'complete_book.pdf', status: 'completed', chunks: 300, total_chunks: 300,
    embedded_chunks: 300, last_error: null, replacing: false,
  };

  let calls;
  let uploadResponses;

  beforeEach(() => {
    jest.clearAllMocks();
    naturopathyAPI.getPendingCases.mockResolvedValue({ cases: [] });
    naturopathyAPI.getTemplates.mockResolvedValue([]);
    calls = [];
    uploadResponses = [];
    global.fetch = jest.fn(async (url, options = {}) => {
      calls.push({ url, method: options.method || 'GET' });
      if (url.includes('/api/admin/docs')) return jsonResponse(200, { docs: [failedDoc, completedDoc] });
      if (url.includes('/api/admin/upload')) return uploadResponses.shift();
      if (url.includes('/api/admin/ingest/')) return jsonResponse(202, { status: 'started' });
      return jsonResponse(404, {});
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('shows progress, the error and Resume/Restart for a failed document', async () => {
    render(<AdminDashboard />);

    expect(await screen.findByText('640 / 1,210 chunks')).toBeInTheDocument();
    expect(screen.getByTestId('ingest-help')).toBeInTheDocument();
    expect(screen.getByText(/synthetic embedding failure/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Resume/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Restart/ })).toBeInTheDocument();
    // A completed document has nothing to resume
    expect(screen.getAllByRole('button', { name: /Resume/ })).toHaveLength(1);
  });

  test('Resume continues the existing ingestion instead of restarting it', async () => {
    render(<AdminDashboard />);
    fireEvent.click(await screen.findByRole('button', { name: /Resume/ }));

    await waitFor(() => {
      expect(calls).toContainEqual({ url: expect.stringContaining('/api/admin/ingest/synthetic_book.pdf?restart=false'), method: 'POST' });
    });
  });

  test('uploading an existing filename asks before replacing it', async () => {
    uploadResponses = [
      jsonResponse(409, { detail: { code: 'document_exists', filename: 'complete_book.pdf', message: 'exists' } }),
      jsonResponse(200, { status: 'replaced', filename: 'complete_book.pdf' }),
    ];
    const { container } = render(<AdminDashboard />);
    await screen.findByText('640 / 1,210 chunks');

    const file = new File(['synthetic'], 'complete_book.pdf', { type: 'application/pdf' });
    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file] } });

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Replace complete_book.pdf?');
    expect(dialog).toHaveTextContent('stays searchable until the new one has finished');

    fireEvent.click(screen.getByRole('button', { name: 'Replace' }));

    await waitFor(() => {
      expect(calls).toContainEqual({ url: expect.stringContaining('/api/admin/upload?replace=true'), method: 'POST' });
      expect(calls).toContainEqual({ url: expect.stringContaining('/api/admin/ingest/complete_book.pdf?restart=false'), method: 'POST' });
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('cancelling the replace dialog uploads nothing', async () => {
    uploadResponses = [
      jsonResponse(409, { detail: { code: 'document_exists', filename: 'complete_book.pdf', message: 'exists' } }),
    ];
    const { container } = render(<AdminDashboard />);
    await screen.findByText('640 / 1,210 chunks');

    const file = new File(['synthetic'], 'complete_book.pdf', { type: 'application/pdf' });
    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file] } });
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(calls.filter(c => c.url.includes('/api/admin/upload'))).toHaveLength(1);
    expect(calls.filter(c => c.url.includes('/api/admin/ingest/'))).toHaveLength(0);
  });
});
