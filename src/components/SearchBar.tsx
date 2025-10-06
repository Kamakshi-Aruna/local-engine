interface SearchBarProps {
  query: string;
  setQuery: (query: string) => void;
  loading: boolean;
  handleSearch: () => void;
  handleKeyPress: (e: React.KeyboardEvent) => void;
  messages: any[];

}

export default function SearchBar({
  query,
  setQuery,
  loading,
  handleSearch,
  handleKeyPress,
  messages,
}: SearchBarProps) {
  const isEmptyState = messages.length === 0;

  return (
    <div className={`flex-shrink-0 p-4 ${!isEmptyState ? 'bg-gray-800/50 backdrop-blur-sm' : ''}`}>
      <div className="max-w-4xl mx-auto">
        <div className="relative">
          <div className="relative flex-1">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Be specific: 'iOS Swift', 'Android Kotlin', 'Flutter Dart', or 'React Native JavaScript'..."
              className="w-full pl-4 pr-16 py-4 bg-gray-700 text-white rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400 text-lg"
              disabled={loading}
            />

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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Welcome Message - Only show when no messages */}
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-6">
            <p className="mb-4">Search for developers using semantic search</p>
            <p className="text-sm">Try: "iOS developers", "Android Kotlin", or "mobile app developers"</p>
          </div>
        )}
      </div>
    </div>
  );
}