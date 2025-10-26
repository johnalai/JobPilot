import React, { useState, useCallback, useEffect, useRef, useReducer } from 'react';
// FIX: Use relative paths for local module imports.
import { parseResumeText } from '../services/geminiService';
import { LoadingSpinner } from './icons';
import { useAppContext } from '../context/AppContext';
import { Resume, ResumeContent, ResumeVersion, ResumeTemplate } from '../types';
import { downloadTextFile, downloadElementAsPdf } from '../utils/fileUtils'; // Import for JSON export and PDF download

const EditIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" />
    </svg>
);

const PRESET_RESUME_TEMPLATES: ResumeTemplate[] = [
  {
    id: 'template-classic',
    name: 'Classic Professional',
    content: {
      rawText: `John Doe
123 Main Street, Anytown, USA
(123) 456-7890 | john.doe@email.com

Summary
Highly motivated and results-oriented professional with 5+ years of experience in project management and team leadership. Proven ability to deliver complex projects on time and within budget. Seeking to leverage strong organizational and communication skills to contribute to a dynamic team.

Skills
Project Management, Team Leadership, Budget Management, Strategic Planning, Communication, Problem Solving, Microsoft Office Suite, Agile Methodologies

Experience
Senior Project Manager | Tech Solutions Inc. | Anytown, USA | 2020 – Present
  Managed a portfolio of 5-7 concurrent software development projects with budgets up to $2M.
  Led cross-functional teams of 10-15 engineers, designers, and QA specialists.
  Implemented Agile Scrum methodologies, resulting in a 20% increase in project delivery efficiency.
Project Coordinator | Global Innovations | Anytown, USA | 2017 – 2020
  Assisted senior project managers in planning, executing, and closing projects.
  Developed and maintained project schedules, budgets, and risk registers.
  Facilitated team meetings and stakeholder communications.

Education
Master of Business Administration (MBA) | University of Anytown | 2019
Bachelor of Science in Business Administration | State University | 2017`,
      skills: ['Project Management', 'Team Leadership', 'Budget Management', 'Strategic Planning', 'Communication', 'Problem Solving', 'Microsoft Office Suite', 'Agile Methodologies'],
      experience: [
        { title: 'Senior Project Manager', company: 'Tech Solutions Inc.', description: 'Managed a portfolio of 5-7 concurrent software development projects with budgets up to $2M. Led cross-functional teams of 10-15 engineers, designers, and QA specialists. Implemented Agile Scrum methodologies, resulting in a 20% increase in project delivery efficiency.' },
        { title: 'Project Coordinator', company: 'Global Innovations', description: 'Assisted senior project managers in planning, executing, and closing projects. Developed and maintained project schedules, budgets, and risk registers. Facilitated team meetings and stakeholder communications.' }
      ],
      education: [
        { institution: 'University of Anytown', degree: 'Master of Business Administration (MBA)' },
        { institution: 'State University', degree: 'Bachelor of Science in Business Administration' }
      ],
      contactInfo: { name: 'John Doe', address: '123 Main Street, Anytown, USA', phone: '(123) 456-7890', email: 'john.doe@email.com' }
    }
  },
  {
    id: 'template-modern-tech',
    name: 'Modern Tech Professional',
    content: {
      rawText: `Jane Smith
(555) 123-4567 | jane.smith@dev.com | LinkedIn: /in/janesmithdev | GitHub: /janesmith

Summary
Results-driven Software Engineer with 3 years of experience in full-stack development using modern web technologies. Specializing in React, Node.js, and cloud platforms. Passionate about building scalable and user-friendly applications.

Skills
React, Node.js, JavaScript (ES6+), TypeScript, Python, AWS (EC2, Lambda, S3), Docker, PostgreSQL, MongoDB, Git, Agile, RESTful APIs, TDD

Experience
Software Engineer | Innovate Solutions | City, State | 2021 – Present
  Developed and maintained high-performance web applications using React, Node.js, and PostgreSQL.
  Implemented robust RESTful APIs, improving data retrieval efficiency by 30%.
  Collaborated with product teams to translate requirements into technical specifications, delivering features on time.
Junior Developer | WebCrafters Co. | City, State | 2020 – 2021
  Assisted in front-end development, focusing on responsive UI with HTML, CSS, and JavaScript.
  Contributed to migration of legacy systems to modern frameworks.

Education
Bachelor of Science in Computer Science | Tech University | 2020`,
      skills: ['React', 'Node.js', 'JavaScript (ES6+)', 'TypeScript', 'Python', 'AWS (EC2, Lambda, S3)', 'Docker', 'PostgreSQL', 'MongoDB', 'Git', 'Agile', 'RESTful APIs', 'TDD'],
      experience: [
        { title: 'Software Engineer', company: 'Innovate Solutions', description: 'Developed and maintained high-performance web applications using React, Node.js, and PostgreSQL. Implemented robust RESTful APIs, improving data retrieval efficiency by 30%. Collaborated with product teams to translate requirements into technical specifications, delivering features on time.' },
        { title: 'Junior Developer', company: 'WebCrafters Co.', description: 'Assisted in front-end development, focusing on responsive UI with HTML, CSS, and JavaScript. Contributed to migration of legacy systems to modern frameworks.' }
      ],
      education: [
        { institution: 'Tech University', degree: 'Bachelor of Science in Computer Science' }
      ],
      contactInfo: { name: 'Jane Smith', address: 'City, State', phone: '(555) 123-4567', email: 'jane.smith@dev.com' }
    }
  },
  {
    id: 'template-minimalist',
    name: 'Minimalist',
    content: {
      rawText: `Alex Johnson
alex.johnson@email.com | (987) 654-3210 | LinkedIn.com/in/alexjohnson

Profile
Highly adaptable professional with a knack for process optimization and data analysis. Seeking to contribute to an innovative environment, leveraging strong analytical and problem-solving skills.

Skills
Data Analysis, Process Improvement, Microsoft Excel, SQL, Project Support, Communication, Research

Experience
Business Analyst | Efficiency Pro Inc. | City, State | 2022 – Present
  Analyzed operational data to identify bottlenecks, improving workflow efficiency by 15%.
  Developed SQL queries to extract key performance indicators for monthly reports.
  Supported project managers with data validation and documentation.
Project Assistant | Solutions Co. | City, State | 2020 – 2022
  Coordinated project schedules and resources, ensuring timely completion of tasks.
  Maintained accurate project documentation and communications.

Education
Bachelor of Arts in Economics | City College | 2020`,
      skills: ['Data Analysis', 'Process Improvement', 'Microsoft Excel', 'SQL', 'Project Support', 'Communication', 'Research'],
      experience: [
        { title: 'Business Analyst', company: 'Efficiency Pro Inc.', description: 'Analyzed operational data to identify bottlenecks, improving workflow efficiency by 15%. Developed SQL queries to extract key performance indicators for monthly reports. Supported project managers with data validation and documentation.' },
        { title: 'Project Assistant', company: 'Solutions Co.', description: 'Coordinated project schedules and resources, ensuring timely completion of tasks. Maintained accurate project documentation and communications.' }
      ],
      education: [
        { institution: 'City College', degree: 'Bachelor of Arts in Economics' }
      ],
      contactInfo: { name: 'Alex Johnson', address: 'City, State', phone: '(987) 654-3210', email: 'alex.johnson@email.com' }
    }
  },
  {
    id: 'template-creative',
    name: 'Creative Design',
    content: {
      rawText: `Maria Sanchez
Creative Designer
hello@mariasanch.design | +1 (111) 222-3333 | Portfolio: mariasanch.design/portfolio | Instagram: @mariasanch_design

Summary
Passionate and innovative Graphic Designer with 4 years of experience crafting compelling visual narratives. Expertise in brand identity, digital marketing collateral, and user interface design. Committed to delivering impactful designs that resonate with target audiences.

Skills
Adobe Creative Suite (Photoshop, Illustrator, InDesign, XD), Figma, UI/UX Design, Branding, Typography, Digital Illustration, Marketing Collateral, Print Design

Experience
Graphic Designer | Visionary Studio | Town, State | 2021 – Present
  Led design projects from concept to completion, including branding, web graphics, and print materials.
  Collaborated with marketing teams to create visually engaging campaigns that increased engagement by 25%.
  Mentored junior designers on best practices for Adobe Creative Suite and design principles.
Junior Graphic Designer | Bright Spark Agency | Town, State | 2019 – 2021
  Assisted senior designers in creating digital and print assets for various clients.
  Developed wireframes and prototypes for small-scale UI projects.

Education
Bachelor of Fine Arts in Graphic Design | Art Institute | 2019`,
      skills: ['Adobe Creative Suite (Photoshop, Illustrator, InDesign, XD)', 'Figma', 'UI/UX Design', 'Branding', 'Typography', 'Digital Illustration', 'Marketing Collateral', 'Print Design'],
      experience: [
        { title: 'Graphic Designer', company: 'Visionary Studio', description: 'Led design projects from concept to completion, including branding, web graphics, and print materials. Collaborated with marketing teams to create visually engaging campaigns that increased engagement by 25%. Mentored junior designers on best practices for Adobe Creative Suite and design principles.' },
        { title: 'Junior Designer', company: 'Bright Spark Agency', description: 'Assisted senior designers in creating digital and print assets for various clients. Developed wireframes and prototypes for small-scale UI projects.' }
      ],
      education: [
        { institution: 'Art Institute', degree: 'Bachelor of Fine Arts in Graphic Design' }
      ],
      contactInfo: { name: 'Maria Sanchez', address: 'Town, State', phone: '+1 (111) 222-3333', email: 'hello@mariasanch.design' }
    }
  }
];

