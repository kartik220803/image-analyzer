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
    credentials: JSON.parse(process.env.GOOGLE_STORAGE_CREDENTIALS),
    projectId: process.env.GOOGLE_PROJECT_ID
});

const bucketName = process.env.GOOGLE_STORAGE_BUCKET;
const bucket = storage.bucket(bucketName);

// Initialize Vision API client
const client = new vision.ImageAnnotatorClient({
    credentials: JSON.parse(process.env.GOOGLE_VISION_CREDENTIALS),
    projectId: process.env.GOOGLE_PROJECT_ID
});

// Configure multer for memory storage
const multerStorage = multer.memoryStorage();
const upload = multer({ storage: multerStorage });

const app = express();

// Configure CORS
app.use(cors({
    origin: ['https://image-analyzer-mu.vercel.app', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Helper function to upload file to Google Cloud Storage
const uploadToGCS = async (file) => {
    try {
        console.log('Starting GCS upload for file:', file.originalname);
        const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
        console.log('Generated filename:', fileName);
        
        const blob = bucket.file(fileName);
        const blobStream = blob.createWriteStream({
            resumable: false,
            metadata: {
                contentType: file.mimetype
            }
        });

        return new Promise((resolve, reject) => {
            blobStream.on('error', (err) => {
                console.error('Blob stream error:', err);
                reject(new Error(`Failed to upload to Google Cloud Storage: ${err.message}`));
            });
            
            blobStream.on('finish', async () => {
                try {
                    console.log('Upload finished, generating public URL...');
                    // With uniform bucket-level access, we don't need to make individual files public
                    // Just construct the public URL directly
                    const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
                    console.log('File uploaded successfully, URL:', publicUrl);
                    resolve(publicUrl);
                } catch (error) {
                    console.error('Error generating public URL:', error);
                    reject(new Error(`Failed to generate public URL: ${error.message}`));
                }
            });

            console.log('Writing file buffer to blob stream...');
            blobStream.end(file.buffer);
        });
    } catch (error) {
        console.error('Error in uploadToGCS:', error);
        throw new Error(`Failed to initialize upload: ${error.message}`);
    }
};

// Helper function to delete old analyses
const cleanupOldAnalyses = async (userId) => {
    try {
        // Get all analyses for the user, sorted by date
        const analyses = await Analysis.find({ userId }).sort({ createdAt: -1 });
        
        // If we have more than 10 analyses, delete the older ones
        if (analyses.length > 10) {
            const analysesToDelete = analyses.slice(10);
            
            // Delete old images from Google Cloud Storage
            for (const analysis of analysesToDelete) {
                if (analysis.imageUrl) {
                    try {
                        const fileName = analysis.imageUrl.split('/').pop();
                        const file = bucket.file(fileName);
                        await file.delete();
                    } catch (error) {
                        console.error('Error deleting file from GCS:', error);
                    }
                }
            }
            
            // Delete old analyses from MongoDB
            await Analysis.deleteMany({
                userId,
                _id: { $in: analysesToDelete.map(a => a._id) }
            });
        }
    } catch (error) {
        console.error('Error cleaning up old analyses:', error);
    }
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
                },
                {
                    type: 'WEB_DETECTION',
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
                confidence: (label.score * 100).toFixed(2)
            })) || [],
            objects: result.localizedObjectAnnotations?.map(obj => ({
                name: obj.name,
                confidence: (obj.score * 100).toFixed(2)
            })) || [],
            faces: result.faceAnnotations?.map(face => ({
                joy: face.joyLikelihood,
                sorrow: face.sorrowLikelihood,
                anger: face.angerLikelihood,
                surprise: face.surpriseLikelihood,
                confidence: 100 // Face detection doesn't provide a confidence score
            })) || [],
            text: result.textAnnotations?.[0]?.description || '',
            webEntities: result.webDetection?.webEntities?.map(entity => ({
                description: entity.description,
                confidence: (entity.score * 100).toFixed(2)
            })) || []
        };

        return processedResults;
    } catch (error) {
        console.error('Vision API Error:', error);
        throw new Error(`Failed to analyze image: ${error.message}`);
    }
}

// Anonymous image analysis endpoint
app.post('/analyze-anonymous', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        let imageUrl;
        try {
            imageUrl = await uploadToGCS(req.file);
        } catch (error) {
            console.error('Error uploading to GCS:', error);
            return res.status(500).json({ error: 'Failed to upload image' });
        }

        // Analyze the image
        const results = await analyzeImage(req.file.buffer);
        
        return res.json({
            success: true,
            imageUrl,
            results
        });
    } catch (error) {
        console.error('Error in anonymous analysis:', error);
        res.status(500).json({ error: error.message });
    }
});

// Apply auth middleware to routes that need user context
app.post('/upload', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        let imageUrl;
        try {
            imageUrl = await uploadToGCS(req.file);
        } catch (error) {
            console.error('Error uploading to GCS:', error);
            return res.status(500).json({ error: 'Failed to upload image' });
        }

        // Analyze the image
        const results = await analyzeImage(req.file.buffer);

        // Create new analysis document
        const analysis = new Analysis({
            userId: req.user.id,
            imageUrl,
            results,
            isSaved: true
        });
        await analysis.save();

        // Clean up old analyses
        await cleanupOldAnalyses(req.user.id);

        return res.json(results);
    } catch (error) {
        console.error('Error in upload:', error);
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

// URL-based image analysis endpoint
app.post('/analyze-url', async (req, res) => {
    try {
        const { imageUrl } = req.body;
        
        if (!imageUrl) {
            return res.status(400).json({ error: 'No image URL provided' });
        }

        // Download the image
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const imageBuffer = Buffer.from(response.data);

        // Analyze the image
        const results = await analyzeImage(imageBuffer);

        // If user is authenticated, save the analysis
        if (req.user) {
            const analysis = new Analysis({
                userId: req.user.id,
                imageUrl,
                results,
                isSaved: true
            });
            await analysis.save();
            await cleanupOldAnalyses(req.user.id);
        }
        
        return res.json({
            success: true,
            imageUrl,
            results
        });
    } catch (error) {
        console.error('Error in URL analysis:', error);
        res.status(500).json({ error: error.message });
    }
});

// Check username availability
app.get('/check-username/:username', async (req, res) => {
    try {
        const username = req.params.username;
        const existingUser = await User.findOne({ username });
        res.json({ available: !existingUser });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update username
app.post('/update-username', authenticateToken, async (req, res) => {
    try {
        const { newUsername, password } = req.body;
        const user = await User.findById(req.user.id);

        // Verify password
        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ error: 'Invalid password' });
        }

        // Check if new username is available
        const existingUser = await User.findOne({ username: newUsername });
        if (existingUser) {
            return res.status(400).json({ error: 'Username already taken' });
        }

        // Update username
        user.username = newUsername;
        await user.save();

        res.json({
            message: 'Username updated successfully',
            user: {
                id: user._id,
                username: user.username,
                email: user.email
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update password
app.post('/update-password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.user.id);

        // Verify current password
        if (!user || !(await user.comparePassword(currentPassword))) {
            return res.status(401).json({ error: 'Invalid current password' });
        }

        // Update password
        user.password = newPassword;
        await user.save();

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
