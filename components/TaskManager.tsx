import React, { useState, useEffect } from 'react';
// Import useAppContext from AppContext.tsx
import { useAppContext } from '../context/AppContext';
import { Task, Job, Application } from '../types';
import { PlusIcon, TrashIcon, ArchiveBoxArrowDownIcon, CalendarDaysIcon, MegaphoneIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import { generateId } from '../utils/fileUtils';

// Helper to safely format dates and prevent crashes from invalid date strings
const isValidDate = (date: any): boolean => {
  return date && !isNaN(new Date(date).getTime());
};

function TaskManager() {
  const { tasks, addTask, updateTask, removeTask, savedJobs, applications } = useAppContext();

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<Task['priority']>('Medium');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskJobId, setNewTaskJobId] = useState<string | undefined>(undefined);
  const [newTaskApplicationId, setNewTaskApplicationId] = useState<string | undefined>(undefined);

  const [filterStatus, setFilterStatus] = useState<'All' | Task['status']>('All');
  const [filterPriority, setFilterPriority] = useState<'All' | Task['priority']>('All');
  const [filterJobId, setFilterJobId] = useState<string | 'All'>('All');

  // --- Robust Job & Application Lookups ---
  // Create a comprehensive list of all known jobs from saved jobs and applications
  const allKnownJobs = [...(savedJobs || [])];
  (applications || []).forEach(app => {
    if (app && app.jobId && !allKnownJobs.some(j => j.id === app.jobId)) {
      allKnownJobs.push({
        id: app.jobId,
        title: app.jobTitle,
        company: app.companyName,
        location: 'N/A',
        description: 'Full job details not available.',
        isSaved: false,
      } as Job);
    }
  });
  allKnownJobs.sort((a, b) => (a?.company || '').localeCompare(b?.company || ''));

  const allApplications = (applications || []).sort((a, b) => (a?.companyName || '').localeCompare(b?.companyName || ''));
  // --- End Robust Lookups ---


  const filteredTasks = (tasks || []).filter(task => {
    // Defensive check for corrupted task data
    if (!task || !task.status || !task.priority) return false;
    const matchesStatus = filterStatus === 'All' || task.status === filterStatus;
    const matchesPriority = filterPriority === 'All' || task.priority === filterPriority;
    const matchesJob = filterJobId === 'All' || task.jobId === filterJobId || task.applicationId === filterJobId; // Match by job or application linked to job
    return matchesStatus && matchesPriority && matchesJob;
  }).sort((a, b) => {
    // Sort by due date, then priority
    const dueDateA = new Date(a?.dueDate || 0).getTime();
    const dueDateB = new Date(b?.dueDate || 0).getTime();
    if (dueDateA !== dueDateB) return dueDateA - dueDateB;

    const priorityOrder = { 'High': 1, 'Medium': 2, 'Low': 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !newTaskDueDate.trim()) {
      alert('Task title and due date are required.');
      return;
    }

    const newTask: Task = {
      id: generateId(),
      title: newTaskTitle,
      dueDate: newTaskDueDate,
      priority: newTaskPriority,
      status: 'Pending',
      description: newTaskDescription.trim() || undefined,
      jobId: newTaskJobId === 'All' ? undefined : newTaskJobId,
      applicationId: newTaskApplicationId === 'All' ? undefined : newTaskApplicationId,
    };

    addTask(newTask);
    setNewTaskTitle('');
    setNewTaskDueDate('');
    setNewTaskPriority('Medium');
    setNewTaskDescription('');
    setNewTaskJobId(undefined);
    setNewTaskApplicationId(undefined);
  };

  const handleUpdateTaskStatus = (taskId: string, newStatus: Task['status']) => {
    updateTask(taskId, { status: newStatus });
  };

  const handleDeleteTask = (taskId: string) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      removeTask(taskId);
    }
  };

  const getJobDisplay = (jobId?: string, applicationId?: string) => {
    if (applicationId) {
      const app = (applications || []).find(a => a.id === applicationId);
      if (app) return `App: ${app.jobTitle} at ${app.companyName}`;
    }
    if (jobId) {
      const job = allKnownJobs.find(j => j.id === jobId); // Use the comprehensive job list
      if (job) return `Job: ${job.title} at ${job.company}`;
    }
    return 'General Task';
  };

  const getPriorityClass = (priority: Task['priority']) => {
    switch (priority) {
      case 'High': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'Medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'Low': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getStatusClass = (status: Task['status']) => {
    switch (status) {
      case 'Pending': return 'text-orange-600 dark:text-orange-400';
      case 'In Progress': return 'text-blue-600 dark:text-blue-400';
      case 'Completed': return 'text-green-600 dark:text-green-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <div className="task-manager-section bg-white dark:bg-gray-900 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 min-h-[70vh]">
      <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-6 text-center">Task Manager</h2>

      {/* Add New Task Form */}
      <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-8">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
          <PlusIcon className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" /> Add New Task
        </h3>
        <form onSubmit={handleAddTask} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="newTaskTitle" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Task Title<span className="text-red-500">*</span></label>
            <input
              type="text"
              id="newTaskTitle"
              className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 dark:text-white"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="newTaskDueDate" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Due Date<span className="text-red-500">*</span></label>
            <input
              type="date"
              id="newTaskDueDate"
              className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 dark:text-white"
              value={newTaskDueDate}
              onChange={(e) => setNewTaskDueDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="newTaskPriority" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Priority</label>
            <select
              id="newTaskPriority"
              className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 dark:text-white"
              value={newTaskPriority}
              onChange={(e) => setNewTaskPriority(e.target.value as Task['priority'])}
            >
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
          <div>
            <label htmlFor="newTaskJobId" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Link to Job/Application</label>
            <select
              id="newTaskJobId"
              className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 dark:text-white"
              value={newTaskJobId || 'All'}
              onChange={(e) => {
                setNewTaskJobId(e.target.value === 'All' ? undefined : e.target.value);
                setNewTaskApplicationId(undefined); // Clear application if linking to a job
              }}
            >
              <option value="All">-- Select Job --</option>
              {allKnownJobs.map(job => (
                <option key={job.id} value={job.id}>{job.title} ({job.company})</option>
              ))}
            </select>
          </div>
          {newTaskJobId && (
            <div>
              <label htmlFor="newTaskApplicationId" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Link to Specific Application (if applicable)</label>
              <select
                id="newTaskApplicationId"
                className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 dark:text-white"
                value={newTaskApplicationId || 'All'}
                onChange={(e) => setNewTaskApplicationId(e.target.value === 'All' ? undefined : e.target.value)}
              >
                <option value="All">-- Select Application --</option>
                {allApplications.filter(app => app.jobId === newTaskJobId).map(app => (
                  <option key={app.id} value={app.id}>App: {app.jobTitle} ({app.companyName})</option>
                ))}
              </select>
            </div>
          )}
          <div className="md:col-span-2">
            <label htmlFor="newTaskDescription" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Description</label>
            <textarea
              id="newTaskDescription"
              className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 dark:text-white min-h-[80px]"
              value={newTaskDescription}
              onChange={(e) => setNewTaskDescription(e.target.value)}
            ></textarea>
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow transition-colors duration-200 flex items-center"
            >
              <PlusIcon className="h-5 w-5 mr-2" /> Add Task
            </button>
          </div>
        </form>
      </div>

      {/* Filters and Task List */}
      <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
          <ArchiveBoxArrowDownIcon className="h-5 w-5 mr-2 text-green-600 dark:text-green-400" /> Your Tasks
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <select
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 dark:text-white"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as 'All' | Task['status'])}
          >
            <option value="All">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
          </select>
          <select
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 dark:text-white"
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value as 'All' | Task['priority'])}
          >
            <option value="All">All Priorities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
          <select
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 dark:text-white"
            value={filterJobId}
            onChange={(e) => setFilterJobId(e.target.value)}
          >
            <option value="All">All Jobs/Applications</option>
            {allKnownJobs.map(job => (
              <option key={job.id} value={job.id}>{job.title} ({job.company})</option>
            ))}
            {allApplications.map(app => (
              <option key={app.id} value={app.id}>App: {app.jobTitle} ({app.companyName})</option>
            ))}
          </select>
        </div>

        {(tasks?.length || 0) === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 text-lg mt-8">No tasks added yet!</p>
        ) : (
          <ul className="space-y-4">
            {filteredTasks.length === 0 ? (
              <p className="text-center text-gray-500 dark:text-gray-400 text-lg mt-8">No tasks match your filters.</p>
            ) : (
              filteredTasks.map(task => (
                <li
                  key={task.id}
                  className="bg-white dark:bg-gray-700 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex-grow">
                    <p className="font-semibold text-lg text-gray-900 dark:text-white mb-1">{task.title}</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 flex items-center">
                      <CalendarDaysIcon className="h-4 w-4 mr-1" /> Due: {isValidDate(task.dueDate) ? new Date(task.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
                      <span className={`ml-3 px-2 py-0.5 rounded-full text-xs ${getPriorityClass(task.priority)}`}>
                        {task.priority} Priority
                      </span>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center">
                      <MegaphoneIcon className="h-4 w-4 mr-1" /> {getJobDisplay(task.jobId, task.applicationId)}
                    </p>
                    {task.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">{task.description}</p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <select
                      value={task.status}
                      onChange={(e) => handleUpdateTaskStatus(task.id, e.target.value as Task['status'])}
                      className={`p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-sm ${getStatusClass(task.status)}`}
                    >
                      <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                    </select>
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="p-2 rounded-full text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors duration-200"
                      title="Delete Task"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

export default TaskManager;