// --- useReducer definitions for the add/edit form ---
interface FormState {
  rawText: string;
  newResumeName: string;
  parsedContent: ResumeContent | null;
  selectedTemplateId: string | null;
  loading: boolean;
  statusMessage: string;
  formError: string | null; // Renamed to formError to distinguish from global error
}

type FormAction =
  | { type: 'SET_RAW_TEXT'; payload: string }
  | { type: 'SET_NEW_NAME'; payload: string }
  | { type: 'SET_PARSED_CONTENT'; payload: ResumeContent | null }
  | { type: 'SET_SELECTED_TEMPLATE_ID'; payload: string | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_STATUS_MESSAGE'; payload: string }
  | { type: 'SET_FORM_ERROR'; payload: string | null } // Renamed action type
  | { type: 'RESET_FORM' };

const initialFormState: FormState = {
  rawText: '',
  newResumeName: '',
  parsedContent: null,
  selectedTemplateId: null,
  loading: false,
  statusMessage: '',
  formError: null,
};

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'SET_RAW_TEXT':
      return { ...state, rawText: action.payload };
    case 'SET_NEW_NAME':
      return { ...state, newResumeName: action.payload };
    case 'SET_PARSED_CONTENT':
      return { ...state, parsedContent: action.payload };
    case 'SET_SELECTED_TEMPLATE_ID':
      return { ...state, selectedTemplateId: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_STATUS_MESSAGE':
      return { ...state, statusMessage: action.payload };
    case 'SET_FORM_ERROR': // Handle new action type
      return { ...state, formError: action.payload };
    case 'RESET_FORM':
      return initialFormState;
    default:
      return state;
  }
}
// --- End useReducer definitions ---


