const express = require('express');
const { engine } = require('express-handlebars');
const path = require('path');
const multer = require('multer');
const Jimp = require('jimp');
const fs = require('fs');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

app.engine('hbs', engine({ extname: '.hbs' }));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

const PORT = process.env.PORT || 3000;

// Middleware: Log the HTTP method and URL of each incoming request
app.use((req, res, next) => {
  console.log(`${req.method} request for '${req.url}'`);
  next();
});

// Middleware to load the gallery images
app.use((req, res, next) => {
    fs.readdir('public/outputs', (err, files) => {
      if (err) {
        console.error("Error reading outputs directory:", err);
        req.galleryImages = [];
      } else {
        // Sort files by modification time (oldest to newest)
        const sortedFiles = files
          .map(file => ({
            name: file,
            time: fs.statSync(`public/outputs/${file}`).mtime.getTime()
          }))
          .sort((a, b) => a.time - b.time);
  
        // Exclude the oldest and keep the next 9 newest files
        req.galleryImages = sortedFiles.slice(-9).map(file => `/outputs/${file.name}`);
      }
      next(); // Continue to the next middleware or route
    });
  });

  const storage = multer.memoryStorage();
  const upload = multer({ storage });

app.get('/', (req, res) => {
  const memeImages = ['/templates/meme1.jpg', '/templates/meme2.jpg', '/templates/meme3.jpg', '/templates/meme4.jpg', '/templates/meme5.jpg'];
  // Using req.galleryImages, which is loaded by the gallery-loading middleware
  res.render('meme', { memeImages, galleryImages: req.galleryImages });
});

app.post('/generate', upload.single('customImage'), async (req, res) => {
  const topText = req.body.topText.toUpperCase();
  const bottomText = req.body.bottomText.toUpperCase();
  const selectedImage = req.file ? req.file.buffer : `public${req.body.memeImage}`;

  try {
    // Load the image from buffer if it's uploaded; otherwise, use the selected template
    const image = await Jimp.read(req.file ? selectedImage : selectedImage);
    image.resize(768, Jimp.AUTO);

    const fontWhite = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
    const fontBlack = await Jimp.loadFont(Jimp.FONT_SANS_64_BLACK);

    // Function to print text with an outline
    function printTextWithOutline(image, fontWhite, fontBlack, text, x, y, width, height) {
      image.print(fontBlack, x - 3, y - 3, { text, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, width, height);
      image.print(fontBlack, x + 3, y - 3, { text, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, width, height);
      image.print(fontBlack, x - 3, y + 3, { text, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, width, height);
      image.print(fontBlack, x + 3, y + 3, { text, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, width, height);
      image.print(fontBlack, x, y - 3, { text, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, width, height);
      image.print(fontBlack, x, y + 3, { text, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, width, height);
      image.print(fontBlack, x - 3, y, { text, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, width, height);
      image.print(fontBlack, x + 3, y, { text, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, width, height);

      image.print(fontWhite, x, y, { text, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, width, height);
    }

    // Add top and bottom text with outline
    printTextWithOutline(image, fontWhite, fontBlack, topText, 0, 50, image.bitmap.width, image.bitmap.height);
    printTextWithOutline(image, fontWhite, fontBlack, bottomText, 0, image.bitmap.height - 125, image.bitmap.width, image.bitmap.height);

    // Create an in-memory output path for the generated meme
    const outputBuffer = await image.getBufferAsync(Jimp.MIME_PNG);

    // Send the meme directly as a base64-encoded image in the response
    const base64Image = outputBuffer.toString('base64');
    const dataUrl = `data:image/png;base64,${base64Image}`;

    // Render the template with the generated meme as a Data URL
    res.render('meme', {
      memeImages: ['/templates/meme1.jpg', '/templates/meme2.jpg', '/templates/meme3.jpg', '/templates/meme4.jpg', '/templates/meme5.jpg', ],
      generatedMeme: dataUrl,
      galleryImages: req.galleryImages
    });
  } catch (err) {
    res.status(500).send("Error generating meme: " + err.message);
  }
});


app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
