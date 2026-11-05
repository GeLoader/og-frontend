import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTimer } from '../contexts/TimerContext';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { ChevronLeft, ChevronRight, Home, Plus, ArrowUpDown, Trash2, ChevronDown, ChevronRight as ChevronRightIcon, Edit2, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createDateAsBerlinTime, formatTimeBerlin, getEntryDateString } from '../lib/utils';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Helper function to get week start based on user's first_day_of_week setting
const getWeekStart = (date, firstDayOfWeek = 'monday') => {
  const d = new Date(date);
  const currentDay = d.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

  let targetDay;
  if (firstDayOfWeek === 'sunday') {
    targetDay = 0;
  } else if (firstDayOfWeek === 'monday') {
    targetDay = 1;
  } else if (firstDayOfWeek === 'saturday') {
    targetDay = 6;
  } else {
    targetDay = 1; // default to Monday
  }

  let diff = currentDay - targetDay;
  if (diff < 0) {
    diff += 7;
  }

  const weekStart = new Date(d);
  weekStart.setDate(d.getDate() - diff);
  return weekStart;
};

// Helper function to format date as "Mon, 9 Feb"
const formatDayHeader = (date) => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
};

// Helper function to get week days starting from the specified start day
const getWeekDays = (startDate, numberOfDays = 7) => {
  const days = [];
  for (let i = 0; i < numberOfDays; i++) {
    const day = new Date(startDate);
    day.setDate(startDate.getDate() + i);
    days.push(day);
  }
  return days;
};

// FIXED: Helper function to format date as YYYY-MM-DD using LOCAL timezone
const formatDateISO = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper function to parse time string (HH:MM or H:MM) to minutes
const parseTimeToMinutes = (timeStr) => {
  if (!timeStr || timeStr === '0:00') return 0;
  const parts = timeStr.split(':');
  if (parts.length !== 2) return 0;
  const hours = parseInt(parts[0]) || 0;
  const minutes = parseInt(parts[1]) || 0;
  return hours * 60 + minutes;
};

