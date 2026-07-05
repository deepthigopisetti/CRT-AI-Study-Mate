# Student Companion Frontend

React + Vite frontend for the Student Companion learning platform.

## 🏗️ Project Structure

```
frontend/
├── src/
│   ├── components/         # Reusable React components
│   ├── pages/              # Page components
│   │   ├── Login.jsx
│   │   ├── Register.jsx
│   │   └── Dashboard.jsx
│   ├── services/
│   │   └── api.js          # API client (axios)
│   ├── assets/             # Static files (images, fonts)
│   ├── App.jsx             # Main app component
│   ├── index.css           # Global styles
│   └── main.jsx            # Entry point
├── public/                 # Public assets
├── package.json
├── vite.config.js
└── README.md              # This file
```

## ⚙️ Setup

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Development Server

```bash
npm run dev
```

Frontend runs on: `http://localhost:5173`

### 3. Build for Production

```bash
npm run build
```

### 4. Preview Production Build

```bash
npm run preview
```

## 🎨 Tech Stack

- **React 19** - UI library
- **Vite** - Build tool & dev server
- **React Router v7** - Navigation
- **Axios** - HTTP client
- **Tailwind CSS v4** - Utility-first CSS
- **Oxlint** - Linting

## 📱 Pages

### Login Page (`pages/Login.jsx`)
- User email and password input
- Form validation
- Error messages
- Link to register
- Redirects to dashboard on success

### Register Page (`pages/Register.jsx`)
- Full name, email, password input
- Form validation
- Error handling
- Link to login
- Redirect after registration

### Dashboard Page (`pages/Dashboard.jsx`)
- Main application interface
- Navigation between features
- User profile info
- Feature modules (notes, quizzes, etc.)

## 🔌 API Integration

### API Client (`services/api.js`)

```javascript
// Authentication
api.post('/auth/register', userData)
api.post('/auth/login', credentials)

// Notes
api.get('/notes')
api.post('/notes', noteData)
api.get('/notes/:id')
api.put('/notes/:id', updatedData)
api.delete('/notes/:id')

// Quizzes
api.get('/quizzes')
api.post('/quizzes', quizData)
api.get('/quizzes/:id')
api.post('/quizzes/:id/submit', answers)

// Study Plans
api.get('/planner')
api.post('/planner', planData)
api.put('/planner/:id', updatedData)

// Chat
api.post('/chat', { message })
api.get('/chat/history')
```

## 🎯 Key Features

### Authentication Flow
1. User registers → Backend creates account → Redirect to login
2. User logs in → Backend issues JWT → Store token locally
3. Token included in all API requests
4. Logout → Clear token from localStorage

### State Management
- React hooks (useState, useContext)
- localStorage for token persistence
- API calls via axios

### Styling
- Tailwind CSS utility classes
- Gradient backgrounds (purple to blue)
- Responsive design
- Dark theme support

### Form Validation
- Email format validation
- Password strength checking
- Required field validation
- Error message display

## 🚀 Development Workflow

### Add New Page
```javascript
// pages/NewPage.jsx
import React from 'react'
import { useNavigate } from 'react-router-dom'

export default function NewPage() {
  return (
    <div className="container mx-auto p-4">
      {/* Your content */}
    </div>
  )
}
```

### Add API Call
```javascript
// In component
import api from '../services/api'

const fetchData = async () => {
  try {
    const response = await api.get('/endpoint')
    console.log(response.data)
  } catch (error) {
    console.error('Error:', error.response?.data?.message)
  }
}
```

### Add Component
```javascript
// components/MyComponent.jsx
export default function MyComponent({ prop }) {
  return (
    <div className="p-4">
      {/* Component JSX */}
    </div>
  )
}
```

## 🎨 Styling Guidelines

### Color Palette
- Primary: Purple (#9D4EDD)
- Secondary: Blue (#5A189A)
- Accent: Cyan (#00D9FF)
- Background: Dark Navy (#0A0E27)
- Text: Light Gray (#E0E0E0)

### CSS Classes (Tailwind)
```html
<!-- Buttons -->
<button className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-lg text-white">

<!-- Cards -->
<div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg p-6 border border-slate-700">

<!-- Forms -->
<input className="w-full px-4 py-3 bg-slate-100 rounded-lg border-2 border-transparent focus:border-purple-600 focus:outline-none">
```

## 📦 Dependencies

```json
{
  "react": "^19.2.7",
  "react-dom": "^19.2.7",
  "react-router-dom": "^7.18.0",
  "axios": "^1.18.1",
  "tailwindcss": "^4.3.1"
}
```

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Run on different port
npm run dev -- --port 3000
```

### Module Not Found
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Vite Build Errors
```bash
# Clear cache and rebuild
rm -rf dist
npm run build
```

### API Connection Issues
- Check backend is running on http://127.0.0.1:5000
- Verify CORS is enabled on backend
- Check network tab in browser DevTools
- Verify API endpoint URLs in `services/api.js`

## 🔑 Environment Variables

Create `.env` file if needed:

```env
VITE_API_BASE_URL=http://127.0.0.1:5000
```

Reference in code:
```javascript
const apiUrl = import.meta.env.VITE_API_BASE_URL
```

## 📝 Component Conventions

- Functional components only
- Props destructuring
- Custom hooks for logic
- Event handlers prefixed with `handle` (e.g., `handleClick`)
- State setters follow React convention (e.g., `user, setUser`)

## 🔐 Security

- JWT tokens stored in localStorage
- HTTPS recommended for production
- Sanitize user input
- Validate on both client and server
- Never commit `.env` with secrets

## 🚀 Production Build

```bash
npm run build
npm run preview

# Deploy to hosting (Vercel, Netlify, etc.)
```

## 📄 License

MIT License - See LICENSE file for details

## 🤝 Contributing

1. Create feature branch
2. Make changes
3. Test locally
4. Submit pull request

---

**Built with ❤️ using React & Vite**
