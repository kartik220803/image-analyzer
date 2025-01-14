# Imagga Image Analyzer

This application allows users to upload images and get AI-powered tags and categories using the Imagga API.

## Setup Instructions

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```
3. Downlod the key file, containing credentials of Google Cloud Vision API in json format, and rename it to `google-credentials.json`

4. Create a `.env` file in the backend directory and add a variable:
   ```
   GOOGLE_APPLICATION_CREDENTIALS= ./google-credentials.json
   ```

5. Start the backend server:
   ```bash
   npm run dev
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the frontend development server:
   ```bash
   npm start
   ```

The application should now be running at http://localhost:3000

## Features

- Image upload with preview
- Real-time image analysis using GCV API
- Display of tags with confidence scores
- Authentication System Using MongoDB Database
- Modern, responsive UI with Tailwind CSS

## Tech Stack

- Backend: Node.js, Express
- Frontend: React, Tailwind CSS
- API: Google Clous Vision API
