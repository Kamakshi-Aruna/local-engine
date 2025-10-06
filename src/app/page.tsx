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
  const [searchMode, setSearchMode] = useState<'local' | 'cohere' | 'openai' | 'hybrid'>('local');

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
      const endpoint = searchMode === 'hybrid' ? '/api/search-hybrid' : searchMode === 'cohere' ? '/api/search-cohere' : searchMode === 'openai' ? '/api/search-openai' : '/api/search';
      const response = await fetch(endpoint, {
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
              // Show rerank score only for hybrid mode
              const scores = searchMode === 'hybrid' && r.rerank_score
                ? `\n   Scores: Vector ${r.vector_score}% | Rerank ${r.rerank_score}%`
                : '';
              return `${r.rank}. ${r.name} - ${r.role}${skills}${scores}`;
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
      const endpoint = searchMode === 'hybrid' ? '/api/search-hybrid' : searchMode === 'cohere' ? '/api/search-cohere' : searchMode === 'openai' ? '/api/search-openai' : '/api/search';
      const response = await fetch(endpoint, {
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
              // Show rerank score only for hybrid mode
              const scores = searchMode === 'hybrid' && r.rerank_score
                ? `\n   Scores: Vector ${r.vector_score}% | Rerank ${r.rerank_score}%`
                : '';
              return `${r.rank}. ${r.name} - ${r.role}${skills}${scores}`;
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

            {/* Search Mode Toggle */}
            <div className="flex-shrink-0 px-4 pb-2">
              <div className="max-w-4xl mx-auto flex items-center justify-center gap-2">
                <span className="text-sm text-gray-400">Search Mode:</span>
                <button
                  onClick={() => setSearchMode('local')}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    searchMode === 'local'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Local (Ollama)
                </button>
                <button
                  onClick={() => setSearchMode('cohere')}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    searchMode === 'cohere'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Cohere API
                </button>
                <button
                  onClick={() => setSearchMode('openai')}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    searchMode === 'openai'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  OpenAI API
                </button>
                <button
                  onClick={() => setSearchMode('hybrid')}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    searchMode === 'hybrid'
                      ? 'bg-orange-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Hybrid ⚡
                </button>
              </div>
            </div>

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

              <div className="w-full max-w-4xl space-y-4">
                {/* Search Mode Toggle */}
                <div className="flex items-center justify-center gap-2">
                  <span className="text-sm text-gray-400">Search Mode:</span>
                  <button
                    onClick={() => setSearchMode('local')}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      searchMode === 'local'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    Local (Ollama)
                  </button>
                  <button
                    onClick={() => setSearchMode('cohere')}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      searchMode === 'cohere'
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    Cohere API
                  </button>
                  <button
                    onClick={() => setSearchMode('openai')}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      searchMode === 'openai'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    OpenAI API
                  </button>
                  <button
                    onClick={() => setSearchMode('hybrid')}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      searchMode === 'hybrid'
                        ? 'bg-orange-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    Hybrid ⚡
                  </button>
                </div>

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