# Scribe AI Writing Assistant API

<p align="center">
  <strong>An AI-powered platform for Christian authors to write, generate, and manage manuscripts with personalized voice profiles.</strong>
</p>

---

## 📋 Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Key Features](#key-features)
- [API Documentation](#api-documentation)
- [Development Workflow](#development-workflow)
- [Database](#database)
- [Deployment](#deployment)

---

## 🎯 Overview

**Scribe** is an AI-powered writing assistance platform designed for Christian authors. It combines voice profile extraction, retrieval-augmented generation (RAG), and generative AI to help authors:

- Create personalized voice profiles based on writing samples and theological framework
- Generate manuscript outlines and chapters in their unique voice
- Store and manage multiple manuscripts and books
- Chat with an AI agent for writing assistance and refinement
- Generate book covers with Vertex AI

### Key Use Cases

1. **Voice Profile Creation** - Extract author's unique voice from interviews and previous works
2. **Manuscript Generation** - Generate outlines and chapters aligned with author's voice
3. **RAG-based Writing** - Leverage previous works and theological references as context
4. **Interactive Chat** - Real-time chat interface for writing feedback and suggestions
5. **Content Management** - Organize manuscripts, chapters, and versions

---

## 🛠 Tech Stack

### Backend
- **Framework**: NestJS 11 (Node.js + TypeScript)
- **Database**: PostgreSQL + Prisma ORM
- **Vector DB**: pgvector extension for embeddings
- **AI/ML**: 
  - Google Vertex AI (text generation, image generation)
  - Google GenAI SDK
  - LangChain.js (RAG, chains, agents)
  - FastEmbed (local embeddings)
- **Authentication**: JWT with Passport
- **API Docs**: Swagger/OpenAPI 3.0
- **Cloud Storage**: Google Cloud Storage

### Frontend
- **Framework**: React 19 + TypeScript
- **Build**: Vite
- **Routing**: TanStack Router
- **State Management**: TanStack Query (React Query)
- **Form Handling**: React Hook Form
- **Rich Text Editor**: TipTap
- **UI Components**: Custom + React Icons
- **Web Workers**: Transformers.js for client-side ML

### Infrastructure
- **Node.js**: v18+
- **Package Manager**: npm
- **Testing**: Jest, Supertest
- **Linting**: ESLint + Prettier

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Frontend (React + Vite)                    │
│                  - Voice Profile Setup                          │
│                  - Manuscript Editor                            │
│                  - Chat Interface                               │
│                  - Web Workers (Transformers.js)                │
└─────────────────┬───────────────────────────────────────────────┘
                  │ HTTP/REST/WebSocket
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│              Backend API (NestJS + Express)                     │
├──────────────────────────────────────────────────────────────────┤
│  Controllers Layer                                              │
│  ├─ Auth                ├─ Manuscripts    ├─ RAG              │
│  ├─ Voice Profiles      ├─ Chat           ├─ Generation       │
│  ├─ Interview           └─ Books          └─ Health           │
│                                                                  │
│  Services Layer (Business Logic)                                │
│  ├─ VoiceProfileExtractionAgent (Vertex AI)                   │
│  ├─ InterviewProcessingQueueService (Upstash Redis queue)     │
│  ├─ InterviewProcessingWorker (background worker polling Redis)│
│  ├─ ScribeAgentService (LangChain tool-calling agent)         │
│  ├─ RAGService (LangChain)                                    │
│  ├─ GenerationService (Vertex AI)                             │
│  └─ GoogleAuthService, StorageService, etc.                   │
│                                                                  │
│  Data Access Layer                                              │
│  └─ Prisma ORM (Repository pattern)                           │
└─────────────────┬───────────────────────────────────────────────┘
                  │
        ┌─────────┼─────────┐
        ▼         ▼         ▼
    ┌────────┐ ┌────────┐ ┌─────────────┐
    │  Pg    │ │ pgvec- │ │ Google      │
    │SQL DB │ │ tor    │ │ Cloud:      │
    │        │ │        │ │ - Storage   │
    │        │ │(embed- │ │ - Vertex AI │
    │ -Voice │ │ dings) │ │ - GenAI     │
    │ -Manus │ │        │ │ - Auth      │
    │ -Chat  │ │        │ │             │
    └────────┘ └────────┘ └─────────────┘                  │
                  ▼
             ┌─────────────┐
             │  Redis      │
             │  (Upstash)  │
             │  Queue &    │
             │  Locks      │
             │  Background │
             │  Jobs       │
             └─────────────┘```

### Data Flow

**Voice Profile → Manuscript Generation:**
1. User provides interview and previous works
2. VoiceProfileExtractionAgent analyzes texts with Vertex AI
3. FastEmbed converts texts to vector embeddings
4. Embeddings stored in pgvector for RAG retrieval
5. RAGService retrieves contextual materials for manuscript generation
6. GenerationService uses Vertex AI with context to generate content

---

### Background Jobs & Agentic Tool Calling

The backend includes a Redis-backed interview processing queue and a LangChain-based agentic chat assistant.

- `InterviewProcessingQueueService` stores interview jobs, status records, and distributed lock state in Upstash Redis.
- `InterviewProcessingWorker` polls Redis, claims jobs with a lock, recovers interrupted work, and executes the `InterviewProcessingWorkflow`.
- Interview jobs carry interview answers plus previous work chunks, enabling voice profile extraction and RAG-ready embedding generation.
- `ScribeAgentService` builds a tool-calling LangChain agent with backend tools for manuscript lookup, voice profile discovery, user knowledge search, and outline generation.
- The agent routes chat requests through backend services, then synthesizes a final response with user-specific context and tool results.

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ and npm
- **PostgreSQL** 14+ with pgvector extension installed
- **Google Cloud Project** with:
  - Vertex AI API enabled
  - Service account with credentials (JSON key)
  - Cloud Storage bucket created
- **.env file** with credentials

### Installation

#### 1. Clone and Install Dependencies

```bash
# Backend
cd scribe-backend
npm install

# Frontend
cd ../Scribe-Frontend
npm install
```

#### 2. Setup Environment Variables

**Backend (.env)** - in `scribe-backend/`:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/scribe"

# Google Cloud
GOOGLE_APPLICATION_CREDENTIALS="path/to/service-account-key.json"
GOOGLE_CLOUD_PROJECT="your-project-id"
GCS_BUCKET_NAME="scribe_ai"

# JWT
JWT_SECRET="your-super-secret-jwt-key-min-32-chars"
JWT_EXPIRATION="7d"

# Server
PORT=3000
NODE_ENV=development
BODY_LIMIT=25mb

# Email (Resend)
RESEND_API_KEY="your-resend-api-key"
```

**Frontend (.env)** - in `Scribe-Frontend/`:

```env
VITE_API_BASE_URL="https://scribe-500520.lm.r.appspot.com/api"
```

#### 3. Setup Database

```bash
cd scribe-backend

# Install PostgreSQL with pgvector extension
# macOS: brew install postgresql pgvector
# Linux: See https://github.com/pgvector/pgvector#installation

# Create database and apply migrations
npm run prisma:generate
npm run migrate

# (Optional) Seed data
npm run prisma -- db seed
```

#### 4. Start Development Servers

**Backend:**
```bash
cd scribe-backend
npm run start:dev
# Server runs on https://scribe-500520.lm.r.appspot.com
# Swagger API docs: https://scribe-500520.lm.r.appspot.com/swagger
```

**Frontend:**
```bash
cd Scribe-Frontend
npm run dev
# Frontend runs on http://localhost:5173
```

---

## 📁 Project Structure

### Backend (`scribe-backend/`)

```
src/
├── main.ts                          # App entry point, Swagger setup
├── app.module.ts                    # Root module
├── app.controller.ts                # Root controller
├── prisma.service.ts                # Database client
│
├── common/                          # Shared utilities
│   ├── decorators/                  # Custom decorators (e.g., @GetUser)
│   ├── guards/                      # Auth guards (JwtAuthGuard)
│   ├── exceptions/                  # Custom exceptions
│   ├── dto/                         # Shared DTOs
│   └── constants/                   # App-wide constants
│
├── config/                          # Configuration modules
├── database/                        # Database migrations (via Prisma)
├── integrations/                    # External service adapters
│   └── langchain/                   # LangChain.js integration
│
├── modules/                         # Feature modules
│   ├── auth/                        # Authentication (register, login, verify email)
│   │   ├── controllers/
│   │   ├── services/
│   │   └── dto/
│   │
│   ├── voice-profile/               # Voice profile management
│   │   ├── controllers/
│   │   ├── services/
│   │   └── dto/
│   │
│   ├── interview/                   # Interview processing (voice extraction)
│   │   ├── controllers/
│   │   ├── services/
│   │   └── dto/
│   │
│   ├── manuscripts/                 # Manuscript CRUD + chapters
│   │   ├── controllers/
│   │   ├── services/
│   │   └── dto/
│   │
│   ├── generation/                  # Content generation (outlines, chapters, covers)
│   │   ├── controllers/
│   │   ├── services/
│   │   └── dto/
│   │
│   ├── rag/                         # Retrieval-Augmented Generation
│   │   ├── controllers/
│   │   ├── services/
│   │   └── dto/
│   │
│   ├── embeddings/                  # Vector embeddings (FastEmbed)
│   │   └── services/
│   │
│   ├── chat-agent/                  # AI chat interface
│   │   ├── controllers/
│   │   ├── services/
│   │   └── dto/
│   │
│   ├── books/                       # Book management (references for RAG)
│   │   ├── controllers/
│   │   ├── services/
│   │   └── dto/
│   │
│   └── health/                      # Health check endpoints
│
├── jobs/                            # Background jobs / queues
├── types/                           # Global TypeScript types
└── utils/                           # Utility functions

prisma/
├── schema.prisma                    # Database schema definition
└── migrations/                      # SQL migration files

test/
├── app.e2e-spec.ts                  # End-to-end tests
├── jest-e2e.json                    # Jest E2E config
└── helpers/                         # Test utilities
```

### Frontend (`Scribe-Frontend/`)

```
src/
├── main.tsx                         # React entry point
├── App.tsx                          # Root component
│
├── components/                      # Reusable UI components
│   ├── Editor/                      # TipTap rich text editor
│   ├── ChatPanel/                   # Chat interface
│   ├── VoiceProfileForm/            # Voice profile setup
│   └── ...
│
├── pages/                           # Page-level components (route pages)
│   ├── Dashboard.tsx
│   ├── ManuscriptEditor.tsx
│   ├── VoiceProfileSetup.tsx
│   └── ...
│
├── hooks/                           # Custom React hooks
│   ├── useAuth.ts                   # Auth context hook
│   ├── useManuscript.ts             # Manuscript data hook
│   └── ...
│
├── services/                        # API client services
│   ├── api.ts                       # Axios instance
│   ├── authService.ts
│   ├── manuscriptService.ts
│   └── ...
│
├── stores/                          # State management (Zustand/Context)
│   ├── authStore.ts
│   ├── manuscriptStore.ts
│   └── ...
│
├── types/                           # TypeScript types & interfaces
├── utils/                           # Utility functions
├── workers/                         # Web Workers (Transformers.js)
│   └── whisper-worker.js            # Audio processing
│
├── layouts/                         # Layout wrapper components
├── router/                          # TanStack Router config
├── schemas/                         # Form validation schemas
│
├── App.css
├── index.css
└── assets/                          # Static assets (images, etc.)
```

---

## ✨ Key Features

### 1. **Voice Profile Extraction**
- AI-powered analysis of author interviews and previous works
- Extracts signature phrases, theological framework, and writing style
- Stores embeddings for RAG retrieval

### 2. **Manuscript Generation**
- Generate outlines using Vertex AI and author's voice profile
- Generate individual chapters with consistent voice and style
- Real-time streaming of generation progress

### 3. **RAG (Retrieval-Augmented Generation)**
- Vector embeddings of author's books and theological references
- Retrieves contextual materials during manuscript generation
- Ensures generated content aligns with author's works

### 4. **Interactive Chat**
- Real-time chat with AI agent about manuscript
- Context-aware responses using RAG
- Session management and message history

### 5. **Content Management**
- Multi-manuscript support per voice profile
- Chapter organization with reordering
- Manuscript versioning and restoration
- Export to DOCX format

### 6. **Authentication & Authorization**
- JWT-based auth with email verification
- Google OAuth integration (optional)
- User-scoped data isolation

---

## 📚 API Documentation

### Interactive Documentation

Access the **Swagger UI** at https://scribe-500520.lm.r.appspot.com/swagger when the backend is running.

Download the raw **OpenAPI JSON**:
- https://scribe-500520.lm.r.appspot.com/swagger-json
- https://scribe-500520.lm.r.appspot.com/swagger.json

### Main Endpoints

#### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get JWT
- `POST /api/auth/verify-email` - Verify email token
- `GET /api/auth/me` - Get current user profile

#### Voice Profiles
- `GET /api/voice-profiles` - List user's voice profiles
- `POST /api/voice-profiles` - Create voice profile
- `GET /api/voice-profiles/:id` - Get voice profile details
- `PUT /api/voice-profiles/:id` - Update voice profile
- `DELETE /api/voice-profiles/:id` - Delete voice profile

#### Interview Processing
- `POST /api/interview/process` - Process interview to extract voice
- `POST /api/interview/upload-previous-works` - Upload author's previous works
- `GET /api/interview/voice-profile-status/:voiceProfileId` - Check processing status

#### Manuscripts
- `POST /api/manuscripts` - Create manuscript
- `GET /api/manuscripts` - List user's manuscripts
- `PUT /api/manuscripts/:id` - Update manuscript
- `DELETE /api/manuscripts/:id` - Delete manuscript
- `POST /api/manuscripts/:id/chapters` - Add chapter
- `PUT /api/manuscripts/:id/chapters/:chapterId` - Update chapter
- `DELETE /api/manuscripts/:id/chapters/:chapterId` - Delete chapter
- `POST /api/manuscripts/:id/versions` - Create manuscript version (save point)
- `POST /api/manuscripts/:id/export` - Export to DOCX

#### Generation
- `POST /api/generation/generate-manuscript-outline` - Generate outline
- `POST /api/generation/generate-chapter` - Generate chapter content
- `POST /api/generation/generate-book-cover` - Generate book cover image

#### RAG
- `POST /api/rag/context-for-outline` - Retrieve context for outline generation
- `POST /api/rag/manuscript-prompt` - Build RAG prompt for manuscript generation
- `GET /api/rag/context-report` - View RAG retrieval report

#### Chat
- `POST /api/chat/sessions` - Create chat session
- `GET /api/chat/sessions` - List chat sessions
- `POST /api/chat/messages` - Send message
- `POST /api/chat/messages/stream` - Send message with streaming response

#### Books
- `GET /api/books/profile/:voiceProfileId` - List books for profile
- `DELETE /api/books/:bookId` - Delete book

---

## 🔄 Development Workflow

### Code Style & Linting

```bash
# Format code
npm run format

# Lint and fix
npm run lint
```

### Testing

```bash
# Unit tests
npm run test

# Unit tests (watch mode)
npm run test:watch

# E2E tests
npm run test:e2e

# Coverage report
npm run test:cov

# All tests
npm run test:all
```

### Database Management

```bash
# Generate Prisma client
npm run prisma:generate

# Create migration (interactive)
npm run migrate -- --name add_my_field

# View database schema
npx prisma studio
```

### Adding New Features

1. **Create DTOs** in `src/modules/feature/dto/` with `@ApiProperty()` decorators
2. **Define service logic** in `src/modules/feature/services/`
3. **Create controller** in `src/modules/feature/controllers/` with `@ApiOperation()` and `@ApiResponse()` decorators
4. **Register module** in `AppModule`
5. **Write tests** in `test/` or alongside code
6. **Update Swagger UI** automatically regenerates when server restarts

---

## 🗄 Database

### Schema Highlights

**Users**
- id, email, password, name
- emailVerified, emailVerificationToken
- createdAt, updatedAt

**VoiceProfiles**
- id, userId, name, biography
- signaturePhrases[], anchorScriptures[]
- theologicalFramework, sampleTexts
- Relationships: hasMany Manuscripts, hasMany Books, hasMany VoiceProfileEmbeddings

**Manuscripts**
- id, userId, voiceProfileId, title, description
- outline (JSON), status, bookCoverUrl
- Relationships: hasMany Chapters, hasMany ManuscriptVersions

**Chapters**
- id, manuscriptId, title, content, order
- voiceStyle, status
- Relationships: hasMany ChapterVersions

**VoiceProfileEmbedding** (pgvector)
- id, voiceProfileId, bookId
- embedding (vector), sourceText, metadata
- Used for RAG retrieval

**ChatSession & ChatMessage**
- Session-based chat history
- Relationships: oneToMany ChatMessages

### Migrations

Migrations are in `prisma/migrations/`. Key migrations:
- init: Base schema
- add_manuscripts: Manuscript and chapter support
- add_pgvector_hnsw_indexes: Vector search optimization
- add_chat_tables: Chat session support
- add_books_table: Book management

---

## 🚢 Deployment

### Production Build

```bash
# Build backend
npm run build

# Run production server
npm run start:prod
```

### Environment for Production

Set these in `.env`:
```env
NODE_ENV=production
JWT_EXPIRATION=30d
```

### Recommended Hosting

- **Backend**: Google Cloud Run, AWS ECS, or any Node.js host
- **Database**: Google Cloud SQL for PostgreSQL
- **Frontend**: Vercel, Netlify, or Cloud Storage + CDN
- **Storage**: Google Cloud Storage

### Docker Deployment (Optional)

Create `Dockerfile` in `scribe-backend/`:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/src/main"]
```

Build and run:
```bash
docker build -t scribe-api .
docker run -p 3000:3000 --env-file .env scribe-api
```

---

## 📄 License

UNLICENSED - Proprietary

---

## 📞 Support & Contributing

For questions or issues:
1. Check existing documentation in `README_EMBEDDINGS.md`, `EMBEDDINGS_SETUP.md`
2. Review Swagger API docs at `/swagger`
3. Check test files for usage examples
4. Contact the development team

---

## 🔗 Related Documentation

- [Embeddings Setup Guide](./README_EMBEDDINGS.md)
- [Dual Embeddings Guide](./DUAL_EMBEDDINGS_GUIDE.md)
- [Cache Corruption Guide](./CACHE_CORRUPTION_GUIDE.md)
- [NestJS Docs](https://docs.nestjs.com)
- [Prisma Docs](https://www.prisma.io/docs)
- [LangChain Docs](https://js.langchain.com)
- langraph/: higher-level reasoning graph workflows
- llamaindex/: indexing + retrieval skeleton (embeddings, vector store)

These are placeholders to guide implementation. They read configuration from src/config/openai.config.ts and are designed to be replaced with real connectors (LangChain.js clients, vector DB adapters, and model-specific clients for Gemini).

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

See ARCHITECTURE.md for an ASCII architecture diagram and Day 1 setup instructions.
