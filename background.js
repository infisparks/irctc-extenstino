// Professional IRCTC Captcha Solver - High Stability Version
const OCR_CONFIG = {
  apiKey: "K84095424388957",
  timeout: 4500
};

// --- HELPER 1: IMAGE CLEANER (Pre-Processing) ---
async function cleanCaptchaImage(imageUrl) {
  return new Promise((resolve, reject) => {
    // We use OffscreenCanvas for Background Service Workers
    const canvas = new OffscreenCanvas(200, 60); 
    const ctx = canvas.getContext('2d');
    
    // We fetch the image as a Blob first to avoid CORS issues
    fetch(imageUrl)
      .then(response => response.blob())
      .then(blob => createImageBitmap(blob))
      .then(imgBitmap => {
        ctx.drawImage(imgBitmap, 0, 0);
        
        // Thresholding: Make it pure Black & White (Removes Noise)
        let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          let avg = (data[i] + data[i+1] + data[i+2]) / 3;
          let val = avg > 160 ? 255 : 0; // Threshold logic
          data[i] = data[i+1] = data[i+2] = val;
        }
        ctx.putImageData(imageData, 0, 0);
        
        canvas.convertToBlob().then(blob => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result); // Base64
          reader.readAsDataURL(blob);
        });
      })
      .catch(reject);
  });
}

// --- ENGINE: API SOLVER (OCR.space) ---
async function solveRemote(base64Image, engine = 2) {
  try {
    const formData = new FormData();
    formData.append("base64Image", base64Image);
    formData.append("apikey", OCR_CONFIG.apiKey);
    formData.append("OCREngine", engine);
    formData.append("scale", "true");

    const response = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      body: formData
    });

    const data = await response.json();
    if (data.ParsedResults && data.ParsedResults[0]) {
      // PROTECT @, =, and + characters
      const text = data.ParsedResults[0].ParsedText.replace(/[^A-Za-z0-9@=+]/g, "").trim();
      console.log(`IRCTC Captcha: Solved (${engine}) -> ${text}`);
      return text;
    }
    return null;
  } catch (err) {
    console.error(`IRCTC Captcha: Engine ${engine} failed.`);
    return null;
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "get_captcha_text") {
    (async () => {
      try {
        console.log("IRCTC Captcha: Cleaning image and solving...");
        const cleanImage = await cleanCaptchaImage(request.url).catch(() => request.url);

        // Race two engines for speed
        const results = await Promise.race([
          solveRemote(cleanImage, 2),
          new Promise((resolve) => setTimeout(() => resolve(null), OCR_CONFIG.timeout))
        ]);

        if (results && results.length >= 4) {
          sendResponse({ text: results });
        } else {
          // Fallback if race timed out
          const retry = await solveRemote(cleanImage, 1);
          sendResponse({ text: retry });
        }
      } catch (e) {
         console.error("Captcha Solve Error:", e);
         sendResponse({ text: "" });
      }
    })();
    return true; // Keep channel open
  }
});
