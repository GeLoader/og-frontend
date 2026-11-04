import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  Plus,
  Download,
  X,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Helper function to get week start (Monday)
const getWeekStart = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // If Sunday, go back 6 days
  const weekStart = new Date(d);
  weekStart.setDate(d.getDate() + diff);
  return weekStart;
};

// Helper function to format date as YYYY-MM-DD
const formatDateISO = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper function to format date range display
const formatDateRange = (startDate) => {
  const start = new Date(startDate);
  const end = new Date(startDate);
  end.setDate(start.getDate() + 6);

  const formatOptions = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', formatOptions)} → ${end.toLocaleDateString('en-US', formatOptions)}`;
};

// Helper function to format minutes to HH:MM
const formatMinutesToTime = (minutes) => {
  if (!minutes || minutes === 0) return '0:00';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}:${String(mins).padStart(2, '0')}`;
};

// Helper function to format time in HH:MM:SS format
const formatTimeDisplay = (seconds) => {
  if (!seconds || seconds === 0) return '00:00:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
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

// Helper function to format time to HH:MM
const formatTime = (date) => {
  const d = new Date(date);
  const hours = d.getHours();
  const minutes = d.getMinutes();
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

// Helper function to format time to 12-hour format with AM/PM
const formatTime12Hour = (timeStr) => {
  if (!timeStr) return '';
  const [hours24, minutes] = timeStr.split(':').map(Number);
  const period = hours24 >= 12 ? 'PM' : 'AM';
  let hours12 = hours24 % 12;
  if (hours12 === 0) hours12 = 12;
  return `${hours12}:${String(minutes).padStart(2, '0')} ${period}`;
};

// NEW: Helper to create a Date object representing a specific date/time in Berlin/Germany timezone (GMT+1/GMT+2)
const createDateAsBerlinTime = (dateStr, timeStr) => {
  // 1. Parse inputs
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);

  // 2. Create a candidate UTC date with the given components
  // We use UTC methods to avoid local browser timezone interference initially
  const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute));

  // 3. Setup formatter for Berlin
  const formatOptions = {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false, // 24-hour format
    hourCycle: 'h23' // FORCE 0-23
  };
  const formatter = new Intl.DateTimeFormat('en-US', formatOptions);

  // 4. Check the offset
  // We need to find a UTC timestamp X such that X formatted in Berlin = user's desired time.
  // Approximation:
  // Berlin is UTC+1 (winter) or UTC+2 (summer).
  // Try assuming UTC+1 first (subtract 1 hour from target)
  const offset = 1 * 60 * 60 * 1000;
  let currentT = utcDate.getTime() - offset;

  // Iterate to converge (usually 1-2 steps)
  for (let i = 0; i < 3; i++) {
    const d = new Date(currentT);
    const parts = formatter.formatToParts(d);

    const pYear = parseInt(parts.find(p => p.type === 'year').value);
    const pMonth = parseInt(parts.find(p => p.type === 'month').value);
    const pDay = parseInt(parts.find(p => p.type === 'day').value);
    let pHour = parseInt(parts.find(p => p.type === 'hour').value);
    const pMinute = parseInt(parts.find(p => p.type === 'minute').value);

    // FIX: Handle 24:00 returned by some Intl implementations for midnight
    if (pHour === 24) pHour = 0;

    // Construct the time we got
    const gotTime = Date.UTC(pYear, pMonth - 1, pDay, pHour, pMinute);
    const targetTime = Date.UTC(year, month - 1, day, hour, minute);

    const diff = targetTime - gotTime;

    if (diff === 0) break; // Exact match found

    currentT += diff;
  }

  return new Date(currentT);
};

// Time Log Modal Component
const TimeLogModal = ({ isOpen, onClose, timeLog, onSave, onDelete, projects, allTasks, isSaving, isDeleting }) => {
  const { t } = useTranslation();
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
      setProjectId(timeLog.project_id || '');
      setTaskId(timeLog.task_id || '');
    }
  }, [timeLog]);

  const calculateDurationFromTimes = (start, end) => {
    if (!start || !end) return 0;
    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    let diff = endMinutes - startMinutes;
    if (diff < 0) diff += 24 * 60;
    return diff;
  };

  const addMinutesToTime = (time, minutes) => {
    if (!time) return '09:00';
    const [hour, min] = time.split(':').map(Number);
    let totalMinutes = hour * 60 + min + minutes;
    totalMinutes = totalMinutes % (24 * 60);
    if (totalMinutes < 0) totalMinutes += 24 * 60;
    const newHour = Math.floor(totalMinutes / 60);
    const newMin = totalMinutes % 60;
    return `${String(newHour).padStart(2, '0')}:${String(newMin).padStart(2, '0')}`;
  };

  const handleStartTimeChange = (newStartTime) => {
    setStartTime(newStartTime);
    if (newStartTime && endTime) {
      const newDurationMinutes = calculateDurationFromTimes(newStartTime, endTime);
      setDuration(formatMinutesToTime(newDurationMinutes));
    }
  };

  const handleEndTimeChange = (newEndTime) => {
    setEndTime(newEndTime);
    if (startTime && newEndTime) {
      const newDurationMinutes = calculateDurationFromTimes(startTime, newEndTime);
      setDuration(formatMinutesToTime(newDurationMinutes));
    }
  };

  const handleDurationChange = (newDuration) => {
    setDuration(newDuration);
    if (startTime && newDuration) {
      const durationMinutes = parseTimeToMinutes(newDuration);
      const newEndTime = addMinutesToTime(startTime, durationMinutes);
      setEndTime(newEndTime);
    }
  };

  if (!isOpen) return null;

  const handleSave = async () => {
    const durationMinutes = parseTimeToMinutes(duration);
    const ok = await onSave({
      ...timeLog,
      duration: durationMinutes,
      startTime,
      endTime,
      date,
      project_id: projectId,
      task_id: taskId
    });
    if (ok !== false) onClose();
  };

  const handleDelete = async () => {
    if (window.confirm(t('detailedView.modal.deleteConfirm'))) {
      const ok = await onDelete(timeLog);
      if (ok !== false) onClose();
    }
  };

  const getTasksForProject = (proj_id) => {
    return allTasks.filter(task => task.project_id === proj_id);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-card text-card-foreground rounded-xl shadow-2xl w-full max-w-md border border-border overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-border bg-muted/30">
          <h2 className="text-xl font-semibold tracking-tight">{t('detailedView.modal.editTitle')}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">{t('detailedView.modal.project')}</label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="w-full bg-background border-input">
                <SelectValue placeholder={t('detailedView.modal.selectProject')} />
              </SelectTrigger>
              <SelectContent className="bg-popover text-popover-foreground border-border">
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">{t('detailedView.modal.task')}</label>
            <Select value={taskId} onValueChange={setTaskId} disabled={!projectId}>
              <SelectTrigger className="w-full bg-background border-input">
                <SelectValue placeholder={t('detailedView.modal.selectTask')} />
              </SelectTrigger>
              <SelectContent className="bg-popover text-popover-foreground border-border">
                {getTasksForProject(projectId).map((task) => (
                  <SelectItem key={task.id} value={task.id}>
                    {task.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">{t('detailedView.modal.duration')}</label>
            <Input
              type="text"
              placeholder="0:00"
              value={duration}
              onChange={(e) => handleDurationChange(e.target.value)}
              className="w-full bg-background border-input text-foreground"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">{t('detailedView.modal.startTime')}</label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => handleStartTimeChange(e.target.value)}
                className="w-full bg-background border-input text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">{t('detailedView.modal.endTime')}</label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => handleEndTimeChange(e.target.value)}
                className="w-full bg-background border-input text-foreground"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">{t('detailedView.modal.date')}</label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-background border-input text-foreground"
            />
          </div>
        </div>

        <div className="flex items-center justify-between p-6 bg-muted/30 border-t border-border mt-2">
          <div className="flex gap-2">
            <Button onClick={handleSave} className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={isSaving || isDeleting}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('detailedView.modal.save')}
            </Button>
            <Button variant="outline" onClick={onClose} className="border-input hover:bg-accent hover:text-accent-foreground" disabled={isSaving || isDeleting}>
              {t('detailedView.modal.dismiss')}
            </Button>
          </div>
          <Button variant="destructive" onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={isSaving || isDeleting}>
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('detailedView.modal.deleteLog')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export const DetailedViewPage = () => {
  const { token, user } = useAuth();
  const { t } = useTranslation();

  const [currentWeekStart, setCurrentWeekStart] = useState(getWeekStart(new Date()));
  const [selectedUserId, setSelectedUserId] = useState('all');
  const [selectedProjectId, setSelectedProjectId] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [sumBy, setSumBy] = useState('day'); // 'day', 'week', 'month', 'project'

  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [groupedData, setGroupedData] = useState([]);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Time Log Modal state
  const [showTimeLogModal, setShowTimeLogModal] = useState(false);
  const [editingTimeLog, setEditingTimeLog] = useState(null);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
    fetchProjects();
  }, []);

  useEffect(() => {
    fetchTimeEntries();
  }, [currentWeekStart, selectedUserId, selectedProjectId, selectedStatus, sumBy]);

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
      const weekEnd = new Date(currentWeekStart);
      weekEnd.setDate(currentWeekStart.getDate() + 6);

      const params = new URLSearchParams({
        start_date: formatDateISO(currentWeekStart),
        end_date: formatDateISO(weekEnd),
      });

      // Add user filter for admin
      if (isAdmin && selectedUserId !== 'all') {
        params.append('user_id', selectedUserId);
      }

      const response = await axios.get(`${API}/time-entries?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      let entries = response.data;

      // Apply project filter
      if (selectedProjectId !== 'all') {
        entries = entries.filter(entry => entry.project_id === selectedProjectId);
      }

      // Apply status filter (now comes from timesheets table via approval_status)
      if (selectedStatus !== 'all') {
        entries = entries.filter(entry => {
          const status = entry.approval_status || 'draft';
          return status === selectedStatus;
        });
      }

      setTimeEntries(entries);
      groupTimeEntries(entries);
    } catch (error) {
      console.error('Failed to fetch time entries:', error);
      toast.error(t('detailedView.messages.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const groupTimeEntries = (entries) => {
    const grouped = {};

    entries.forEach(entry => {
      let key;

      // Group based on sumBy selection
      switch (sumBy) {
        case 'week':
          // Group by user and week
          const weekStart = getWeekStart(new Date(entry.date));
          const weekKey = formatDateISO(weekStart);
          key = `${entry.user_id}_week_${weekKey}`;
          break;
        case 'month':
          // Group by user and month
          const entryDate = new Date(entry.date);
          const monthKey = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}`;
          key = `${entry.user_id}_month_${monthKey}`;
          break;
        case 'project':
          // Group by user and project only
          const projectId = entry.project_id || 'no-project';
          key = `${entry.user_id}_${projectId}`;
          break;
        case 'day':
        default:
          // Group by user, project, and day
          const userId = entry.user_id;
          const projId = entry.project_id || 'no-project';
          const dateKey = formatDateISO(new Date(entry.date));
          key = `${userId}_${projId}_${dateKey}`;
          break;
      }

      if (!grouped[key]) {
        grouped[key] = {
          id: key,
          user_id: entry.user_id,
          project_id: entry.project_id || 'no-project',
          project_ids: new Set(),
          date: entry.date,
          entries: [],
          total_duration: 0,
          approval_status: entry.approval_status || 'draft'
        };
      }

      grouped[key].project_ids.add(entry.project_id || 'no-project');
      grouped[key].entries.push(entry);
      grouped[key].total_duration += entry.duration || 0;
    });

    const groupedArray = Object.values(grouped);
    setGroupedData(groupedArray);
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

  const toggleRowExpansion = (rowId) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(rowId)) {
      newExpanded.delete(rowId);
    } else {
      newExpanded.add(rowId);
    }
    setExpandedRows(newExpanded);
  };

  const handleAddTimeLog = () => {
    const today = formatDateISO(new Date());
    const newLog = {
      id: `new_log_${Date.now()}`,
      date: today,
      duration: 0,
      startTime: '09:00',
      endTime: '09:00',
      project_id: '',
      task_id: '',
      user_id: user.id
    };
    setEditingTimeLog(newLog);
    setShowTimeLogModal(true);
  };

  const handleSaveTimeLog = async (updatedLog) => {
    setIsSaving(true);
    try {
      if (!updatedLog.project_id) {
        toast.error(t('detailedView.messages.selectProject'));
        return false;
      }

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
        await axios.put(`${API}/time-entries/${updatedLog.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success(t('detailedView.messages.logUpdated'));
      } else {
        await axios.post(`${API}/time-entries/manual`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success(t('detailedView.messages.logCreated'));
      }

      await fetchTimeEntries();
      return true;
    } catch (error) {
      console.error('Failed to save time log:', error);
      toast.error(t('detailedView.messages.saveError'));
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditTimeLog = (entry) => {
    setEditingTimeLog({
      id: entry.id,
      date: formatDateISO(new Date(entry.date)),
      duration: Math.floor((entry.duration || 0) / 60), // modal works in minutes
      startTime: formatTime(new Date(entry.start_time)),
      endTime: formatTime(new Date(entry.end_time)),
      notes: entry.notes || '',
      project_id: entry.project_id || '',
      task_id: entry.task_id || ''
    });
    setShowTimeLogModal(true);
  };

  const handleDeleteTimeLog = async (log) => {
    setIsDeleting(true);
    try {
      if (log.id && !log.id.startsWith('new_log_')) {
        await axios.delete(`${API}/time-entries/${log.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        await fetchTimeEntries();
        toast.success(t('detailedView.messages.logDeleted'));
      }
      return true;
    } catch (error) {
      console.error('Failed to delete time log:', error);
      toast.error(t('detailedView.messages.deleteError'));
      return false;
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      const weekEnd = new Date(currentWeekStart);
      weekEnd.setDate(currentWeekStart.getDate() + 6);

      const params = new URLSearchParams({
        start_date: formatDateISO(currentWeekStart),
        end_date: formatDateISO(weekEnd),
      });

      if (isAdmin && selectedUserId !== 'all') {
        params.append('user_id', selectedUserId);
      }

      if (selectedProjectId !== 'all') {
        params.append('project_id', selectedProjectId);
      }

      const response = await axios.get(`${API}/reports/export/pdf?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `detailed_report_${formatDateISO(currentWeekStart)}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success(t('detailedView.messages.pdfExported'));
    } catch (error) {
      console.error('Failed to export PDF:', error);
      toast.error(t('detailedView.messages.exportPdfError'));
    }
  };

  const handleExportCSV = async () => {
    try {
      const weekEnd = new Date(currentWeekStart);
      weekEnd.setDate(currentWeekStart.getDate() + 6);

      const params = new URLSearchParams({
        start_date: formatDateISO(currentWeekStart),
        end_date: formatDateISO(weekEnd),
      });

      if (isAdmin && selectedUserId !== 'all') {
        params.append('user_id', selectedUserId);
      }

      if (selectedProjectId !== 'all') {
        params.append('project_id', selectedProjectId);
      }

      const response = await axios.get(`${API}/reports/export/csv?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `detailed_report_${formatDateISO(currentWeekStart)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success(t('detailedView.messages.csvExported'));
    } catch (error) {
      console.error('Failed to export CSV:', error);
      toast.error(t('detailedView.messages.exportCsvError'));
    }
  };

  const getUserName = (userId) => {
    const foundUser = users.find(u => u.id === userId);
    return foundUser ? foundUser.name : user?.id === userId ? user.name : t('detailedView.modal.unknownUser');
  };

  const getProjectName = (projectId) => {
    if (!projectId || projectId === 'no-project') return t('detailedView.modal.unknownProject');
    const project = projects.find(p => p.id === projectId);
    return project ? project.name : t('detailedView.modal.unknownProject');
  };

  const getStatusBadge = (status) => {
    const statusColors = {
      'approved': 'bg-green-100 text-green-800',
      'denied': 'bg-red-100 text-red-800',
      'submitted': 'bg-blue-100 text-blue-800',
      'draft': 'bg-yellow-100 text-yellow-800'
    };

    const displayStatus = status || 'draft';
    const colorClass = statusColors[displayStatus] || statusColors['draft'];

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${colorClass}`}>
        {t(`timesheets.${displayStatus}`)}
      </span>
    );
  };

  const weekRangeText = t('detailedView.weekRange', { range: formatDateRange(currentWeekStart) });

  return (
    <div className="space-y-6" data-testid="detailed-view-page">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold tracking-tight" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          {t('detailedView.title')}
        </h1>
      </div>

      {/* Controls Row */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Week Navigation */}
        <div className="flex items-center gap-2 border border-border rounded-lg px-4 py-2 bg-card">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePreviousWeek}
            data-testid="prev-week-btn"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[200px] text-center">
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
        </div>

        {/* Sum By Dropdown */}
        <div className="flex items-center gap-2 border border-border rounded-lg px-4 py-2 bg-card">
          <Select value={sumBy} onValueChange={setSumBy}>
            <SelectTrigger className="w-[150px]" data-testid="sum-by-filter">
              <SelectValue placeholder={t('detailedView.sumBy')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">{t('detailedView.sumByOptions.day')}</SelectItem>
              <SelectItem value="week">{t('detailedView.sumByOptions.week')}</SelectItem>
              <SelectItem value="month">{t('detailedView.sumByOptions.month')}</SelectItem>
              <SelectItem value="project">{t('detailedView.sumByOptions.project')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Add Time Log Button */}
        <Button onClick={handleAddTimeLog} data-testid="add-time-log-btn">
          <Plus className="h-4 w-4 mr-2" />
          {t('detailedView.addTimeLog')}
        </Button>

        {/* Download Button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" data-testid="download-btn">
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={handleExportPDF}>
              {t('detailedView.downloadPdf')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportCSV}>
              {t('detailedView.downloadCsv')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-sm font-medium">{t('detailedView.filters')}</span>

        {/* Users Filter (Admin Only) */}
        {isAdmin && (
          <div className="flex items-center gap-2 border border-border rounded-lg px-4 py-2 bg-card">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="w-[180px]" data-testid="users-filter">
                <SelectValue placeholder={t('detailedView.users')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('detailedView.allUsers')}</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Projects Filter */}
        <div className="flex items-center gap-2 border border-border rounded-lg px-4 py-2 bg-card">
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="w-[180px]" data-testid="projects-filter">
              <SelectValue placeholder={t('detailedView.projects')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('detailedView.allProjects')}</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2 border border-border rounded-lg px-4 py-2 bg-card">
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-[180px]" data-testid="status-filter">
              <SelectValue placeholder={t('detailedView.allStatus')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('detailedView.allStatus')}</SelectItem>
              <SelectItem value="draft">{t('timesheets.draft')}</SelectItem>
              <SelectItem value="submitted">{t('timesheets.submitted')}</SelectItem>
              <SelectItem value="approved">{t('timesheets.approved')}</SelectItem>
              <SelectItem value="denied">{t('timesheets.denied')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Total Hours Display */}
      <div className="text-lg font-semibold">
        {t('detailedView.totals', { hours: formatTimeDisplay(timeEntries.reduce((sum, entry) => sum + (entry.duration || 0), 0)) })}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="detailed-view-table">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="p-4 text-left font-medium w-[50px]"></th>
                <th className="p-4 text-left font-medium min-w-[150px]">{t('detailedView.table.user')}</th>
                <th className="p-4 text-left font-medium min-w-[200px]">{t('detailedView.table.project')}</th>
                <th className="p-4 text-center font-medium min-w-[150px]">{t('detailedView.table.totalHours')}</th>
                {/* <th className="p-4 text-center font-medium min-w-[150px]">{t('detailedView.table.approvalStatus')}</th> */}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    <div className="flex justify-center items-center">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                    </div>
                  </td>
                </tr>
              ) : groupedData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    {t('detailedView.table.noEntries')}
                  </td>
                </tr>
              ) : (
                groupedData.map((group) => (
                  <React.Fragment key={group.id}>
                    {/* Main Row */}
                    <tr className="border-b border-border hover:bg-muted/20 transition-colors">
                      {/* Expand/Collapse Button */}
                      <td className="p-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleRowExpansion(group.id)}
                          data-testid={`expand-row-${group.id}`}
                        >
                          {expandedRows.has(group.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRightIcon className="h-4 w-4" />
                          )}
                        </Button>
                      </td>

                      {/* User */}
                      <td className="p-4">{getUserName(group.user_id)}</td>

                      {/* Project */}
                      <td className="p-4">
                        {group.project_ids && group.project_ids.size > 1
                          ? 'Multiple projects'
                          : getProjectName(group.project_id)}
                      </td>

                      {/* Total Hours */}
                      <td className="p-4 text-center font-medium">
                        {formatTimeDisplay(group.total_duration)}
                      </td>

                      {/* Approval Status - Linked from Timesheets */}
                      {/* <td className="p-4 text-center">
                        {getStatusBadge(group.approval_status)}
                      </td> */}
                    </tr>

                    {/* Expanded Row Content */}
                    {expandedRows.has(group.id) && (
                      <tr className="bg-muted/10">
                        <td colSpan={5} className="p-4">
                          <div className="space-y-2">
                            <h4 className="font-semibold text-sm mb-3 text-foreground">{t('detailedView.table.dailyBreakdown')}</h4>
                            {group.entries.map((entry, index) => {
                              const entryDate = new Date(entry.date);
                              const dateStr = entryDate.toLocaleDateString('en-US', {
                                weekday: 'short',
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              });

                              return (
                                <div
                                  key={entry.id || index}
                                  className="flex items-center justify-between p-3 bg-card border border-border rounded-lg shadow-sm cursor-pointer hover:bg-muted/30 transition-colors"
                                  onClick={() => handleEditTimeLog(entry)}
                                  title="Click to edit this time log"
                                  data-testid={`entry-${entry.id}`}
                                >
                                  <div className="flex-1">
                                    <span className="text-sm font-medium text-foreground">{dateStr}</span>
                                  </div>
                                  <div className="text-sm text-muted-foreground font-mono">
                                    {formatTimeDisplay(entry.duration)}
                                  </div>
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
          </table>
        </div>
      </div>

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
        isSaving={isSaving}
        isDeleting={isDeleting}
      />
    </div>
  );
};
