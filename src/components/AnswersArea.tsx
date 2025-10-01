interface Message {
  id: string;
  question: string;
  answer: string;
  timestamp: Date;
  tool_calls?: Array<{
    id: string;
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_results?: Array<{
    tool_call_id: string;
    result: any;
  }>;
}

interface AnswersAreaProps {
  messages: Message[];
  editingMessageId?: string | null;
  editingText?: string;
  setEditingText?: (text: string) => void;
  onEditQuestion?: (messageId: string, currentQuestion: string) => void;
  onSaveEdit?: (messageId: string) => void;
  onCancelEdit?: () => void;
}

function renderToolResult(result: any, toolName: string) {
  if (result.error) {
    return (
      <div className="text-red-400">
        <strong>Error:</strong> {result.error}
      </div>
    );
  }

  switch (toolName) {
    case 'calculate':
      return (
        <div>
          <strong>Calculation:</strong> {result.expression} = <span className="text-green-400">{result.result}</span>
        </div>
      );

    case 'fetch_weather':
      if (result.weather) {
        return (
          <div>
            <strong>Weather in {result.weather.location}:</strong>
            <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
              <div>🌡️ {result.weather.temperature}°C</div>
              <div>🌤️ {result.weather.condition}</div>
              <div>💧 {result.weather.humidity}% humidity</div>
              <div>💨 {result.weather.wind_speed} km/h</div>
            </div>
          </div>
        );
      }
      break;

    case 'fetch_stock_price':
      if (result.stock) {
        const isPositive = result.stock.change >= 0;
        return (
          <div>
            <strong>{result.stock.symbol} Stock Price:</strong>
            <div className="mt-1 text-xs">
              <div className="text-green-400 font-bold text-lg">${result.stock.price}</div>
              <div className={isPositive ? 'text-green-400' : 'text-red-400'}>
                {isPositive ? '↗️' : '↘️'} {result.stock.change} ({result.stock.change_percent}%)
              </div>
              <div>Volume: {result.stock.volume?.toLocaleString()}</div>
            </div>
          </div>
        );
      }
      break;

    case 'get_current_time':
      return (
        <div>
          <strong>Current Time ({result.timezone}):</strong>
          <div className="mt-1 text-xs">
            <div>🕐 {result.formatted}</div>
            <div>Unix: {result.unix_timestamp}</div>
          </div>
        </div>
      );

    case 'currency_convert':
      return (
        <div>
          <strong>Currency Conversion:</strong>
          <div className="mt-1 text-xs">
            <div>{result.original_amount} {result.from_currency} = <span className="text-green-400">{result.converted_amount} {result.to_currency}</span></div>
            <div>Exchange Rate: {result.exchange_rate}</div>
          </div>
        </div>
      );

    default:
      return (
        <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
          {JSON.stringify(result, null, 2)}
        </pre>
      );
  }

  return (
    <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
      {JSON.stringify(result, null, 2)}
    </pre>
  );
}

export default function AnswersArea({
  messages,
  editingMessageId,
  editingText,
  setEditingText,
  onEditQuestion,
  onSaveEdit,
  onCancelEdit
}: AnswersAreaProps) {
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
                      {editingMessageId === message.id ? (
                        /* Edit Mode */
                        <div className="space-y-3">
                          <textarea
                            value={editingText}
                            onChange={(e) => setEditingText?.(e.target.value)}
                            className="w-full p-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                            rows={3}
                            placeholder="Edit your question..."
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => onSaveEdit?.(message.id)}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                            >
                              Save
                            </button>
                            <button
                              onClick={onCancelEdit}
                              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Display Mode */
                        <div className="group">
                          <div className="flex items-start justify-between">
                            <h2 className="text-xl font-semibold text-white mb-2 flex-1">{message.question}</h2>
                            <button
                              onClick={() => onEditQuestion?.(message.id, message.question)}
                              className="opacity-0 group-hover:opacity-100 ml-2 p-1 text-gray-400 hover:text-blue-400 transition-all"
                              title="Edit question"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          </div>
                          <p className="text-sm text-gray-400">
                            Asked at {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      )}
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

                {/* Tool Calling Results */}
                {message.tool_results && message.tool_results.length > 0 && (
                  <div className="bg-blue-900/20 rounded-xl p-4 border border-blue-500/30">
                    <div className="flex items-center gap-2 mb-3">
                      <svg className="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <h3 className="text-sm font-semibold text-blue-300">Real-time Data Used</h3>
                    </div>
                    <div className="space-y-3">
                      {message.tool_results.map((toolResult, toolIndex) => {
                        const toolCall = message.tool_calls?.find(tc => tc.id === toolResult.tool_call_id);
                        const toolName = toolCall?.function.name || 'Unknown Tool';

                        return (
                          <div key={toolIndex} className="bg-gray-800/50 rounded-lg p-3 border border-gray-600">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded-full font-medium">
                                {toolName.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </span>
                            </div>
                            <div className="text-sm text-gray-300">
                              {renderToolResult(toolResult.result, toolName)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}