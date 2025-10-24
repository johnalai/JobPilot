import React, { useState, useCallback, useEffect, useRef } from 'react';
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
        { title: 'Junior Graphic Designer', company: 'Bright Spark Agency', description: 'Assisted senior designers in creating digital and print assets for various clients. Developed wireframes and prototypes for small-scale UI projects.' }
      ],
      education: [
        { institution: 'Art Institute', degree: 'Bachelor of Fine Arts in Graphic Design' }
      ],
      contactInfo: { name: 'Maria Sanchez', address: 'Town, State', phone: '+1 (111) 222-3333', email: 'hello@mariasanch.design' }
    }
  }
];

const ResumeHub: React.FC = () => {
  const { resumes, setResumes, defaultResumeId, setDefaultResumeId } = useAppContext();
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [view, setView] = useState<'view' | 'add'>('view'); // 'view' to show details/history, 'add' to edit/create
  
  const [rawText, setRawText] = useState(''); // Raw text for the input area
  const [newResumeName, setNewResumeName] = useState(''); // Name for the resume (either new or current)
  const [parsedContent, setParsedContent] = useState<ResumeContent | null>(null); // Parsed content from AI
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [isEditingName, setIsEditingName] = useState(false);
  const [currentEditedName, setCurrentEditedName] = useState('');
  
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  
  const selectedResume = resumes.find(r => r.id === selectedResumeId);

  // Effect to populate form when switching to 'add' mode or selected resume changes
  useEffect(() => {
    if (view === 'add' && selectedResume) {
      setNewResumeName(selectedResume.name);
      setRawText(selectedResume.activeContent.rawText);
      setParsedContent(selectedResume.activeContent); // Also pre-populate parsed content
      setSelectedTemplateId(null); // Clear selected template when editing an existing resume
    } else if (view === 'add' && !selectedResumeId) {
      // If no resume selected but in 'add' view, clear form for a new resume
      resetAddForm(); 
    }
    // Also, when switching views, ensure edit name state is off
    setIsEditingName(false);
  }, [view, selectedResumeId, resumes, selectedResume]); // Add selectedResume to dependencies


  const resetAddForm = () => {
    setRawText('');
    setNewResumeName('');
    setParsedContent(null);
    setLoading(false);
    setStatusMessage('');
    setError(null);
    setSelectedTemplateId(null); // Clear selected template
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setStatusMessage('Extracting text from file...');
    setError(null);
    setParsedContent(null); // Clear previous parsed content
    setSelectedTemplateId(null); // Clear template selection
    
    // Always set rawText to new content from file, regardless of selectedResumeId
    setRawText(''); 

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
      
      setRawText(extractedText);
      // Only set newResumeName from filename if no resume is currently selected AND input name is empty
      if (!selectedResumeId && !newResumeName && file.name) { 
        setNewResumeName(file.name.replace(/\.[^/.]+$/, "")); 
      }
      await runAIParser(extractedText);

    } catch (e: any) {
      setError(e.message || "Failed to process the file.");
      setLoading(false);
      setStatusMessage('');
    }
    
    if(event.target) event.target.value = '';
  };
  
  const runAIParser = useCallback(async (textToParse: string) => {
    if (!textToParse.trim()) {
      setError("Text is empty. Please upload or paste resume content.");
      setLoading(false);
      return;
    }
    setStatusMessage('Parsing with AI...');
    setLoading(true);
    setError(null);
    try {
      const parsedData = await parseResumeText(textToParse);
      setParsedContent({ skills: [], experience: [], education: [], ...parsedData, rawText: textToParse });
    } catch (e: any) {
      setError(e.message || "Failed to parse resume.");
    } finally {
      setLoading(false);
      setStatusMessage('');
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
        setError("Please provide a name for the resume and ensure it has been parsed.");
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
        setStatusMessage('Resume updated with a new version.');
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
        setStatusMessage('New resume saved.');
        setSelectedResumeId(newResume.id); // Select the new resume
    } else {
        // This case handles when user clicks save but no new content was parsed or selected an existing one and parsed content is identical to active content
        setStatusMessage('No changes to save, or content is identical to active version.');
    }
    
    setView('view'); // Go back to view mode after save/update
    // Clear temporary form states
    resetAddForm(); 
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
                setError("Version not found for reversion.");
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
    setStatusMessage(`Successfully reverted to version "${originalVersionName}". A new version entry has been created.`);
    // The UI will re-render automatically with the updated activeContent
  };
  
  const handleSelectTemplate = (templateId: string) => {
    if (templateId === "") {
        resetAddForm(); // Select "Empty Resume" option
        setStatusMessage("Starting with an empty resume.");
        return;
    }
    const template = PRESET_RESUME_TEMPLATES.find(t => t.id === templateId);
    if (template) {
        setSelectedTemplateId(templateId);
        if (!newResumeName.trim()) { // Only set name if current input is empty
            setNewResumeName(template.name);
        }
        setRawText(template.content.rawText);
        setParsedContent(template.content); // Use pre-parsed content from template
        setStatusMessage(`Template "${template.name}" applied. You can now edit the content.`);
        setError(null);
    }
  };

  const handleExportResumes = () => {
    try {
        const resumesJson = JSON.stringify(resumes, null, 2);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        downloadTextFile(`jobpilot_resumes_export_${timestamp}.json`, resumesJson, 'application/json');
        setStatusMessage('All resumes exported successfully!');
    } catch (e: any) {
        setError('Failed to export resumes: ' + (e.message || 'Unknown error.'));
    }
  };

  const handleImportResumes = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setStatusMessage('Importing resumes...');
    setError(null);

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
            setStatusMessage(`Successfully imported ${importedData.length} resumes!`);
            setSelectedResumeId(importedData.length > 0 ? importedData[0].id : null); // Select the first imported resume
            setView('view');
        } catch (e: any) {
            setError('Failed to import resumes: ' + (e.message || 'Invalid JSON file.'));
        } finally {
            if (event.target) event.target.value = ''; // Clear file input
        }
    };
    reader.onerror = (e) => {
        setError('Error reading file: ' + (e.target?.error?.message || 'Unknown error.'));
    };
    reader.readAsText(file);
  };

  const handleDownloadPdf = () => {
    if (selectedResume) {
        downloadElementAsPdf('printable-resume-content', `${selectedResume.name}-Resume.pdf`);
    } else {
        setError("No resume selected to download as PDF.");
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
                                onChange={(e) => handleSelectTemplate(e.target.value)}
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
                    <textarea value={rawText} onChange={(e) => { setRawText(e.target.value); setParsedContent(null); setSelectedTemplateId(null); }} placeholder="Paste resume text here, or upload a file."
                        className="w-full h-64 p-4 border rounded-lg bg-gray-50 dark:bg-gray-700"/>
                    <div className="flex gap-4">
                        <label className="cursor-pointer bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm font-semibold py-2 px-4 rounded-lg flex-1 text-center">
                            Upload File <input type="file" accept=".pdf,.docx" className="hidden" onChange={handleFileChange} disabled={loading}/>
                        </label>
                        <button onClick={() => runAIParser(rawText)} disabled={loading || !rawText.trim()} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50 flex-1">
                          {loading ? <LoadingSpinner className="w-5 h-5 mx-auto"/> : 'Parse Content'}
                        </button>
                    </div>
                    {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                    {loading && statusMessage && <p className="text-blue-500 text-sm text-center mt-2">{statusMessage}</p>}
                    {parsedContent && (
                        <div className="mt-4 p-4 border-t dark:border-gray-700">
                           {renderResumeDetails(parsedContent)}
                           <div className="mt-4 flex gap-4 items-center">
                             <input type="text" value={newResumeName} onChange={(e) => setNewResumeName(e.target.value)} placeholder="Enter a name for this resume" className="flex-grow p-2 border rounded-lg bg-gray-50 dark:bg-gray-700"/>
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
                          <button onClick={() => { setView('add'); setRawText(selectedResume.activeContent.rawText); setNewResumeName(selectedResume.name); setParsedContent(selectedResume.activeContent); setSelectedTemplateId(null); }} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded-lg text-sm">
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
      {error && <p className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-red-500 text-white py-2 px-4 rounded-lg shadow-lg z-50">{error}</p>}
      {statusMessage && <p className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-green-500 text-white py-2 px-4 rounded-lg shadow-lg z-50">{statusMessage}</p>}

      {/* Hidden div for PDF generation */}
      <div className="absolute -left-[9999px] top-0 w-[800px] p-8 bg-white text-gray-900" id="printable-resume-content">
        {selectedResume && (
          <div>
            {selectedResume.activeContent.contactInfo && (selectedResume.activeContent.contactInfo.name || selectedResume.activeContent.contactInfo.address || selectedResume.activeContent.contactInfo.phone || selectedResume.activeContent.contactInfo.email) && (
              <div className="mb-6 text-center">
                <h1 className="text-4xl font-bold mb-1">{selectedResume.activeContent.contactInfo.name}</h1>
                <p className="text-lg">{selectedResume.activeContent.contactInfo.address}</p>
                <p className="text-lg">{selectedResume.activeContent.contactInfo.phone} {selectedResume.activeContent.contactInfo.phone && selectedResume.activeContent.contactInfo.email ? '•' : ''} {selectedResume.activeContent.contactInfo.email}</p>
              </div>
            )}

            {selectedResume.activeContent.skills.length > 0 && (
              <div className="mb-6">
                <h2 className="text-2xl font-bold border-b-2 border-gray-400 pb-1 mb-3">Skills</h2>
                <p className="text-lg">{selectedResume.activeContent.skills.join(' • ')}</p>
              </div>
            )}

            {selectedResume.activeContent.experience.length > 0 && (
              <div className="mb-6">
                <h2 className="text-2xl font-bold border-b-2 border-gray-400 pb-1 mb-3">Experience</h2>
                {selectedResume.activeContent.experience.map((exp, idx) => (
                  <div key={idx} className="mb-4">
                    <h3 className="text-xl font-semibold">{exp.title} at {exp.company}</h3>
                    <p className="text-base mt-1">{exp.description}</p>
                  </div>
                ))}
              </div>
            )}

            {selectedResume.activeContent.education.length > 0 && (
              <div className="mb-6">
                <h2 className="text-2xl font-bold border-b-2 border-gray-400 pb-1 mb-3">Education</h2>
                {selectedResume.activeContent.education.map((edu, idx) => (
                  <div key={idx} className="mb-2">
                    <h3 className="text-xl font-semibold">{edu.degree} from {edu.institution}</h3>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResumeHub;