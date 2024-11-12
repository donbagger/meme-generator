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

const storage = multer.diskStorage({
  destination: './public/uploads',
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

app.get('/', (req, res) => {
  const memeImages = ['/templates/meme1.jpg', '/templates/meme2.jpg', '/templates/meme3.jpg', '/templates/meme4.jpg', '/templates/meme5.jpg'];
  // Using req.galleryImages, which is loaded by the gallery-loading middleware
  res.render('meme', { memeImages, galleryImages: req.galleryImages });
});

app.post('/generate', upload.single('customImage'), async (req, res) => {
  const topText = req.body.topText.toUpperCase();
  const bottomText = req.body.bottomText.toUpperCase();
  const uploadedImagePath = req.file ? `/uploads/${req.file.filename}` : null;
  const selectedImage = uploadedImagePath || req.body.memeImage;

  try {
    const image = await Jimp.read(`public${selectedImage}`);
    image.resize(768, Jimp.AUTO);
    const fontWhite = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
    const fontBlack = await Jimp.loadFont(Jimp.FONT_SANS_64_BLACK);

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

    printTextWithOutline(image, fontWhite, fontBlack, topText, 0, 50, image.bitmap.width, image.bitmap.height);
    printTextWithOutline(image, fontWhite, fontBlack, bottomText, 0, image.bitmap.height - 125, image.bitmap.width, image.bitmap.height);

    const outputPath = `/outputs/meme-${Date.now()}.png`;
    await image.writeAsync(`public${outputPath}`);

    if (uploadedImagePath) {
      fs.unlink(`public${uploadedImagePath}`, (err) => {
        if (err) console.error("Error deleting uploaded image:", err);
      });
    }

    fs.readdir('public/outputs', (err, files) => {
      if (err) {
        console.error("Error reading outputs directory:", err);
      } else {
        const memeFiles = files
          .map(file => ({ name: file, time: fs.statSync(`public/outputs/${file}`).mtime.getTime() }))
          .sort((a, b) => a.time - b.time);
          

        if (memeFiles.length > 10) {
          const filesToDelete = memeFiles.slice(0, memeFiles.length - 10);
          filesToDelete.forEach(file => {
            fs.unlink(`public/outputs/${file.name}`, (err) => {
              if (err) console.error("Error deleting old meme file:", err);
            });
          });
        }
      }
    });

    res.render('meme', { memeImages: ['/templates/meme1.jpg', '/templates/meme2.jpg', '/templates/meme3.jpg'], generatedMeme: outputPath, galleryImages: req.galleryImages });
  } catch (err) {
    res.status(500).send("Error generating meme: " + err.message);
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
