# Cards of Curiosity Game

A Next.js card game project with Clerk authentication, built with JavaScript (no TypeScript).

## 🚀 Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```

3. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🔐 Setting up Clerk Authentication

To enable user authentication features:

1. **Create a Clerk account:**
   - Go to [https://dashboard.clerk.com](https://dashboard.clerk.com)
   - Sign up or log in

2. **Create a new application:**
   - Click "Add application"
   - Choose your preferred sign-in methods (email, social, etc.)

3. **Get your API keys:**
   - Go to "API Keys" in your Clerk dashboard
   - Copy your Publishable Key and Secret Key

4. **Update environment variables:**
   - Open `.env.local` in your project root
   - Replace the placeholder values:
     ```
     NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_actual_key_here
     CLERK_SECRET_KEY=sk_test_your_actual_secret_here
     ```

5. **Enable Clerk in your app:**
   - Uncomment the Clerk imports in `src/app/layout.js`
   - Uncomment the ClerkProvider wrapper
   - Update `src/components/Navigation.js` to use Clerk components
   - Update `src/app/page.js` to use Clerk authentication components

## 🎨 Features

- **Next.js 15** with App Router
- **JavaScript** (no TypeScript)
- **Tailwind CSS** for styling
- **SCSS** support with global variables
- **Clerk Authentication** (ready to configure)
- **React Query** for data fetching
- **Dark Mode** toggle
- **Responsive Design**

## 📁 Project Structure

```
src/
├── app/
│   ├── globals.scss          # Global styles
│   ├── _variables.scss       # SCSS variables
│   ├── layout.js            # Root layout with providers
│   └── page.js              # Home page
├── components/
│   ├── Navigation.js        # Navigation component
│   ├── DarkModeButton.js    # Dark mode toggle
│   ├── Navigation.module.scss
│   └── darkmodebutton.module.scss
└── middleware.js            # Clerk middleware
```

## 🛠️ Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## 🎮 Game Features (Coming Soon)

- Card collection system
- Multiplayer gameplay
- User profiles and statistics
- Real-time game sessions

## 📝 Notes

- The project is currently set up to work without Clerk authentication for development
- SCSS warnings about deprecated functions are non-critical and won't affect functionality
- All components are written in JavaScript (no TypeScript)

## 🔧 Troubleshooting

If you encounter issues:

1. **Server won't start:** Make sure all dependencies are installed with `npm install`
2. **Clerk errors:** Ensure your API keys are correctly set in `.env.local`
3. **SCSS warnings:** These are deprecation warnings and won't break the app

## 📚 Next Steps

1. Set up Clerk authentication
2. Design your card game mechanics
3. Create card data structures
4. Implement game logic
5. Add multiplayer functionality

Happy coding! 🎉