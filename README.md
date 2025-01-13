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

3. Create a `.env` file in the backend directory and add your Imagga API credentials:
   ```
   IMAGGA_API_KEY=your_api_key_here
   IMAGGA_API_SECRET=your_api_secret_here
   PORT=5000
   ```

4. Start the backend server:
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
- Real-time image analysis using Imagga API
- Display of tags with confidence scores
- Modern, responsive UI with Tailwind CSS

## Tech Stack

- Backend: Node.js, Express
- Frontend: React, Tailwind CSS
- API: Imagga Image Recognition API
