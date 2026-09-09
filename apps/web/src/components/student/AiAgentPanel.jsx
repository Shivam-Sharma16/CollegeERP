import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X, Send, RefreshCw, Bot } from 'lucide-react';
import { useStudentPersonalMutation, useGetConversationHistoryQuery } from '../../api/aiAgentApi';
import styles from './AiAgentPanel.module.css';

export function AiAgentPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [localMessages, setLocalMessages] = useState([]);
  
  const { data: historyData, isLoading: isLoadingHistory } = useGetConversationHistoryQuery('studentPersonalAgent', {
    skip: !isOpen
  });
  
  const [sendMessage, { isLoading: isSending }] = useStudentPersonalMutation();
  const messagesEndRef = useRef(null);

  // Load history if available, though currently backend might not persist it
  useEffect(() => {
    if (historyData?.data) {
      setLocalMessages(historyData.data);
    }
  }, [historyData]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [localMessages, isSending]);

  const handleSend = async (textToSend = input) => {
    if (!textToSend.trim() || isSending) return;
    
    const userMsg = { role: 'user', content: textToSend, id: Date.now() };
    setLocalMessages(prev => [...prev, userMsg]);
    setInput('');

    try {
      const res = await sendMessage({ prompt: textToSend }).unwrap();
      const botMsg = { role: 'assistant', content: res.data.result, id: Date.now() + 1 };
      setLocalMessages(prev => [...prev, botMsg]);
    } catch (err) {
      const errorMsg = { 
        role: 'error', 
        content: 'Failed to reach the AI agent. Please try again.',
        originalPrompt: textToSend,
        id: Date.now() + 1 
      };
      setLocalMessages(prev => [...prev, errorMsg]);
    }
  };

  const handleRetry = (prompt, idToRemove) => {
    setLocalMessages(prev => prev.filter(m => m.id !== idToRemove));
    handleSend(prompt);
  };

  return (
    <>
      <button 
        className={styles.fab} 
        onClick={() => setIsOpen(true)}
        aria-label="Open AI Assistant"
      >
        <MessageSquare size={24} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div 
              className={styles.backdrop}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
            />
            
            <motion.div 
              className={styles.panel}
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            >
              <div className={styles.header}>
                <div className={styles.headerTitle}>
                  <div className={styles.avatar}><Bot size={20} /></div>
                  <div>
                    <h3>Academic Assistant</h3>
                    <p>Powered by AI</p>
                  </div>
                </div>
                <button className={styles.closeBtn} onClick={() => setIsOpen(false)}>
                  <X size={20} />
                </button>
              </div>

              <div className={styles.chatArea}>
                {localMessages.length === 0 && !isLoadingHistory && (
                  <div className={styles.emptyChat}>
                    <Bot size={40} className={styles.emptyIcon} />
                    <p>Hi! I can help you with your attendance, marks, fees, and study notes. What would you like to know?</p>
                  </div>
                )}
                
                {localMessages.map((msg) => (
                  <div key={msg.id} className={`${styles.messageWrapper} ${styles[msg.role]}`}>
                    {msg.role === 'assistant' && (
                      <div className={styles.msgAvatar}><Bot size={16} /></div>
                    )}
                    <div className={styles.messageBubble}>
                      {msg.role === 'error' ? (
                        <div className={styles.errorContent}>
                          <p>{msg.content}</p>
                          <button 
                            className={styles.retryBtn} 
                            onClick={() => handleRetry(msg.originalPrompt, msg.id)}
                          >
                            <RefreshCw size={14} /> Retry
                          </button>
                        </div>
                      ) : (
                        <p>{msg.content}</p>
                      )}
                    </div>
                  </div>
                ))}
                
                {isSending && (
                  <div className={`${styles.messageWrapper} ${styles.assistant}`}>
                    <div className={styles.msgAvatar}><Bot size={16} /></div>
                    <div className={`${styles.messageBubble} ${styles.typingBubble}`}>
                      <span className={styles.typingDot}></span>
                      <span className={styles.typingDot}></span>
                      <span className={styles.typingDot}></span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className={styles.inputArea}>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Ask about your academic data..."
                  className={styles.input}
                  disabled={isSending}
                />
                <button 
                  className={styles.sendBtn} 
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isSending}
                >
                  <Send size={18} />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
