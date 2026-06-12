/**
 * Slot Suggestion AI Service
 * Analyzes appointment slots and queue congestion to provide smart recommendation badges.
 */

/**
 * Generates recommendation tags and explanations for a list of timeslots.
 * @param {string[]} timeSlots - Array of time strings (e.g. ["09:00 AM", "09:30 AM"])
 * @param {number} currentQueueLength - Number of currently waiting users
 * @returns {Record<string, {status: 'recommended'|'neutral'|'busy', badge: string, reason: string}>} Map of timeslot to suggestion
 */
export const getSlotSuggestions = (timeSlots = [], currentQueueLength = 0) => {
  const suggestions = {};

  timeSlots.forEach((slot) => {
    // Parse time to determine morning/lunch/afternoon/evening
    const timeLower = slot.toLowerCase();
    const isMorning = timeLower.includes('am') && !timeLower.startsWith('12');
    const isLunch = timeLower.includes('12:') || timeLower.includes('01:') || timeLower.includes('1:');
    const isAfternoon = timeLower.includes('pm') && (timeLower.startsWith('02:') || timeLower.startsWith('2:') || timeLower.startsWith('03:') || timeLower.startsWith('3:'));
    const isEvening = timeLower.includes('pm') && (timeLower.startsWith('04:') || timeLower.startsWith('4:') || timeLower.startsWith('05:') || timeLower.startsWith('5:') || timeLower.startsWith('06:') || timeLower.startsWith('6:'));

    let status = 'neutral';
    let badge = '';
    let reason = '';

    if (currentQueueLength >= 8) {
      // If queue is heavy, favor slots further out or early morning
      if (isMorning) {
        status = 'recommended';
        badge = 'Less Busy';
        reason = 'Current live queue is heavy. Morning slots are expected to be faster.';
      } else if (isEvening) {
        status = 'busy';
        badge = 'Avoid - Heavy Queue';
        reason = 'Peak check-in window. Waiting times may be longer today.';
      } else {
        status = 'neutral';
        badge = 'Normal Traffic';
        reason = 'Moderate congestion expected.';
      }
    } else {
      // Normal queue size suggestions
      if (isLunch) {
        status = 'busy';
        badge = 'Peak Hour (Lunch)';
        reason = 'High activity period. Consider booking earlier or later to avoid wait times.';
      } else if (isEvening) {
        status = 'busy';
        badge = 'Evening Rush';
        reason = 'Typically higher footfalls after work hours.';
      } else if (isMorning || isAfternoon) {
        status = 'recommended';
        badge = 'Highly Recommended';
        reason = 'Optimal slot with historically low queue lengths and fast serving times.';
      } else {
        status = 'neutral';
        badge = 'Recommended';
        reason = 'Moderate wait times expected.';
      }
    }

    suggestions[slot] = { status, badge, reason };
  });

  return suggestions;
};
