# AI Clone Platform - Frontend Documentation

## Overview
This is the frontend application for the AI Clone Platform, built with **Next.js 15**, **React 19**, **TypeScript**, and **Tailwind CSS**. The platform allows users to interact with AI versions of experts through chat, voice, and video sessions.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm/pnpm/yarn

### Installation
```bash
# Install dependencies
npm install
# or
pnpm install

# Run development server
npm run dev
# or 
pnpm dev

# Build for production
npm run build

# Start production server
npm start
```

### Development Server
The application will be available at `http://localhost:3000`

## 📁 Project Structure

```
frontend/
├── app/                    # Next.js App Router pages
│   ├── chat/[id]/          # Chat interface pages
│   ├── clone/[id]/         # Expert clone profile pages
│   ├── create-clone/       # Clone creation flow
│   ├── dashboard/          # User & creator dashboards
│   ├── discover/           # Expert discovery page
│   ├── how-it-works/       # Information pages
│   ├── pricing/            # Pricing information
│   ├── profile/            # User profile management
│   ├── video/[id]/         # Video call interface
│   ├── voice/[id]/         # Voice call interface
│   ├── globals.css         # Global styles
│   ├── layout.tsx          # Root layout
│   ├── loading.tsx         # Global loading component
│   └── page.tsx            # Homepage
├── components/             # Reusable React components
│   ├── ui/                 # shadcn/ui component library (43+ components)
│   └── theme-provider.tsx  # Theme context provider
├── hooks/                  # Custom React hooks
│   ├── use-mobile.tsx      # Mobile viewport detection
│   └── use-toast.ts        # Toast notification management
├── lib/                    # Utility functions
│   └── utils.ts            # Common utilities (cn, etc.)
├── public/                 # Static assets
│   ├── placeholder-logo.png
│   ├── placeholder-logo.svg
│   ├── placeholder-user.jpg
│   ├── placeholder.jpg
│   └── placeholder.svg
├── styles/                 # Additional styles
│   └── globals.css         # Global CSS (duplicate - can be removed)
├── components.json         # shadcn/ui configuration
├── next.config.mjs         # Next.js configuration
├── postcss.config.mjs      # PostCSS configuration
└── tailwind.config.ts      # Tailwind CSS configuration
```

## 🛠️ Technology Stack

### Core Framework
- **Next.js 15** - React framework with App Router
- **React 19** - UI library with latest features
- **TypeScript** - Type-safe JavaScript

### Styling & UI
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - High-quality component library (43+ components)
- **CSS Custom Properties** - Theme variables for light/dark mode
- **Framer Motion** - Animation library

### State Management & Forms
- **React useState** - Component state management
- **React Hook Form** - Form handling and validation
- **Zod** - Schema validation
- **Custom Hooks** - Reusable stateful logic

### Icons & Assets
- **Lucide React** - Icon library
- **next/image** - Optimized image handling
- **Geist Font** - Sans and mono typefaces

## 📱 Key Features

### User Interface
- **Responsive Design** - Mobile-first approach
- **Dark/Light Mode** - Complete theming system
- **Smooth Animations** - Framer Motion transitions
- **Accessible Components** - WCAG compliant UI components
- **Loading States** - Skeleton loaders and loading pages

### Navigation & Routing
- **App Router** - Next.js 13+ routing system
- **Dynamic Routes** - Expert profiles, chat, video, voice sessions
- **Nested Layouts** - Shared layouts and loading states
- **Link Prefetching** - Optimized navigation

### Expert Interaction
- **Chat Interface** - Text-based conversations with AI experts
- **Voice Calls** - Audio communication with experts
- **Video Calls** - Video communication with experts
- **Expert Discovery** - Browse and filter experts by category
- **Expert Profiles** - Detailed expert information and specialties

### User Management
- **User Dashboard** - Session history, favorites, billing
- **Creator Dashboard** - Analytics, earnings, clone management
- **Profile Management** - User account settings
- **Clone Creation** - Multi-step wizard for creating AI clones

## 🎨 Component Library

### shadcn/ui Components (43 total)

#### Form & Input Components
- **Button** - Multiple variants (default, destructive, outline, secondary, ghost, link)
- **Input** - Text input with validation states
- **Textarea** - Multi-line text input
- **Checkbox** - Custom styled checkboxes
- **Radio Group** - Radio button selections
- **Select** - Dropdown select component
- **Slider** - Range input slider
- **Switch** - Toggle switches
- **Form** - Form wrapper with validation
- **Label** - Form labels
- **Input OTP** - One-time password input

#### Layout & Navigation
- **Navigation Menu** - Main navigation component
- **Menubar** - Menu bar interface
- **Breadcrumb** - Navigation breadcrumbs
- **Sidebar** - Collapsible sidebar navigation
- **Tabs** - Tab navigation interface
- **Pagination** - Page navigation controls

#### Display Components
- **Card** - Content containers with header/content/footer
- **Avatar** - User avatars with fallbacks
- **Badge** - Status and category badges
- **Table** - Data tables with sorting
- **Progress** - Progress bars and indicators
- **Skeleton** - Loading placeholders
- **Separator** - Visual separators

