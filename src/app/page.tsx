'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import QuestionsSidebar from '@/components/QuestionsSidebar';
import AnswersArea from '@/components/AnswersArea';
import SearchBar from '@/components/SearchBar';

interface Message {
  id: string;
  question: string;
  answer: string;
  timestamp: Date;
}

export default function Home() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

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
        // Format the answer from results
        const formattedAnswer = data.results && data.results.length > 0
          ? data.results.map((r: any) => {
              const skills = r.matched_skills && r.matched_skills.length > 0
                ? `\n   Skills: ${r.matched_skills.join(', ')}`
                : '';
              return `${r.rank}. ${r.name} - ${r.role} (${r.language})${skills}`;
            }).join('\n\n')
          : data.message || 'No results found';

        // Update the message with the answer
        setMessages(prev => prev.map(msg =>
          msg.id === newMessageId
            ? { ...msg, answer: formattedAnswer }
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
        // Format the answer from results
        const formattedAnswer = data.results && data.results.length > 0
          ? data.results.map((r: any) => {
              const skills = r.matched_skills && r.matched_skills.length > 0
                ? `\n   Skills: ${r.matched_skills.join(', ')}`
                : '';
              return `${r.rank}. ${r.name} - ${r.role} (${r.language})${skills}`;
            }).join('\n\n')
          : data.message || 'No results found';

        // Update the message with the new answer
        setMessages(prev => prev.map(msg =>
          msg.id === messageId
            ? { ...msg, answer: formattedAnswer }
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