const ResumeHub: React.FC = () => {
  const { resumes, setResumes, defaultResumeId, setDefaultResumeId, setError: setGlobalError } = useAppContext(); // Get global setError
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [view, setView] = useState<'view' | 'add'>('view'); // 'view' to show details/history, 'add' to edit/create
  
  // Refactored form state using useReducer
  const [formState, dispatch] = useReducer(formReducer, initialFormState);
  const { rawText, newResumeName, parsedContent, selectedTemplateId, loading, statusMessage, formError } = formState;

  const [isEditingName, setIsEditingName] = useState(false);
  const [currentEditedName, setCurrentEditedName] = useState('');
  
  const selectedResume = resumes.find(r => r.id === selectedResumeId);

  // Effect to populate form when switching to 'add' mode or selected resume changes
  useEffect(() => {
    if (view === 'add' && selectedResume) {
      dispatch({ type: 'SET_NEW_NAME', payload: selectedResume.name });
      dispatch({ type: 'SET_RAW_TEXT', payload: selectedResume.activeContent.rawText });
      dispatch({ type: 'SET_PARSED_CONTENT', payload: selectedResume.activeContent });
      dispatch({ type: 'SET_SELECTED_TEMPLATE_ID', payload: null }); // Clear selected template when editing an existing resume
    } else if (view === 'add' && !selectedResumeId) {
      // If no resume selected but in 'add' view, clear form for a new resume
      dispatch({ type: 'RESET_FORM' }); 
    }
    // Also, when switching views, ensure edit name state is off
    setIsEditingName(false);
  }, [view, selectedResumeId, resumes, selectedResume]); // Add selectedResume to dependencies


  const resetAddForm = () => {
    dispatch({ type: 'RESET_FORM' });
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_STATUS_MESSAGE', payload: 'Extracting text from file...' });
    dispatch({ type: 'SET_FORM_ERROR', payload: null });
    dispatch({ type: 'SET_PARSED_CONTENT', payload: null }); // Clear previous parsed content
    dispatch({ type: 'SET_SELECTED_TEMPLATE_ID', payload: null }); // Clear template selection
    
    // Always set rawText to new content from file, regardless of selectedResumeId
    dispatch({ type: 'SET_RAW_TEXT', payload: '' }); 

    try {
      let extractedText = '';
      if (file.type === 'application/pdf') {
        // Use importmap for pdfjsLib
        const pdfjsLib = await import('pdfjs-dist@^5.4.296');
        // FIX: Update workerSrc to match the version in index.html (5.4.296)
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.296/build/pdf.worker.mjs`;
        
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        
        const textItems = [];
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            textItems.push(...textContent.items.map(item => ('str' in item ? item.str : '')));
        }
        extractedText = textItems.join(' ');
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        // Use importmap for mammoth
        const mammoth = await import('mammoth');
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        extractedText = result.value;
      } else {
        throw new Error("Unsupported file type. Please upload a PDF or DOCX file.");
      }
      
      dispatch({ type: 'SET_RAW_TEXT', payload: extractedText });
      // Only set newResumeName from filename if no resume is currently selected AND input name is empty
      if (!selectedResumeId && !newResumeName && file.name) { 
        dispatch({ type: 'SET_NEW_NAME', payload: file.name.replace(/\.[^/.]+$/, "") }); 
      }
      await runAIParser(extractedText);

    } catch (e: any) {
      dispatch({ type: 'SET_FORM_ERROR', payload: e.message || "Failed to process the file." });
      dispatch({ type: 'SET_LOADING', payload: false });
      dispatch({ type: 'SET_STATUS_MESSAGE', payload: '' });
    }
    
    if(event.target) event.target.value = '';
  };
  
  const runAIParser = useCallback(async (textToParse: string) => {
    if (!textToParse.trim()) {
      dispatch({ type: 'SET_FORM_ERROR', payload: "Text is empty. Please upload or paste resume content." });
      dispatch({ type: 'SET_LOADING', payload: false });
      return;
    }
    dispatch({ type: 'SET_STATUS_MESSAGE', payload: 'Parsing with AI...' });
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_FORM_ERROR', payload: null });
    try {
      const parsedData = await parseResumeText(textToParse);
      dispatch({ type: 'SET_PARSED_CONTENT', payload: { skills: [], experience: [], education: [], ...parsedData, rawText: textToParse } });
    } catch (e: any) {
      dispatch({ type: 'SET_FORM_ERROR', payload: e.message || "Failed to parse resume." });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
      dispatch({ type: 'SET_STATUS_MESSAGE', payload: '' });
    }
  }, []);

  // Check if parsed content is different from the active content of the selected resume
  const isParsedContentNewerThanActive = useCallback(() => {
    if (!selectedResume || !parsedContent) return false;
    // Simple check based on raw text. Can be made more robust with deep comparison.
    return parsedContent.rawText !== selectedResume.activeContent.rawText;
  }, [selectedResume, parsedContent]);

  // Unified function to save new resume or update existing with a new version
  const handleSaveResumeVersion = () => {
    if (!newResumeName.trim() || !parsedContent) {
        dispatch({ type: 'SET_FORM_ERROR', payload: "Please provide a name for the resume and ensure it has been parsed." });
        return;
    }

    if (selectedResumeId && selectedResume && isParsedContentNewerThanActive()) {
        // Update existing resume with new version
        setResumes(prev => prev.map(r => {
            if (r.id === selectedResumeId) {
                const newVersion: ResumeVersion = {
                    content: parsedContent,
                    timestamp: Date.now(),
                    versionName: `Update - ${new Date().toLocaleString()}`,
                };
                return {
                    ...r,
                    name: newResumeName, // Allow renaming the main resume
                    activeContent: parsedContent,
                    versions: [...r.versions, newVersion],
                };
            }
            return r;
        }));
        dispatch({ type: 'SET_STATUS_MESSAGE', payload: 'Resume updated with a new version.' });
    } else if (!selectedResumeId) {
        // Add new resume
        const newVersion: ResumeVersion = {
            content: parsedContent,
            timestamp: Date.now(),
            versionName: selectedTemplateId ? `Initial Version (from ${PRESET_RESUME_TEMPLATES.find(t => t.id === selectedTemplateId)?.name || 'Template'})` : 'Initial Version',
        };
        const newResume: Resume = {
            id: Date.now().toString(),
            name: newResumeName,
            activeContent: parsedContent,
            versions: [newVersion],
        };
        const isFirstResume = resumes.length === 0;
        setResumes(prev => [...prev, newResume]);
        if (isFirstResume) {
            setDefaultResumeId(newResume.id);
        }
        dispatch({ type: 'SET_STATUS_MESSAGE', payload: 'New resume saved.' });
        setSelectedResumeId(newResume.id); // Select the new resume
    } else {
        // This case handles when user clicks save but no new content was parsed or selected an existing one and parsed content is identical to active content
        dispatch({ type: 'SET_STATUS_MESSAGE', payload: 'No changes to save, or content is identical to active version.' });
    }
    
    setView('view'); // Go back to view mode after save/update
    // Clear temporary form states
    dispatch({ type: 'RESET_FORM' }); 
  };
  
  const handleDeleteResume = (idToDelete: string) => {
    setResumes(prev => prev.filter(r => r.id !== idToDelete));
    if (defaultResumeId === idToDelete) {
        setDefaultResumeId(null);
    }
    if (selectedResumeId === idToDelete) {
        setSelectedResumeId(null);
        setView('view'); // Go back to view mode with no resume selected
    }
  };

  const handleStartEditName = () => {
    if (selectedResume) {
        setIsEditingName(true);
        setCurrentEditedName(selectedResume.name);
    }
  };

  const handleSaveName = () => {
    if (selectedResume && currentEditedName.trim()) {
        setResumes(prev => prev.map(r => 
            r.id === selectedResume.id ? { ...r, name: currentEditedName.trim() } : r
        ));
        setIsEditingName(false);
    }
  };

  const handleRevertToVersion = (resumeId: string, versionTimestamp: number, originalVersionName: string) => {
    setResumes(prevResumes => prevResumes.map(resume => {
        if (resume.id === resumeId) {
            const targetVersion = resume.versions.find(v => v.timestamp === versionTimestamp);
            if (!targetVersion) {
                setGlobalError("Version not found for reversion."); // Use global setError
                return resume; 
            }

            const revertVersionEntry: ResumeVersion = {
                content: targetVersion.content,
                timestamp: Date.now(),
                versionName: `Reverted to "${originalVersionName}" (${new Date().toLocaleString()})`,
            };

            return {
                ...resume,
                activeContent: targetVersion.content,
                versions: [...resume.versions, revertVersionEntry],
            };
        }
        return resume;
    }));
    dispatch({ type: 'SET_STATUS_MESSAGE', payload: `Successfully reverted to version "${originalVersionName}". A new version entry has been created.` });
    // The UI will re-render automatically with the updated activeContent
  };
  
  const handleSelectTemplate = (templateId: string) => {
    if (templateId === "") {
        dispatch({ type: 'RESET_FORM' }); // Reset all form states
        dispatch({ type: 'SET_STATUS_MESSAGE', payload: "Starting with an empty resume." });
        return;
    }
    const template = PRESET_RESUME_TEMPLATES.find(t => t.id === templateId);
    if (template) {
        dispatch({ type: 'SET_SELECTED_TEMPLATE_ID', payload: templateId });
        if (!newResumeName.trim()) { // Only set name if current input is empty
            dispatch({ type: 'SET_NEW_NAME', payload: template.name });
        }
        dispatch({ type: 'SET_RAW_TEXT', payload: template.content.rawText });
        dispatch({ type: 'SET_PARSED_CONTENT', payload: template.content }); // Use pre-parsed content from template
        dispatch({ type: 'SET_STATUS_MESSAGE', payload: `Template "${template.name}" applied. You can now edit the content.` });
        dispatch({ type: 'SET_FORM_ERROR', payload: null }); // Clear local form error
    }
  };

  const handleExportResumes = () => {
    try {
        const resumesJson = JSON.stringify(resumes, null, 2);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        downloadTextFile(`jobpilot_resumes_export_${timestamp}.json`, resumesJson, 'application/json');
        dispatch({ type: 'SET_STATUS_MESSAGE', payload: 'All resumes exported successfully!' }); // Use formState dispatch
    } catch (e: any) {
        setGlobalError('Failed to export resumes: ' + (e.message || 'Unknown error.')); // Use global setError
    }
  };

  const handleImportResumes = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    dispatch({ type: 'SET_STATUS_MESSAGE', payload: 'Importing resumes...' }); // Use formState dispatch
    setGlobalError(null); // Clear global error

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const content = e.target?.result as string;
            const importedData = JSON.parse(content);

            if (!Array.isArray(importedData)) {
                throw new Error('Imported file does not contain a valid array of resumes.');
            }
            // Basic validation for resume structure
            const isValid = importedData.every(item => 
                typeof item === 'object' && item !== null && 'id' in item && 'name' in item && 'activeContent' in item
            );

            if (!isValid) {
                throw new Error('Imported file has an invalid resume structure.');
            }

            setResumes(importedData); // Replace existing resumes with imported ones
            dispatch({ type: 'SET_STATUS_MESSAGE', payload: `Successfully imported ${importedData.length} resumes!` }); // Use formState dispatch
            setSelectedResumeId(importedData.length > 0 ? importedData[0].id : null); // Select the first imported resume
            setView('view');
        } catch (e: any) {
            setGlobalError('Failed to import resumes: ' + (e.message || 'Invalid JSON file.')); // Use global setError
        } finally {
            if (event.target) event.target.value = ''; // Clear file input
        }
    };
    reader.onerror = (e) => {
        setGlobalError('Error reading file: ' + (e.target?.error?.message || 'Unknown error.')); // Use global setError
    };
    reader.readAsText(file);
  };

  const handleDownloadPdf = () => {
    if (selectedResume) {
        downloadElementAsPdf('printable-resume-content', `${selectedResume.name}-Resume.pdf`);
    } else {
        setGlobalError("No resume selected to download as PDF."); // Use global setError
    }
  };


  const renderResumeDetails = (resumeContent: ResumeContent) => (
    <div className="space-y-6 h-[28rem] overflow-y-auto pr-2">
      {resumeContent.contactInfo && (resumeContent.contactInfo.name || resumeContent.contactInfo.address || resumeContent.contactInfo.phone || resumeContent.contactInfo.email) && (
        <div>
          <h4 className="font-semibold text-lg mb-2">Contact Information</h4>
          <div className="p-3 bg-gray-100 dark:bg-gray-700/50 rounded-lg text-sm">
            {resumeContent.contactInfo.name && <p className="font-bold">{resumeContent.contactInfo.name}</p>}
            {resumeContent.contactInfo.address && <p>{resumeContent.contactInfo.address}</p>}
            {(resumeContent.contactInfo.phone || resumeContent.contactInfo.email) && (
              <p>{resumeContent.contactInfo.phone} {resumeContent.contactInfo.phone && resumeContent.contactInfo.email ? '|' : ''} {resumeContent.contactInfo.email}</p>
            )}
          </div>
        </div>
      )}
      <div>
        <h4 className="font-semibold text-lg mb-2">Skills</h4>
        <div className="flex flex-wrap gap-2">
          {resumeContent.skills.map((skill, index) => (
            <span key={index} className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 text-sm font-medium px-2.5 py-1 rounded-full">
              {skill}
            </span>
          ))}
        </div>
      </div>
      <div>
        <h4 className="font-semibold text-lg mb-2">Experience</h4>
        <div className="space-y-4">
          {resumeContent.experience.map((exp, index) => (
            <div key={index} className="p-3 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
              <p className="font-bold">{exp.title}</p>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{exp.company}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{exp.description}</p>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h4 className="font-semibold text-lg mb-2">Education</h4>
        <div className="space-y-3">
          {resumeContent.education.map((edu, index) => (
            <div key={index} className="p-3 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
              <p className="font-bold">{edu.institution}</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{edu.degree}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-gray-800 dark:text-white">Resume Hub</h2>
        <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">Manage your saved resumes and their versions. Add, view, edit, and set a default for job searching.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Resume List */}
        <div className="lg:col-span-1 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
          <h3 className="text-xl font-semibold mb-4">My Resumes</h3>
          <div className="space-y-2">
            {resumes.map(resume => (
              <div key={resume.id} onClick={() => { setSelectedResumeId(resume.id); setView('view'); }}
                className={`p-3 rounded-lg cursor-pointer transition-colors border-2 ${selectedResumeId === resume.id ? 'bg-blue-100 dark:bg-blue-900/50 border-blue-500' : 'bg-gray-100 dark:bg-gray-700/50 border-transparent hover:border-blue-400'}`}>
                <div className="flex justify-between items-center">
                    <div>
                        <p className="font-semibold">{resume.name}</p>
                        {resume.id === defaultResumeId && <span className="text-xs text-green-600 dark:text-green-400 font-bold">Default</span>}
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={(e) => { e.stopPropagation(); setDefaultResumeId(resume.id); }} disabled={resume.id === defaultResumeId} className="text-xs font-semibold disabled:opacity-50 text-blue-600 hover:underline">Set Default</button>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteResume(resume.id); }} className="text-xs font-semibold text-red-600 hover:underline">Delete</button>
                    </div>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => { setView('add'); setSelectedResumeId(null); resetAddForm(); }} className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
            + Add New Resume
          </button>
          
          <div className="mt-4 flex flex-col gap-2">
            <button
                onClick={handleExportResumes}
                className="w-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold py-2 px-4 rounded-lg transition-colors"
            >
                Export All Resumes (JSON)
            </button>
            <label className="w-full cursor-pointer bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold py-2 px-4 rounded-lg text-center transition-colors">
                Import Resumes (JSON)
                <input type="file" accept=".json" className="hidden" onChange={handleImportResumes} />
            </label>
          </div>

        </div>

        {/* Display/Add Section */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
          {view === 'add' ? (
            <div>
                <h3 className="text-xl font-semibold mb-4">{selectedResume ? `Edit Resume: ${selectedResume.name}` : 'Add New Resume'}</h3>
                {statusMessage && <p className="text-green-500 text-sm mb-4 text-center">{statusMessage}</p>}
                <div className="space-y-4">
                    {!selectedResume && (
                        <div className="mb-4">
                            <label htmlFor="template-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Or start with a template:
                            </label>
                            <select
                                id="template-select"
                                value={selectedTemplateId || ''}
                                onChange={(e) => dispatch({ type: 'SET_SELECTED_TEMPLATE_ID', payload: e.target.value === "" ? null : e.target.value })}
                                className="w-full p-3 border rounded-lg bg-gray-50 dark:bg-gray-700"
                                disabled={loading}
                            >
                                <option value="">-- Empty Resume --</option>
                                {PRESET_RESUME_TEMPLATES.map(template => (
                                    <option key={template.id} value={template.id}>{template.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <textarea value={rawText} onChange={(e) => { dispatch({ type: 'SET_RAW_TEXT', payload: e.target.value }); dispatch({ type: 'SET_PARSED_CONTENT', payload: null }); dispatch({ type: 'SET_SELECTED_TEMPLATE_ID', payload: null }); }} placeholder="Paste resume text here, or upload a file."
                        className="w-full h-64 p-4 border rounded-lg bg-gray-50 dark:bg-gray-700"/>
                    <div className="flex gap-4">
                        <label className="cursor-pointer bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm font-semibold py-2 px-4 rounded-lg flex-1 text-center">
                            Upload File <input type="file" accept=".pdf,.docx" className="hidden" onChange={handleFileChange} disabled={loading}/>
                        </label>
                        <button onClick={() => runAIParser(rawText)} disabled={loading || !rawText.trim()} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50 flex-1">
                          {loading ? <LoadingSpinner className="w-5 h-5 mx-auto"/> : 'Parse Content'}
                        </button>
                    </div>
                    {formError && <p className="text-red-500 text-sm mt-2">{formError}</p>}
                    {loading && statusMessage && <p className="text-blue-500 text-sm text-center mt-2">{statusMessage}</p>}
                    {parsedContent && (
                        <div className="mt-4 p-4 border-t dark:border-gray-700">
                           {renderResumeDetails(parsedContent)}
                           <div className="mt-4 flex gap-4 items-center">
                             <input type="text" value={newResumeName} onChange={(e) => dispatch({ type: 'SET_NEW_NAME', payload: e.target.value })} placeholder="Enter a name for this resume" className="flex-grow p-2 border rounded-lg bg-gray-50 dark:bg-gray-700"/>
                             <button 
                                onClick={handleSaveResumeVersion} 
                                disabled={!newResumeName.trim() || loading || (!selectedResumeId && !parsedContent) || (selectedResumeId && !isParsedContentNewerThanActive() && parsedContent?.rawText === selectedResume?.activeContent.rawText)}
                                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50"
                              >
                                {selectedResumeId && parsedContent && isParsedContentNewerThanActive() ? 'Update Resume (New Version)' : 'Save Resume'}
                              </button>
                           </div>
                        </div>
                    )}
                </div>
            </div>
          ) : selectedResume ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                  {isEditingName ? (
                      <div className="flex items-center gap-2 flex-grow">
                          <input
                              type="text"
                              value={currentEditedName}
                              onChange={(e) => setCurrentEditedName(e.target.value)}
                              className="flex-grow p-2 border rounded-lg bg-gray-50 dark:bg-gray-700 text-xl font-semibold"
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                          />
                          <button onClick={handleSaveName} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg text-sm">Save</button>
                          <button onClick={() => setIsEditingName(false)} className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg text-sm">Cancel</button>
                      </div>
                  ) : (
                      <div className="flex items-center gap-3">
                          <h3 className="text-xl font-semibold">{selectedResume.name}</h3>
                          <button onClick={handleStartEditName} className="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400">
                            <EditIcon className="w-5 h-5" />
                          </button>
                          <button onClick={() => { setView('add'); dispatch({ type: 'SET_RAW_TEXT', payload: selectedResume.activeContent.rawText }); dispatch({ type: 'SET_NEW_NAME', payload: selectedResume.name }); dispatch({ type: 'SET_PARSED_CONTENT', payload: selectedResume.activeContent }); dispatch({ type: 'SET_SELECTED_TEMPLATE_ID', payload: null }); }} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded-lg text-sm">
                            Edit Content
                          </button>
                      </div>
                  )}
              </div>
              <h4 className="font-semibold text-lg mb-2">Active Content:</h4>
              {renderResumeDetails(selectedResume.activeContent)}

              {/* Download Buttons */}
              <div className="mt-4 flex gap-2">
                <button 
                    onClick={() => downloadTextFile(`${selectedResume.name}-Raw.txt`, selectedResume.activeContent.rawText)} 
                    className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold py-2 px-4 rounded-lg text-sm transition-colors"
                >
                    Download Raw Text
                </button>
                <button 
                    onClick={handleDownloadPdf} 
                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors"
                >
                    Download PDF
                </button>
              </div>

              {/* Version History Section */}
              <div className="mt-8 pt-6 border-t dark:border-gray-700">
                <h4 className="font-semibold text-lg mb-4">Version History</h4>
                {selectedResume.versions.length > 1 ? ( // Only show history if there's more than one version
                    <div className="space-y-3 h-64 overflow-y-auto pr-2">
                        {/* Sort versions by timestamp descending to show most recent first */}
                        {selectedResume.versions.sort((a, b) => b.timestamp - a.timestamp).map((version, index) => (
                            <div key={version.timestamp} className={`p-3 rounded-lg border ${version.content.rawText === selectedResume.activeContent.rawText ? 'bg-indigo-100 dark:bg-indigo-900/50 border-indigo-500' : 'bg-gray-100 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'}`}>
                                <p className="font-semibold">{version.versionName}</p>
                                <p className="text-xs text-gray-600 dark:text-gray-400">{new Date(version.timestamp).toLocaleString()}</p>
                                {version.content.rawText !== selectedResume.activeContent.rawText && (
                                    <button 
                                        onClick={() => handleRevertToVersion(selectedResume.id, version.timestamp, version.versionName)}
                                        className="mt-2 text-xs font-semibold text-blue-600 hover:underline"
                                    >
                                        Revert to this version
                                    </button>
                                )}
                                {version.content.rawText === selectedResume.activeContent.rawText && (
                                    <span className="mt-2 text-xs font-semibold text-indigo-700 dark:text-indigo-400">Currently Active</span>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-gray-500 dark:text-gray-400 text-sm">No previous versions available. Save updates to create versions.</p>
                )}
              </div>
            </div>
          ) : (
             <div className="flex justify-center items-center h-full text-center">
                <p className="text-gray-500 dark:text-gray-400">Select a resume to view its details, or add a new one.</p>
            </div>
          )}
        </div>
      </div>
      {formError && <p className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-red-500 text-white py-2 px-4 rounded-lg shadow-lg z-50">{formError}</p>}
      {statusMessage && <p className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-green-500 text-white py-2 px-4 rounded-lg shadow-lg z-50">{statusMessage}</p>}

      {/* Hidden div for PDF generation */}
      <div className="absolute -left-[9999px] top-0" id="printable-resume-content">
        {selectedResume && (
          <div className="pdf-content-wrapper">
            {/* The renderPrintableContent function from TailoredDocuments.tsx is the canonical way to render this.
                Duplicating the logic here would be a maintenance nightmare.
                Instead, we rely on the generic structure and styling from the pdf-content-wrapper.
                For ResumeHub, we simply ensure the core contact info is there. */}
            {selectedResume.activeContent.contactInfo && (
              <div className="pdf-header-block">
                <h1 className="pdf-h1">{selectedResume.activeContent.contactInfo.name || 'Your Name'}</h1>
                {selectedResume.activeContent.contactInfo.address && <p className="pdf-text-lg">{selectedResume.activeContent.contactInfo.address}</p>}
                {(selectedResume.activeContent.contactInfo.phone || selectedResume.activeContent.contactInfo.email) && (
                  <p className="pdf-text-lg">
                    {selectedResume.activeContent.contactInfo.phone}
                    {(selectedResume.activeContent.contactInfo.phone && selectedResume.activeContent.contactInfo.email) ? ' • ' : ''}
                    {selectedResume.activeContent.contactInfo.email}
                  </p>
                )}
              </div>
            )}

            {/* General Content sections */}
            {selectedResume.activeContent.rawText.split('\n').map((line, index) => {
                const trimmedLine = line.trim();
                if (trimmedLine.length === 0) return <p key={`blank-${index}`} className="pdf-mb-1">&nbsp;</p>; // Preserve blank lines

                // Simple heuristic to differentiate main sections from plain text
                if (trimmedLine.match(/^(Summary|Skills|Experience|Education|Projects|Awards|Certifications):?$/i)) {
                    return <h2 key={index} className="pdf-h2 pdf-mt-4">{trimmedLine}</h2>;
                }
                // Try to catch common bullet formats
                if (trimmedLine.startsWith('* ') || trimmedLine.startsWith('- ') || trimmedLine.match(/^\d+\.\s/)) {
                    return <ul key={index} className="pdf-ul"><li className="pdf-li pdf-text-sm">{trimmedLine.replace(/^((\*|-|\d+\.)\s*)/, '')}</li></ul>;
                }
                return <p key={index} className="pdf-p pdf-text-sm">{trimmedLine}</p>;
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResumeHub;