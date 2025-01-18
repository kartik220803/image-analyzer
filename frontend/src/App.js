import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

function App() {
    const [file, setFile] = useState(null);
    const [imageUrl, setImageUrl] = useState('');
    const [results, setResults] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState([]);
    const [activeTab, setActiveTab] = useState('home');
    const [showLogin, setShowLogin] = useState(false);
    const [showRegister, setShowRegister] = useState(false);
    const [user, setUser] = useState(null);
    const [loginForm, setLoginForm] = useState({ username: '', password: '' });
    const [registerForm, setRegisterForm] = useState({ username: '', email: '', password: '' });
    const [selectedAnalysis, setSelectedAnalysis] = useState(null);
    const [preview, setPreview] = useState(null);
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

    // Theme effect
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
    };

    // Check for existing token on load
    useEffect(() => {
        const token = localStorage.getItem('token');
        const userData = localStorage.getItem('user');
        if (token && userData) {
            setUser(JSON.parse(userData));
            fetchHistory();
        }
    }, []);

    const fetchHistory = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setError('Please log in to view history');
                return;
            }
            
            const response = await axios.get('https://image-analyzer-b.vercel.app/history', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setHistory(response.data);
        } catch (error) {
            setError('Failed to fetch history');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!file && !imageUrl) {
            setError('Please select an image file or provide an image URL');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const formData = new FormData();
            if (file) {
                formData.append('image', file);
            } else {
                formData.append('url', imageUrl);
            }

            const response = await axios.post('https://image-analyzer-b.vercel.app/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            setResults(response.data);
            if (user) {
                fetchHistory(); // Refresh history after successful upload
            }
        } catch (error) {
            console.error('Upload error:', error);
            setError(error.response?.data?.error || 'Failed to analyze image');
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        setFile(selectedFile);
        setImageUrl('');
        
        if (selectedFile) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreview(reader.result);
            };
            reader.readAsDataURL(selectedFile);
        } else {
            setPreview(null);
        }
    };

    const handleUrlChange = (e) => {
        const url = e.target.value;
        setImageUrl(url);
        setFile(null);
        setPreview(url);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile && droppedFile.type.startsWith('image/')) {
            setFile(droppedFile);
            setImageUrl('');
            
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreview(reader.result);
            };
            reader.readAsDataURL(droppedFile);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const resetAnalysis = () => {
        setFile(null);
        setImageUrl('');
        setResults(null);
        setError(null);
        setPreview(null);
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post('https://image-analyzer-b.vercel.app/login', loginForm);
            const { token, user } = response.data;
            
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));
            
            setUser(user);
            setShowLogin(false);
            setLoginForm({ username: '', password: '' });
            fetchHistory();
        } catch (error) {
            setError(error.response?.data?.error || 'Login failed');
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setError(null);
        try {
            const response = await axios.post('https://image-analyzer-b.vercel.app/register', registerForm);
            const { token, user } = response.data;
            
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));
            
            setUser(user);
            setShowRegister(false);
            setRegisterForm({ username: '', email: '', password: '' });
            fetchHistory();
        } catch (error) {
            setError(error.response?.data?.error || 'Registration failed');
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        setHistory([]);
        setActiveTab('home');
    };

    return (
        <div className="App">
            <header className="header">
                <h1 className="app-title">Vision Analyzer</h1>
                <nav className="nav-links">
                    <button 
                        className={`nav-link ${activeTab === 'home' ? 'active' : ''}`}
                        onClick={() => setActiveTab('home')}
                    >
                        Home
                    </button>
                    <button 
                        className={`nav-link ${activeTab === 'history' ? 'active' : ''}`}
                        onClick={() => {
                            if (!user) {
                                setError('Please log in to view history');
                                setShowLogin(true);
                                return;
                            }
                            setActiveTab('history');
                            fetchHistory();
                        }}
                    >
                        History
                    </button>
                </nav>
                <div className="auth-section">
                    {user ? (
                        <div className="user-info">
                            <span>Welcome, {user.username}!</span>
                            <button className="logout-btn" onClick={handleLogout}>Log Out</button>
                        </div>
                    ) : (
                        <button className="login-btn" onClick={() => setShowLogin(true)}>
                            <span className="login-icon">👤</span>
                            Log In
                        </button>
                    )}
                </div>
                <button onClick={toggleTheme} className="theme-toggle">
                    {theme === 'light' ? '🌙' : '☀️'}
                </button>
            </header>

            {error && <div className="error-message">{error}</div>}

            <main className="main-content">
                {activeTab === 'home' && (
                    <div className="home-container">
                        <div className="upload-section">
                            <h2>Analyze Your Image</h2>
                            <form onSubmit={handleSubmit} className="upload-form">
                                <div className="upload-options">
                                    <div 
                                        className="upload-box"
                                        onDrop={handleDrop}
                                        onDragOver={handleDragOver}
                                    >
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleFileChange}
                                            id="file-input"
                                            className="file-input"
                                        />
                                        <label htmlFor="file-input" className="file-label">
                                            {preview ? (
                                                <img src={preview} alt="Preview" className="upload-preview" />
                                            ) : (
                                                <>
                                                    <span className="upload-icon">📁</span>
                                                    <span>Drag & Drop or Click to Upload</span>
                                                </>
                                            )}
                                        </label>
                                    </div>
                                    <div className="divider">OR</div>
                                    <div className="url-input-container">
                                        <input
                                            type="text"
                                            value={imageUrl}
                                            onChange={handleUrlChange}
                                            placeholder="Enter Image URL"
                                            className="url-input"
                                        />
                                        {imageUrl && (
                                            <div className="url-preview">
                                                <img src={imageUrl} alt="URL Preview" className="upload-preview" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <button 
                                    type="submit" 
                                    className="analyze-btn"
                                    disabled={loading || (!file && !imageUrl)}
                                >
                                    {loading ? 'Analyzing...' : 'Analyze Image'}
                                </button>
                            </form>
                        </div>

                        {results && (
                            <div className="results-container">
                                <h2>Analysis Results</h2>
                                <div className="results-header">
                                    <img src={preview || imageUrl} alt="Analyzed" className="results-image" />
                                </div>
                                <div className="results-content">
                                    {results.labels && (
                                        <div className="result-section">
                                            <h4>Labels</h4>
                                            <ul>
                                                {results.labels.slice(0, 5).map((label, index) => (
                                                    <li key={index}>
                                                        {label.description} ({Math.round(label.confidence)}%)
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {results.objects && (
                                        <div className="result-section">
                                            <h4>Objects</h4>
                                            <ul>
                                                {results.objects.slice(0, 5).map((object, index) => (
                                                    <li key={index}>
                                                        {object.name} ({Math.round(object.confidence)}%)
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {results.faces && (
                                        <div className="result-section">
                                            <h4>Faces</h4>
                                            <ul>
                                                {results.faces.slice(0, 5).map((face, index) => (
                                                    <li key={index}>
                                                        Joy: {face.joy}, Sorrow: {face.sorrow}, Anger: {face.anger}, Surprise: {face.surprise} ({Math.round(face.confidence)}%)
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {results.landmarks && (
                                        <div className="result-section">
                                            <h4>Landmarks</h4>
                                            <ul>
                                                {results.landmarks.slice(0, 5).map((landmark, index) => (
                                                    <li key={index}>
                                                        {landmark.name} ({Math.round(landmark.confidence)}%)
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {results.text && (
                                        <div className="result-section">
                                            <h4>Text Found</h4>
                                            <pre className="whitespace-pre-wrap">{results.text}</pre>
                                        </div>
                                    )}
                                    {results.webEntities && (
                                        <div className="result-section">
                                            <h4>Web Entities</h4>
                                            <ul>
                                                {results.webEntities.slice(0, 5).map((entity, index) => (
                                                    <li key={index}>
                                                        {entity.description} ({Math.round(entity.confidence)}%)
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                                <button 
                                    className="analyze-more-btn"
                                    onClick={resetAnalysis}
                                >
                                    Analyze Another Image
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="history-page">
                        <h2>Analysis History</h2>
                        {!selectedAnalysis ? (
                            <div className="history-grid">
                                {history.map((item) => (
                                    <div 
                                        key={item._id} 
                                        className="history-item"
                                        onClick={() => setSelectedAnalysis(item)}
                                    >
                                        <div className="history-image-container">
                                            <img 
                                                src={item.imageUrl} 
                                                alt="Analyzed" 
                                                className="history-image"
                                                onError={(e) => {
                                                    e.target.onerror = null;
                                                    e.target.src = 'https://via.placeholder.com/300x200?text=Image+Not+Found';
                                                }}
                                            />
                                        </div>
                                        <div className="history-details">
                                            <p className="timestamp">
                                                {new Date(item.createdAt).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="analysis-detail-page">
                                <button 
                                    className="back-btn"
                                    onClick={() => setSelectedAnalysis(null)}
                                >
                                    ← Back to History
                                </button>
                                <div className="analysis-detail">
                                    <img 
                                        src={selectedAnalysis.imageUrl} 
                                        alt="Analyzed" 
                                        className="detail-image"
                                    />
                                    <div className="detail-content">
                                        <h3>Analysis Results</h3>
                                        <p className="timestamp">
                                            Analyzed on: {new Date(selectedAnalysis.createdAt).toLocaleString()}
                                        </p>
                                        {selectedAnalysis.results && Object.entries(selectedAnalysis.results).map(([key, value]) => (
                                            <div key={key} className="result-section">
                                                <h4>{key.charAt(0).toUpperCase() + key.slice(1)}</h4>
                                                {Array.isArray(value) && value.map((item, index) => (
                                                    <div key={index} className="result-item">
                                                        {item.description || item.name} 
                                                        {item.confidence && ` (${Math.round(item.confidence)}%)`}
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Login Modal */}
            {showLogin && (
                <div className="modal">
                    <div className="modal-content">
                        <h2>Welcome Back!</h2>
                        <form onSubmit={handleLogin} className="auth-form">
                            <div className="form-group">
                                <input
                                    type="text"
                                    placeholder="Username"
                                    value={loginForm.username}
                                    onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <input
                                    type="password"
                                    placeholder="Password"
                                    value={loginForm.password}
                                    onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                                    required
                                />
                            </div>
                            <button type="submit" className="auth-submit-btn">
                                Log In
                            </button>
                        </form>
                        <p className="auth-switch">
                            Don't have an account?{' '}
                            <button 
                                className="link-button"
                                onClick={() => {
                                    setShowLogin(false);
                                    setShowRegister(true);
                                }}
                            >
                                Register Now
                            </button>
                        </p>
                        <button 
                            className="close-button"
                            onClick={() => setShowLogin(false)}
                        >
                            ×
                        </button>
                    </div>
                </div>
            )}

            {/* Register Modal */}
            {showRegister && (
                <div className="modal">
                    <div className="modal-content">
                        <h2>Create Account</h2>
                        <form onSubmit={handleRegister} className="auth-form">
                            <div className="form-group">
                                <input
                                    type="text"
                                    placeholder="Username"
                                    value={registerForm.username}
                                    onChange={(e) => setRegisterForm({...registerForm, username: e.target.value})}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <input
                                    type="email"
                                    placeholder="Email"
                                    value={registerForm.email}
                                    onChange={(e) => setRegisterForm({...registerForm, email: e.target.value})}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <input
                                    type="password"
                                    placeholder="Password"
                                    value={registerForm.password}
                                    onChange={(e) => setRegisterForm({...registerForm, password: e.target.value})}
                                    required
                                />
                            </div>
                            <button type="submit" className="auth-submit-btn">
                                Register
                            </button>
                        </form>
                        <p className="auth-switch">
                            Already have an account?{' '}
                            <button 
                                className="link-button"
                                onClick={() => {
                                    setShowRegister(false);
                                    setShowLogin(true);
                                }}
                            >
                                Log In
                            </button>
                        </p>
                        <button 
                            className="close-button"
                            onClick={() => setShowRegister(false)}
                        >
                            ×
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
