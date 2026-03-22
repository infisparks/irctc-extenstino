function setNativeValue(element, value) {
  if (!element || !value) return;
  element.focus();
  element.value = value;
  
  const prototype = Object.getPrototypeOf(element);
  const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set;
  
  if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
    try { prototypeValueSetter.call(element, value); } catch(e){}
  } else if (valueSetter) {
    try { valueSetter.call(element, value); } catch(e){}
  }
  
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.dispatchEvent(new Event('blur', { bubbles: true }));
}

let currentUrl = window.location.href;
let hasFilledForThisPage = false;
let fillAttempts = 0;
let lastCaptchaSrc = "";

const checkInterval = setInterval(() => {
  // Track URL changes to reset state for new booking flows
  if (currentUrl !== window.location.href) {
    currentUrl = window.location.href;
    hasFilledForThisPage = false;
    fillAttempts = 0;
    lastCaptchaSrc = "";
  }

  const isPassengerPage = window.location.href.includes('nget/booking/psgninput');
  const isReviewPage = window.location.href.includes('nget/booking/reviewBooking');
  const isPaymentPage = window.location.href.includes('nget/payment/bkgPaymentOptions');

  // Only run on the actual passenger form, review page, or payment page
  if (!isPassengerPage && !isReviewPage && !isPaymentPage) return;

  if (isPaymentPage) {
    if (hasFilledForThisPage || fillAttempts > 20) return;
    fillAttempts++;

    chrome.storage.local.get(['paymentMode', 'paymentGateway', 'autoPayBook'], (result) => {
      const mode = result.paymentMode;
      const gateway = result.paymentGateway;
      const autoPay = result.autoPayBook;

      if (!mode) return;

      // 1. Select the Payment Mode (e.g., BHIM/ UPI/ USSD)
      const menuItems = Array.from(document.querySelectorAll('.bank-text, span, div, a'));
      const targetMenu = menuItems.find(el => {
        const txt = el.textContent.trim();
        if (mode === 'BHIM_UPI') {
          return txt === 'BHIM/ UPI' || txt === 'BHIM/ UPI/ USSD' || txt === 'Pay using BHIM UPI';
        }
        return false;
      });

      if (targetMenu) {
        const clickableMenu = targetMenu.closest('a') || targetMenu;
        if (!clickableMenu.classList.contains('active-bank')) {
          clickableMenu.click();
        }
      }

      // 2. Select the Gateway/Bank (e.g., PAYTM)
      const banks = Array.from(document.querySelectorAll('.bank-box, .col-sm-4, .col-xs-12'));
      const targetBank = banks.find(el => {
        const txt = el.textContent.trim().toLowerCase();
        if (gateway === 'PAYTM') {
          return txt.includes('paytm') || txt.includes('bhim') && txt.includes('paytm');
        }
        return false;
      });

      if (targetBank) {
        targetBank.click();
        const radio = targetBank.querySelector('input[type="radio"]');
        if (radio) radio.click();
      }

      // 3. Auto click Pay & Book if requested
      if (autoPay && targetBank) {
        // Wait a bit for the selection to register
        setTimeout(() => {
          const payBtn = Array.from(document.querySelectorAll('button')).find(btn => 
            btn.textContent.includes('Pay & Book') || 
            (btn.classList.contains('btn-primary') && btn.textContent.trim() === 'Pay & Book')
          );
          
          if (payBtn && !payBtn.disabled) {
            payBtn.click();
            hasFilledForThisPage = true;
          }
        }, 500);
      } else if (targetBank) {
        hasFilledForThisPage = true;
      }
    });

    return;
  }

  if (isReviewPage) {
    const captchaImg = document.querySelector('img.captcha-img');
    const captchaInput = document.querySelector('input[id="captcha"]');

    if (captchaImg && captchaInput && captchaImg.src !== lastCaptchaSrc && captchaImg.src.startsWith('data:image')) {
      const currentSrc = captchaImg.src;
      lastCaptchaSrc = currentSrc;

      try {
        chrome.runtime.sendMessage({ action: "solve_captcha", base64: currentSrc }, (response) => {
          if (chrome.runtime.lastError) return;
          if (response && response.success && response.text) {
            const latestImg = document.querySelector('img.captcha-img');
            // Double check if user didn't refresh captcha while we generated
            if (latestImg && latestImg.src === currentSrc) {
              setNativeValue(captchaInput, response.text);
            }
          } else {
            lastCaptchaSrc = ""; // reset on fail so it re-attempts later if desired
          }
        });
      } catch (e) {
        if (e.message.includes("Extension context invalidated")) {
          clearInterval(checkInterval);
        }
      }
    }
    return; // Don't run passenger fill logic on this page
  }

  // Stop trying if we have succeeded or exceeded attempt limit
  if (hasFilledForThisPage || fillAttempts > 15) return;

  try {
    chrome.storage.local.get(['passengers', 'paymentMode'], (result) => {
      const passengers = result.passengers || [];
      const paymentMode = result.paymentMode;
    if (passengers.length === 0) return;

    const currentRows = document.querySelectorAll('app-passenger');
    
    // Wait for the outer passenger form container to exist
    if (currentRows.length === 0) return; 
    
    // Wait for the inner inputs to exist (Angular templates load asynchronously)
    const firstRowInput = currentRows[0].querySelector('input[formcontrolname="passengerAge"]');
    if (!firstRowInput) return;

    // Check if we need to click "+ Add Passenger"
    if (currentRows.length < passengers.length) {
      const addBtns = Array.from(document.querySelectorAll('a span.prenext'));
      const addPassengerBtn = addBtns.find(span => span.textContent.includes('+ Add Passenger'));
      
      if (addPassengerBtn) {
        const clickable = addPassengerBtn.closest('a') || addPassengerBtn;
        clickable.click();
        fillAttempts++; // count this as an attempt since sometimes the button might not work gracefully
        return; // Wait until next interval for the new row to render
      }
    }

    fillAttempts++;
    let completelyFilled = true;

    passengers.forEach((p, index) => {
      if (index >= currentRows.length) {
        completelyFilled = false;
        return;
      }
      
      const row = currentRows[index];

      const nameInput = row.querySelector('p-autocomplete[formcontrolname="passengerName"] input');
      const ageInput = row.querySelector('input[formcontrolname="passengerAge"]');
      const genderSelect = row.querySelector('select[formcontrolname="passengerGender"]');
      const nationalitySelect = row.querySelector('select[formcontrolname="passengerNationality"]');
      const berthSelect = row.querySelector('select[formcontrolname="passengerBerthChoice"]');

      if (nameInput && nameInput.value !== p.name && p.name) setNativeValue(nameInput, p.name);
      if (ageInput && ageInput.value !== p.age.toString() && p.age) setNativeValue(ageInput, p.age.toString());
      if (genderSelect && genderSelect.value !== p.gender && p.gender) setNativeValue(genderSelect, p.gender);
      if (nationalitySelect && nationalitySelect.value !== p.nationality && p.nationality) setNativeValue(nationalitySelect, p.nationality);
      if (berthSelect && !berthSelect.value && p.berth) setNativeValue(berthSelect, p.berth);
      
      // Secondary check to ensure value took
      if ((nameInput && nameInput.value !== p.name && p.name) ||
          (ageInput && ageInput.value !== p.age.toString() && p.age) ||
          (genderSelect && genderSelect.value !== p.gender && p.gender)) {
        completelyFilled = false;
      }
    });

    // Auto-select BHIM/UPI in payment options on passenger info page
    if (paymentMode === 'BHIM_UPI') {
      const upiRadioBox = document.querySelector('p-radiobutton[id="2"] .ui-radiobutton-box, p-radiobutton[label*="BHIM"] .ui-radiobutton-box');
      if (upiRadioBox && upiRadioBox.getAttribute('aria-checked') !== 'true') {
        upiRadioBox.click();
        completelyFilled = false; // require one more tick to verify it checked
      }
    }

    if (completelyFilled) {
      // Small verification check at the end
      hasFilledForThisPage = true;
    }
  });
  } catch (e) {
    if (e.message.includes("Extension context invalidated")) {
      clearInterval(checkInterval);
    }
  }
}, 800);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fill_passengers") {
    hasFilledForThisPage = false;
    fillAttempts = 0;
    sendResponse({ success: true });
  }
  return true;
});