#### Interactive Components
- **Dialog** - Modal dialogs
- **Alert Dialog** - Confirmation dialogs
- **Sheet** - Slide-out panels
- **Drawer** - Bottom sheet drawers
- **Popover** - Floating content
- **Hover Card** - Hover-triggered content
- **Tooltip** - Information tooltips
- **Dropdown Menu** - Context menus
- **Context Menu** - Right-click menus
- **Command** - Command palette interface

#### Feedback Components
- **Alert** - Notification alerts
- **Toast** - Toast notifications
- **Toaster** - Toast container
- **Sonner** - Advanced toast implementation

#### Advanced Components
- **Calendar** - Date picker interface
- **Carousel** - Content carousels
- **Chart** - Data visualization
- **Accordion** - Collapsible content
- **Collapsible** - Toggle content visibility
- **Aspect Ratio** - Maintain aspect ratios
- **Resizable** - Resizable panel layouts
- **Scroll Area** - Custom scrollbars
- **Toggle** - Toggle buttons
- **Toggle Group** - Toggle button groups

## 🎯 Page Structure

### Core Pages
- **Homepage** (`/`) - Landing page with hero, featured experts, categories, testimonials
- **Discover** (`/discover`) - Expert browsing with filters and search
- **How It Works** (`/how-it-works`) - Platform explanation and features
- **Pricing** (`/pricing`) - Pricing plans and session costs

### User Pages
- **Dashboard** (`/dashboard`) - User session history, favorites, billing
- **Profile** (`/profile`) - User account management

### Creator Pages
- **Creator Dashboard** (`/dashboard/creator`) - Creator analytics and earnings
- **Create Clone** (`/create-clone`) - Clone creation interface
- **Clone Wizard** (`/create-clone/wizard`) - Step-by-step clone setup

### Interaction Pages
- **Expert Profile** (`/clone/[id]`) - Individual expert information
- **Chat Session** (`/chat/[id]`) - Text-based conversations
- **Voice Session** (`/voice/[id]`) - Audio communication
- **Video Session** (`/video/[id]`) - Video communication

## 🎨 Theming System

### CSS Custom Properties
The application uses a comprehensive theming system with CSS custom properties:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
  /* ... more theme variables */
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  /* ... dark theme variables */
}
```

### Theme Provider
Dark/light mode switching is handled by the `ThemeProvider` component using `next-themes`.

## 🔧 Configuration

### Next.js Configuration (`next.config.mjs`)
```javascript
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true }
};
```

### Tailwind Configuration (`tailwind.config.ts`)
- Custom color palette with CSS variables
- Extended animations and keyframes
- Custom border radius values
- Plugin integrations (tailwindcss-animate)

### TypeScript Configuration (`tsconfig.json`)
- Path aliases (`@/` points to root)
- Next.js optimizations
- Strict type checking

## 📱 Responsive Design

### Breakpoints
- **Mobile**: < 640px
- **Tablet**: >= 640px (sm)
- **Laptop**: >= 1024px (lg)
- **Desktop**: >= 1280px (xl)

### Mobile-First Approach
All components are designed mobile-first with progressive enhancement for larger screens.

## 🚀 Performance Optimizations

### Next.js Features
- **App Router** - Server-side rendering and static generation
- **Image Optimization** - Automatic image optimization
- **Link Prefetching** - Preload page resources
- **Code Splitting** - Automatic bundle splitting

### Loading States
- Global loading component (`app/loading.tsx`)
- Page-specific loading states
- Skeleton components for content loading

## 🧪 Development Guidelines

### Component Development
1. Use TypeScript for all components
2. Follow shadcn/ui patterns for consistency
3. Implement proper loading and error states
4. Ensure mobile responsiveness
5. Add proper accessibility attributes

### Styling Guidelines
1. Use Tailwind utility classes
2. Leverage CSS custom properties for theming
3. Maintain consistent spacing and typography
4. Follow design system color palette

### State Management
1. Use React hooks for local state
2. Lift state up when needed across components
3. Consider custom hooks for reusable logic
4. Use React Hook Form for form state

## 🔍 Troubleshooting

### Common Issues
1. **Build Errors**: Check TypeScript and ESLint configurations
2. **Styling Issues**: Verify Tailwind CSS setup and imports
3. **Component Imports**: Check path aliases and component exports
4. **Theme Issues**: Ensure ThemeProvider is properly configured

### Development Server Issues
- Clear `.next` cache: `rm -rf .next`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- Check Next.js version compatibility

## 📚 Resources

### Documentation
- [Next.js Documentation](https://nextjs.org/docs)
- [shadcn/ui Documentation](https://ui.shadcn.com)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [React Hook Form](https://react-hook-form.com)

### Component Reference
- All UI components are documented in the shadcn/ui library
- Custom components include TypeScript interfaces
- Props and usage examples available in component files

## 🔄 Future Enhancements

### Planned Features
- Real-time chat functionality
- WebRTC video/voice integration
- Payment processing integration
- Advanced analytics dashboard
- Mobile app development

### Technical Improvements
- State management library (Redux Toolkit, Zustand)
- API layer with React Query
- End-to-end testing setup
- Performance monitoring
- Accessibility auditing

---

*This documentation is maintained alongside the codebase. Please update it when making significant changes to the frontend structure or adding new features.*