import React, { useState, useEffect, useCallback } from 'react';
import { useTimer } from '../contexts/TimerContext';
import { useAuth } from '../contexts/AuthContext';
import { Play, Square, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { toast } from 'sonner';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const StickyTimerWidget = () => {
  const { activeTimer, elapsed, isRunning, startTimer, stopTimer, formatTime } = useTimer();
  const { token, user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [activeTimerTasks, setActiveTimerTasks] = useState([]); // FIXED: Separate tasks for active timer
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedTask, setSelectedTask] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [isExpanded, setIsExpanded] = useState(() => {
    // Load expanded state from localStorage, default to true
    const saved = localStorage.getItem('timerWidgetExpanded');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const fetchProjects = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/projects`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProjects(response.data);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
  }, [token]);

  const fetchTasks = useCallback(async (projectId) => {
    try {
      const response = await axios.get(`${API}/tasks?project_id=${projectId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      return [];
    }
  }, [token]);

  // FIXED: Load tasks for active timer's project
  const loadActiveTimerTasks = useCallback(async () => {
    if (!activeTimer?.project_id) {
      setActiveTimerTasks([]);
      return;
    }

    try {
      const tasksData = await fetchTasks(activeTimer.project_id);
      setActiveTimerTasks(tasksData);
    } catch (error) {
      console.error('Failed to load active timer tasks:', error);
    }
  }, [activeTimer?.project_id, fetchTasks]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // FIXED: Fetch tasks for active timer when it changes
  useEffect(() => {
    if (activeTimer?.project_id) {
      loadActiveTimerTasks();
    }
  }, [activeTimer?.project_id, loadActiveTimerTasks]);

  useEffect(() => {
    if (selectedProject) {
      fetchTasks(selectedProject).then(tasksData => {
        setTasks(tasksData);
      });
      // Reset task selection when project changes
      setSelectedTask('');
    } else {
      setTasks([]);
      setSelectedTask('');
    }
  }, [selectedProject, fetchTasks]);

  useEffect(() => {
    // Only set defaults if user has them configured
    if (user?.default_project && projects.length > 0) {
      const projectExists = projects.find(p => p.id === user.default_project);
      if (projectExists) {
        setSelectedProject(user.default_project);
      }
    }
    if (user?.default_task && tasks.length > 0) {
      const taskExists = tasks.find(t => t.id === user.default_task);
      if (taskExists) {
        setSelectedTask(user.default_task);
      }
    }
  }, [user, projects, tasks]);

  const handleStart = async () => {
    // Allow starting timer even without project/task selection
    const result = await startTimer(selectedProject || null, selectedTask || null);
    if (result.success) {
      setShowDialog(false);
    }
  };

  const handleStop = async () => {
    await stopTimer();
  };

  const toggleExpanded = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    localStorage.setItem('timerWidgetExpanded', JSON.stringify(newState));
  };

  if (!isRunning) {
    return (
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogTrigger asChild>
          <button
            data-testid="floating-timer-start-btn"
            className="fixed bottom-6 left-6 right-6 z-50 h-16 w-full max-w-[90vw] rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 flex items-center justify-center transition-all hover:scale-105 sm:left-auto sm:right-6 sm:w-auto sm:max-w-none sm:h-16 sm:w-16"
          >
            <Play className="h-6 w-6" />
          </button>
        </DialogTrigger>
        <DialogContent data-testid="start-timer-dialog">
          <DialogHeader>
            <DialogTitle>Start Timer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Project</label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger data-testid="project-select">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Task</label>
              <Select value={selectedTask} onValueChange={setSelectedTask}>
                <SelectTrigger data-testid="task-select">
                  <SelectValue placeholder="Select task" />
                </SelectTrigger>
                <SelectContent>
                  {tasks.map((task) => (
                    <SelectItem key={task.id} value={task.id}>
                      {task.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleStart}
              data-testid="start-timer-submit-btn"
              className="w-full"
            >
              Start Timer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (isRunning) {
    // FIXED: Use projects array for current project, and activeTimerTasks for current task
    const currentProject = projects.find(p => p.id === activeTimer?.project_id);
    const currentTask = activeTimerTasks.find(t => t.id === activeTimer?.task_id);

    // Determine display text for project and task
    const projectDisplay = activeTimer?.project_id
      ? (currentProject?.name || 'No Project')
      : 'No Project';
    const taskDisplay = activeTimer?.task_id
      ? (currentTask?.name || 'No Task')
      : 'No Task';

    return (
      <div
        data-testid="active-timer-widget"
        className="fixed bottom-6 left-6 right-6 z-50 bg-background/95 dark:bg-card/95 border border-border shadow-xl rounded-xl backdrop-blur-md transition-all duration-300 supports-[backdrop-filter]:bg-background/60 sm:left-auto sm:right-6 sm:w-auto"
        style={{
          minWidth: isExpanded ? '240px' : '140px',
          maxWidth: '90vw'
        }}
      >
        {/* Header with timer and expand toggle */}
        <div className="p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" data-testid="timer-running-indicator"></div>
              <Clock className="h-5 w-5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">RUNNING</span>
            </div>
            <button
              onClick={toggleExpanded}
              className="p-1 hover:bg-muted rounded transition-colors"
              data-testid="timer-expand-toggle"
              aria-label={isExpanded ? "Collapse timer" : "Expand timer"}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </div>

          <div className="mb-3">
            <div
              data-testid="timer-display"
              className="text-3xl font-mono font-bold tabular-nums tracking-wider"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              {formatTime(elapsed)}
            </div>
          </div>

          {/* Expandable details */}
          <div
            className="overflow-hidden transition-all duration-300"
            style={{
              maxHeight: isExpanded ? '200px' : '0',
              opacity: isExpanded ? 1 : 0
            }}
          >
            <div className="mb-3 space-y-1">
              <div className="text-xs text-muted-foreground">Project</div>
              <div className="text-sm font-medium truncate">{projectDisplay}</div>
              <div className="text-xs text-muted-foreground mt-2">Task</div>
              <div className="text-sm font-medium truncate">{taskDisplay}</div>
            </div>

            <Button
              variant="destructive"
              size="sm"
              onClick={handleStop}
              data-testid="timer-stop-btn"
              className="w-full"
            >
              <Square className="h-4 w-4 mr-2" />
              Stop Timer
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};