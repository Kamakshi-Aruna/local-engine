'use client';

import { useState, useEffect } from 'react';

export default function Home() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [messages, setMessages] = useState<Array<{id: string, question: string, answer: string, timestamp: Date}>>([]);

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

    const newMessageId = Date.now().toString();
    const userQuestion = query.trim();

    // Add user message immediately
    setMessages(prev => [...prev, {
      id: newMessageId,
      question: userQuestion,
      answer: '',
      timestamp: new Date()
    }]);

    setLoading(true);
    setError('');
    setQuery(''); // Clear input immediately

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: userQuestion }),
      });

      const data = await response.json();

      if (data.success) {
        // Update the message with the answer
        setMessages(prev => prev.map(msg =>
          msg.id === newMessageId
            ? { ...msg, answer: data.answer }
            : msg
        ));
      } else {
        setError(data.error || 'Search failed');
        // Remove the message if there was an error
        setMessages(prev => prev.filter(msg => msg.id !== newMessageId));
      }
    } catch (err) {
      setError('Failed to connect to search service');
      // Remove the message if there was an error
      setMessages(prev => prev.filter(msg => msg.id !== newMessageId));
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

  const handleExampleClick = (example: string) => {
    setQuery(example);
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      {/* Header */}
      <div className="flex-shrink-0 text-center py-8 px-4">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
          Local AI Search Engine
        </h1>
        <p className="text-gray-300">
          Powered by Ollama + LlamaIndex + Qdrant
        </p>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Questions Sidebar - Only show when there are messages */}
        {messages.length > 0 && (
          <div className="w-80 bg-gray-900/50 border-r border-gray-700 flex flex-col">
            <div className="p-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-2">Your Questions</h3>
              <p className="text-sm text-gray-400">Click on any question to view its answer</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {messages.map((message, index) => (
                <button
                  key={message.id}
                  onClick={() => {
                    // Scroll to the answer or highlight it
                    const answerElement = document.getElementById(`answer-${message.id}`);
                    if (answerElement) {
                      answerElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                  }}
                  className={`w-full text-left p-3 rounded-lg border transition-all hover:bg-gray-700/50 ${
                    index === messages.length - 1
                      ? 'bg-blue-600/20 border-blue-500/50 text-blue-200'
                      : 'bg-gray-800/50 border-gray-600/50 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-xs text-white font-medium mt-0.5">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-2">{message.question}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Answer Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {messages.length > 0 ? (
              <div className="max-w-4xl mx-auto space-y-8">
                {messages.map((message, index) => (
                  <div key={message.id} id={`answer-${message.id}`} className="space-y-4">
                    {/* Question Header */}
                    <div className="border-b border-gray-700 pb-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm text-white font-medium">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <h2 className="text-xl font-semibold text-white mb-2">{message.question}</h2>
                          <p className="text-sm text-gray-400">
                            Asked at {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Answer */}
                    <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                      {message.answer ? (
                        <div className="prose prose-invert max-w-none">
                          <p className="text-gray-100 whitespace-pre-wrap leading-relaxed text-lg">
                            {message.answer}
                          </p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <svg className="animate-spin h-5 w-5 text-blue-400" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 818-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span className="text-blue-400 font-medium">Generating answer...</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex-shrink-0 px-4 pb-2">
          <div className="max-w-4xl mx-auto">
            <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg">
              <p className="font-semibold">Error:</p>
              <p>{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Search Bar - Fixed at Bottom */}
      <div className="flex-shrink-0 p-4 border-t border-gray-700 bg-gray-800/50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            <div className="relative flex-1">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything about your uploaded PDF documents..."
                className="w-full pl-4 pr-20 py-4 bg-gray-700 text-white rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400 text-lg"
                disabled={loading}
              />

              {/* Upload Button */}
              <div className="absolute right-12 top-1/2 transform -translate-y-1/2">
                <button
                  onClick={() => setShowUploadModal(!showUploadModal)}
                  className="p-2 text-green-400 hover:text-green-300 transition-colors rounded-lg hover:bg-gray-600"
                  title="Upload PDF"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </button>

                {/* Upload Dropdown */}
                {showUploadModal && (
                  <div className="absolute right-0 bottom-full mb-2 w-80 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50">
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white">📄 Upload PDF</h3>
                        <button
                          onClick={() => setShowUploadModal(false)}
                          className="text-gray-400 hover:text-gray-300 p-1 rounded hover:bg-gray-700 transition-all"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      {/* Upload Area */}
                      <div className="relative border-2 border-dashed border-gray-600 rounded-lg p-6 text-center hover:border-green-500 transition-colors mb-4">
                        <div className="flex flex-col items-center gap-3">
                          <div className="p-2 bg-green-600/20 rounded-full">
                            <svg className="h-6 w-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-white font-medium text-sm">Drop PDF files here</p>
                            <p className="text-gray-400 text-xs">or click to browse</p>
                          </div>
                        </div>
                        <input
                          type="file"
                          accept=".pdf"
                          onChange={handleFileUpload}
                          disabled={uploadLoading}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                        />
                      </div>

                      {/* Upload Status */}
                      {uploadLoading && (
                        <div className="mb-4 p-3 bg-green-600/10 border border-green-600/30 rounded-lg">
                          <div className="flex items-center gap-2">
                            <svg className="animate-spin h-4 w-4 text-green-400" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 818-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            <span className="text-green-400 text-sm font-medium">Processing PDF...</span>
                          </div>
                        </div>
                      )}

                      {/* Uploaded Files */}
                      {uploadedFiles.length > 0 && (
                        <div className="mb-4">
                          <h4 className="text-xs font-medium text-gray-300 mb-2">Documents ({uploadedFiles.length})</h4>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {uploadedFiles.map((filename, index) => (
                              <div
                                key={index}
                                className="flex items-center justify-between p-2 bg-gray-700/50 rounded border border-gray-600/50 group"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="p-1 bg-red-600/20 rounded">
                                    <svg className="h-3 w-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                  </div>
                                  <span className="text-gray-200 text-xs font-medium truncate">{filename}</span>
                                </div>
                                <button
                                  onClick={() => handleDeleteFile(filename)}
                                  disabled={deletingFile === filename}
                                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-400 transition-all disabled:opacity-50"
                                  title="Delete file"
                                >
                                  {deletingFile === filename ? (
                                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 818-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                  ) : (
                                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  )}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Info Text */}
                      <p className="text-xs text-gray-500 text-center">
                        Upload PDFs to build your searchable library
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Send Button */}
              <button
                onClick={handleSearch}
                disabled={loading || !query.trim()}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? (
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 818-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Welcome Message - Only show when no messages */}
          {messages.length === 0 && (
            <div className="text-center text-gray-400 mt-6">
              <p className="mb-4">Upload PDFs and ask questions about the content</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}