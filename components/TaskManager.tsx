import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Task, TaskStatus, TaskPriority } from '../types'; // Import TaskPriority
import { PencilIcon, TrashIcon, CheckSquareIcon, CalendarIcon } from './icons';

const TaskManager: React.FC = () => {
  const { tasks, setTasks } = useAppContext();
  const [showAddTaskForm, setShowAddTaskForm] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('Medium'); // New: State for new task priority
  const [editingTask, setEditingTask] = useState<Task | null>(null); // State to hold task being edited

  const [sortBy, setSortBy] = useState<'dueDate' | 'priority' | 'status'>('dueDate'); // New: State for sort type
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc'); // New: State for sort order

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const newTask: Task = {
      id: Date.now().toString(),
      title: newTaskTitle.trim(),
      description: newTaskDescription.trim(),
      dueDate: newTaskDueDate || new Date().toISOString().split('T')[0], // Default to today if not set
      status: 'Pending',
      priority: newTaskPriority, // New: Include priority
    };

    setTasks(prev => [...prev, newTask]);
    setNewTaskTitle('');
    setNewTaskDescription('');
    setNewTaskDueDate('');
    setNewTaskPriority('Medium'); // Reset priority
    setShowAddTaskForm(false);
  };

  const handleUpdateTask = (updatedTask: Task) => {
    setTasks(prev => prev.map(task => (task.id === updatedTask.id ? updatedTask : task)));
    setEditingTask(null); // Exit editing mode
  };

  const handleDeleteTask = (id: string) => {
    setTasks(prev => prev.filter(task => task.id !== id));
    if (editingTask?.id === id) {
        setEditingTask(null); // If deleted task was being edited, close the form
    }
  };

  const handleToggleTaskStatus = (id: string) => {
    setTasks(prev =>
      prev.map(task =>
        task.id === id
          ? { ...task, status: task.status === 'Completed' ? 'Pending' : 'Completed' }
          : task
      )
    );
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'Completed': return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
      case 'In Progress': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300';
      case 'Pending':
      default: return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300';
    }
  };

  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case 'High': return 'text-red-600 dark:text-red-400';
      case 'Medium': return 'text-orange-600 dark:text-orange-400';
      case 'Low':
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  // New: Sorting logic
  const priorityOrder: { [key in TaskPriority]: number } = { 'Low': 1, 'Medium': 2, 'High': 3 };
  const statusOrder: { [key in TaskStatus]: number } = { 'Completed': 1, 'In Progress': 2, 'Pending': 3 };

  const sortedTasks = [...tasks].sort((a, b) => {
    let compare = 0;

    if (sortBy === 'dueDate') {
      const dateA = new Date(a.dueDate).getTime();
      const dateB = new Date(b.dueDate).getTime();
      compare = dateA - dateB;
    } else if (sortBy === 'priority') {
      compare = priorityOrder[a.priority] - priorityOrder[b.priority];
    } else if (sortBy === 'status') {
      compare = statusOrder[a.status] - statusOrder[b.status];
    }

    return sortOrder === 'asc' ? compare : -compare;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-gray-800 dark:text-white">Task Manager</h2>
        <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">Organize your job search and application tasks.</p>
      </div>

      {/* Add Task Form / Button */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
        {!showAddTaskForm ? (
          <button
            onClick={() => setShowAddTaskForm(true)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
          >
            + Add New Task
          </button>
        ) : (
          <form onSubmit={handleAddTask} className="space-y-4">
            <h3 className="text-xl font-semibold mb-4">Add New Task</h3>
            <div>
              <label htmlFor="task-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Task Title</label>
              <input
                id="task-title"
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="e.g., Follow up with Google recruiter"
                className="mt-1 w-full p-3 border rounded-lg bg-gray-50 dark:bg-gray-700"
                required
              />
            </div>
            <div>
              <label htmlFor="task-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description (Optional)</label>
              <textarea
                id="task-description"
                value={newTaskDescription}
                onChange={(e) => setNewTaskDescription(e.target.value)}
                placeholder="Details about the task..."
                rows={3}
                className="mt-1 w-full p-3 border rounded-lg bg-gray-50 dark:bg-gray-700"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="task-duedate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Due Date</label>
                <input
                  id="task-duedate"
                  type="date"
                  value={newTaskDueDate}
                  onChange={(e) => setNewTaskDueDate(e.target.value)}
                  className="mt-1 w-full p-3 border rounded-lg bg-gray-50 dark:bg-gray-700"
                  required
                />
              </div>
              <div>
                <label htmlFor="task-priority" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Priority</label>
                <select
                  id="task-priority"
                  value={newTaskPriority}
                  onChange={(e) => setNewTaskPriority(e.target.value as TaskPriority)}
                  className="mt-1 w-full p-3 border rounded-lg bg-gray-50 dark:bg-gray-700"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowAddTaskForm(false);
                  setNewTaskTitle('');
                  setNewTaskDescription('');
                  setNewTaskDueDate('');
                  setNewTaskPriority('Medium'); // Reset priority on cancel
                }}
                className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg"
              >
                Create Task
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Task List */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
        <h3 className="text-xl font-semibold mb-4">My Tasks</h3>
        {/* New: Sorting Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="flex-1">
            <label htmlFor="sort-by" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Sort By</label>
            <select
              id="sort-by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="mt-1 w-full p-2 border rounded-lg bg-gray-50 dark:bg-gray-700"
            >
              <option value="dueDate">Due Date</option>
              <option value="priority">Priority</option>
              <option value="status">Status</option>
            </select>
          </div>
          <div className="flex-1">
            <label htmlFor="sort-order" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Order</label>
            <select
              id="sort-order"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
              className="mt-1 w-full p-2 border rounded-lg bg-gray-50 dark:bg-gray-700"
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </div>
        </div>

        {tasks.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400">No tasks added yet. Start by creating a new task!</p>
        ) : (
          <div className="space-y-4">
            {sortedTasks.map(task => (
              <div
                key={task.id}
                className={`flex flex-col md:flex-row items-start md:items-center justify-between p-4 rounded-lg shadow-sm border ${task.status === 'Completed' ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950 opacity-70' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50'}`}
              >
                {editingTask?.id === task.id ? (
                  <EditTaskForm task={editingTask} onSave={handleUpdateTask} onCancel={() => setEditingTask(null)} />
                ) : (
                  <>
                    <div className="flex-1 min-w-0 pr-4">
                      <h4 className={`font-bold text-lg ${task.status === 'Completed' ? 'line-through text-gray-500 dark:text-gray-400' : ''}`}>{task.title}</h4>
                      {task.description && (
                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 break-words">{task.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500 dark:text-gray-400 mt-2">
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="w-4 h-4" />
                          Due: {new Date(task.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(task.status)}`}>{task.status}</span>
                        <span className={`font-semibold ${getPriorityColor(task.priority)}`}>Priority: {task.priority}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3 md:mt-0">
                      <button
                        onClick={() => handleToggleTaskStatus(task.id)}
                        title={task.status === 'Completed' ? 'Mark as Pending' : 'Mark as Completed'}
                        className={`p-2 rounded-full transition-colors ${task.status === 'Completed' ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-200'}`}
                      >
                        <CheckSquareIcon className="w-5 h-5" filled={task.status === 'Completed'} />
                      </button>
                      <button
                        onClick={() => setEditingTask(task)}
                        title="Edit Task"
                        className="p-2 rounded-full bg-blue-500 hover:bg-blue-600 text-white dark:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                      >
                        <PencilIcon className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        title="Delete Task"
                        className="p-2 rounded-full bg-red-500 hover:bg-red-600 text-white dark:bg-red-700 dark:hover:bg-red-600 transition-colors"
                      >
                        <TrashIcon className="w-5 h-5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface EditTaskFormProps {
  task: Task;
  onSave: (task: Task) => void;
  onCancel: () => void;
}

const EditTaskForm: React.FC<EditTaskFormProps> = ({ task, onSave, onCancel }) => {
  const [editedTitle, setEditedTitle] = useState(task.title);
  const [editedDescription, setEditedDescription] = useState(task.description);
  const [editedDueDate, setEditedDueDate] = useState(task.dueDate);
  const [editedStatus, setEditedStatus] = useState<TaskStatus>(task.status);
  const [editedPriority, setEditedPriority] = useState<TaskPriority>(task.priority); // New: State for edited priority

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editedTitle.trim()) return;
    onSave({
      ...task,
      title: editedTitle.trim(),
      description: editedDescription.trim(),
      dueDate: editedDueDate,
      status: editedStatus,
      priority: editedPriority, // New: Include priority in save
    });
  };

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-3 p-2">
      <div>
        <label htmlFor={`edit-title-${task.id}`} className="sr-only">Task Title</label>
        <input
          id={`edit-title-${task.id}`}
          type="text"
          value={editedTitle}
          onChange={(e) => setEditedTitle(e.target.value)}
          className="w-full p-2 border rounded-lg bg-gray-100 dark:bg-gray-600 text-lg font-semibold"
          required
        />
      </div>
      <div>
        <label htmlFor={`edit-description-${task.id}`} className="sr-only">Description</label>
        <textarea
          id={`edit-description-${task.id}`}
          value={editedDescription}
          onChange={(e) => setEditedDescription(e.target.value)}
          rows={2}
          className="w-full p-2 border rounded-lg bg-gray-100 dark:bg-gray-600 text-sm"
        />
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1">
          <label htmlFor={`edit-duedate-${task.id}`} className="block text-xs font-medium text-gray-700 dark:text-gray-300">Due Date</label>
          <input
            id={`edit-duedate-${task.id}`}
            type="date"
            value={editedDueDate}
            onChange={(e) => setEditedDueDate(e.target.value)}
            className="w-full p-2 border rounded-lg bg-gray-100 dark:bg-gray-600 text-sm"
            required
          />
        </div>
        <div className="flex-1">
          <label htmlFor={`edit-status-${task.id}`} className="block text-xs font-medium text-gray-700 dark:text-gray-300">Status</label>
          <select
            id={`edit-status-${task.id}`}
            value={editedStatus}
            onChange={(e) => setEditedStatus(e.target.value as TaskStatus)}
            className="w-full p-2 border rounded-lg bg-gray-100 dark:bg-gray-600 text-sm"
          >
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
          </select>
        </div>
        <div className="flex-1">
          <label htmlFor={`edit-priority-${task.id}`} className="block text-xs font-medium text-gray-700 dark:text-gray-300">Priority</label>
          <select
            id={`edit-priority-${task.id}`}
            value={editedPriority}
            onChange={(e) => setEditedPriority(e.target.value as TaskPriority)}
            className="w-full p-2 border rounded-lg bg-gray-100 dark:bg-gray-600 text-sm"
          >
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <button
          type="button"
          onClick={onCancel}
          className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-1 px-3 rounded-lg text-sm"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-3 rounded-lg text-sm"
        >
          Save
        </button>
      </div>
    </form>
  );
};

export default TaskManager;