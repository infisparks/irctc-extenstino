chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "solve_captcha" && request.base64) {
    const formData = new URLSearchParams();
    formData.append("base64Image", request.base64);
    formData.append("language", "eng");
    formData.append("OCREngine", "2"); // Engine 2 is fast and good for alphanumerics

    fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      headers: {
        "apikey": "helloworld", // Free API key
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: formData.toString()
    })
    .then(res => res.json())
    .then(data => {
      if (data && data.ParsedResults && data.ParsedResults.length > 0) {
        let text = data.ParsedResults[0].ParsedText || "";
        // Clean up text: IRCTC captchas are alphanumeric, usually no spaces
        text = text.replace(/[^a-zA-Z0-9=]/g, '').trim();
        sendResponse({ success: true, text: text });
      } else {
        sendResponse({ success: false, error: "No text found" });
      }
    })
    .catch(error => {
      sendResponse({ success: false, error: error.message });
    });

    return true; // Important: tells Chrome we will sendResponse asynchronously
  }
});
