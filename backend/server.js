require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const vision = require('@google-cloud/vision');
const axios = require('axios');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Analysis = require('./models/Analysis');
const { Storage } = require('@google-cloud/storage');

// Initialize Google Cloud Storage
const storage = new Storage({
    keyFilename: process.env.GOOGLE_STORAGE_CREDENTIALS,
    projectId: process.env.GOOGLE_PROJECT_ID
});

const bucketName = process.env.GOOGLE_STORAGE_BUCKET;
const bucket = storage.bucket(bucketName);

// Configure multer for memory storage
const multerStorage = multer.memoryStorage();
const upload = multer({ storage: multerStorage });

const app = express();

app.use(cors());
app.use(express.json());

// Helper function to upload file to Google Cloud Storage
const uploadToGCS = async (file) => {
    const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    const blob = bucket.file(fileName);
    const blobStream = blob.createWriteStream({
        resumable: false,
        metadata: {
            contentType: file.mimetype
        }
    });

    return new Promise((resolve, reject) => {
        blobStream.on('error', (err) => reject(err));
        blobStream.on('finish', async () => {
            // Make the file public
            await blob.makePublic();
            const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
            resolve(publicUrl);
        });
        blobStream.end(file.buffer);
    });
};

// MongoDB Connection
mongoose.connect(process.env.MONGODB_CONNECTION_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB');
}).catch(err => {
    console.error('MongoDB connection error:', err);
});

// JWT Secret
// const JWT_SECRET = 'your-secret-key'; // In production, use environment variable

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(400).json({ error: 'Invalid token.' });
    }
};

// Auth Middleware
const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) {
            req.user = null;
            return next();
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        
        if (!user) {
            req.user = null;
            return next();
        }

        req.user = user;
        next();
    } catch (error) {
        req.user = null;
        next();
    }
};

// Auth Routes
app.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        // Check if username exists
        const existingUsername = await User.findOne({ username });
        if (existingUsername) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        // Check if email exists
        const existingEmail = await User.findOne({ email });
        if (existingEmail) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        const user = new User({ username, email, password });
        await user.save();
        
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
        res.status(201).json({
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email
            }
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const user = await User.findOne({ username });
        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ 
                error: 'Invalid username or password' 
            });
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
        
        res.json({
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email
            }
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Creates a client
const client = new vision.ImageAnnotatorClient({
    keyFilename: process.env.GOOGLE_VISION_CREDENTIALS
});

async function analyzeImage(imageBuffer) {
    try {
        // Create a request object with the image and required features
        const request = {
            image: {
                content: imageBuffer.toString('base64')
            },
            features: [
                {
                    type: 'LABEL_DETECTION',
                    maxResults: 10
                },
                {
                    type: 'OBJECT_LOCALIZATION',
                    maxResults: 10
                },
                {
                    type: 'FACE_DETECTION',
                    maxResults: 10
                },
                {
                    type: 'TEXT_DETECTION',
                    maxResults: 10
                }
            ]
        };

        // Call the Vision API
        const [result] = await client.annotateImage(request);
        
        // Process and format the results
        const processedResults = {
            labels: result.labelAnnotations?.map(label => ({
                description: label.description,
                score: (label.score * 100).toFixed(2)
            })) || [],
            objects: result.localizedObjectAnnotations?.map(obj => ({
                name: obj.name,
                confidence: (obj.score * 100).toFixed(2)
            })) || [],
            faces: result.faceAnnotations?.map(face => ({
                joy: face.joyLikelihood,
                sorrow: face.sorrowLikelihood,
                anger: face.angerLikelihood,
                surprise: face.surpriseLikelihood
            })) || [],
            text: result.textAnnotations?.[0]?.description || ''
        };

        return processedResults;
    } catch (error) {
        console.error('Vision API Error:', error);
        throw new Error(`Failed to analyze image: ${error.message}`);
    }
}

// Apply auth middleware to routes that need user context
app.post('/upload', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        let imageUrl;
        let imageBuffer;
        
        if (req.file) {
            // Upload to Google Cloud Storage
            imageUrl = await uploadToGCS(req.file);
            imageBuffer = req.file.buffer;
        } else if (req.body.url) {
            // If URL was provided
            imageUrl = req.body.url;
            const response = await axios.get(imageUrl, {
                responseType: 'arraybuffer'
            });
            imageBuffer = Buffer.from(response.data);
            
            // Upload the URL image to Google Cloud Storage as well
            const file = {
                originalname: `url-image-${Date.now()}.jpg`,
                buffer: imageBuffer,
                mimetype: 'image/jpeg'
            };
            imageUrl = await uploadToGCS(file);
        } else {
            return res.status(400).json({ error: 'No image provided' });
        }

        // Analyze the image
        const results = await analyzeImage(imageBuffer);

        // Save the analysis to history
        if (req.user) {
            const analysis = new Analysis({
                userId: req.user.id,
                imageUrl: imageUrl,
                results: results,
                createdAt: new Date()
            });
            await analysis.save();
        }

        res.json(results);
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get user's analysis history
app.get('/history', authenticateToken, async (req, res) => {
    try {
        const analyses = await Analysis.find({ userId: req.user.id })
            .sort({ createdAt: -1 }) // Sort by newest first
            .limit(20); // Limit to last 20 analyses
        res.json(analyses);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching history' });
    }
});

// Save analysis
app.post('/save-analysis', authenticateToken, async (req, res) => {
    try {
        const analysis = new Analysis({
            userId: req.user.id,
            imageUrl: req.body.imageUrl,
            results: req.body.results,
            isSaved: true
        });
        await analysis.save();
        res.status(201).json(analysis);
    } catch (error) {
        res.status(500).json({ error: 'Error saving analysis' });
    }
});

// Toggle save status
app.post('/toggle-save/:id', authenticateToken, async (req, res) => {
    try {
        const analysis = await Analysis.findOne({ _id: req.params.id, userId: req.user.id });
        if (!analysis) {
            return res.status(404).json({ error: 'Analysis not found' });
        }
        analysis.isSaved = !analysis.isSaved;
        await analysis.save();
        res.json(analysis);
    } catch (error) {
        res.status(500).json({ error: 'Error updating analysis' });
    }
});

// Get saved analyses
app.get('/saved', authenticateToken, async (req, res) => {
    try {
        const savedAnalyses = await Analysis.find({ 
            userId: req.user.id,
            isSaved: true 
        }).sort({ createdAt: -1 });
        res.json(savedAnalyses);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching saved analyses' });
    }
});

// Get user's analysis history
app.get('/history', auth, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Please log in to view history' });
        }

        const history = await Analysis.find({ userId: req.user._id })
            .sort({ createdAt: -1 });
        res.json(history);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

// Get user's saved analyses
app.get('/saved', auth, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Please log in to view saved items' });
        }

        const saved = await Analysis.find({ 
            userId: req.user._id,
            isSaved: true 
        }).sort({ createdAt: -1 });
        res.json(saved);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch saved analyses' });
    }
});

// Toggle save status
app.post('/toggle-save/:id', auth, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Please log in to save analyses' });
        }

        const analysis = await Analysis.findOne({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!analysis) {
            return res.status(404).json({ error: 'Analysis not found' });
        }

        analysis.isSaved = !analysis.isSaved;
        await analysis.save();
        res.json(analysis);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update save status' });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
