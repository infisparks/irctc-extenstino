(function() {
  let hasFilledHome = false;
  let _hasClickedBhimTab = false;
  let _hasClickedPaytm = false;

  function setNativeValue(element, value) {
    if (!element) return;
    element.focus();
    element.value = value;
    const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set;
    const prototype = Object.getPrototypeOf(element);
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
       prototypeValueSetter.call(element, value);
    } else if (valueSetter) {
       valueSetter.call(element, value);
    }
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  async function typeHumanStyle(el, text) {
      if (!el) return;
      
      // 1. Properly clear the input first (Angular-safe)
      if (el.value !== "") {
          setNativeValue(el, "");
          await new Promise(r => setTimeout(r, 50));
      }

      el.focus(); 
      el.click();
      await new Promise(r => setTimeout(r, 50));
      
      // 2. Type out the real value
      el.value = "";
      for (let char of text) {
          el.value += char;
          el.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
          el.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise(r => setTimeout(r, 10));
      }
      el.dispatchEvent(new Event('change', { bubbles: true }));
      
      // 3. Click out to close the calendar popup
      document.body.click(); 
  }

  // --- MODULE 1: HOME PAGE (SEARCH) ---
  
  function handleHomeSearch() {
    if (!chrome.runtime?.id) return;
    if (!window.location.href.toLowerCase().includes('train-search') && !window.location.href.endsWith('nget/')) return;
    if (hasFilledHome) return;

    chrome.storage.local.get(['fromStation', 'toStation', 'journeyDate'], async (result) => {
      const { fromStation: fVal, toStation: tVal, journeyDate: dVal } = result;
      if (!fVal || !tVal || !dVal) return;

      const fromInp = document.querySelector('p-autocomplete[formcontrolname="origin"] input');
      const toInp = document.querySelector('p-autocomplete[formcontrolname="destination"] input');
      const dateInp = document.querySelector('p-calendar[formcontrolname="journeyDate"] input, #jDate input');

      if (!fromInp || !toInp || !dateInp) return;

      // Smart Check
      const needsUpdate = !fromInp.value.toUpperCase().includes(fVal.toUpperCase()) || 
                          !toInp.value.toUpperCase().includes(tVal.toUpperCase()) || 
                          dateInp.value !== dVal;

      if (!needsUpdate) return;

      console.log("IRCTC Helper: Modular Search Engine Triggered...");
      
      // Parallel Fill
      setNativeValue(fromInp, fVal);
      setTimeout(() => {
        document.querySelectorAll('.ui-autocomplete-items li').forEach(li => {
          if (li.textContent.toUpperCase().includes(fVal.toUpperCase())) li.click();
        });
      }, 1000);

      setNativeValue(toInp, tVal);
      setTimeout(() => {
        document.querySelectorAll('.ui-autocomplete-items li').forEach(li => {
          if (li.textContent.toUpperCase().includes(tVal.toUpperCase())) li.click();
        });
      }, 1000);

      await typeHumanStyle(dateInp, dVal);

      setTimeout(() => {
        document.querySelector('button.train_Search')?.click();
        hasFilledHome = true;
      }, 1500);
    });
  }

  // --- MODULE 2: PASSENGER DETAILS PAGE ---
  function handlePassengerDetails() {
    if (!chrome.runtime?.id) return;
    if (!window.location.href.toLowerCase().includes('psgninput')) return;

    chrome.storage.local.get(['passengers', 'paymentMode', 'autoContinuePsgn'], (settings) => {
      const psgns = settings.passengers;
      if (!psgns || psgns.length === 0) return;

      // 1. Detect how many rows ARE VISIBLE by looking for the Name inputs
      const nameInputs = document.querySelectorAll('p-autocomplete[formcontrolname="passengerName"] input, input[placeholder="Name"]');
      const rowCount = nameInputs.length;

      // 2. Add Rows Rapidly if needed (Using Text-Search for higher accuracy)
      const addBtn = Array.from(document.querySelectorAll('a, span, button')).find(el => el.textContent.includes('+ Add Passenger'));
      
      if (addBtn && rowCount < psgns.length) {
        console.log(`IRCTC Helper: Rapid-fire adding all ${psgns.length} rows...`);
        for (let i = rowCount; i < psgns.length; i++) {
          addBtn.click();
        }
        return; // Wait for one heartbeat to let IRCTC render the rows
      }

      let completelyFilled = true;

      // 3. Bulk Fill all visible rows
      psgns.forEach((p, i) => {
        // Find the "Row" which is a parent of the name input
        const nameInp = nameInputs[i];
        if (!nameInp) return;
        
        // Find the container for this specific passenger
        const row = nameInp.closest('app-passenger') || nameInp.closest('.passenger-row') || nameInp.closest('.row');
        if (!row) return;

        const a = row.querySelector('input[formcontrolname="passengerAge"], input[placeholder="Age"]');
        const g = row.querySelector('select[formcontrolname="passengerGender"], select.form-control');
        const b = row.querySelector('select[formcontrolname="passengerBerthChoice"], select.form-control:nth-of-type(2)');

        // Fill Name
        if (nameInp.value !== p.name) { 
          setNativeValue(nameInp, p.name); 
          completelyFilled = false; 
        }
        // Fill Age
        if (a && a.value !== p.age) { 
          setNativeValue(a, p.age); 
          completelyFilled = false; 
        }
        // Select Gender
        if (g && g.value !== p.gender) { 
          g.value = p.gender; 
          g.dispatchEvent(new Event('change', { bubbles: true })); 
          completelyFilled = false; 
        }
        // Select Berth
        if (b && p.berth && b.value !== p.berth) { 
          b.value = p.berth; 
          b.dispatchEvent(new Event('change', { bubbles: true })); 
          completelyFilled = false; 
        }
      });

      // 3. BHIM/UPI Deep Select
      if (settings.paymentMode === 'BHIM_UPI') {
        const target = Array.from(document.querySelectorAll('tr, .link, label')).find(el => 
            el.textContent.includes('BHIM/UPI') && el.querySelector('p-radiobutton')
        );
        if (target) {
          const radio = target.querySelector('.ui-radiobutton-box');
          if (radio && !radio.classList.contains('ui-state-active') && radio.getAttribute('aria-checked') !== 'true') {
            target.click(); radio.click(); target.querySelector('label')?.click();
            completelyFilled = false;
          }
        }
      }

      // 4. Auto Continue
      if (completelyFilled && settings.autoContinuePsgn) {
        document.querySelector('button.train_Search, button[type="submit"].btn-primary')?.click();
      }
    });
  }


  function handleOtherPages() {
    if (!chrome.runtime?.id) return;
    chrome.storage.local.get(['allowWaitlist', 'paymentMode', 'autoPayBook'], (settings) => {
        // Review Page
        if (window.location.href.includes('reviewBooking')) {
            const avail = document.querySelector('.avail-info')?.textContent || "";
            const ok = avail.includes('AVAILABLE') || avail.includes('CURR_AVBL') || (avail.includes('WL') && settings.allowWaitlist);
            const captchaInput = document.querySelector('#captcha');
            if (ok && captchaInput && captchaInput.value.length >= 4) {
               document.querySelector('button.btn-primary[type="submit"]')?.click();
            }
        }
        // --- MODULE 3: REVIEW & PAYMENT ---
        if (window.location.href.includes('bkgPaymentOptions')) {
            try {
                // Reusable function to simulate an unstoppable human click
                const triggerClick = (el) => {
                    if (!el) return;
                    el.click(); // Standard click
                    // Fire Native DOM Events to bypass Angular ignores
                    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
                    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
                    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                };

                // 1. Find all potential interactive containers on the page
                const allContainers = Array.from(document.querySelectorAll('[tabindex="0"], .link, .bank-type'));
                
                // 2. Identify the Tab
                const tab = allContainers.find(el => {
                    const txt = (el.textContent || "").toUpperCase();
                    return txt.includes('BHIM') && txt.includes('UPI') && txt.includes('USSD');
                });

                // 3. Identify the Paytm Option Box
                const paytmOption = allContainers.find(el => {
                    const txt = (el.textContent || "").toUpperCase();
                    return txt.includes('PAY USING BHIM') && txt.includes('PAYTM');
                });

                // 4. Verify Selection States from IRCTC HTML
                const isTabOpen = tab && (tab.classList.contains('bank-type-active') || tab.classList.contains('active'));
                
                // When selected, IRCTC adds 'dull-back' class and an `.fa-check-circle` orange checkmark
                const isOptionSelected = paytmOption && (
                    paytmOption.classList.contains('dull-back') || 
                    paytmOption.querySelector('.fa-check-circle') || 
                    paytmOption.querySelector('.bank-checked')
                );

                // ACTION A: Open the Tab
                if (tab && !isTabOpen && !paytmOption) {
                    if (tab.dataset.clicked !== 'true') {
                        console.log("IRCTC Pro: Opening BHIM/UPI/USSD Tab!");
                        tab.dataset.clicked = 'true';
                        triggerClick(tab);
                    }
                    return; // Wait for options to render
                }

                // ACTION B: Select the Paytm Option
                if (paytmOption && !isOptionSelected) {
                    if (paytmOption.dataset.clicked !== 'true') {
                        console.log("IRCTC Pro: Force-Clicking PAYTM Option Container!");
                        paytmOption.dataset.clicked = 'true';
                        triggerClick(paytmOption);
                    }
                    return; // Wait for IRCTC to confirm selection (orange checkmark)
                }

                // ACTION C: Pay & Book (Only triggers AFTER selection is confirmed by the checkmark)
                if (isOptionSelected && settings.autoPayBook) {
                    const finalBtn = Array.from(document.querySelectorAll('button')).find(b => 
                        (b.textContent || "").toUpperCase().includes('PAY & BOOK') && 
                        !b.classList.contains('hidden-xs') // Desktop vs Mobile safety
                    ) || Array.from(document.querySelectorAll('button')).find(b => 
                        (b.textContent || "").toUpperCase().includes('PAY & BOOK')
                    );
                    
                    if (finalBtn && finalBtn.dataset.clicked !== 'true') {
                        console.log("IRCTC Pro: Payment Method Selected ✅ Clicking 'Pay & Book'!");
                        finalBtn.dataset.clicked = 'true';
                        
                        // Wait 800ms to mimic human reflex and ensure Angular state is stable
                        setTimeout(() => triggerClick(finalBtn), 800);
                    }
                }
            } catch (error) {
                console.error("IRCTC Payment Module Error:", error);
            }
        }
    });
  }

  // --- MODULE 4: AUTO-CAPTCHA SOLVER ---
  function handleCaptcha() {
    if (!chrome.runtime?.id) return;
    const img = document.querySelector('.captcha-img, #captcha-img');
    const input = document.querySelector('#captcha, .captcha-input');
    
    // Only solve if input is empty and we haven't already tried solving THIS image
    if (img && input && input.value === "" && img.dataset.solving !== img.src) {
        img.dataset.solving = img.src; // Mark this specific image as "in-progress"
        console.log("IRCTC Helper: New Captcha detected! Solving...");

        chrome.runtime.sendMessage({ action: "get_captcha_text", url: img.src }, (resp) => {
            if (resp && resp.text) {
                setNativeValue(input, resp.text);
                console.log(`IRCTC Helper: Captcha Solved -> ${resp.text}`);
                // Don't clear solving state so we don't resolve the same image twice
            } else {
                img.dataset.solving = ""; // Allow retry if it failed
            }
        });
    }
  }

  // --- MASTER TICKER ---
  setInterval(() => {
    handleHomeSearch();
    handlePassengerDetails();
    handleOtherPages();
    handleCaptcha();
  }, 500);

  // Captcha Listener
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "solve_captcha") {
       const img = document.querySelector('#captcha-img, .captcha-img');
       if (img) {
         chrome.runtime.sendMessage({ action: "get_captcha_text", url: img.src }, (resp) => {
            if (resp && resp.text) setNativeValue(document.querySelector('#captcha, .captcha-input'), resp.text);
         });
       }
    }
  });
})();
