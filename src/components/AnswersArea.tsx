interface Message {
  id: string;
  question: string;
  answer: string;
  timestamp: Date;
}

interface AnswersAreaProps {
  messages: Message[];
}

export default function AnswersArea({ messages }: AnswersAreaProps) {
  return (
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
  );
}