// Helper function to format minutes to HH:MM
const formatMinutesToTime = (minutes) => {
  if (!minutes || minutes === 0) return '0:00';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}:${String(mins).padStart(2, '0')}`;
};

// Helper function to format time to 12-hour format with AM/PM
const formatTime12Hour = (timeStr) => {
  if (!timeStr) return '';

  // Parse HH:MM format
  const [hours24, minutes] = timeStr.split(':').map(Number);

  // Convert to 12-hour format
  const period = hours24 >= 12 ? 'PM' : 'AM';
  let hours12 = hours24 % 12;
  if (hours12 === 0) hours12 = 12; // Handle midnight and noon

  return `${hours12}:${String(minutes).padStart(2, '0')} ${period}`;
};

// Time Log Modal Component
const TimeLogModal = ({ isOpen, onClose, timeLog, onSave, onDelete, projects, allTasks, rowId, isSaving, isDeleting }) => {
  const [duration, setDuration] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [date, setDate] = useState('');
  const [projectId, setProjectId] = useState('');
  const [taskId, setTaskId] = useState('');

  useEffect(() => {
    if (timeLog) {
      setDuration(formatMinutesToTime(timeLog.duration || 0));
      setStartTime(timeLog.startTime || '09:00');
      setEndTime(timeLog.endTime || '10:00');
      setDate(timeLog.date || '');
      setProjectId(timeLog.project_id || timeLog.rowProjectId || '');
      setTaskId(timeLog.task_id || timeLog.rowTaskId || '');
    }
  }, [timeLog]);

  // Helper: Calculate duration in minutes between two times (HH:MM format)
  const calculateDurationFromTimes = (start, end) => {
    if (!start || !end) return 0;

    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    let diff = endMinutes - startMinutes;
    // Handle case where end time is next day (negative difference)
    if (diff < 0) {
      diff += 24 * 60; // Add 24 hours
    }

    return diff;
  };

  // Helper: Add minutes to a time (HH:MM format)
  const addMinutesToTime = (time, minutes) => {
    if (!time) return '09:00';

    const [hour, min] = time.split(':').map(Number);
    let totalMinutes = hour * 60 + min + minutes;

    // Handle overflow (wrap around 24 hours)
    totalMinutes = totalMinutes % (24 * 60);
    if (totalMinutes < 0) totalMinutes += 24 * 60;

    const newHour = Math.floor(totalMinutes / 60);
    const newMin = totalMinutes % 60;

    return `${String(newHour).padStart(2, '0')}:${String(newMin).padStart(2, '0')}`;
  };

  // Handle start time change → recalculate duration
  const handleStartTimeChange = (newStartTime) => {
    setStartTime(newStartTime);

    // Auto-calculate duration based on new start time and existing end time
    if (newStartTime && endTime) {
      const newDurationMinutes = calculateDurationFromTimes(newStartTime, endTime);
      setDuration(formatMinutesToTime(newDurationMinutes));
    }
  };

  // Handle end time change → recalculate duration
  const handleEndTimeChange = (newEndTime) => {
    setEndTime(newEndTime);

    // Auto-calculate duration based on existing start time and new end time
    if (startTime && newEndTime) {
      const newDurationMinutes = calculateDurationFromTimes(startTime, newEndTime);
      setDuration(formatMinutesToTime(newDurationMinutes));
    }
  };

  // Handle duration change → recalculate end time
  const handleDurationChange = (newDuration) => {
    setDuration(newDuration);

    // Auto-calculate end time based on start time + new duration
    if (startTime && newDuration) {
      const durationMinutes = parseTimeToMinutes(newDuration);
      const newEndTime = addMinutesToTime(startTime, durationMinutes);
      setEndTime(newEndTime);
    }
  };

  if (!isOpen) return null;

  const handleSave = () => {
    const durationMinutes = parseTimeToMinutes(duration);
    onSave({
      ...timeLog,
      duration: durationMinutes,
      startTime,
      endTime,
      date,
      project_id: projectId,
      task_id: taskId
    });
    onClose();
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this time log?')) {
      onDelete(timeLog);
      onClose();
    }
  };

  const getTasksForProject = (proj_id) => {
    return allTasks.filter(task => task.project_id === proj_id);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 dark:border dark:border-gray-700 rounded-lg shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold dark:text-white">Edit time log</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Fields */}
        <div className="space-y-4">
          {/* Project */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Project</label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="w-full dark:text-gray-100 dark:border-gray-600">
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

          {/* Task */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Task</label>
            <Select value={taskId} onValueChange={setTaskId} disabled={!projectId}>
              <SelectTrigger className="w-full dark:text-gray-100 dark:border-gray-600">
                <SelectValue placeholder="Select task" />
              </SelectTrigger>
              <SelectContent>
                {getTasksForProject(projectId).map((task) => (
                  <SelectItem key={task.id} value={task.id}>
                    {task.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Duration</label>
            <Input
              type="text"
              placeholder="0:00"
              value={duration}
              onChange={(e) => handleDurationChange(e.target.value)}
              className="w-full dark:text-gray-100 dark:border-gray-600"
            />
          </div>

          {/* Start Time & End Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Start time</label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => handleStartTimeChange(e.target.value)}
                className="w-full dark:text-gray-100 dark:border-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">End time</label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => handleEndTimeChange(e.target.value)}
                className="w-full dark:text-gray-100 dark:border-gray-600"
              />
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Date</label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full dark:text-gray-100 dark:border-gray-600"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mt-6">
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={isSaving || isDeleting}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save
            </Button>
            <Button variant="outline" onClick={onClose} disabled={isSaving || isDeleting}>Dismiss</Button>
          </div>
          <Button variant="destructive" onClick={handleDelete} disabled={isSaving || isDeleting}>
            {isDeleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Delete this log
          </Button>
        </div>
      </div>
    </div>
  );
};

export const TimeTrackerPage = () => {
  const { token, user } = useAuth();
  const { t } = useTranslation();

  const [viewMode, setViewMode] = useState('Week'); // 'Week' or 'Day'
  const [currentWeekStart, setCurrentWeekStart] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date()); // For Day View
  const [selectedUserId, setSelectedUserId] = useState(user?.id);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [timesheetRows, setTimesheetRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // New state for expandable rows and time logs
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [timeLogs, setTimeLogs] = useState({}); // { rowId_date: [timeLogs] }
  const [showTimeLogModal, setShowTimeLogModal] = useState(false);
  const [editingTimeLog, setEditingTimeLog] = useState(null);

  // Loading states
  const [isSavingLog, setIsSavingLog] = useState(false);
  const [isDeletingLog, setIsDeletingLog] = useState(false);
  const [isDeletingRow, setIsDeletingRow] = useState(null); // rowId
  const [isSavingEntry, setIsSavingEntry] = useState(null); // rowId_date

  // Time tracking settings
  const [timeTrackingSettings, setTimeTrackingSettings] = useState({
    first_day_of_week: 'monday',
    working_on_weekends: true
  });
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const isAdmin = user?.role === 'admin';

  // Fetch time tracking settings first
  useEffect(() => {
    fetchTimeTrackingSettings();
  }, []);

  // Initialize week start after settings are loaded
  useEffect(() => {
    if (settingsLoaded) {
      setCurrentWeekStart(getWeekStart(new Date(), 'monday'));
    }
  }, [settingsLoaded]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedUserId && currentWeekStart) {
      fetchTimeEntries();
    }
  }, [currentWeekStart, selectedUserId, viewMode]);

  // FIXED: Auto-refresh data when timer stops
  const { registerOnStopCallback } = useTimer();
  useEffect(() => {
    const cleanup = registerOnStopCallback(() => {
      console.log('Timer stopped, refreshing time entries...');
      fetchTimeEntries();
    });
    return cleanup;
  }, [registerOnStopCallback, currentWeekStart, selectedUserId]);

  const fetchTimeTrackingSettings = async () => {
    try {
      const response = await axios.get(`${API}/user/time-tracking-settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTimeTrackingSettings(response.data);
      setSettingsLoaded(true);
    } catch (error) {
      console.error('Failed to fetch time tracking settings:', error);
      // Use defaults if fetch fails
      setSettingsLoaded(true);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await axios.get(`${API}/projects`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProjects(response.data);

      // Fetch all tasks
      const taskPromises = response.data.map(project =>
        axios.get(`${API}/tasks?project_id=${project.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      );
      const taskResponses = await Promise.all(taskPromises);
      const allTasksData = taskResponses.flatMap(res => res.data);
      setAllTasks(allTasksData);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
  };

  const fetchTimeEntries = async () => {
    setLoading(true);
    try {
      // Calculate number of days to show (5 for weekdays only, 7 for including weekends)
      const numberOfDays = 7;
      const weekDays = getWeekDays(currentWeekStart, numberOfDays);
      const weekStart = formatDateISO(weekDays[0]);
      const weekEnd = formatDateISO(weekDays[weekDays.length - 1]);

      const params = new URLSearchParams({
        start_date: weekStart,
        end_date: weekEnd,
      });

      if (isAdmin && selectedUserId) {
        params.append('user_id', selectedUserId);
      }

      const response = await axios.get(`${API}/time-entries?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Transform time entries into timesheet rows and time logs
      const entries = response.data;
      console.log('📊 Raw entries from API:', entries);
      const rowsMap = new Map();
      const logsMap = {};

      entries.forEach(entry => {
        console.log('Processing entry:', entry);
        // Normalize project_id and task_id to handle null, undefined, and empty strings
        const normalizedProjectId = entry.project_id || '';
        const normalizedTaskId = entry.task_id || '';
        const key = `${normalizedProjectId}_${normalizedTaskId}`;

        if (!rowsMap.has(key)) {
          rowsMap.set(key, {
            id: key,
            project_id: normalizedProjectId,
            task_id: normalizedTaskId,
            timeByDay: {}
          });
        }

        const row = rowsMap.get(key);
        // entry.date is stored as the calendar date (midnight UTC); avoid a
        // local-timezone round trip so the day cannot shift.
        const entryDate = getEntryDateString(entry);
        const durationInMinutes = Math.floor(entry.duration / 60);
        console.log(`📅 Entry date: ${entry.date} → ${entryDate}, Duration: ${entry.duration}s → ${durationInMinutes}min`);
        row.timeByDay[entryDate] = (row.timeByDay[entryDate] || 0) + durationInMinutes;

        // Store individual time logs
        const logKey = `${key}_${entryDate}`;
        if (!logsMap[logKey]) {
          logsMap[logKey] = [];
        }

        const startDate = new Date(entry.start_time || entry.date);
        const endDate = new Date(entry.end_time || entry.date);

        logsMap[logKey].push({
          id: entry.id || `log_${Date.now()}_${Math.random()}`,
          rowId: key,
          date: entryDate,
          duration: durationInMinutes,
          startTime: formatTimeBerlin(startDate),
          endTime: formatTimeBerlin(endDate),
          notes: entry.notes || '',
          project_id: entry.project_id,
          task_id: entry.task_id
        });
      });

      const rows = Array.from(rowsMap.values());
      console.log('✅ Final rows:', rows);
      console.log('✅ Final timeLogs:', logsMap);

      // Ensure always 5 rows by default
      while (rows.length < 5) {
        rows.push({
          id: `new_${Date.now()}_${rows.length + 1}`,
          project_id: '',
          task_id: '',
          timeByDay: {}
        });
      }

      setTimesheetRows(rows);
      setTimeLogs(logsMap);
    } catch (error) {
      console.error('Failed to fetch time entries:', error);
      toast.error('Failed to load time entries');
    } finally {
      setLoading(false);
    }
  };

  const handlePreviousWeek = () => {
    const newWeekStart = new Date(currentWeekStart);
    newWeekStart.setDate(currentWeekStart.getDate() - 7);
    setCurrentWeekStart(newWeekStart);
  };

  const handleNextWeek = () => {
    const newWeekStart = new Date(currentWeekStart);
    newWeekStart.setDate(currentWeekStart.getDate() + 7);
    setCurrentWeekStart(newWeekStart);
  };

  const handleToday = () => {
    setCurrentWeekStart(getWeekStart(new Date(), 'monday'));
  };

  const handlePreviousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() - 1);
    setSelectedDate(newDate);
  };

  const handleNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + 1);
    setSelectedDate(newDate);
  };

  const handleTodayDay = () => {
    setSelectedDate(new Date());
  };

  const handleAddRow = () => {
    const newRow = {
      id: `new_${Date.now()}`,
      project_id: '',
      task_id: '',
      timeByDay: {}
    };
    setTimesheetRows([...timesheetRows, newRow]);
  };

  const handleDeleteRow = async (rowId) => {
    if (!window.confirm('Are you sure you want to delete this row and all its time entries?')) {
      return;
    }

    setIsDeletingRow(rowId);
    try {
      // Delete all time logs for this row
      const logsToDelete = [];
      Object.keys(timeLogs).forEach(key => {
        if (key.startsWith(rowId + '_')) {
          logsToDelete.push(...timeLogs[key]);
        }
      });

      // Delete from backend
      for (const log of logsToDelete) {
        if (log.id && !log.id.startsWith('log_')) {
          await axios.delete(`${API}/time-entries/${log.id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
        }
      }

      // Update local state
      setTimesheetRows(timesheetRows.filter(row => row.id !== rowId));

      // Remove logs from timeLogs state
      const newTimeLogs = { ...timeLogs };
      Object.keys(newTimeLogs).forEach(key => {
        if (key.startsWith(rowId + '_')) {
          delete newTimeLogs[key];
        }
      });
      setTimeLogs(newTimeLogs);

      toast.success('Row and time entries deleted');
    } catch (error) {
      console.error('Failed to delete row:', error);
      toast.error('Failed to delete row');
    } finally {
      setIsDeletingRow(null);
    }
  };

  // Move every saved entry of a row to a new project/task, then rebuild the grid
  const moveRowEntries = async (rowId, nextProjectId, nextTaskId) => {
    const normalizedTaskId = nextTaskId || '';
    const newRowId = `${nextProjectId}_${normalizedTaskId}`;

    // Nothing to move (empty row) or same assignment
    if (!nextProjectId || newRowId === rowId) return;

    const realLogs = Object.keys(timeLogs)
      .filter(key => key.startsWith(`${rowId}_`))
      .flatMap(key => (timeLogs[key] || []).filter(
        log => log.id && !log.id.startsWith('new_log_') && !log.id.startsWith('log_')
      ));

    if (realLogs.length === 0) return;

    setIsSavingEntry(rowId);
    try {
      for (const log of realLogs) {
        const startDateTime = createDateAsBerlinTime(log.date, log.startTime);
        const endDateTime = createDateAsBerlinTime(log.date, log.endTime);
        // Handle overnight shifts (end time on next day)
        if (endDateTime < startDateTime) {
          endDateTime.setDate(endDateTime.getDate() + 1);
        }

        await axios.put(`${API}/time-entries/${log.id}`, {
          project_id: nextProjectId,
          task_id: normalizedTaskId || null,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          duration: (log.duration || 0) * 60,
          notes: log.notes || ''
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      await fetchTimeEntries();
      toast.success('Time entries moved to the selected project');
    } catch (error) {
      console.error('Failed to move time entries:', error);
      toast.error('Failed to move time entries');
      // Re-sync so the grid does not keep a wrong local state
      await fetchTimeEntries();
    } finally {
      setIsSavingEntry(null);
    }
  };

  const handleProjectChange = (rowId, projectId) => {
    setTimesheetRows(timesheetRows.map(row =>
      row.id === rowId
        ? { ...row, project_id: projectId, task_id: '' }
        : row
    ));
    // Persist the change on existing entries instead of only updating local state
    moveRowEntries(rowId, projectId, '');
  };

  const handleTaskChange = (rowId, taskId) => {
    const row = timesheetRows.find(r => r.id === rowId);
    setTimesheetRows(timesheetRows.map(r =>
      r.id === rowId
        ? { ...r, task_id: taskId }
        : r
    ));
    if (row?.project_id) {
      moveRowEntries(rowId, row.project_id, taskId);
    }
  };

  const handleTimeChange = (rowId, date, value) => {
    setTimesheetRows(timesheetRows.map(row => {
      if (row.id === rowId) {
        const minutes = parseTimeToMinutes(value);
        return {
          ...row,
          timeByDay: {
            ...row.timeByDay,
            [date]: minutes
          }
        };
      }
      return row;
    }));
  };

  const handleTimeBlur = async (rowId, date) => {
    const row = timesheetRows.find(r => r.id === rowId);
    if (!row) return;

    const minutes = row.timeByDay[date] || 0;

    // Existing entries already saved for this cell (row + day)
    const logKey = `${rowId}_${date}`;
    const existingLogs = (timeLogs[logKey] || []).filter(
      log => log.id && !log.id.startsWith('new_log_') && !log.id.startsWith('log_')
    );
    const existingMinutes = existingLogs.reduce((sum, log) => sum + (log.duration || 0), 0);

    // Nothing actually changed (e.g. user only clicked the cell) -> don't touch the API
    if (minutes === existingMinutes) return;

    if (minutes > 0 && !row.project_id) {
      toast.error('Please select a project first');
      return;
    }

    setIsSavingEntry(`${rowId}_${date}`);
    try {
      // Clearing a cell removes its saved entries
      if (minutes === 0) {
        for (const log of existingLogs) {
          await axios.delete(`${API}/time-entries/${log.id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
        }
        await fetchTimeEntries();
        toast.success('Time entry removed');
        return;
      }

      // Keep the start time the user already had, fall back to 09:00
      const startTime = createDateAsBerlinTime(date, existingLogs[0]?.startTime || '09:00');
      const endTime = new Date(startTime.getTime() + minutes * 60000);

      const payload = {
        project_id: row.project_id || null,
        task_id: row.task_id || null,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        duration: minutes * 60,
        notes: `Timesheet entry for ${date}`
      };

      if (existingLogs.length > 0) {
        // UPDATE the existing entry instead of adding a new one
        await axios.put(`${API}/time-entries/${existingLogs[0].id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        // Collapse duplicate entries that may already exist for this cell
        for (const extra of existingLogs.slice(1)) {
          await axios.delete(`${API}/time-entries/${extra.id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
        }
        await fetchTimeEntries();
        toast.success('Time entry updated');
      } else {
        await axios.post(`${API}/time-entries/manual`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        await fetchTimeEntries();
        toast.success('Time entry saved');
      }
    } catch (error) {
      console.error('Failed to save time entry:', error);
      toast.error('Failed to save time entry');
    } finally {
      setIsSavingEntry(null);
    }
  };

  const handleSort = () => {
    const sorted = [...timesheetRows].sort((a, b) => {
      const projectA = projects.find(p => p.id === a.project_id)?.name || '';
      const projectB = projects.find(p => p.id === b.project_id)?.name || '';
      return projectA.localeCompare(projectB);
    });
    setTimesheetRows(sorted);
  };

  const calculateRowTotal = (row) => {
    let total = 0;
    Object.values(row.timeByDay || {}).forEach(minutes => {
      total += minutes || 0;
    });
    return formatMinutesToTime(total);
  };

  const calculateColumnTotal = (dateStr) => {
    let total = 0;
    timesheetRows.forEach(row => {
      total += row.timeByDay[dateStr] || 0;
    });
    return formatMinutesToTime(total);
  };

  const calculateGrandTotal = () => {
    let total = 0;
    timesheetRows.forEach(row => {
      Object.values(row.timeByDay || {}).forEach(minutes => {
        total += minutes || 0;
      });
    });
    return formatMinutesToTime(total);
  };

  const getTasksForProject = (projectId) => {
    return allTasks.filter(task => task.project_id === projectId);
  };

  const toggleRowExpansion = (rowId) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(rowId)) {
      newExpanded.delete(rowId);
    } else {
      newExpanded.add(rowId);
    }
    setExpandedRows(newExpanded);
  };

  const handleAddTimeLog = (rowId, date, allowEmptyProject = false) => {
    const row = timesheetRows.find(r => r.id === rowId);

    // Only check for project if not explicitly allowed to be empty (Week view requirement)
    if (!allowEmptyProject && (!row || !row.project_id)) {
      toast.error('Please select a project first');
      return;
    }

    const logKey = `${rowId}_${date}`;
    const newLog = {
      id: `new_log_${Date.now()}_${Math.random()}`,
      rowId: rowId || `temp_${Date.now()}`,
      date,
      duration: 0,
      startTime: '09:00',
      endTime: '09:00',
      notes: '',
      project_id: row?.project_id || '',
      task_id: row?.task_id || '',
      rowProjectId: row?.project_id || '',
      rowTaskId: row?.task_id || ''
    };

    setEditingTimeLog(newLog);
    setShowTimeLogModal(true);
  };

  const handleEditTimeLog = (log) => {
    const row = timesheetRows.find(r => r.id === log.rowId);
    setEditingTimeLog({
      ...log,
      rowProjectId: row?.project_id,
      rowTaskId: row?.task_id
    });
    setShowTimeLogModal(true);
  };

  const handleSaveTimeLog = async (updatedLog) => {
    try {
      // Validate that a project is selected
      if (!updatedLog.project_id) {
        toast.error('Please select a project');
        return;
      }

      setIsSavingLog(true);
      // FIXED: Create datetime strings that preserve the selected date in GERMAN timezone (Europe/Berlin)
      const startDateTime = createDateAsBerlinTime(updatedLog.date, updatedLog.startTime);
      const endDateTime = createDateAsBerlinTime(updatedLog.date, updatedLog.endTime);
      // Handle overnight shifts (end time on next day)
      if (endDateTime < startDateTime) {
        endDateTime.setDate(endDateTime.getDate() + 1);
      }
      const durationSeconds = updatedLog.duration * 60;

      const payload = {
        project_id: updatedLog.project_id,
        task_id: updatedLog.task_id || null,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        duration: durationSeconds,
        notes: updatedLog.notes || ''
      };

      if (updatedLog.id && !updatedLog.id.startsWith('new_log_')) {
        // Update existing entry
        await axios.put(`${API}/time-entries/${updatedLog.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Time log updated');
      } else {
        // Create new entry
        await axios.post(`${API}/time-entries/manual`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Time log created');
      }

      // Refresh data
      await fetchTimeEntries();
      setShowTimeLogModal(false);
    } catch (error) {
      console.error('Failed to save time log:', error);
      toast.error('Failed to save time log');
    } finally {
      setIsSavingLog(false);
    }
  };

  const handleDeleteTimeLog = async (log) => {
    setIsDeletingLog(true);
    try {
      if (log.id && !log.id.startsWith('new_log_') && !log.id.startsWith('log_')) {
        await axios.delete(`${API}/time-entries/${log.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      // Refresh data
      await fetchTimeEntries();
      toast.success('Time log deleted');
      setShowTimeLogModal(false);
    } catch (error) {
      console.error('Failed to delete time log:', error);
      toast.error('Failed to delete time log');
    } finally {
      setIsDeletingLog(false);
    }
  };

  const getDayTimeLogs = () => {
    const dateStr = formatDateISO(selectedDate);
    const dayLogs = [];

    timesheetRows.forEach(row => {
      const logKey = `${row.id}_${dateStr}`;
      const logs = timeLogs[logKey] || [];
      logs.forEach(log => {
        const project = projects.find(p => p.id === row.project_id);
        const task = allTasks.find(t => t.id === row.task_id);
        dayLogs.push({
          ...log,
          projectName: project?.name || 'No project',
          taskName: task?.name || 'No task'
        });
      });
    });

    return dayLogs;
  };

  const calculateDayTotal = () => {
    const dayLogs = getDayTimeLogs();
    const total = dayLogs.reduce((sum, log) => sum + (log.duration || 0), 0);
    return formatMinutesToTime(total);
  };

  // Wait for settings to load before rendering
  if (!settingsLoaded || !currentWeekStart) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // Calculate number of days to display based on working_on_weekends setting
  const numberOfDays = 7;
  const weekDays = getWeekDays(currentWeekStart, numberOfDays);
  const weekRangeText = `This week, ${weekDays[0].getDate()} ${weekDays[0].toLocaleDateString('en-US', { month: 'short' })} → ${weekDays[weekDays.length - 1].getDate()} ${weekDays[weekDays.length - 1].toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;

  // Calculate number of columns for the table
  const tableColspan = numberOfDays + 4; // days + PROJECT + TASK + Total + Delete button

  return (
    <div className="space-y-6" data-testid="time-tracker-page">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold tracking-tight" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          Track
        </h1>
      </div>

      {/* Controls Row */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Date Range Navigation */}
        {viewMode === 'Week' ? (
          <div className="flex items-center gap-2 border border-border rounded-lg px-4 py-2 bg-card">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePreviousWeek}
              data-testid="prev-week-btn"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[140px] sm:min-w-[200px] text-center">
              {weekRangeText}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNextWeek}
              data-testid="next-week-btn"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToday}
              data-testid="today-btn"
            >
              <Home className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 border border-border rounded-lg px-4 py-2 bg-card">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePreviousDay}
              data-testid="prev-day-btn"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[140px] sm:min-w-[200px] text-center">
              {formatDayHeader(selectedDate)} (Today)
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNextDay}
              data-testid="next-day-btn"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleTodayDay}
              data-testid="today-day-btn"
            >
              <Home className="h-4 w-4" />
            </Button>

          </div>
        )}

        {/* User Selector (Admin Only) */}
        {isAdmin && (
          <div className="flex items-center gap-2 border border-border rounded-lg px-4 py-2 bg-card">
            <Select
              value={selectedUserId}
              onValueChange={setSelectedUserId}
            >
              <SelectTrigger className="w-full sm:w-[200px]" data-testid="user-selector">
                <SelectValue placeholder="Select user" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} {u.id === user.id ? '(me)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* View Mode Toggle */}
        <div className="flex items-center border border-border rounded-lg overflow-hidden bg-card ml-auto">
          <Button
            variant={viewMode === 'Week' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('Week')}
            data-testid="week-view-btn"
            className="rounded-none"
          >
            Week
          </Button>
          <Button
            variant={viewMode === 'Day' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('Day')}
            data-testid="day-view-btn"
            className="rounded-none"
          >
            Day
          </Button>
        </div>
      </div>

      {/* Week View */}
      {viewMode === 'Week' && (
        <>
          {/* Timesheet Grid */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="timesheet-table">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="p-4 text-left font-medium w-[40px] sm:w-[50px]"></th>
                    <th className="p-4 text-left font-medium min-w-[140px] sm:min-w-[200px]">
                      PROJECT <span className="text-red-500">*</span>
                    </th>
                    <th className="p-4 text-left font-medium min-w-[140px] sm:min-w-[200px]">TASK</th>
                    {weekDays.map((day) => (
                      <th key={day.toISOString()} className="p-4 text-center font-medium min-w-[80px] sm:min-w-[100px]">
                        {formatDayHeader(day)}
                      </th>
                    ))}
                    <th className="p-4 text-center font-medium min-w-[80px] sm:min-w-[100px]">Total</th>
                    <th className="p-4 text-center font-medium w-[40px] sm:w-[50px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={tableColspan + 1} className="p-8 text-center text-muted-foreground">
                        <div className="flex justify-center items-center">
                          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                        </div>
                      </td>
                    </tr>
                  ) : timesheetRows.length === 0 ? (
                    <tr>
                      <td colSpan={tableColspan + 1} className="p-8 text-center text-muted-foreground">
                        No timesheet rows. Click "Add timesheet row" to start.
                      </td>
                    </tr>
                  ) : (
                    timesheetRows.map((row) => (
                      <React.Fragment key={row.id}>
                        {/* Main Row */}
                        <tr className="border-b border-border hover:bg-muted/20 transition-colors">
                          {/* Expand/Collapse Button */}
                          <td className="p-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleRowExpansion(row.id)}
                              data-testid={`expand-row-${row.id}`}
                            >
                              {expandedRows.has(row.id) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRightIcon className="h-4 w-4" />
                              )}
                            </Button>
                          </td>

                          {/* Project Select */}
                          <td className="p-2">
                            <Select
                              value={row.project_id}
                              onValueChange={(value) => handleProjectChange(row.id, value)}
                            >
                              <SelectTrigger data-testid={`project-select-${row.id}`}>
                                <SelectValue placeholder="Select/create a project..." />
                              </SelectTrigger>
                              <SelectContent>
                                {projects.map((project) => (
                                  <SelectItem key={project.id} value={project.id}>
                                    {project.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>

                          {/* Task Select */}
                          <td className="p-2">
                            <Select
                              value={row.task_id}
                              onValueChange={(value) => handleTaskChange(row.id, value)}
                              disabled={!row.project_id}
                            >
                              <SelectTrigger data-testid={`task-select-${row.id}`}>
                                <SelectValue placeholder="Select/create a task..." />
                              </SelectTrigger>
                              <SelectContent>
                                {getTasksForProject(row.project_id).map((task) => (
                                  <SelectItem key={task.id} value={task.id}>
                                    {task.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>

                          {/* Time Inputs for each day */}
                          {weekDays.map((day) => {
                            const dateStr = formatDateISO(day);
                            const minutes = row.timeByDay[dateStr] || 0;
                            return (
                              <td key={dateStr} className="p-2">
                                <div className="relative group">
                                  <Input
                                    type="text"
                                    placeholder="hh:mm"
                                    value={formatMinutesToTime(minutes)}
                                    onChange={(e) => handleTimeChange(row.id, dateStr, e.target.value)}
                                    onBlur={() => handleTimeBlur(row.id, dateStr)}
                                    className={`text-center ${isSavingEntry === `${row.id}_${dateStr}` ? 'opacity-50' : ''}`}
                                    disabled={!row.project_id || isSavingEntry === `${row.id}_${dateStr}`}
                                    data-testid={`time-input-${row.id}-${dateStr}`}
                                  />
                                  {isSavingEntry === `${row.id}_${dateStr}` && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                      <Loader2 className="h-3 w-3 animate-spin text-primary" />
                                    </div>
                                  )}
                                  {/* Edit Icon on Hover */}
                                  {minutes > 0 && (
                                    <button
                                      className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={() => {
                                        const logKey = `${row.id}_${dateStr}`;
                                        const logs = timeLogs[logKey] || [];
                                        if (logs.length > 0) {
                                          handleEditTimeLog(logs[0]);
                                        }
                                      }}
                                    >
                                      <Edit2 className="h-3 w-3 text-gray-500 hover:text-gray-700" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            );
                          })}

                          {/* Total Column */}
                          <td className="p-2 text-center font-medium">
                            {calculateRowTotal(row)}
                          </td>

                          {/* Delete Button */}
                          <td className="p-2 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteRow(row.id)}
                              disabled={isDeletingRow === row.id}
                              data-testid={`delete-row-${row.id}`}
                            >
                              {isDeletingRow === row.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </td>
                        </tr>

                        {/* Expanded Row Content */}
                        {expandedRows.has(row.id) && (
                          <tr className="bg-muted/10">
                            <td colSpan={tableColspan + 1} className="p-4">
                              <div className="space-y-4">
                                {weekDays.map((day) => {
                                  const dateStr = formatDateISO(day);
                                  const logKey = `${row.id}_${dateStr}`;
                                  const logs = timeLogs[logKey] || [];

                                  return (
                                    <div key={dateStr} className="border-b border-border pb-3">
                                      <div className="flex items-center justify-between mb-3">
                                        <span className="text-sm font-medium">{formatDayHeader(day)}</span>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleAddTimeLog(row.id, dateStr)}
                                          data-testid={`add-log-${row.id}-${dateStr}`}
                                        >
                                          <Plus className="h-3 w-3 mr-1" />
                                          Add time log
                                        </Button>
                                      </div>

                                      {logs.length > 0 ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-2">
                                          {logs.map((log) => (
                                            <div
                                              key={log.id}
                                              className="p-3 bg-card border border-border rounded cursor-pointer hover:bg-accent/50 group relative transition-colors"
                                              onClick={() => handleEditTimeLog(log)}
                                              data-testid={`time-log-${log.id}`}
                                            >
                                              <div className="text-sm font-medium text-foreground">{formatMinutesToTime(log.duration)}</div>
                                              <div className="text-xs text-muted-foreground mt-1">{formatTime12Hour(log.startTime)} - {formatTime12Hour(log.endTime)}</div>
                                              {/* Edit Icon */}
                                              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Edit2 className="h-3 w-3 text-muted-foreground" />
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <div className="text-sm text-muted-foreground italic">No time logs for this day</div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
                <tfoot className="bg-muted/30 border-t-2 border-border">
                  <tr>
                    <td className="p-4" colSpan={3}>
                      <span className="font-semibold text-sm">Total</span>
                    </td>
                    {weekDays.map((day) => {
                      const dateStr = formatDateISO(day);
                      return (
                        <td key={dateStr} className="p-4 text-center font-semibold text-sm">
                          {calculateColumnTotal(dateStr)}
                        </td>
                      );
                    })}
                    <td className="p-4 text-center font-bold text-sm">
                      {calculateGrandTotal()}
                    </td>
                    <td className="p-4"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <Button
              onClick={handleAddRow}
              data-testid="add-row-btn"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add timesheet row
            </Button>
            <Button
              variant="outline"
              onClick={handleSort}
              data-testid="sort-btn"
            >
              <ArrowUpDown className="h-4 w-4 mr-2" />
              Sort
            </Button>
          </div>
        </>
      )}

      {/* Day View */}
      {viewMode === 'Day' && (
        <div className="space-y-4">
          {/* Add Time Log Button */}
          <div className="flex gap-2">
            <Button
              onClick={() => {
                // Add a new time log for the selected day - allow empty project in Day view
                const dateStr = formatDateISO(selectedDate);
                const rowId = timesheetRows.length > 0 ? timesheetRows[0].id : `temp_${Date.now()}`;
                handleAddTimeLog(rowId, dateStr, true); // true = allow empty project
              }}
              data-testid="add-time-log-day-btn"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add time log
            </Button>
          </div>

          {/* Total */}
          <div className="text-right">
            <span className="text-lg font-semibold">Total: {calculateDayTotal()}</span>
          </div>

          {/* Time Logs List */}
          <div className="space-y-4">
            {getDayTimeLogs().length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                No time logs for this day
              </div>
            ) : (
              getDayTimeLogs().map((log) => (
                <div
                  key={log.id}
                  className="bg-card border border-border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => handleEditTimeLog(log)}
                  data-testid={`day-log-${log.id}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="text-sm font-medium mb-1">
                        {log.projectName} {log.taskName !== 'No task' && `• ${log.taskName}`}
                      </div>
                      <div className="text-xs text-gray-400">
                        {log.notes || 'Add project, task, and other details'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold">{formatMinutesToTime(log.duration)}</div>
                      <div className="text-xs text-gray-500">
                        {formatTime12Hour(log.startTime)} - {formatTime12Hour(log.endTime)}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Total (Bottom) */}
          <div className="text-right pt-4 border-t border-border">
            <span className="text-lg font-semibold">Total: {calculateDayTotal()}</span>
          </div>
        </div>
      )}

      {/* Time Log Modal */}
      <TimeLogModal
        isOpen={showTimeLogModal}
        onClose={() => {
          setShowTimeLogModal(false);
          setEditingTimeLog(null);
        }}
        timeLog={editingTimeLog}
        onSave={handleSaveTimeLog}
        onDelete={handleDeleteTimeLog}
        projects={projects}
        allTasks={allTasks}
        rowId={editingTimeLog?.rowId}
        isSaving={isSavingLog}
        isDeleting={isDeletingLog}
      />
    </div>
  );
};
