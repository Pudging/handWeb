import React, { useState, useEffect, useRef } from 'react';
import * as tf from '@tensorflow/tfjs';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  type: 'text' | 'card' | 'deck' | 'analysis';
  data?: any;
  source?: 'local' | 'ai'; // Track response source
}

interface QuickAction {
  label: string;
  query: string;
  description: string;
}

const AIChatbot: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [model, setModel] = useState<tf.LayersModel | null>(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isAIAvailable, setIsAIAvailable] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Quick actions for common queries
  const quickActions: QuickAction[] = [
    {
      label: 'Deck Analysis',
      query: 'Analyze my current deck and suggest improvements',
      description: 'Get AI-powered deck analysis'
    },
    {
      label: 'Card Recommendations',
      query: 'What cards would work well with my current deck?',
      description: 'Find synergistic cards'
    },
    {
      label: 'Meta Advice',
      query: 'What\'s the current meta and how should I adapt?',
      description: 'Get meta strategy advice'
    },
    {
      label: 'Hand Analysis',
      query: 'How good is this starting hand?',
      description: 'Analyze hand strength'
    },
    {
      label: 'Combo Ideas',
      query: 'What combos can I make with my deck?',
      description: 'Discover powerful combinations'
    },
    {
      label: 'Side Deck Help',
      query: 'What should I put in my side deck?',
      description: 'Get side deck recommendations'
    }
  ];

  useEffect(() => {
    loadModel();
    // Add welcome message
    setMessages([{
      id: '1',
      text: 'Hello! I\'m your Yu-Gi-Oh! AI assistant. I can help you analyze decks, suggest cards, and provide strategic advice. I use both local intelligence and real AI for the best responses! How can I help you today?',
      isUser: false,
      timestamp: new Date(),
      type: 'text',
      source: 'local'
    }]);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadModel = async () => {
    try {
      // Create a simple sequential model for basic pattern recognition
      const sequentialModel = tf.sequential({
        layers: [
          tf.layers.dense({ inputShape: [50], units: 32, activation: 'relu' }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({ units: 16, activation: 'relu' }),
          tf.layers.dense({ units: 8, activation: 'softmax' })
        ]
      });

      sequentialModel.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
      });

      setModel(sequentialModel);
      setIsModelLoaded(true);
      console.log('Local AI Model loaded successfully');
    } catch (error) {
      console.error('Error loading local AI model:', error);
      toast.error('Failed to load local AI model');
    }
  };

  // Determine if a question is simple (use local) or complex (use AI)
  const isSimpleQuestion = (input: string): boolean => {
    const lowerInput = input.toLowerCase();
    const simpleKeywords = ['hello', 'hi', 'help', 'what', 'how', 'when', 'where', 'why'];
    const complexKeywords = ['analyze', 'strategy', 'meta', 'competitive', 'tournament', 'matchup', 'theory', 'advanced'];
    
    // If it contains complex keywords, use AI
    if (complexKeywords.some(keyword => lowerInput.includes(keyword))) {
      return false;
    }
    
    // If it's very short or simple, use local
    if (input.length < 20 || simpleKeywords.some(keyword => lowerInput.includes(keyword))) {
      return true;
    }
    
    // Default to AI for medium-complexity questions
    return false;
  };

  // Call Hugging Face API for real AI responses
  const callHuggingFaceAPI = async (userInput: string): Promise<string> => {
    try {
      // Get token from environment variable or use fallback
      const token = import.meta.env.VITE_HUGGING_FACE_TOKEN;
      
      if (!token || token === 'hf_your_token_here') {
        throw new Error('Hugging Face token not configured');
      }
      
      // Using Hugging Face Inference API (free tier)
      const response = await fetch('https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: `User: ${userInput}\nAssistant: I'm a Yu-Gi-Oh! expert. `,
          parameters: {
            max_length: 200,
            temperature: 0.7,
            do_sample: true
          }
        })
      });

      if (!response.ok) {
        throw new Error('AI API call failed');
      }

      const data = await response.json();
      return data[0]?.generated_text || 'I apologize, but I couldn\'t generate a response right now.';
    } catch (error) {
      console.error('Hugging Face API error:', error);
      throw error;
    }
  };

  // Enhanced local responses with more Yu-Gi-Oh! knowledge
  const generateLocalResponse = (input: string): string => {
    const lowerInput = input.toLowerCase();
    
    // Deck analysis
    if (lowerInput.includes('deck') && lowerInput.includes('analysis')) {
      return "I'd be happy to analyze your deck! Please share your deck list or upload a .ydk file, and I can provide insights on card ratios, synergies, and potential improvements. I can also suggest tech choices and side deck options.";
    }
    
    // Card recommendations
    if (lowerInput.includes('card') && (lowerInput.includes('recommend') || lowerInput.includes('suggest'))) {
      return "For card recommendations, I'll need to see your current deck to understand the archetype and strategy. Once you share your deck, I can suggest cards that would enhance your strategy, improve consistency, or provide better matchups.";
    }
    
    // Meta advice
    if (lowerInput.includes('meta') || lowerInput.includes('competitive')) {
      return "The current meta is quite diverse with several strong archetypes. To give you specific advice, I'd need to know what format you're playing (TCG, OCG, Traditional) and what your local meta looks like. I can help you adapt your deck once I see it.";
    }
    
    // Hand analysis
    if (lowerInput.includes('hand') && lowerInput.includes('analysis')) {
      return "I can help analyze your starting hand! Use the Hand Simulation feature to input your hand, and I can evaluate its strength, suggest optimal plays, and identify potential combo starters or disruption options.";
    }
    
    // Combos and synergies
    if (lowerInput.includes('combo') || lowerInput.includes('synergy')) {
      return "Combos and synergies depend heavily on your specific deck composition. Share your deck with me, and I can identify powerful combinations, suggest ways to maximize their effectiveness, and help you understand the optimal sequencing.";
    }
    
    // Side deck help
    if (lowerInput.includes('side') && lowerInput.includes('deck')) {
      return "Side deck construction is crucial for competitive play. I can help you build an effective side deck once I see your main deck and understand what matchups you're preparing for. This includes tech choices, counters, and format-specific cards.";
    }
    
    // General help
    if (lowerInput.includes('help') || lowerInput.includes('what can you do')) {
      return "I'm here to help with your Yu-Gi-Oh! deck building and strategy! I can analyze decks, suggest cards, provide meta advice, evaluate hands, identify combos, and help with side deck construction. What would you like to know?";
    }
    
    // Greetings
    if (lowerInput.includes('hello') || lowerInput.includes('hi') || lowerInput.includes('hey')) {
      return "Hello! I'm your Yu-Gi-Oh! AI assistant. I can help you with deck analysis, card recommendations, meta strategy, hand evaluation, combo identification, and side deck building. How can I assist you today?";
    }
    
    return "I'm here to help with your Yu-Gi-Oh! deck building and strategy! You can ask me about deck analysis, card recommendations, meta advice, hand analysis, combos, or side deck help. What would you like to know?";
  };

  const generateResponse = async (userInput: string): Promise<string> => {
    try {
      // Determine if we should use local or AI
      if (isSimpleQuestion(userInput)) {
        console.log('Using local response for simple question');
        return generateLocalResponse(userInput);
      }
      
      // Use real AI for complex questions
      if (isAIAvailable) {
        console.log('Using real AI for complex question');
        try {
          const aiResponse = await callHuggingFaceAPI(userInput);
          return aiResponse;
        } catch (aiError) {
          console.log('AI failed, falling back to local response');
          toast.error('AI service temporarily unavailable, using local response');
          return generateLocalResponse(userInput);
        }
      }
      
      // Fallback to local
      return generateLocalResponse(userInput);
    } catch (error) {
      console.error('Response generation error:', error);
      return generateLocalResponse(userInput);
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      isUser: true,
      timestamp: new Date(),
      type: 'text'
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    try {
      const response = await generateResponse(inputText);
      const isAIResponse = !isSimpleQuestion(inputText) && isAIAvailable;
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response,
        isUser: false,
        timestamp: new Date(),
        type: 'text',
        source: isAIResponse ? 'ai' : 'local'
      };

      setMessages(prev => [...prev, aiMessage]);
      
      // Show source indicator
      if (isAIResponse) {
        toast.success('🤖 AI-powered response generated!');
      } else {
        toast.success('💡 Local intelligence response');
      }
    } catch (error) {
      console.error('Error generating response:', error);
      toast.error('Failed to generate response');
    } finally {
      setIsTyping(false);
    }
  };

  const handleQuickAction = (action: QuickAction) => {
    setInputText(action.query);
    handleSendMessage();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <>
      {/* Floating Chat Button */}
      {!isOpen && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: 100,
            right: 340,
            width: 60,
            height: 60,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #2a7a3a, #234a7a)',
            border: 'none',
            color: '#fff',
            fontSize: 24,
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            zIndex: 9999
          }}
          title="Hybrid AI Assistant"
        >
          🤖
        </motion.button>
      )}

      {/* Chat Interface */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 50 }}
            style={{
              position: 'fixed',
              bottom: 100,
              right: 340,
              width: 400,
              height: 600,
              background: 'rgba(40, 44, 52, 0.98)',
              borderRadius: 16,
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 9999,
              border: '1px solid #3a3a7a'
            }}
          >
            {/* Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #3a3a7a',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(30,30,40,0.8)',
              borderRadius: '16px 16px 0 0'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #2a7a3a, #234a7a)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18
                }}>
                  🤖
                </div>
                <div>
                  <div style={{ color: '#fff', fontWeight: 600, fontSize: 16 }}>Hybrid AI Assistant</div>
                  <div style={{ color: '#888', fontSize: 12 }}>
                    {isModelLoaded ? (isAIAvailable ? 'AI + Local Ready' : 'Local Only') : 'Loading...'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#888',
                  fontSize: 20,
                  cursor: 'pointer',
                  padding: 4
                }}
              >
                ×
              </button>
            </div>

            {/* Messages */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    alignSelf: message.isUser ? 'flex-end' : 'flex-start',
                    maxWidth: '80%'
                  }}
                >
                  <div style={{
                    background: message.isUser ? '#234a7a' : 'rgba(60,60,80,0.8)',
                    color: '#fff',
                    padding: '12px 16px',
                    borderRadius: 16,
                    fontSize: 14,
                    lineHeight: 1.4,
                    wordWrap: 'break-word'
                  }}>
                    {message.text}
                  </div>
                  <div style={{
                    fontSize: 11,
                    color: '#888',
                    marginTop: 4,
                    textAlign: message.isUser ? 'right' : 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {!message.isUser && message.source && (
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontSize: 10,
                        background: message.source === 'ai' ? '#2a7a3a' : '#7a3a2a',
                        color: '#fff'
                      }}>
                        {message.source === 'ai' ? '🤖 AI' : '💡 Local'}
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
              
              {isTyping && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{
                    alignSelf: 'flex-start',
                    maxWidth: '80%'
                  }}
                >
                  <div style={{
                    background: 'rgba(60,60,80,0.8)',
                    color: '#fff',
                    padding: '12px 16px',
                    borderRadius: 16,
                    fontSize: 14
                  }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <div style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: '#fff',
                        animation: 'typing 1.4s infinite'
                      }} />
                      <div style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: '#fff',
                        animation: 'typing 1.4s infinite 0.2s'
                      }} />
                      <div style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: '#fff',
                        animation: 'typing 1.4s infinite 0.4s'
                      }} />
                    </div>
                  </div>
                </motion.div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Actions */}
            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid #3a3a7a',
              background: 'rgba(30,30,40,0.5)'
            }}>
              <div style={{
                fontSize: 12,
                color: '#888',
                marginBottom: 8,
                textAlign: 'center'
              }}>
                Quick Actions
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 8
              }}>
                {quickActions.slice(0, 4).map((action, index) => (
                  <button
                    key={index}
                    onClick={() => handleQuickAction(action)}
                    style={{
                      padding: '8px 12px',
                      background: 'rgba(60,60,80,0.8)',
                      border: '1px solid #3a3a7a',
                      borderRadius: 8,
                      color: '#fff',
                      fontSize: 11,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(80,80,100,0.8)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(60,60,80,0.8)';
                    }}
                    title={action.description}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Input */}
            <div style={{
              padding: '16px 20px',
              borderTop: '1px solid #3a3a7a',
              background: 'rgba(30,30,40,0.8)',
              borderRadius: '0 0 16px 16px'
            }}>
              <div style={{
                display: 'flex',
                gap: 8
              }}>
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask me about Yu-Gi-Oh! strategy..."
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    background: 'rgba(40,40,60,0.8)',
                    border: '1px solid #3a3a7a',
                    borderRadius: 8,
                    color: '#fff',
                    fontSize: 14,
                    outline: 'none'
                  }}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!inputText.trim() || isTyping}
                  style={{
                    padding: '12px 16px',
                    background: inputText.trim() && !isTyping ? '#2a7a3a' : '#555',
                    border: 'none',
                    borderRadius: 8,
                    color: '#fff',
                    fontSize: 14,
                    cursor: inputText.trim() && !isTyping ? 'pointer' : 'not-allowed',
                    transition: 'background 0.2s'
                  }}
                >
                  Send
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes typing {
          0%, 60%, 100% { opacity: 0.3; }
          30% { opacity: 1; }
        }
      `}</style>
    </>
  );
};

export default AIChatbot;
