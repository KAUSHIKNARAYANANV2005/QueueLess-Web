/**
 * QueueBot AI Service
 * Supports rule-based keyword matching for common user queries and context-aware responses.
 * Includes placeholders for future Gemini or Ollama API integrations.
 */

/**
 * Evaluates user message against rules and returns a structured response.
 * @param {string} message - The user's input message.
 * @param {Object} [context] - Contextual data including active booking/queue details, user role, etc.
 * @returns {Promise<{text: string, quickReplies?: string[]}>} The bot's response and optional quick reply chips.
 */
export const getQueueBotResponse = async (message, context = {}) => {
  // Simulate network delay for natural feel
  await new Promise((resolve) => setTimeout(resolve, 800));

  const text = (message || '').toLowerCase().trim();
  const { role, activeBooking, queueData } = context;

  // 1. HELP & GENERAL WELCOME
  if (text.includes('help') || text.includes('hello') || text.includes('hi ') || text === 'hi' || text.includes('hey')) {
    const welcomeText = role === 'business'
      ? "Hi there! I'm QueueBot, your merchant assistant. I can help you with:\n\n• Managing your active queue\n• Editing services and staff profiles\n• Checking business settings\n• Viewing reviews"
      : "Hello! I'm QueueBot, your virtual queue assistant. I can help you with:\n\n• Booking an appointment\n• Checking your active queue status\n• Cancelling a booking\n• Finding local businesses";
    
    const quickReplies = role === 'business'
      ? ['How to serve next?', 'Manage my services', 'Staff settings']
      : ['Queue Status', 'How do I book?', 'Cancel booking'];

    return { text: welcomeText, quickReplies };
  }

  // 2. ACTIVE QUEUE STATUS HELP
  if (text.includes('queue') || text.includes('status') || text.includes('position') || text.includes('wait') || text.includes('token')) {
    if (role === 'business') {
      const totalWaiting = queueData?.totalWaiting ?? 0;
      const currentServing = queueData?.currentServingToken || 'None';
      return {
        text: `Here is your current live queue status:\n\n• **Total Waiting:** ${totalWaiting} customer(s)\n• **Now Serving Token:** ${currentServing}\n\nTo manage and call customers, navigate to the **Queue Manager** from your sidebar.`,
        quickReplies: ['How to serve next?', 'Manage staff']
      };
    } else {
      if (activeBooking && activeBooking.status !== 'cancelled' && activeBooking.status !== 'served') {
        const pos = activeBooking.queuePosition || '—';
        const wait = activeBooking.estimatedWaitMinutes || '—';
        const token = activeBooking.tokenNumber || '—';
        const bizName = activeBooking.businessName || 'the venue';
        const service = activeBooking.serviceName || 'service';
        
        return {
          text: `You have an active booking! Here are the details:\n\n• **Venue:** ${bizName}\n• **Service:** ${service}\n• **Token Number:** ${token}\n• **Queue Position:** #${pos}\n• **Est. Wait Time:** ~${wait} mins\n\nYou can track this live on your **Active Queue** page.`,
          quickReplies: ['Cancel booking', 'Help']
        };
      } else {
        return {
          text: "You don't have any active bookings at the moment. To book a spot, search for a business on your Home screen, select a service, choose a time slot, and confirm your booking.",
          quickReplies: ['How do I book?', 'Find businesses']
        };
      }
    }
  }

  // 3. BOOKING HELP
  if (text.includes('book') || text.includes('appointment') || text.includes('reserve') || text.includes('schedule')) {
    if (role === 'business') {
      return {
        text: "Customers book your services through the QueueLess app. You can view all bookings for today on your **Dashboard** or inspect the active list in your **Queue Manager**.",
        quickReplies: ['Queue Status', 'Dashboard help']
      };
    } else {
      return {
        text: "Booking is simple! Follow these steps:\n1. Go to your **Home** page.\n2. Browse categories or search for a business.\n3. Click **View Details** on a business card.\n4. Tap **Book Appointment**.\n5. Select your service, staff member, date, and time.\n6. Review and click **Confirm Booking**.",
        quickReplies: ['Queue Status', 'Find businesses']
      };
    }
  }

  // 4. CANCELLATION HELP
  if (text.includes('cancel') || text.includes('cancellation') || text.includes('delete booking')) {
    if (role === 'business') {
      return {
        text: "To remove a customer from the queue and cancel their booking, go to the **Queue Manager** page. Locate the customer in the waiting table and click **Remove**. This will cancel their appointment and automatically notify them.",
        quickReplies: ['Queue Status', 'Dashboard help']
      };
    } else {
      if (activeBooking) {
        return {
          text: `You can cancel your current booking for **${activeBooking.serviceName || 'service'}** by going to either:\n\n1. The **Active Queue** page and clicking **Cancel Booking**.\n2. The **My Appointments** page, clicking the "Upcoming" or "Active" tab, and selecting **Cancel Booking**.\n\n*Note: This action is immediate and cannot be undone.*`,
          quickReplies: ['Queue Status', 'Help']
        };
      } else {
        return {
          text: "To cancel a booking, you must navigate to your **My Appointments** page, find the active or upcoming appointment, and click the **Cancel Booking** button.",
          quickReplies: ['My Appointments', 'Help']
        };
      }
    }
  }

  // 5. BUSINESS DASHBOARD HELP
  if (role === 'business' && (text.includes('dashboard') || text.includes('merchant') || text.includes('analytics') || text.includes('stats'))) {
    return {
      text: "Your **Dashboard** provides a high-level overview of today's operations. You can monitor:\n\n• **Queue metrics:** Total waiting, now serving, and completion rates.\n• **Recent bookings:** View details of the last 8 bookings.\n• **Customer reviews:** Previews of recent customer feedback and ratings.\n• **Quick links:** Fast access to manage services, staff, and queue settings.",
      quickReplies: ['Queue Status', 'Manage my services']
    };
  }

  // 6. SERVICES, STAFF, SETTINGS HELP (MERCHANT Specific)
  if (role === 'business' && (text.includes('service') || text.includes('staff') || text.includes('settings') || text.includes('hours') || text.includes('operating'))) {
    if (text.includes('service')) {
      return {
        text: "Manage what you offer on the **Services** page. You can add new services (with price, duration, and category), edit existing ones, toggle availability, or delete services.",
        quickReplies: ['Manage my services', 'Dashboard help']
      };
    } else if (text.includes('staff')) {
      return {
        text: "Manage team members on the **Staff** page. You can add staff profiles, edit details, toggle active status (determining if they appear as bookable by customers), or remove staff.",
        quickReplies: ['Staff settings', 'Dashboard help']
      };
    } else {
      return {
        text: "Customize business details on the **Business Settings** page. Here you can edit business name, category, description, address, phone number, upload logo/cover images, and define your weekly operating hours.",
        quickReplies: ['Dashboard help', 'Queue Status']
      };
    }
  }

  // 7. REVIEW HELP
  if (text.includes('review') || text.includes('rating') || text.includes('star') || text.includes('feedback')) {
    if (role === 'business') {
      return {
        text: "Navigate to the **Reviews** page to view all ratings left by customers and write professional replies. Responding to reviews generates automated notifications to the customer's device.",
        quickReplies: ['Dashboard help', 'Queue Status']
      };
    } else {
      return {
        text: "After you are served (booking status changes to Completed), you can write a review. Go to **My Appointments**, click the **Completed** tab, and select **Write Review**. You can rate from 1-5 stars and write a comment.",
        quickReplies: ['My Appointments', 'Help']
      };
    }
  }

  // 8. FIND BUSINESSES (Customer Specific)
  if (role === 'customer' && (text.includes('find') || text.includes('search') || text.includes('shop') || text.includes('venue') || text.includes('list'))) {
    return {
      text: "You can find local shops and venues on your **Home** page. Use the category pills (Clinic, Salon, Spa, Bank, Government) to filter, or type keywords in the search bar to filter by name, address, or service description.",
      quickReplies: ['How do I book?', 'Queue Status']
    };
  }

  // ─── AI INTEGRATION PLACEHOLDER ───
  // Future implementation for live APIs (Gemini/Ollama) goes here.
  // Note: Never expose API keys directly in client-side code.
  /*
  try {
    const response = await fetch('https://api.example.com/v1/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.VITE_AI_API_KEY}` // Example safe env reference
      },
      body: JSON.stringify({ message: text, context })
    });
    const data = await response.json();
    return { text: data.reply };
  } catch (error) {
    console.error("AI API Error, falling back to rule-based:", error);
  }
  */

  // 9. DEFAULT FALLBACK RESPONSE
  const fallbackText = role === 'business'
    ? "I'm not sure I understand that request. As your merchant assistant, I can help you manage your queue, services, reviews, and staff. Try asking about 'queue status' or 'how to manage staff'."
    : "I'm not sure how to help with that. I can assist with booking, cancellations, active queue tracking, or reviews. Try asking 'how do I book?' or 'what is my queue status?'.";
  
  const fallbackReplies = role === 'business'
    ? ['Queue Status', 'Dashboard help', 'Help']
    : ['Queue Status', 'How do I book?', 'Help'];

  return {
    text: fallbackText,
    quickReplies: fallbackReplies
  };
};
