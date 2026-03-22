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
    if (hasFilledForThisPage || fillAttempts > 50) return;
    fillAttempts++;

    chrome.storage.local.get(['paymentMode', 'paymentGateway', 'autoPayBook'], (result) => {
      const mode = result.paymentMode;
      const gateway = result.paymentGateway;
      const autoPay = result.autoPayBook;

      if (!mode) return;

      // 1. Select the Payment Mode Category (Left Menu)
      const spans = Array.from(document.querySelectorAll('.bank-type span, .col-pad'));
      const bhimTab = spans.find(el => {
        const txt = el.textContent.trim().toUpperCase();
        return txt.includes('BHIM') || txt.includes('UPI/ USSD');
      });

      if (bhimTab) {
        const tabContainer = bhimTab.closest('.bank-type') || bhimTab;
        if (!tabContainer.classList.contains('bank-type-active')) {
          tabContainer.click();
        }

        // 2. Poll for the Gateway/Bank Option (Right Side only)
        let pollCount = 0;
        const pollInterval = setInterval(() => {
          pollCount++;
          // Only search within the bank-type container on the right
          const rightSide = document.querySelector('#bank-type');
          if (!rightSide) return;

          const options = Array.from(rightSide.querySelectorAll('.bank-text, .col-pad, span'));
          const targetBank = options.find(el => {
            const txt = el.textContent.trim().toUpperCase();
            if (gateway === 'PAYTM') {
              // Be very specific to PAYTM to stay away from Amazon Pay
              return txt.includes('PAYTM');
            }
            return false;
          });

          if (targetBank) {
            clearInterval(pollInterval);
            
            // 3. Force Click the Bank Container
            const clickable = targetBank.closest('.link') || targetBank.closest('.bank-text') || targetBank;
            clickable.focus();
            clickable.click();
            
            // Backup click for any images inside
            const img = clickable.querySelector('img');
            if (img) img.click();

            // 4. Auto click Pay & Book if requested
            if (autoPay) {
              setTimeout(() => {
                const payBtn = Array.from(document.querySelectorAll('button')).find(btn => 
                  (btn.innerText || btn.textContent).includes('Pay & Book') && 
                  btn.classList.contains('btn-primary')
                );
                
                if (payBtn && !payBtn.disabled) {
                  payBtn.click();
                  hasFilledForThisPage = true;
                }
              }, 1000);
            } else {
              hasFilledForThisPage = true;
            }
          }

          // If we've polled for 5 seconds without finding it, stop
          if (pollCount > 25) {
            clearInterval(pollInterval);
          }
        }, 200);
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
        console.log("IRCTC Helper: Submitting Captcha to background solvers...");
        chrome.runtime.sendMessage({ action: "solve_captcha", base64: currentSrc }, (response) => {
          if (chrome.runtime.lastError) {
             console.error("IRCTC Helper: Message error:", chrome.runtime.lastError.message);
             return;
          }
          if (response && response.success && response.text) {
            console.log("IRCTC Helper: Captcha solved successfully:", response.text);
            const latestImg = document.querySelector('img.captcha-img');
            if (latestImg && latestImg.src === currentSrc) {
              setNativeValue(captchaInput, response.text);
            }
          } else {
            console.warn("IRCTC Helper: Solvers failed to find text.", response ? response.error : "");
            lastCaptchaSrc = "";
          }
        });
      } catch (e) {
         console.error("IRCTC Helper: solve_captcha exception:", e);
      }
    }

    // Auto-click Continue logic
    if (captchaInput && captchaInput.value.length >= 4) {
      chrome.storage.local.get(['allowWaitlist'], (result) => {
        const allowWaitlist = result.allowWaitlist !== undefined ? result.allowWaitlist : true;
        
        // Check availability status
        const isWL = document.querySelector('.WL') !== null;
        const isAvailable = document.querySelector('.AVAILABLE') !== null;
        
        // Logic: Click if it's Available OR if it's WL but user allowed waitlist booking
        if (isAvailable || (isWL && allowWaitlist)) {
          const continueBtn = document.querySelector('button.train_Search');
          if (continueBtn && !continueBtn.disabled) {
            continueBtn.click();
          }
        } else if (isWL && !allowWaitlist) {
          // Could optionally show a warning on page
          console.log("Auto-booking stopped: Waitlist not allowed in settings.");
        }
      });
    }

    return;
  }

  // Stop trying if we have succeeded or exceeded attempt limit
  if (isPassengerPage) {
    if (hasFilledForThisPage || fillAttempts > 30) return;

    try {
      chrome.storage.local.get(['passengers', 'paymentMode', 'autoContinuePsgn'], (result) => {
        const passengers = result.passengers || [];
        const paymentMode = result.paymentMode;
        const autoContinue = result.autoContinuePsgn !== undefined ? result.autoContinuePsgn : true;
        
        if (passengers.length === 0) return;

        const currentRows = document.querySelectorAll('app-passenger');
        if (currentRows.length === 0) return; 
        
        const firstRowInput = currentRows[0].querySelector('input[formcontrolname="passengerAge"]');
        if (!firstRowInput) return;

        // SMART TRICK: Rapid-fire add all passengers in early microtasks
        if (currentRows.length < passengers.length) {
          const addBtn = Array.from(document.querySelectorAll('.prenext')).find(span => 
            span.textContent.includes('+ Add Passenger')
          );
          if (addBtn) {
            const needed = passengers.length - currentRows.length;
            for (let i = 0; i < needed; i++) {
              addBtn.click();
            }
            // Give the browser 100ms to render the new rows
            fillAttempts++;
            return; 
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
          // Aggressive selectors
          const nameInput = row.querySelector('input[placeholder="Name"], p-autocomplete[formcontrolname="passengerName"] input, input.ui-autocomplete-input');
          const ageInput = row.querySelector('input[placeholder="Age"], input[formcontrolname="passengerAge"]');
          const genderSelect = row.querySelector('select[formcontrolname="passengerGender"]');
          const nationalitySelect = row.querySelector('select[formcontrolname="passengerNationality"]');
          const berthSelect = row.querySelector('select[formcontrolname="passengerBerthChoice"]');

          // 1. Fill values if missing or different
          if (nameInput && nameInput.value !== p.name && p.name) {
             setNativeValue(nameInput, p.name);
             completelyFilled = false; // Check again in next tick
          }
          if (ageInput && ageInput.value !== p.age.toString() && p.age) {
             setNativeValue(ageInput, p.age.toString());
             completelyFilled = false;
          }
          if (genderSelect && genderSelect.value !== p.gender && p.gender) {
             setNativeValue(genderSelect, p.gender);
             completelyFilled = false;
          }
          if (nationalitySelect && nationalitySelect.value !== p.nationality && p.nationality) {
             setNativeValue(nationalitySelect, p.nationality);
             completelyFilled = false;
          }
          if (berthSelect && berthSelect.value !== (p.berth || '') && p.berth) {
             setNativeValue(berthSelect, p.berth);
             completelyFilled = false;
          }
          
          // 2. Strict Verification for this row
          const isNameValid = !p.name || (nameInput && nameInput.value === p.name);
          const isAgeValid = !p.age || (ageInput && ageInput.value === p.age.toString());
          const isGenderValid = !p.gender || (genderSelect && genderSelect.value === p.gender);
          const isNationalityValid = !p.nationality || (nationalitySelect && nationalitySelect.value === p.nationality);
          const isBerthValid = !p.berth || (berthSelect && (berthSelect.value === p.berth || berthSelect.value === ''));

          if (!isNameValid || !isAgeValid || !isGenderValid || !isNationalityValid || !isBerthValid) {
            completelyFilled = false;
            console.log(`Passenger ${index + 1} not ready. Retrying...`);
          }
        });

        // 3. Payment Mode Selection Verification (Deep-Select Logic)
        if (paymentMode === 'BHIM_UPI') {
          const target = Array.from(document.querySelectorAll('tr, .link, label')).find(el => {
            const txt = el.textContent || "";
            return txt.includes('BHIM/UPI') && el.querySelector('p-radiobutton');
          });
          
          if (target) {
            const upiRadioBox = target.querySelector('.ui-radiobutton-box');
            const isChecked = upiRadioBox && (upiRadioBox.classList.contains('ui-state-active') || upiRadioBox.getAttribute('aria-checked') === 'true');
            
            if (!isChecked) {
              target.click(); // Row click
              if (upiRadioBox) upiRadioBox.click(); // Dot click
              const label = target.querySelector('label');
              if (label) label.click(); // Label click
              completelyFilled = false; 
              console.log("IRCTC Helper: BHIM/UPI selected correctly!");
            }
          }
        }

        // 4. Final step: Success and Auto-Continue
        if (completelyFilled) {
          hasFilledForThisPage = true;
          if (autoContinue) {
            setTimeout(() => {
              const continueBtn = document.querySelector('button.train_Search');
              if (continueBtn && !continueBtn.disabled) {
                continueBtn.click();
              }
            }, 500);
          }
        }
      });
    } catch (e) {
      console.error("Fill Passenger details error:", e);
    }
    return;
  }}, 500);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fill_passengers") {
    hasFilledForThisPage = false;
    fillAttempts = 0;
    sendResponse({ success: true });
  }
  return true;
});
