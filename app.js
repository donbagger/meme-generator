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
    res.render('meme', { memeImages, galleryImages: req.galleryImages });
});

app.post('/generate', upload.single('customImage'), async (req, res) => {
    const topText = req.body.topText.toUpperCase();
    const bottomText = req.body.bottomText.toUpperCase();
    const selectedImage = req.file ? await Jimp.read(req.file.buffer) : await Jimp.read(`public${req.body.memeImage}`);

    try {
        selectedImage.resize(768, Jimp.AUTO);

        // Load fonts from `public/fonts` directory
        const fontWhite = await Jimp.loadFont(path.join(__dirname, 'public/fonts/open-sans-64-white.fnt'));
        const fontBlack = await Jimp.loadFont(path.join(__dirname, 'public/fonts/open-sans-64-black.fnt'));

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
        printTextWithOutline(selectedImage, fontWhite, fontBlack, topText, 0, 50, selectedImage.bitmap.width, selectedImage.bitmap.height);
        printTextWithOutline(selectedImage, fontWhite, fontBlack, bottomText, 0, selectedImage.bitmap.height - 125, selectedImage.bitmap.width, selectedImage.bitmap.height);

        // Create an in-memory output path for the generated meme
        const outputBuffer = await selectedImage.getBufferAsync(Jimp.MIME_PNG);

        // Send the meme directly as a base64-encoded image in the response
        const base64Image = outputBuffer.toString('base64');
        const dataUrl = `data:image/png;base64,${base64Image}`;

        // Render the template with the generated meme as a Data URL
        res.render('meme', {
            memeImages: ['/templates/meme1.jpg', '/templates/meme2.jpg', '/templates/meme3.jpg', '/templates/meme4.jpg', '/templates/meme5.jpg'],
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
