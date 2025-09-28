interface Message {
  id: string;
  question: string;
  answer: string;
  timestamp: Date;
}

interface QuestionsSidebarProps {
  messages: Message[];
}

export default function QuestionsSidebar({ messages }: QuestionsSidebarProps) {
  const handleQuestionClick = (messageId: string) => {
    const answerElement = document.getElementById(`answer-${messageId}`);
    if (answerElement) {
      answerElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  if (messages.length === 0) {
    return null;
  }

  return (
    <div className="w-80 bg-gray-900/50 border-r border-gray-700 flex flex-col h-full">
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((message, index) => (
          <button
            key={message.id}
            onClick={() => handleQuestionClick(message.id)}
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
  );
}