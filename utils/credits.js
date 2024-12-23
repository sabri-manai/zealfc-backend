// utils/credits.js
function consumeCredits(user, amountToUse) {
    // Sort credits by expiration date: earlier expiring first, permanent (no expires_at) last
    user.credits.sort((a, b) => {
      if (a.expires_at && b.expires_at) return new Date(a.expires_at) - new Date(b.expires_at);
      if (a.expires_at && !b.expires_at) return -1;
      if (!a.expires_at && b.expires_at) return 1;
      return 0;
    });
  
    let remaining = amountToUse;
    const usedCredits = []; // Track which credits were used
  
    for (const credit of user.credits) {
      if (credit.amount > 0) {
        const used = Math.min(credit.amount, remaining);
        credit.amount -= used;
        remaining -= used;
        usedCredits.push({ amount: used, type: credit.type, expires_at: credit.expires_at });
        if (remaining <= 0) break;
      }
    }
  
    // If we couldn't fulfill the entire amountToUse, revert changes and return false
    if (remaining > 0) {
      for (const usedCredit of usedCredits) {
        const originalCredit = user.credits.find(
          (c) => c.type === usedCredit.type && c.expires_at === usedCredit.expires_at
        );
        if (originalCredit) {
          originalCredit.amount += usedCredit.amount;
        }
      }
      return false;
    }
  
    // Clean up credits with 0 amount if desired
    user.credits = user.credits.filter((c) => c.amount > 0 || c.type === 'permanent');
  
    // Mark credits as modified
    user.markModified('credits');
  
    return usedCredits; // Return the details of used credits
  }
  
  function totalAvailableCredits(user) {
    return user.credits.reduce((sum, c) => sum + c.amount, 0);
  }
  
  function removeExpiredCredits(user) {
    const now = new Date();
    const originalLength = user.credits.length;
    user.credits = user.credits.filter((credit) => {
      if (credit.type === 'subscription' && credit.expires_at && credit.expires_at < now) {
        return false;
      }
      return true;
    });
  
    if (user.credits.length !== originalLength) {
      user.markModified('credits');
    }
  }
  
  module.exports = {
    consumeCredits,
    totalAvailableCredits,
    removeExpiredCredits
  };
  