'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import QuestionsSidebar from '@/components/QuestionsSidebar';
import AnswersArea from '@/components/AnswersArea';
import SearchBar from '@/components/SearchBar';

interface Message {
  id: string;
  question: string;
  answer: string;
  timestamp: Date;
  hasToolResults?: boolean;
  hasPdfResults?: boolean;
}

export default function Home() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  // Files are stored locally in state only (Cloudflare Vectorize doesn't have list API)
  // Files will reset on page refresh

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
      // Detect if this is a pure math query
      const isMathQuery = /^[\d\s\+\-\*\/\^\(\)\.]+$|square root|sqrt|calculate|compute|math|value of|what is/i.test(userQuestion);

      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: userQuestion,
          useTools: true,
          usePdfSearch: !isMathQuery // Skip PDF search for pure math queries
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Update the message with the answer and metadata
        setMessages(prev => prev.map(msg =>
          msg.id === newMessageId
            ? {
                ...msg,
                answer: data.answer,
                hasToolResults: data.hasToolResults,
                hasPdfResults: data.hasPdfResults
              }
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
    console.log('📁 File upload triggered');
    const file = e.target.files?.[0];

    if (!file) {
      console.log('❌ No file selected');
      setError('Please select a file');
      return;
    }

    console.log('📄 File selected:', file.name, 'Type:', file.type, 'Size:', file.size);

    if (file.type !== 'application/pdf') {
      setError('Please select a PDF file');
      return;
    }

    setUploadLoading(true);
    setError('');

    try {
      console.log('🚀 Uploading PDF to /api/upload-pdf...');
      const formData = new FormData();
      formData.append('pdf', file);

      const response = await fetch('/api/upload-pdf', {
        method: 'POST',
        body: formData,
      });

      console.log('📡 Response status:', response.status);
      const data = await response.json();
      console.log('📦 Response data:', data);

      if (data.success) {
        console.log('✅ Upload successful!', data);
        setUploadedFiles(prev => [...prev, file.name]);
        setError('');
        setShowUploadModal(false); // Close modal after successful upload
        // Show success message
        alert(`Success! Uploaded ${data.chunks_created || 0} chunks from ${file.name}`);
        // Reset file input
        e.target.value = '';
      } else {
        console.error('❌ Upload failed:', data.error);
        setError(data.error || 'Upload failed');
      }
    } catch (err) {
      console.error('❌ Upload error:', err);
      setError('Failed to upload PDF');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleDeleteFile = async (filename: string) => {
    // Only remove from local state - files remain in Cloudflare Vectorize
    if (!confirm(`Remove ${filename} from the list? (File will remain searchable)`)) {
      return;
    }
    setUploadedFiles(prev => prev.filter(f => f !== filename));
  };

  const handleEditQuestion = (messageId: string, currentQuestion: string) => {
    setEditingMessageId(messageId);
    setEditingText(currentQuestion);
  };

  const handleSaveEdit = async (messageId: string) => {
    if (!editingText.trim()) return;

    const editedQuestion = editingText.trim();

    // Update the question in the message
    setMessages(prev => prev.map(msg =>
      msg.id === messageId
        ? { ...msg, question: editedQuestion, answer: '', timestamp: new Date() }
        : msg
    ));

    // Clear edit state
    setEditingMessageId(null);
    setEditingText('');

    // Re-search with the edited question
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: editedQuestion }),
      });

      const data = await response.json();

      if (data.success) {
        // Update the message with the new answer and metadata
        setMessages(prev => prev.map(msg =>
          msg.id === messageId
            ? {
                ...msg,
                answer: data.answer,
                hasToolResults: data.hasToolResults,
                hasPdfResults: data.hasPdfResults
              }
            : msg
        ));
      } else {
        setError(data.error || 'Search failed');
      }
    } catch (err) {
      setError('Failed to connect to search service');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingText('');
  };

  return (
    <div className="flex h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      {/* Questions Sidebar - Full Height */}
      <QuestionsSidebar
        messages={messages}
        editingMessageId={editingMessageId}
        editingText={editingText}
        setEditingText={setEditingText}
        onEditQuestion={handleEditQuestion}
        onSaveEdit={handleSaveEdit}
        onCancelEdit={handleCancelEdit}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {messages.length > 0 ? (
          <>
            <Header />
            <AnswersArea
              messages={messages}
              editingMessageId={editingMessageId}
              editingText={editingText}
              setEditingText={setEditingText}
              onEditQuestion={handleEditQuestion}
              onSaveEdit={handleSaveEdit}
              onCancelEdit={handleCancelEdit}
            />

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

            <SearchBar
              query={query}
              setQuery={setQuery}
              loading={loading}
              handleSearch={handleSearch}
              handleKeyPress={handleKeyPress}
              showUploadModal={showUploadModal}
              setShowUploadModal={setShowUploadModal}
              uploadLoading={uploadLoading}
              uploadedFiles={uploadedFiles}
              deletingFile={deletingFile}
              handleFileUpload={handleFileUpload}
              handleDeleteFile={handleDeleteFile}
              messages={messages}
            />
          </>
        ) : (
          /* Centered Layout for No Messages */
          <>
            <Header />

            {/* Centered Search Area */}
            <div className="flex-1 flex items-center justify-center px-8">
              {/* Error Message for Empty State */}
              {error && (
                <div className="absolute top-32 left-1/2 transform -translate-x-1/2 w-full max-w-2xl px-4">
                  <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg">
                    <p className="font-semibold">Error:</p>
                    <p>{error}</p>
                  </div>
                </div>
              )}

              <div className="w-full max-w-4xl">
                <SearchBar
                  query={query}
                  setQuery={setQuery}
                  loading={loading}
                  handleSearch={handleSearch}
                  handleKeyPress={handleKeyPress}
                  showUploadModal={showUploadModal}
                  setShowUploadModal={setShowUploadModal}
                  uploadLoading={uploadLoading}
                  uploadedFiles={uploadedFiles}
                  deletingFile={deletingFile}
                  handleFileUpload={handleFileUpload}
                  handleDeleteFile={handleDeleteFile}
                  messages={messages}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}