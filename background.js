chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "solve_captcha" && request.base64) {
    
    // We will race multiple solvers and take the fastest one that works
    chrome.storage.local.get(['ocrApiKey'], (result) => {
      const apikey = result.ocrApiKey || "K84095424388957"; // Use user's private key as default

      const solveWithEngine = (engine) => {
        const formData = new URLSearchParams();
        formData.append("base64Image", request.base64);
        formData.append("language", "eng");
        formData.append("OCREngine", engine);

        return fetch("https://api.ocr.space/parse/image", {
          method: "POST",
          headers: {
            "apikey": apikey,
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: formData.toString()
        }).then(res => res.json());
      };

      // RUN BOTH ENGINES IN PARALLEL
      console.log("IRCTC Helper: Starting Parallel Captcha Solving...");
      
      Promise.all([
        solveWithEngine("2"), // Engine 2 is usually faster
        solveWithEngine("1")  // Engine 1 is sometimes more robust
      ])
      .then(results => {
        // Find the best valid result from the engines
        let finalOutput = null;
        
        results.forEach((data, index) => {
          const engineNum = index === 0 ? "2" : "1";
          if (data && data.ParsedResults && data.ParsedResults.length > 0) {
             let text = data.ParsedResults[0].ParsedText || "";
             text = text.replace(/[^a-zA-Z0-9]/g, '').trim();
             console.log(`IRCTC Helper: Engine ${engineNum} suggested: "${text}"`);
             
             if (text.length >= 3 && !finalOutput) {
               finalOutput = text;
             }
          } else {
            console.warn(`IRCTC Helper: Engine ${engineNum} failed or returned no text.`, data);
          }
        });

        if (finalOutput) {
          console.log(`IRCTC Helper: Decided to use: "${finalOutput}"`);
          sendResponse({ success: true, text: finalOutput });
        } else {
          console.error("IRCTC Helper: Multi-Engine Failure. Both engines returned nothing useful.");
          sendResponse({ success: false, error: "Multi-Engine Failure" });
        }
      })
      .catch(error => {
        console.error("IRCTC Helper: OCR Network Error:", error.message);
        sendResponse({ success: false, error: error.message });
      });
    });

    return true; // Keep the message channel open
  }
});
