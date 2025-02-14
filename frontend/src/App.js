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
    const [showLoginPassword, setShowLoginPassword] = useState(false);
    const [showRegisterPassword, setShowRegisterPassword] = useState(false);
    const [showAccountSettings, setShowAccountSettings] = useState(false);
    const [accountForm, setAccountForm] = useState({
        newUsername: '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
        verifyPassword: ''
    });
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [showVerifyPassword, setShowVerifyPassword] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [urlPreviewLoading, setUrlPreviewLoading] = useState(false);
    const [urlError, setUrlError] = useState('');

    const addNotification = (message, type = 'success') => {
        const id = Date.now();
        setNotifications(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 5000);
    };

    const removeNotification = (id) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

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
            let response;
            
            if (file) {
                // Handle file upload
                const formData = new FormData();
                formData.append('image', file);

                // Use anonymous endpoint if user is not logged in
                const endpoint = user ? 'https://image-analyzer-b.vercel.app/upload' : 'https://image-analyzer-b.vercel.app/analyze-anonymous';
                const headers = {
                    'Content-Type': 'multipart/form-data',
                    ...(user && { 'Authorization': `Bearer ${localStorage.getItem('token')}` })
                };

                response = await axios.post(endpoint, formData, { headers });
            } else {
                // Handle URL-based analysis
                const endpoint = 'https://image-analyzer-b.vercel.app/analyze-url';
                const headers = {
                    'Content-Type': 'application/json',
                    ...(user && { 'Authorization': `Bearer ${localStorage.getItem('token')}` })
                };

                response = await axios.post(endpoint, { imageUrl }, { headers });
            }

            // Handle different response structures
            let analysisResults;
            if (response.data.results) {
                // For anonymous and URL-based analysis
                analysisResults = response.data.results;
            } else {
                // For authenticated file upload
                analysisResults = response.data;
            }
            
            setResults(analysisResults);
            
            if (user) {
                fetchHistory(); // Refresh history after successful upload
            }
        } catch (error) {
            console.error('Analysis error:', error);
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

    const handleUrlChange = async (e) => {
        const url = e.target.value;
        setImageUrl(url);
        setFile(null);
        setUrlError('');

        if (!url) {
            setPreview(null);
            return;
        }

        if (url.match(/\.(jpeg|jpg|gif|png)$/i)) {
            setUrlPreviewLoading(true);
            try {
                const img = new Image();
                img.onload = () => {
                    setPreview(url);
                    setUrlPreviewLoading(false);
                };
                img.onerror = () => {
                    setUrlError('Unable to load image from URL');
                    setPreview(null);
                    setUrlPreviewLoading(false);
                };
                img.src = url;
            } catch (error) {
                setUrlError('Unable to load image from URL');
                setPreview(null);
                setUrlPreviewLoading(false);
            }
        }
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
        setError(null);
        try {
            const response = await axios.post('https://image-analyzer-b.vercel.app/login', loginForm);
            const { token, user } = response.data;
            
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));
            
            setUser(user);
            setShowLogin(false);
            setLoginForm({ username: '', password: '' });
            addNotification('Successfully logged in!');
            fetchHistory();
        } catch (error) {
            addNotification(error.response?.data?.error || 'Login failed', 'error');
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
            addNotification('Successfully registered!');
            fetchHistory();
        } catch (error) {
            addNotification(error.response?.data?.error || 'Registration failed', 'error');
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        setHistory([]);
        setActiveTab('home');
    };

    const handleUpdateUsername = async (e) => {
        e.preventDefault();
        setError(null);
        
        try {
            const checkResponse = await axios.get(`https://image-analyzer-b.vercel.app/check-username/${accountForm.newUsername}`);
            if (!checkResponse.data.available) {
                addNotification('Username is already taken', 'error');
                return;
            }

            const response = await axios.post('https://image-analyzer-b.vercel.app/update-username', {
                newUsername: accountForm.newUsername,
                password: accountForm.verifyPassword
            }, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });

            setUser(response.data.user);
            localStorage.setItem('user', JSON.stringify(response.data.user));
            setAccountForm(prev => ({ ...prev, newUsername: '', verifyPassword: '' }));
            addNotification('Username updated successfully!');
        } catch (error) {
            addNotification(error.response?.data?.error || 'Failed to update username', 'error');
        }
    };

    const handleUpdatePassword = async (e) => {
        e.preventDefault();
        setError(null);

        if (accountForm.newPassword !== accountForm.confirmPassword) {
            addNotification('New passwords do not match', 'error');
            return;
        }

        try {
            await axios.post('https://image-analyzer-b.vercel.app/update-password', {
                currentPassword: accountForm.currentPassword,
                newPassword: accountForm.newPassword
            }, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });

            setAccountForm(prev => ({
                ...prev,
                currentPassword: '',
                newPassword: '',
                confirmPassword: ''
            }));
            addNotification('Password updated successfully!');
        } catch (error) {
            addNotification(error.response?.data?.error || 'Failed to update password', 'error');
        }
    };

    return (
        <div className="app">
            {/* Notification Container */}
            <div className="notification-container">
                {notifications.map(({ id, message, type }) => (
                    <div key={id} className={`notification ${type}`}>
                        <span className="notification-message">{message}</span>
                        <button
                            className="notification-close"
                            onClick={() => removeNotification(id)}
                        >
                            ×
                        </button>
                    </div>
                ))}
            </div>

            <header className="app-header">
                <div className="app-logo">
                    <span className="icon">🔍</span>
                    <span>Vizify</span>
                </div>

                <nav className="nav-links">
                    <button 
                        className={`nav-link ${activeTab === 'home' ? 'active' : ''}`}
                        onClick={() => setActiveTab('home')}
                    >
                        <span className="nav-icon">🏠</span>
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
                        <span className="nav-icon">📊</span>
                        History
                    </button>
                </nav>

                <div className="auth-section">
                    {user ? (
                        <div className="user-info">
                            <span>Welcome, {user.username}!</span>
                            <button className="logout-btn" onClick={handleLogout}>
                                <span className="logout-icon">👋</span>
                                Log Out
                            </button>
                        </div>
                    ) : (
                        <button className="login-btn" onClick={() => setShowLogin(true)}>
                            <span className="login-icon">👤</span>
                            Log In
                        </button>
                    )}
                    <button onClick={toggleTheme} className="theme-toggle">
                        {theme === 'light' ? '🌙' : '☀️'}
                    </button>
                </div>
            </header>

            <main className="main-content">
                {activeTab === 'home' && (
                    <div className="home-container">
                        <div className="upload-section">
                            <h2>Analyze Your Image</h2>
                            <p className="subtitle">Powerful AI-powered image analysis at your fingertips</p>
                            
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
                                                    <span className="upload-icon">📸</span>
                                                    <span className="upload-text">Drag & Drop or Click to Upload</span>
                                                    <span className="upload-subtext">Supports JPG, PNG, GIF</span>
                                                </>
                                            )}
                                        </label>
                                    </div>
                                    
                                    <div className="divider">
                                        <span>OR</span>
                                    </div>
                                    
                                    <div className="url-section">
                                        <div className="url-input-container">
                                            <label htmlFor="url-input" className="url-label">Image URL</label>
                                            <input
                                                id="url-input"
                                                type="text"
                                                value={imageUrl}
                                                onChange={handleUrlChange}
                                                placeholder="Enter Image URL (e.g., https://example.com/image.jpg)"
                                                className="url-input"
                                                autoComplete="off"
                                            />
                                            {urlError && (
                                                <div className="url-error">
                                                    <span className="error-icon">⚠️</span>
                                                    {urlError}
                                                </div>
                                            )}
                                        </div>
                                        
                                        {urlPreviewLoading && (
                                            <div className="url-preview-loading">
                                                <span className="loading-icon">🔄</span>
                                                Loading preview...
                                            </div>
                                        )}
                                        
                                        {imageUrl && !urlError && !urlPreviewLoading && (
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
                                    {loading ? (
                                        <span className="loading-text">
                                            <span className="loading-icon">🔄</span>
                                            Analyzing...
                                        </span>
                                    ) : (
                                        <>
                                            <span className="btn-icon">✨</span>
                                            Analyze Image
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>

                        {error && (
                            <div className="error-container">
                                <span className="error-icon">⚠️</span>
                                <span className="error-message">{error}</span>
                            </div>
                        )}

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
                        <h2>Login</h2>
                        <form onSubmit={handleLogin} className="auth-form">
                            <div className="form-group">
                                <label>Username</label>
                                <input
                                    type="text"
                                    value={loginForm.username}
                                    onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Password</label>
                                <input
                                    type={showLoginPassword ? "text" : "password"}
                                    value={loginForm.password}
                                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                                    required
                                />
                                <button
                                    type="button"
                                    className="password-toggle"
                                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                                >
                                    {showLoginPassword ? "Hide" : "Show"}
                                </button>
                            </div>
                            {error && <div className="error-message">{error}</div>}
                            <button type="submit" className="analyze-btn">Login</button>
                            <p className="auth-switch">
                                Don't have an account?{" "}
                                <button type="button" className="link-button" onClick={() => { setShowLogin(false); setShowRegister(true); setError(null); }}>
                                    Register
                                </button>
                            </p>
                        </form>
                        <button className="close-button" onClick={() => { setShowLogin(false); setError(null); }}>×</button>
                    </div>
                </div>
            )}

            {/* Register Modal */}
            {showRegister && (
                <div className="modal">
                    <div className="modal-content">
                        <h2>Register</h2>
                        <form onSubmit={handleRegister} className="auth-form">
                            <div className="form-group">
                                <label>Username</label>
                                <input
                                    type="text"
                                    value={registerForm.username}
                                    onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Email</label>
                                <input
                                    type="email"
                                    value={registerForm.email}
                                    onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Password</label>
                                <input
                                    type={showRegisterPassword ? "text" : "password"}
                                    value={registerForm.password}
                                    onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                                    required
                                />
                                <button
                                    type="button"
                                    className="password-toggle"
                                    onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                                >
                                    {showRegisterPassword ? "Hide" : "Show"}
                                </button>
                            </div>
                            {error && <div className="error-message">{error}</div>}
                            <button type="submit" className="analyze-btn">Register</button>
                            <p className="auth-switch">
                                Already have an account?{" "}
                                <button type="button" className="link-button" onClick={() => { setShowRegister(false); setShowLogin(true); setError(null); }}>
                                    Login
                                </button>
                            </p>
                        </form>
                        <button className="close-button" onClick={() => { setShowRegister(false); setError(null); }}>×</button>
                    </div>
                </div>
            )}

            {/* Account Settings Modal */}
            {showAccountSettings && (
                <div className="modal">
                    <div className="modal-content">
                        <h2>Account Settings</h2>
                        <div className="settings-section">
                            <h3>Update Username</h3>
                            <form onSubmit={handleUpdateUsername} className="auth-form">
                                <div className="form-group">
                                    <label>New Username</label>
                                    <input
                                        type="text"
                                        value={accountForm.newUsername}
                                        onChange={(e) => setAccountForm(prev => ({ ...prev, newUsername: e.target.value }))}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Verify Password</label>
                                    <input
                                        type={showVerifyPassword ? "text" : "password"}
                                        value={accountForm.verifyPassword}
                                        onChange={(e) => setAccountForm(prev => ({ ...prev, verifyPassword: e.target.value }))}
                                        required
                                    />
                                    <button
                                        type="button"
                                        className="password-toggle"
                                        onClick={() => setShowVerifyPassword(!showVerifyPassword)}
                                    >
                                        {showVerifyPassword ? "Hide" : "Show"}
                                    </button>
                                </div>
                                <button type="submit" className="analyze-btn">Update Username</button>
                            </form>
                        </div>

                        <div className="settings-section">
                            <h3>Update Password</h3>
                            <form onSubmit={handleUpdatePassword} className="auth-form">
                                <div className="form-group">
                                    <label>Current Password</label>
                                    <input
                                        type={showCurrentPassword ? "text" : "password"}
                                        value={accountForm.currentPassword}
                                        onChange={(e) => setAccountForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                                        required
                                    />
                                    <button
                                        type="button"
                                        className="password-toggle"
                                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                    >
                                        {showCurrentPassword ? "Hide" : "Show"}
                                    </button>
                                </div>
                                <div className="form-group">
                                    <label>New Password</label>
                                    <input
                                        type={showNewPassword ? "text" : "password"}
                                        value={accountForm.newPassword}
                                        onChange={(e) => setAccountForm(prev => ({ ...prev, newPassword: e.target.value }))}
                                        required
                                    />
                                    <button
                                        type="button"
                                        className="password-toggle"
                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                    >
                                        {showNewPassword ? "Hide" : "Show"}
                                    </button>
                                </div>
                                <div className="form-group">
                                    <label>Confirm New Password</label>
                                    <input
                                        type={showConfirmPassword ? "text" : "password"}
                                        value={accountForm.confirmPassword}
                                        onChange={(e) => setAccountForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                        required
                                    />
                                    <button
                                        type="button"
                                        className="password-toggle"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    >
                                        {showConfirmPassword ? "Hide" : "Show"}
                                    </button>
                                </div>
                                <button type="submit" className="analyze-btn">Update Password</button>
                            </form>
                        </div>
                        {error && <div className="error-message">{error}</div>}
                        <button 
                            className="close-button"
                            onClick={() => {
                                setShowAccountSettings(false);
                                setError(null);
                                setAccountForm({
                                    newUsername: '',
                                    currentPassword: '',
                                    newPassword: '',
                                    confirmPassword: '',
                                    verifyPassword: ''
                                });
                            }}
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
