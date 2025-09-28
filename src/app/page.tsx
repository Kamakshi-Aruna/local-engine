'use client';

import { useState, useEffect } from 'react';

export default function Home() {
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [sources, setSources] = useState<any[]>([]);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Load uploaded files on component mount
  const loadUploadedFiles = async () => {
    try {
      const response = await fetch('/api/list-files');
      const data = await response.json();

      if (data.success) {
        setUploadedFiles(data.files);
      }
    } catch (err) {
      // Silently fail - it's okay if we can't load files
      console.error('Failed to load uploaded files:', err);
    }
  };

  // Load files when component mounts
  useEffect(() => {
    loadUploadedFiles();
  }, []);

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
        setSources(data.sources || []);
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
        setShowUploadModal(false); // Close modal after successful upload
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

  const handleDeleteFile = async (filename: string) => {
    if (!confirm(`Are you sure you want to delete ${filename}?`)) {
      return;
    }

    setDeletingFile(filename);
    setError('');

    try {
      const response = await fetch('/api/delete-pdf', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filename }),
      });

      const data = await response.json();

      if (data.success) {
        setUploadedFiles(prev => prev.filter(f => f !== filename));
        // Clear answer and sources if they're from the deleted file
        if (sources.some(s => s.file === filename)) {
          setAnswer('');
          setSources([]);
        }
        alert(`Successfully deleted ${filename}`);
      } else {
        alert(`Error: ${data.error || 'Failed to delete file'}`);
      }
    } catch (err) {
      alert('Error: Failed to delete file');
    } finally {
      setDeletingFile(null);
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
            <div className="relative flex-1">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything about your uploaded PDF documents..."
                className="w-full pl-4 pr-12 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
                disabled={loading}
              />
              <button
                onClick={() => setShowUploadModal(!showUploadModal)}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 text-green-400 hover:text-green-300 transition-colors"
                title="Upload PDF"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </button>
            </div>
            <button
              onClick={handleSearch}
              disabled={loading || !query.trim()}
              className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 818-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Searching...
                </span>
              ) : (
                'Search'
              )}
            </button>
          </div>

          {/* Upload Modal/Dropdown */}
          {showUploadModal && (
            <div className="mt-4 p-4 bg-gray-900 rounded-lg border border-gray-600">
              <h3 className="text-lg font-semibold mb-3 text-green-400">📄 Upload PDF Documents</h3>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-1">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileUpload}
                    disabled={uploadLoading}
                    className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gradient-to-r file:from-green-500 file:to-blue-600 file:text-white hover:file:from-green-600 hover:file:to-blue-700 file:disabled:opacity-50 file:cursor-pointer disabled:file:cursor-not-allowed"
                  />
                </div>
                {uploadLoading && (
                  <div className="flex items-center gap-2 text-green-400">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 818-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Processing...
                  </div>
                )}
              </div>

              {uploadedFiles.length > 0 && (
                <div>
                  <p className="text-sm text-gray-400 mb-2">Uploaded files:</p>
                  <div className="flex flex-wrap gap-2">
                    {uploadedFiles.map((filename, index) => (
                      <div
                        key={index}
                        className="group flex items-center gap-2 px-3 py-1 bg-green-600/20 border border-green-500/30 rounded-full text-sm text-green-300"
                      >
                        <span>📄 {filename}</span>
                        <button
                          onClick={() => handleDeleteFile(filename)}
                          disabled={deletingFile === filename}
                          className="ml-1 text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                          title="Delete file"
                        >
                          {deletingFile === filename ? (
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 818-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                          ) : (
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center mt-4">
                <p className="text-xs text-gray-500">
                  Upload PDF files to build your searchable document library.
                </p>
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="text-sm text-gray-400 hover:text-gray-300 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}
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
            <p className="mb-4">Upload PDFs first, then try asking questions about their content:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto">
              {[
                "What ia Java?",
                "Explain about Object",
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