const mongoose = require('mongoose');

const analysisSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    imageUrl: {
        type: String,
        required: true
    },
    results: {
        type: Object,
        required: true
    },
    isSaved: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Analysis', analysisSchema);
