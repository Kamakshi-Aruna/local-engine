'use client';

import { useState } from 'react';

export default function Home() {
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [uploadLoading, setUploadLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError('');
    setAnswer('');

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      const data = await response.json();

      if (data.success) {
        setAnswer(data.answer);
      } else {
        setError(data.error || 'Search failed');
      }
    } catch (err) {
      setError('Failed to connect to search service');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleSearch();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== 'application/pdf') {
      setError('Please select a PDF file');
      return;
    }

    setUploadLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('pdf', file);

      const response = await fetch('/api/upload-pdf', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setUploadedFiles(prev => [...prev, file.name]);
        setError('');
        // Reset file input
        e.target.value = '';
      } else {
        setError(data.error || 'Upload failed');
      }
    } catch (err) {
      setError('Failed to upload PDF');
    } finally {
      setUploadLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
            Local AI Search Engine
          </h1>
          <p className="text-gray-300 text-lg">
            Powered by Ollama + LlamaIndex + Qdrant
          </p>
        </div>

        <div className="bg-gray-800 rounded-lg shadow-2xl p-6 mb-8">
          <div className="flex gap-4">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me anything about your documents, Next.js, React, TypeScript..."
              className="flex-1 px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
              disabled={loading}
            />
            <button
              onClick={handleSearch}
              disabled={loading || !query.trim()}
              className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Searching...
                </span>
              ) : (
                'Search'
              )}
            </button>
          </div>
        </div>

        {/* PDF Upload Section */}
        <div className="bg-gray-800 rounded-lg shadow-2xl p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4 text-green-400">📄 Upload PDF Documents</h2>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                disabled={uploadLoading}
                className="block w-full text-sm text-gray-300 file:mr-4 file:py-3 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gradient-to-r file:from-green-500 file:to-blue-600 file:text-white hover:file:from-green-600 hover:file:to-blue-700 file:disabled:opacity-50 file:cursor-pointer disabled:file:cursor-not-allowed"
              />
            </div>
            {uploadLoading && (
              <div className="flex items-center gap-2 text-green-400">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Processing...
              </div>
            )}
          </div>

          {uploadedFiles.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-gray-400 mb-2">Uploaded files:</p>
              <div className="flex flex-wrap gap-2">
                {uploadedFiles.map((filename, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-green-600/20 border border-green-500/30 rounded-full text-sm text-green-300"
                  >
                    📄 {filename}
                  </span>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-gray-500 mt-3">
            Upload PDF files to search through their content along with the existing knowledge base.
          </p>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg mb-6">
            <p className="font-semibold">Error:</p>
            <p>{error}</p>
          </div>
        )}

        {answer && (
          <div className="bg-gray-800 rounded-lg shadow-2xl p-6">
            <h2 className="text-2xl font-semibold mb-4 text-blue-400">Answer:</h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">
                {answer}
              </p>
            </div>
          </div>
        )}

        {!answer && !error && !loading && (
          <div className="text-center text-gray-400 mt-12">
            <p className="mb-4">Try asking questions like:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto">
              {[
                "What is Next.js?",
                "How do I create a new Next.js project?",
                "What are React hooks?",
                "What is TypeScript?",
                "How do I handle API routes in Next.js?",
                "What is server-side rendering?"
              ].map((example, i) => (
                <button
                  key={i}
                  onClick={() => setQuery(example)}
                  className="text-left px-4 py-2 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors text-sm"
                >
                  "{example}"
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
