import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, limit, onSnapshot, getDocs, doc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import useAuth from '../../hooks/useAuth';
import { getQueueBotResponse } from '../../services/ai/queueBotService';
import { MessageSquare, Send, X, Bot, Sparkles, ChevronDown, User, Loader2 } from 'lucide-react';

const QueueBot = () => {
  const navigate = useNavigate();
  const { currentUser, role } = useAuth();
  
  // Chat UI states
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'bot',
      text: role === 'business'
        ? "Hi! I'm QueueBot. I can help you manage your queue, view staff settings, check review replies, or answer general dashboard questions."
        : "Hi! I'm QueueBot. I can help you check your active queue status, guide you through booking, explain cancellation steps, or find local venues.",
      quickReplies: role === 'business'
        ? ['Queue Status', 'Manage my services', 'Help']
        : ['Queue Status', 'How do I book?', 'Help'],
      timestamp: new Date(),
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  // Context states
  const [activeBooking, setActiveBooking] = useState(null);
  const [queueData, setQueueData] = useState(null);
  const [businessId, setBusinessId] = useState(null);

  const messagesEndRef = useRef(null);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, isOpen]);

  // Subscribe to contextual database data based on user role
  useEffect(() => {
    if (!currentUser) return;

    let unsubBooking = () => {};
    let unsubQueue = () => {};

    if (role === 'customer') {
      // 1. Listen for active customer bookings
      const q = query(
        collection(db, 'bookings'),
        where('customerId', '==', currentUser.uid),
        where('status', 'in', ['pending', 'confirmed', 'active']),
        orderBy('createdAt', 'desc'),
        limit(1)
      );
      
      unsubBooking = onSnapshot(q, (snap) => {
        if (!snap.empty) {
          setActiveBooking({ id: snap.docs[0].id, ...snap.docs[0].data() });
        } else {
          setActiveBooking(null);
        }
      }, (err) => {
        console.error("QueueBot customer bookings listener error:", err);
      });
    } else if (role === 'business') {
      // 2. Resolve businessId from ownerId
      const q = query(
        collection(db, 'businesses'),
        where('ownerId', '==', currentUser.uid),
        limit(1)
      );
      
      getDocs(q).then((snap) => {
        if (!snap.empty) {
          const bId = snap.docs[0].id;
          setBusinessId(bId);
          
          // 3. Listen to the queue document for this business
          unsubQueue = onSnapshot(doc(db, 'queues', bId), (queueSnap) => {
            if (queueSnap.exists()) {
              setQueueData(queueSnap.data());
            }
          }, (queueErr) => {
            console.error("QueueBot queue listener error:", queueErr);
          });
        }
      }).catch((err) => {
        console.error("QueueBot business resolve error:", err);
      });
    }

    return () => {
      unsubBooking();
      unsubQueue();
    };
  }, [currentUser, role]);

  const handleSendMessage = async (textToSend) => {
    if (!textToSend.trim()) return;

    // Add user message
    const userMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date(),
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    try {
      // Fetch bot response from service passing active context
      const botResponse = await getQueueBotResponse(textToSend, {
        role,
        activeBooking,
        queueData,
      });

      // Add bot message
      const botMessage = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: botResponse.text,
        quickReplies: botResponse.quickReplies || [],
        timestamp: new Date(),
      };
      
      setMessages((prev) => [...prev, botMessage]);
    } catch (err) {
      console.error("QueueBot error getting reply:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          sender: 'bot',
          text: "Oops, I ran into a connection glitch. Let's try that again.",
          timestamp: new Date(),
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleQuickReply = (reply) => {
    // Check if quick reply requests direct navigation
    if (reply === 'Find businesses' || reply === 'Find local businesses') {
      navigate('/home');
      setIsOpen(false);
      return;
    }
    if (reply === 'My Appointments') {
      navigate('/appointments');
      setIsOpen(false);
      return;
    }
    if (reply === 'Manage my services') {
      navigate('/services');
      setIsOpen(false);
      return;
    }
    if (reply === 'Staff settings') {
      navigate('/staff');
      setIsOpen(false);
      return;
    }

    // Default: send reply as user message
    handleSendMessage(reply);
  };

  if (!currentUser) return null; // Only show for logged in users

  return (
    <div className="queuebot-root-container">
      {/* Floating Toggle Bubble */}
      {!isOpen && (
        <button 
          className="queuebot-trigger-bubble shadow-lg animate-float"
          onClick={() => setIsOpen(true)}
          aria-label="Open QueueBot Chat"
        >
          <Bot size={24} className="bubble-icon" />
          <Sparkles size={12} className="sparkle-icon" />
        </button>
      )}

      {/* Expanded Chat Window */}
      {isOpen && (
        <div className="queuebot-chat-window glass-panel shadow-2xl animate-scale-in">
          {/* Header */}
          <header className="chat-header">
            <div className="chat-header-left">
              <div className="chat-bot-avatar">
                <Bot size={18} />
              </div>
              <div className="chat-bot-details">
                <h3>QueueBot</h3>
                <span className="live-status-pill">
                  <span className="pulse-dot" /> Live AI Assistant
                </span>
              </div>
            </div>
            <div className="chat-header-actions">
              <button className="chat-close-btn" onClick={() => setIsOpen(false)} aria-label="Minimize Chat">
                <ChevronDown size={20} />
              </button>
            </div>
          </header>

          {/* Messages Area */}
          <main className="chat-messages-container">
            {messages.map((msg) => (
              <div key={msg.id} className={`chat-message-row ${msg.sender}`}>
                <div className="chat-message-bubble">
                  <p className="message-content">{msg.text}</p>
                </div>
                {/* Render quick replies directly under the bot message if it is the latest message */}
                {msg.sender === 'bot' && msg.quickReplies && msg.quickReplies.length > 0 && 
                 messages[messages.length - 1].id === msg.id && !isTyping && (
                  <div className="chat-quick-replies">
                    {msg.quickReplies.map((reply) => (
                      <button 
                        key={reply} 
                        className="quick-reply-chip"
                        onClick={() => handleQuickReply(reply)}
                      >
                        {reply}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            
            {/* Typing Indicator */}
            {isTyping && (
              <div className="chat-message-row bot typing">
                <div className="chat-message-bubble typing-bubble">
                  <div className="typing-dots">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </main>

          {/* Input Area */}
          <form 
            className="chat-input-container" 
            onSubmit={(e) => { e.preventDefault(); handleSendMessage(inputValue); }}
          >
            <input 
              type="text" 
              placeholder="Ask about booking, queue status..." 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isTyping}
            />
            <button 
              type="submit" 
              className="chat-send-btn btn-primary"
              disabled={!inputValue.trim() || isTyping}
              aria-label="Send message"
            >
              {isTyping ? <Loader2 size={16} className="spinner" /> : <Send size={16} />}
            </button>
          </form>
        </div>
      )}

      {/* Styled Layout */}
      <style>{`
        .queuebot-root-container {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 1000;
          font-family: 'Outfit', sans-serif;
        }

        /* Trigger Bubble */
        .queuebot-trigger-bubble {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--primary), var(--primary-deep));
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          position: relative;
          box-shadow: 0 8px 30px rgba(108, 99, 255, 0.4);
        }

        .queuebot-trigger-bubble:hover {
          transform: scale(1.1) translateY(-4px);
          box-shadow: 0 12px 35px rgba(108, 99, 255, 0.55);
        }

        .bubble-icon {
          animation: bubble-rotate 6s linear infinite;
        }

        .sparkle-icon {
          position: absolute;
          top: 8px;
          right: 8px;
          color: var(--amber);
        }

        /* Expanded Window */
        .queuebot-chat-window {
          width: 360px;
          height: 520px;
          background: var(--glass-bg);
          border: 1px solid var(--glass-border);
          border-radius: 20px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          transform-origin: bottom right;
        }

        @media (max-width: 450px) {
          .queuebot-chat-window {
            width: calc(100vw - 32px);
            height: calc(100vh - 120px);
            bottom: 16px;
            right: 16px;
          }
        }

        /* Header */
        .chat-header {
          padding: 16px 20px;
          background: rgba(108, 99, 255, 0.08);
          border-bottom: 1px solid var(--glass-border);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .chat-header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .chat-bot-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(108, 99, 255, 0.15);
          border: 1px solid rgba(108, 99, 255, 0.25);
          color: var(--primary);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .chat-bot-details h3 {
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
        }

        .live-status-pill {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 0.68rem;
          color: var(--text-secondary);
          margin-top: 2px;
        }

        .pulse-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #4CAF50;
          box-shadow: 0 0 8px #4CAF50;
          animation: pulse 1.8s infinite;
        }

        .chat-close-btn {
          background: none;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.2s;
        }

        .chat-close-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          color: var(--text-primary);
        }

        /* Messages */
        .chat-messages-container {
          flex: 1;
          padding: 20px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .chat-message-row {
          display: flex;
          flex-direction: column;
          max-width: 82%;
        }

        .chat-message-row.bot {
          align-self: flex-start;
          align-items: flex-start;
        }

        .chat-message-row.user {
          align-self: flex-end;
          align-items: flex-end;
          max-width: 78%;
        }

        .chat-message-bubble {
          padding: 12px 16px;
          border-radius: 16px;
          font-size: 0.88rem;
          line-height: 1.45;
        }

        .bot .chat-message-bubble {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--glass-border);
          color: var(--text-primary);
          border-bottom-left-radius: 4px;
          white-space: pre-line;
        }

        .user .chat-message-bubble {
          background: var(--primary);
          color: white;
          border-bottom-right-radius: 4px;
          box-shadow: 0 4px 12px rgba(108, 99, 255, 0.2);
        }

        .message-content {
          margin: 0;
        }

        /* Quick Replies */
        .chat-quick-replies {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 8px;
        }

        .quick-reply-chip {
          background: rgba(108, 99, 255, 0.08);
          border: 1px solid rgba(108, 99, 255, 0.2);
          color: var(--primary);
          font-family: inherit;
          font-size: 0.76rem;
          font-weight: 600;
          padding: 6px 12px;
          border-radius: 50px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .quick-reply-chip:hover {
          background: var(--primary);
          color: white;
          border-color: var(--primary);
          transform: scale(1.02);
        }

        /* Typing Dots */
        .typing-bubble {
          padding: 10px 18px;
        }

        .typing-dots {
          display: flex;
          align-items: center;
          gap: 4px;
          height: 10px;
        }

        .typing-dots span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--text-secondary);
          animation: typing-bounce 1.4s infinite ease-in-out both;
        }

        .typing-dots span:nth-child(1) { animation-delay: -0.32s; }
        .typing-dots span:nth-child(2) { animation-delay: -0.16s; }

        /* Input area */
        .chat-input-container {
          padding: 12px 16px;
          border-top: 1px solid var(--glass-border);
          display: flex;
          gap: 8px;
          align-items: center;
          background: rgba(255, 255, 255, 0.02);
        }

        .chat-input-container input {
          flex: 1;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--glass-border);
          border-radius: 50px;
          padding: 10px 16px;
          font-family: inherit;
          font-size: 0.88rem;
          color: var(--text-primary);
          outline: none;
          transition: border-color 0.2s;
        }

        .chat-input-container input:focus {
          border-color: rgba(108, 99, 255, 0.45);
        }

        .chat-send-btn {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          padding: 0;
        }

        .chat-send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Animations */
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }

        @keyframes bubble-rotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes pulse {
          0% { transform: scale(0.9); opacity: 0.8; }
          50% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(0.9); opacity: 0.8; }
        }

        @keyframes typing-bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }

        .animate-scale-in {
          animation: scale-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes scale-in {
          from { opacity: 0; transform: scale(0.85); }
          to { opacity: 1; transform: scale(1); }
        }

        .spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default QueueBot;
