const base64 = "data:image/jpg;base64,iVBORw0KGgoAAAANSUhEUgAAAMsAAAAyCAYAAADyZi/iAAADnElEQVR42u2cPWgUQRSAgxwWEoRwBBGLg5BaDoJYBBEhSLCysQpy2IgECYcIIkEkHDZWEkSwCMEiBMQqWNhI6kCQkEJECCJBLAQRsZAQ0D1cUR9v/25n5k3w+2C53O28t2+H/e52d2YzNAQAAAAAAAAAAAAAAABB+SHwnSdZtSGa3na0H/Mi74aL/RC0KuYay0t2EOtBlrCyXBVNdxztx47Ie82DLAsVc/U8yxK8HmQJK8uRZNkTzc/U3IezIt/3ZBn2IMtuxVy7nmUJXg+yBJQlbbskmi/X3IdlkW/J1X4kfBHvp0rmOS/ivjqSxbQeZAkvy6Rovlfjl2DY5S+VcnA+FO+flszzTMQtOpLFtB5kCSxL2v6NCJkdcLuzIs9bl/2R0FbEbhbkaCbLvoibcCSLaT3IYiPLTRGyOeB2N0WeW677I3nZEh93C3J0RfvtQfs6tnqQxUaWUeXbrl1xmydFfD/fMQ+yqAdbTo5t0X7OsSxm9SCLgSxpzJo8j664zQcifs1HfyQvI8p10URG/Kms0ySHspjVgyx2skyLsM/J0igZ21DuDF3w1R/Jn6vyQjsj/pFot1qzj6KqB1nsZDmk3Pu/XDJ2RsR96OfzKMuUcuu1oQj8LevWrmNZTOpBFiNZ0jg5qrxeMu6liLvnuz+St+/F6o5Y38kbNHQpi1U9yOKBCtsfV8LHCmJaSsx4AFlyxVYEvutZluD1IIuhLGkN6yK8V9B+YZBfIwcHZytL7IxJii3PsgSvB1nsZelUmfOknH5cCXVaqnxb98qeTrqWxaIeZDG8Zsm5szWd0Va7sD0cUBZVbOVGxUwgWYLWgyzGsqTxi2XGTPpzoeqMzTg4ODWx7yuTHRuBZAlaD7LEIUtbGY0fFW2adUf9XeyHMplxv4zAPmQJXQ+yRCBLmuOVSHNDrK80zcOjLO2CS7Z2YFmC1YMs8chyXaR5Ldarc5ws+kOp5TdbLvsotnqQJR5ZtGdTJtN1p5U5TkcNZelmHJxzRrIEqQdZIpElzfNEe+oxeX0sPl+x7I+MyYy5AnuWJUg9yBKXLNrz9CPKHKdz1v2hTGZccd1HsdWDLBHJkuaS/6lFjvC/i70/LGSJaV+RJZws8wV3d+4gC7Igy69cx5Wxgr/HEE4gC7Igy598zzNkeXEQ+gNZkCWkLBczZLmELMiCLP/m6z9F+VGk/eTiaUhkQRYAAAAAAAAAAAAAAAAAAAAAAAAAgP+Sn64JUxzMSyeBAAAAAElFTkSuQmCC";

fetch("https://api.ocr.space/parse/image", {
  method: "POST",
  headers: {
    "apikey": "helloworld",
    "Content-Type": "application/x-www-form-urlencoded"
  },
  body: new URLSearchParams({
    base64Image: base64,
    language: "eng",
    OCREngine: "2"
  })
}).then(res => res.json()).then(data => {
   console.log(JSON.stringify(data, null, 2));
});
