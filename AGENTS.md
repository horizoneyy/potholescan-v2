# PotholeScan

React 19 + Vite + Tailwind CSS v4 + FastAPI + YOLOv8 + Supabase PostGIS.

## Development Servers

- Frontend Vite Server: `http://localhost:5173` (with `/api` proxy pointing to `http://127.0.0.1:8000`)
- Backend FastAPI Server: `http://127.0.0.1:8000` (interactive docs at `/docs`)

## Project Structure

- `src/` - Frontend application source code (React 19, Leaflet, Tailwind CSS)
  - `src/components/` - View components (Public, Staff, Admin, MapView, Login, Camera, shared UI)
  - `src/api.ts` - REST API client layer connecting to FastAPI backend
  - `src/main.tsx` - React entrypoint
  - `src/App.tsx` - Main layout & routing controller
- `backend/` - Backend AI engine & API service (Python 3.12, FastAPI, YOLOv8)
  - `backend/app/` - API routers, schemas, services (YOLOv8 inference, PostGIS, ReportLab PDF)
  - `backend/weights/` - AI weights (`best.pt`)
  - `backend/scripts/` - Local GPU training, evaluation, and database setup scripts
  - `backend/tests/` - Pytest unit test suites
- `docs/` - Centralized documentation
  - `docs/specifications/` - PRD, SRS, HDD, TECH_STACK, METODOLOGI
  - `docs/training_metrics/` - Confusion matrix, PR curve, F1 curve, results.csv
