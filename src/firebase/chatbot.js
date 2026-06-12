/**
 * AI Chatbot (QueueBot) Service Integration Layer
 * 
 * SECURITY COMPLIANCE WARNING:
 * Do not expose the Gemini API key directly in the frontend codebase.
 * Under production settings, client queries must be proxied via a backend/Firebase Cloud Function.
 */

/**
 * Sends a message to the QueueBot assistant.
 * Fallbacks to local mock reasoning or local Ollama client if the serverless proxy is unconfigured.
 * 
 * @param {string} userMessage - The text input from the customer
 * @param {Array} chatHistory - Array of previous messages in the conversation
 * @returns {Promise<string>} The assistant's text response
 */
export const sendMessageToQueueBot = async (userMessage, chatHistory = []) => {
  try {
    // PLACEHOLDER: Firebase Cloud Function proxy call
    // When deploying backend, uncomment the lines below and configure your functions endpoint:
    /*
    const response = await fetch('https://YOUR_FIREBASE_FUNCTIONS_URL/queueBotChat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: userMessage,
        history: chatHistory
      })
    });
    const data = await response.json();
    return data.reply;
    */

    // FALLBACK 1: Local Ollama Client check (if running locally on port 11434)
    // Make sure Ollama CORS is configured via: OLLAMA_ORIGINS="*" ollama serve
    try {
      const ollamaResponse = await fetch('http://127.0.0.1:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3',
          messages: [
            ...chatHistory.map(msg => ({ role: msg.sender === 'user' ? 'user' : 'assistant', content: msg.text })),
            { role: 'user', content: userMessage }
          ],
          stream: false
        })
      });
      if (ollamaResponse.ok) {
        const ollamaData = await ollamaResponse.json();
        return ollamaData.message.content;
      }
    } catch (ollamaErr) {
      // Local Ollama client is offline or not configured, proceed to fallback mock
      console.log('Local Ollama offline, executing rule-based fallback response.');
    }

    // FALLBACK 2: Rule-based local mock responses (to simulate interactive behaviors for testing)
    const lowerMessage = userMessage.toLowerCase();
    
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
      return "Hello! I am QueueLess QueueBot. How can I assist you with your booking or queue status today?";
    }
    if (lowerMessage.includes('status') || lowerMessage.includes('queue') || lowerMessage.includes('token')) {
      return "You can check your active queue status by clicking on the 'Active Queue' tracker in your navigation sidebar. It updates in real-time.";
    }
    if (lowerMessage.includes('cancel')) {
      return "To cancel an appointment, navigate to 'Appointments', choose your booking details, and click the 'Cancel Booking' option.";
    }
    if (lowerMessage.includes('book') || lowerMessage.includes('reserve')) {
      return "To book a slot: Select a business from the Home screen, choose your services/staff, select an available timeslot, and complete the check out.";
    }

    return `I received your message: "${userMessage}". Once the Firebase Cloud Function is linked, I will respond using Gemini AI.`;
  } catch (error) {
    console.error('QueueBot Chat Error:', error);
    return "I apologize, but I am having trouble connecting right now. Please check back shortly.";
  }
};
