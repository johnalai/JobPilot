# AI Studio Application Rules

This document outlines the core technologies and best practices for developing and maintaining the JobPilot AI application.

## Tech Stack Overview

*   **Frontend Framework**: React with TypeScript for building dynamic user interfaces.
*   **Styling**: Tailwind CSS for utility-first styling, ensuring a consistent and responsive design.
*   **AI Integration**: Google Gemini API (`@google/genai`) is used for all AI-powered features, including chat, resume parsing, job finding, application generation, and interview coaching.
*   **State Management**: React Context API (`AppContext.tsx`) is used for global application state, while `useState` handles component-level state.
*   **Routing**: The application uses a custom, state-based routing system managed within `AppContext` and `App.tsx`.
*   **Document Generation**: `docx` is used for generating Word documents (e.g., resumes, cover letters).
*   **PDF Handling**: `jspdf` and `html2canvas` are used for generating PDF reports, and `pdfjs-dist` is used for parsing PDF files.
*   **DOCX Parsing**: `mammoth` is used for extracting raw text from DOCX files.
*   **Local Storage**: `localStorage` is utilized for client-side data persistence (e.g., resumes, applications, chat history).
*   **Build Tool**: Vite is the chosen build tool for a fast development experience.
*   **Icons**: Custom SVG icons are defined in `components/icons.tsx`.

## Library Usage Guidelines

To maintain consistency and efficiency, please adhere to the following rules when implementing new features or modifying existing ones:

*   **User Interface (UI)**: All UI components must be built using **React** and **TypeScript**.
*   **Styling**: Always use **Tailwind CSS** classes for styling. Avoid inline styles or custom CSS files unless absolutely necessary for highly specific, isolated cases.
*   **AI Functionality**: All interactions with AI models (e.g., content generation, analysis, chat) must use the **`@google/genai`** library.
*   **State Management**:
    *   For global application state that needs to be accessible across many components, use the **`AppContext`**.
    *   For component-specific state, use **`useState`** and other React Hooks.
*   **Routing**: Do **NOT** introduce `react-router-dom` or any other routing library. Continue to use the existing state-based routing mechanism via `AppContext` and `App.tsx`.
*   **PDF Generation**: When generating PDF documents from HTML elements, use **`jspdf`** and **`html2canvas`**.
*   **DOCX Generation**: For creating `.docx` files, use the **`docx`** library.
*   **File Parsing (PDF/DOCX)**:
    *   For parsing PDF files, use **`pdfjs-dist`**.
    *   For parsing DOCX files, use **`mammoth`**.
*   **Icons**: Utilize the existing custom SVG icons defined in **`components/icons.tsx`**. If a required icon is not available, create a new SVG icon in the same file following the existing pattern.
*   **Data Persistence**: For client-side data storage, use **`localStorage`** as demonstrated in `AppContext.tsx`.