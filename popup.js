document.addEventListener('DOMContentLoaded', () => {
  const passengerList = document.getElementById('passenger-list');
  const addBtn = document.getElementById('add-passenger-btn');
  const saveBtn = document.getElementById('save-btn');
  const statusMsg = document.getElementById('status-msg');
  const template = document.getElementById('passenger-template').content;
  
  const MAX_PASSENGERS = 6;
  
  // Load saved passengers and payment settings
  chrome.storage.local.get(['passengers', 'paymentMode', 'paymentGateway', 'autoPayBook'], (result) => {
    let passengers = result.passengers || [];
    
    // Load payment settings
    document.getElementById('payment-mode').value = result.paymentMode || '';
    document.getElementById('payment-gateway').value = result.paymentGateway || '';
    document.getElementById('auto-pay-book').checked = result.autoPayBook || false;

    // Always show at least one form if empty
    if (passengers.length === 0) {
      addPassengerCard();
    } else {
      passengers.forEach(p => addPassengerCard(p));
    }
  });

  addBtn.addEventListener('click', () => {
    const currentCount = passengerList.querySelectorAll('.passenger-card').length;
    if (currentCount < MAX_PASSENGERS) {
      addPassengerCard();
    } else {
      showStatus(`Maximum ${MAX_PASSENGERS} passengers allowed.`, 'error');
    }
  });

  saveBtn.addEventListener('click', () => {
    const cards = passengerList.querySelectorAll('.passenger-card');
    const passengers = [];
    
    let hasError = false;
    
    cards.forEach((card, index) => {
      const name = card.querySelector('.p-name').value.trim();
      const age = card.querySelector('.p-age').value.trim();
      const gender = card.querySelector('.p-gender').value;
      const berth = card.querySelector('.p-berth').value;
      const nationality = card.querySelector('.p-nationality').value;
      
      // Simple validation for names if filled
      if (name || age || gender) {
        if (!name || !age || !gender) {
          hasError = true;
          return;
        }
        passengers.push({ name, age, gender, berth, nationality });
      }
    });
    
    if (hasError) {
      showStatus('Please fill Name, Age and Gender for entered passengers.', 'error');
      return;
    }

    const paymentMode = document.getElementById('payment-mode').value;
    const paymentGateway = document.getElementById('payment-gateway').value;
    const autoPayBook = document.getElementById('auto-pay-book').checked;
    
    chrome.storage.local.set({ 
      passengers, 
      paymentMode, 
      paymentGateway, 
      autoPayBook 
    }, () => {
      showStatus('All details saved perfectly!', 'success');
      
      // Optional: Send message to content script immediately after save
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if(tabs[0] && tabs[0].id && tabs[0].url && tabs[0].url.includes('irctc.co.in')) {
           chrome.tabs.sendMessage(tabs[0].id, {action: "fill_passengers"}, (response) => {
             if (chrome.runtime.lastError) {
               console.log("Ignored error:", chrome.runtime.lastError.message);
             }
           });
        }
      });
    });
  });

  function addPassengerCard(data = null) {
    const currentCount = passengerList.querySelectorAll('.passenger-card').length;
    if (currentCount >= MAX_PASSENGERS) return;
    
    const clone = document.importNode(template, true);
    
    const passengerNumber = currentCount + 1;
    clone.querySelector('.passenger-title').textContent = `Passenger ${passengerNumber}`;
    
    if (data) {
      clone.querySelector('.p-name').value = data.name || '';
      clone.querySelector('.p-age').value = data.age || '';
      clone.querySelector('.p-gender').value = data.gender || '';
      clone.querySelector('.p-berth').value = data.berth || '';
      clone.querySelector('.p-nationality').value = data.nationality || 'IN';
    }
    
    clone.querySelector('.remove-btn').addEventListener('click', (e) => {
      e.target.closest('.passenger-card').remove();
      updateTitles();
    });
    
    passengerList.appendChild(clone);
    updateTitles();
  }

  function updateTitles() {
    const cards = passengerList.querySelectorAll('.passenger-card');
    cards.forEach((card, index) => {
      card.querySelector('.passenger-title').textContent = `Passenger ${index + 1}`;
    });
    
    addBtn.style.display = cards.length >= MAX_PASSENGERS ? 'none' : 'block';
  }

  function showStatus(message, type) {
    statusMsg.textContent = message;
    statusMsg.className = `status ${type}`;
    statusMsg.classList.remove('hidden');
    
    setTimeout(() => {
      statusMsg.classList.add('hidden');
    }, 3000);
  }
});
