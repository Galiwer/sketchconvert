# FaceSketch AI - Frontend

Next.js 14+ frontend with TypeScript, Tailwind CSS, NextAuth.js authentication, and full integration with the FaceSketch AI backend.

## Features

- **Authentication**: NextAuth.js with email/password and Google OAuth
- **Canvas**: Advanced drawing tools (brush, eraser, colors, undo/redo)
- **Generation**: Real-time sketch → face generation with progress tracking
- **Gallery**: View and manage your generation history
- **Profile**: Customize default style and prompt preferences
- **Responsive**: Mobile-friendly UI with Tailwind CSS

## Setup

### 1. Install Dependencies

```bash
cd frontend/my-next-app
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_API_BASE=http://localhost:8000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>

# Optional: Google OAuth
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
```

### 3. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000`

## Google OAuth Setup (Optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Go to Credentials → Create OAuth 2.0 Client ID
5. Set Authorized redirect URIs:
   - Development: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://yourdomain.com/api/auth/callback/google`
6. Copy Client ID and Secret to `.env.local`

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   └── auth/
│   │       └── [...nextauth]/route.ts  # NextAuth configuration
│   ├── components/
│   │   ├── AuthProvider.tsx            # Session provider wrapper
│   │   ├── LandingPage.tsx            # Homepage
│   │   └── SketchCanvas.tsx           # Drawing canvas + generation
│   ├── canvas/page.tsx                # Canvas route
│   ├── gallery/page.tsx               # Generation history
│   ├── login/page.tsx                 # Login page
│   ├── profile/page.tsx               # User profile/settings
│   ├── register/page.tsx              # Registration page
│   ├── layout.tsx                     # Root layout with AuthProvider
│   ├── page.tsx                       # Homepage
│   └── globals.css                    # Global styles
└── ...
```

## Pages

### Public Routes
- `/` - Landing page with feature showcase
- `/login` - Email/password and Google sign-in
- `/register` - Create new account

### Protected Routes
- `/canvas` - Drawing canvas and generation
- `/gallery` - View all your generations
- `/profile` - Edit preferences and account settings

## API Integration

The frontend communicates with the backend via:

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

// Auth header
headers: {
  Authorization: `Bearer ${session.accessToken}`
}
```

**Key API calls:**
- `POST /auth/register` - Create account
- `POST /auth/login` - Login
- `GET /auth/me` - Get current user
- `PATCH /auth/me` - Update profile
- `POST /generate` - Generate image
- `GET /status/{job_id}` - Poll async job
- `POST /generations` - Save generation
- `GET /generations` - List history
- `DELETE /generations/{id}` - Delete generation

## Development

### Build for Production

```bash
npm run build
npm start
```

### Linting

```bash
npm run lint
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_BASE` | Yes | Backend API URL |
| `NEXTAUTH_URL` | Yes | Frontend URL for NextAuth |
| `NEXTAUTH_SECRET` | Yes | Random secret for session encryption |
| `GOOGLE_CLIENT_ID` | No | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth client secret |

## Features Detail

### SketchCanvas
- Brush with adjustable size and color
- Eraser tool
- Undo/redo with history
- Clear canvas
- Import/export PNG
- Real-time generation
- Progress tracking for async jobs
- Auto-save to user history

### Gallery
- Grid view of all generations
- Shows sketch + output side-by-side
- Displays prompt, style, and generation time
- Download individual images
- Delete generations
- Sorted by creation date (newest first)

### Profile
- Update display name
- Set default style (photorealistic, anime, etc.)
- Set default prompt text
- Sign out

## Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in Vercel
3. Set environment variables:
   - `NEXT_PUBLIC_API_BASE` = your backend URL
   - `NEXTAUTH_URL` = your Vercel URL
   - `NEXTAUTH_SECRET` = random string
   - Google OAuth credentials
4. Deploy

### Self-hosted

```bash
npm run build
npm start
# Or use PM2, Docker, etc.
```

## Troubleshooting

**"Authentication required" errors:**
- Check `NEXT_PUBLIC_API_BASE` points to running backend
- Verify JWT token is being sent in Authorization header
- Check backend `JWT_SECRET` matches

**Google OAuth not working:**
- Verify redirect URIs in Google Console
- Check `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
- Ensure `NEXTAUTH_URL` is correct

**Generation fails:**
- Backend must be running on `NEXT_PUBLIC_API_BASE`
- Check browser console for CORS errors
- Verify image size is under `MAX_IMAGE_BYTES` (backend)

**Session not persisting:**
- Check `NEXTAUTH_SECRET` is set
- Clear cookies and try again
- Verify `NEXTAUTH_URL` matches current domain

