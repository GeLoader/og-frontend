import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { toast } from 'sonner';
import { Check, X, Eye, Edit, Loader2 } from 'lucide-react';
import {
  createDateAsBerlinTime,
  formatTimeBerlin,
  getEntryDateString,
  parseEntryDate,
} from '../lib/utils';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Helper functions for time formatting
const parseTimeToMinutes = (timeStr) => {
  if (!timeStr || timeStr === '0:00') return 0;
  const parts = timeStr.split(':');
  if (parts.length !== 2) return 0;
  const hours = parseInt(parts[0]) || 0;
  const minutes = parseInt(parts[1]) || 0;
  return hours * 60 + minutes;
};

const formatMinutesToTime = (minutes) => {
  if (!minutes || minutes === 0) return '0:00';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}:${String(mins).padStart(2, '0')}`;
};

// Time Log Modal Component (same as TimeTrackerPage)
const TimeLogModal = ({ isOpen, onClose, timeEntry, onSave, onDelete, projects, allTasks, isSaving, isDeleting }) => {
  const [duration, setDuration] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [date, setDate] = useState('');
  const [projectId, setProjectId] = useState('');
  const [taskId, setTaskId] = useState('');

  useEffect(() => {
    if (timeEntry) {
      // Calculate duration from entry
      const durationMinutes = Math.floor(timeEntry.duration / 60);
      setDuration(formatMinutesToTime(durationMinutes));

      // Format start and end times in the application timezone (Europe/Berlin)
      setStartTime(formatTimeBerlin(timeEntry.start_time));
      setEndTime(formatTimeBerlin(timeEntry.end_time));

      // Format date (avoid Date/UTC round-trip so the day cannot shift)
      setDate(getEntryDateString(timeEntry));

      setProjectId(timeEntry.project_id || '');
      setTaskId(timeEntry.task_id || '');
    }
  }, [timeEntry]);

  // Helper: Calculate duration in minutes between two times (HH:MM format)
  const calculateDurationFromTimes = (start, end) => {
    if (!start || !end) return 0;

    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    let diff = endMinutes - startMinutes;
    if (diff < 0) {
      diff += 24 * 60;
    }

    return diff;
  };

  // Helper: Add minutes to a time (HH:MM format)
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

  // Handle start time change → recalculate duration
  const handleStartTimeChange = (newStartTime) => {
    setStartTime(newStartTime);

    if (newStartTime && endTime) {
      const newDurationMinutes = calculateDurationFromTimes(newStartTime, endTime);
      setDuration(formatMinutesToTime(newDurationMinutes));
    }
  };

  // Handle end time change → recalculate duration
  const handleEndTimeChange = (newEndTime) => {
    setEndTime(newEndTime);

    if (startTime && newEndTime) {
      const newDurationMinutes = calculateDurationFromTimes(startTime, newEndTime);
      setDuration(formatMinutesToTime(newDurationMinutes));
    }
  };

  // Handle duration change → recalculate end time
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
      ...timeEntry,
      duration: durationMinutes * 60, // Convert back to seconds for API
      startTime,
      endTime,
      date,
      project_id: projectId,
      task_id: taskId
    });
    // Only close when the save actually succeeded
    if (ok !== false) onClose();
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this time log?')) {
      const ok = await onDelete(timeEntry);
      if (ok !== false) onClose();
    }
  };

  const getTasksForProject = (proj_id) => {
    return allTasks.filter(task => task.project_id === proj_id);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Edit time log</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Fields */}
        <div className="space-y-4">
          {/* Project */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Project</label>
            <Select
              value={projectId}
              onValueChange={(value) => {
                setProjectId(value);
                setTaskId(''); // tasks belong to a project, reset the stale selection
              }}
            >
              <SelectTrigger className="w-full">
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Task</label>
            <Select value={taskId} onValueChange={setTaskId} disabled={!projectId}>
              <SelectTrigger className="w-full">
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Duration</label>
            <Input
              type="text"
              placeholder="0:00"
              value={duration}
              onChange={(e) => handleDurationChange(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Start Time & End Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start time</label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => handleStartTimeChange(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End time</label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => handleEndTimeChange(e.target.value)}
                className="w-full"
              />
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mt-6">
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={isSaving || isDeleting}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
            <Button variant="outline" onClick={onClose} disabled={isSaving || isDeleting}>Dismiss</Button>
          </div>
          <Button variant="destructive" onClick={handleDelete} disabled={isSaving || isDeleting}>
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete this log
          </Button>
        </div>
      </div>
    </div>
  );
};

export const AdminApprovalsPage = () => {
  const { token } = useAuth();
  const { t } = useTranslation();
  const [timesheets, setTimesheets] = useState([]);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTimesheet, setSelectedTimesheet] = useState(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [showEntriesDialog, setShowEntriesDialog] = useState(false);
  const [showEditEntryDialog, setShowEditEntryDialog] = useState(false);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewAction, setReviewAction] = useState('');
  const [activeTab, setActiveTab] = useState('approvals');
  const [timeEntries, setTimeEntries] = useState([]);

  const [editingEntry, setEditingEntry] = useState(null);
  const [isSavingEntry, setIsSavingEntry] = useState(false);
  const [isDeletingEntry, setIsDeletingEntry] = useState(false);

  // Loading states for buttons
  const [loadingViewEntries, setLoadingViewEntries] = useState(null);
  const [loadingReview, setLoadingReview] = useState(false);
  const [loadingEditEntry, setLoadingEditEntry] = useState(null);

  useEffect(() => {
    fetchTimesheets();
    fetchUsers();
    fetchProjects();
  }, [activeTab]);

  const fetchTimesheets = async () => {
    try {
      setLoading(true);
      let url = `${API}/timesheets`;
      if (activeTab === 'approvals') {
        url += '?status=submitted';
      } else if (activeTab === 'approved') {
        url += '?status=approved';
      } else if (activeTab === 'denied') {
        url += '?status=denied';
      }
      // 'all' tab doesn't add a status filter

      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTimesheets(response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch timesheets:', error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/admin/employees`, {
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

  const fetchTimeEntries = async (timesheet) => {
    try {
      setTimeEntries([]);
      const response = await axios.get(
        `${API}/time-entries?start_date=${timesheet.week_start}&end_date=${timesheet.week_end}&user_id=${timesheet.user_id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTimeEntries(response.data);
      return true;
    } catch (error) {
      console.error('Failed to fetch time entries:', error);
      toast.error(t('approvals.messages.loadEntriesError'));
      return false;
    }
  };

  // Re-read the timesheet so its total_hours matches the edited entries
  const refreshSelectedTimesheet = async (timesheetId) => {
    if (!timesheetId) return;
    const freshList = await fetchTimesheets();
    const fresh = (freshList || []).find(ts => ts.id === timesheetId);
    if (fresh) {
      setSelectedTimesheet(fresh);
    }
  };

  const handleReview = async () => {
    if (reviewAction === 'denied' && !reviewComment.trim()) {
      toast.error(t('approvals.messages.commentRequiredError'));
      return;
    }

    try {
      setLoadingReview(true);
      await axios.put(`${API}/timesheets/${selectedTimesheet.id}/review`, {
        status: reviewAction,
        admin_comment: reviewComment
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(t(`approvals.messages.${reviewAction}`));
      setShowReviewDialog(false);
      setSelectedTimesheet(null);
      setReviewComment('');
      fetchTimesheets();
    } catch (error) {
      toast.error(t('approvals.messages.reviewError'));
    } finally {
      setLoadingReview(false);
    }
  };

  const openReviewDialog = (timesheet, action) => {
    setSelectedTimesheet(timesheet);
    setReviewAction(action);
    setReviewComment(''); // never leak a previous comment into the next review
    setShowReviewDialog(true);
  };

  const getUserName = (userId) => {
    const user = users.find(u => u.id === userId);
    return user ? user.name : 'Unknown';
  };

  const handleViewEntries = async (timesheet) => {
    try {
      setLoadingViewEntries(timesheet.id);
      setSelectedTimesheet(timesheet);
      const ok = await fetchTimeEntries(timesheet);
      if (ok) setShowEntriesDialog(true);
    } catch (error) {
      console.error('Failed to fetch entries:', error);
    } finally {
      setLoadingViewEntries(null);
    }
  };

  const handleEditEntry = async (entry) => {
    try {
      setLoadingEditEntry(entry.id);
      setEditingEntry(entry);
      // Close the Time Entries modal first
      setShowEntriesDialog(false);
      // Small delay to ensure smooth transition
      setTimeout(() => {
        setShowEditEntryDialog(true);
        setLoadingEditEntry(null);
      }, 100);
    } catch (error) {
      console.error('Failed to load entry for editing:', error);
      setLoadingEditEntry(null);
    }
  };

  const handleSaveTimeEntry = async (updatedEntry) => {
    // Validate that a project is selected
    if (!updatedEntry.project_id) {
      toast.error('Please select a project');
      return false;
    }

    setIsSavingEntry(true);
    try {
      // Create datetime strings in the application timezone (Europe/Berlin)
      const startDateTime = createDateAsBerlinTime(updatedEntry.date, updatedEntry.startTime);
      const endDateTime = createDateAsBerlinTime(updatedEntry.date, updatedEntry.endTime);
      // Overnight shift: end time on the next day instead of a negative duration
      if (endDateTime < startDateTime) {
        endDateTime.setDate(endDateTime.getDate() + 1);
      }

      const payload = {
        project_id: updatedEntry.project_id,
        task_id: updatedEntry.task_id || null,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        duration: updatedEntry.duration, // Already in seconds
        notes: updatedEntry.notes || ''
      };

      await axios.put(`${API}/time-entries/${updatedEntry.id}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success(t('approvals.messages.entryUpdated'));

      // Refresh entries, the list totals and the dialog header
      if (selectedTimesheet) {
        await fetchTimeEntries(selectedTimesheet);
        await refreshSelectedTimesheet(selectedTimesheet.id);
      }
      return true;
    } catch (error) {
      toast.error(error.response?.data?.detail || t('approvals.messages.entryUpdateError'));
      return false;
    } finally {
      setIsSavingEntry(false);
    }
  };

  const handleDeleteTimeEntry = async (entry) => {
    setIsDeletingEntry(true);
    try {
      await axios.delete(`${API}/time-entries/${entry.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Time entry deleted');

      // Refresh entries, the list totals and the dialog header
      if (selectedTimesheet) {
        await fetchTimeEntries(selectedTimesheet);
        await refreshSelectedTimesheet(selectedTimesheet.id);
      }
      return true;
    } catch (error) {
      console.error('Failed to delete time entry:', error);
      toast.error('Failed to delete time entry');
      return false;
    } finally {
      setIsDeletingEntry(false);
    }
  };

  const handleCloseEditModal = () => {
    setShowEditEntryDialog(false);
    setEditingEntry(null);
    // Reopen the Time Entries dialog
    setShowEntriesDialog(true);
  };

  // UPDATED: Format duration in hh:mm:ss format
  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const hh = String(hrs).padStart(2, '0');
    const mm = String(mins).padStart(2, '0');
    const ss = String(secs).padStart(2, '0');

    return `${hh}:${mm}:${ss}`;
  };

  // UPDATED: Format total hours from hours to hh:mm:ss format
  const formatTotalHours = (hours) => {
    const totalSeconds = Math.round(hours * 3600);
    return formatDuration(totalSeconds);
  };

  // 🆕 Format date range: "Mon, Feb 2, 2026 - Sun, Feb 8, 2026"
  const formatPayPeriod = (weekStart, weekEnd) => {
    const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
    const startDate = new Date(weekStart);
    const endDate = new Date(weekEnd);

    const formattedStart = startDate.toLocaleDateString('en-US', options);
    const formattedEnd = endDate.toLocaleDateString('en-US', options);

    return `${formattedStart} - ${formattedEnd}`;
  };

  return (
    <div className="space-y-4 sm:space-y-6" data-testid="admin-approvals-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          {t('approvals.title')}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed sm:text-base">
          {t('approvals.subtitle')}
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 gap-1 h-auto sm:grid-cols-4" data-testid="approvals-tabs">
          <TabsTrigger value="approvals" data-testid="approvals-tab" className="min-w-0 w-full min-h-10 whitespace-nowrap text-xs sm:text-sm">
            <span className="inline-flex items-center gap-1">
              {t('approvals.tabs.approvals')}
              {activeTab === 'approvals' && timesheets.length > 0 && (
                <span className="inline-flex items-center justify-center rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold leading-none text-white">
                  {timesheets.length}
                </span>
              )}
            </span>
          </TabsTrigger>
          <TabsTrigger value="approved" data-testid="approved-tab" className="min-w-0 w-full min-h-10 whitespace-nowrap text-xs sm:text-sm">
            {t('approvals.tabs.approved')}
          </TabsTrigger>
          <TabsTrigger value="denied" data-testid="denied-tab" className="min-w-0 w-full min-h-10 whitespace-nowrap text-xs sm:text-sm">
            {t('approvals.tabs.denied')}
          </TabsTrigger>
          <TabsTrigger value="all" data-testid="all-tab" className="min-w-0 w-full min-h-10 whitespace-nowrap text-xs sm:text-sm">
            {t('approvals.tabs.all')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {/* Desktop/Tablet Table */}
          <div className="hidden md:block overflow-hidden rounded-xl border border-border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm text-left" data-testid="timesheets-table">
                <thead className="bg-muted/50 text-muted-foreground font-medium">
                  <tr>
                    <th className="p-4 align-middle">{t('approvals.table.employee')}</th>
                    <th className="p-4 align-middle">{t('approvals.table.period')}</th>
                    <th className="p-4 align-middle">{t('approvals.table.totalHours')}</th>
                    <th className="p-4 align-middle">{t('approvals.table.status')}</th>
                    <th className="p-4 align-middle">{t('approvals.table.submitted')}</th>
                    <th className="p-4 align-middle">{t('approvals.table.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-muted-foreground">
                        <div className="flex justify-center items-center">
                          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                        </div>
                      </td>
                    </tr>
                  ) : timesheets.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-muted-foreground">
                        {t('approvals.messages.noTimesheets')}
                      </td>
                    </tr>
                  ) : (
                    timesheets.map((timesheet) => (
                      <tr key={timesheet.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                        <td className="p-4 align-middle font-medium min-w-0">{getUserName(timesheet.user_id)}</td>
                        <td className="p-4 align-middle min-w-0">{formatPayPeriod(timesheet.week_start, timesheet.week_end)}</td>
                        <td className="p-4 align-middle font-medium whitespace-nowrap">{formatTotalHours(timesheet.total_hours)}</td>
                        <td className="p-4 align-middle">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${timesheet.status === 'approved'
                            ? 'bg-green-100 text-green-800'
                            : timesheet.status === 'denied'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                            }`}>
                            {timesheet.status}
                          </span>
                        </td>
                        <td className="p-4 align-middle text-muted-foreground whitespace-nowrap">
                          {timesheet.submitted_at
                            ? new Date(timesheet.submitted_at).toLocaleDateString()
                            : '-'}
                        </td>
                        <td className="p-4 align-middle">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleViewEntries(timesheet)}
                              disabled={loadingViewEntries === timesheet.id}
                              data-testid={`view-entries-${timesheet.id}`}
                              className="h-8"
                            >
                              {loadingViewEntries === timesheet.id ? (
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              ) : (
                                <Eye className="h-4 w-4 mr-1" />
                              )}
                              {t('approvals.buttons.viewEntries')}
                            </Button>
                            {timesheet.status === 'submitted' && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => openReviewDialog(timesheet, 'approved')}
                                  data-testid={`approve-timesheet-${timesheet.id}`}
                                  className="h-8"
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  {t('approvals.buttons.approve')}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => openReviewDialog(timesheet, 'denied')}
                                  data-testid={`deny-timesheet-${timesheet.id}`}
                                  className="h-8"
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  {t('approvals.buttons.deny')}
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3" data-testid="timesheets-cards">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              </div>
            ) : timesheets.length === 0 ? (
              <div className="rounded-xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
                {t('approvals.messages.noTimesheets')}
              </div>
            ) : (
              timesheets.map((timesheet) => (
                <div key={timesheet.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{getUserName(timesheet.user_id)}</p>
                      <p className="text-sm text-muted-foreground break-words">
                        {formatPayPeriod(timesheet.week_start, timesheet.week_end)}
                      </p>
                    </div>
                    <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${timesheet.status === 'approved'
                      ? 'bg-green-100 text-green-800'
                      : timesheet.status === 'denied'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                      }`}>
                      {timesheet.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="min-w-0">
                      <div className="text-muted-foreground">{t('approvals.table.totalHours')}</div>
                      <div className="font-medium whitespace-nowrap">{formatTotalHours(timesheet.total_hours)}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-muted-foreground">{t('approvals.table.submitted')}</div>
                      <div className="font-medium whitespace-nowrap">
                        {timesheet.submitted_at
                          ? new Date(timesheet.submitted_at).toLocaleDateString()
                          : '-'}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleViewEntries(timesheet)}
                      disabled={loadingViewEntries === timesheet.id}
                      data-testid={`view-entries-${timesheet.id}`}
                      className="h-8"
                    >
                      {loadingViewEntries === timesheet.id ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Eye className="h-4 w-4 mr-1" />
                      )}
                      {t('approvals.buttons.viewEntries')}
                    </Button>
                    {timesheet.status === 'submitted' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => openReviewDialog(timesheet, 'approved')}
                          data-testid={`approve-timesheet-${timesheet.id}`}
                          className="h-8"
                        >
                          <Check className="h-4 w-4 mr-1" />
                          {t('approvals.buttons.approve')}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => openReviewDialog(timesheet, 'denied')}
                          data-testid={`deny-timesheet-${timesheet.id}`}
                          className="h-8"
                        >
                          <X className="h-4 w-4 mr-1" />
                          {t('approvals.buttons.deny')}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Review Dialog */}
      <Dialog
        open={showReviewDialog}
        onOpenChange={(open) => {
          setShowReviewDialog(open);
          if (!open) setReviewComment('');
        }}
      >
        <DialogContent data-testid="review-dialog">
          <DialogHeader>
            <DialogTitle>
              {t(`approvals.dialog.reviewTitle.${reviewAction === 'approved' ? 'approve' : 'deny'}`)}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {selectedTimesheet && (
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="text-sm text-muted-foreground mb-1">{t('approvals.table.employee')}</div>
                <div className="font-medium mb-3">{getUserName(selectedTimesheet.user_id)}</div>
                <div className="text-sm text-muted-foreground mb-1">{t('approvals.table.period')}</div>
                <div className="font-medium mb-3">
                  {formatPayPeriod(selectedTimesheet.week_start, selectedTimesheet.week_end)}
                </div>
                <div className="text-sm text-muted-foreground mb-1">{t('approvals.table.totalHours')}</div>
                <div className="font-medium">{formatTotalHours(selectedTimesheet.total_hours)}</div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-2 block">
                {t('approvals.dialog.comment')} {reviewAction === 'denied' && <span className="text-red-500">*</span>}
              </label>
              <Textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder={reviewAction === 'approved' ? t('approvals.dialog.commentOptional') : t('approvals.dialog.commentRequired')}
                rows={4}
                data-testid="review-comment"
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleReview}
                className="flex-1"
                disabled={loadingReview}
                data-testid="confirm-review-btn"
              >
                {loadingReview ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t(`approvals.dialog.confirm${reviewAction === 'approved' ? 'Approval' : 'Denial'}`)}
                  </>
                ) : (
                  t(`approvals.dialog.confirm${reviewAction === 'approved' ? 'Approval' : 'Denial'}`)
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowReviewDialog(false)}
                className="flex-1"
                disabled={loadingReview}
              >
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Time Entries Dialog */}
      <Dialog open={showEntriesDialog} onOpenChange={setShowEntriesDialog}>
        <DialogContent className="w-full max-w-4xl" data-testid="entries-dialog">
          <DialogHeader>
            <DialogTitle>{t('approvals.dialog.entriesTitle')}</DialogTitle>
          </DialogHeader>
          <div className="pt-4">
            {selectedTimesheet && (
              <div className="mb-4 bg-muted/50 rounded-lg p-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <div className="text-sm text-muted-foreground">{t('approvals.table.employee')}</div>
                    <div className="font-medium">{getUserName(selectedTimesheet.user_id)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">{t('approvals.table.period')}</div>
                    <div className="font-medium">
                      {formatPayPeriod(selectedTimesheet.week_start, selectedTimesheet.week_end)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">{t('approvals.table.totalHours')}</div>
                    <div className="font-medium">{formatTotalHours(selectedTimesheet.total_hours)}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-3 text-left">{t('approvals.dialog.date')}</th>
                    <th className="p-3 text-left">{t('approvals.dialog.time')}</th>
                    <th className="p-3 text-left">{t('timeEntry.project')}</th>
                    <th className="p-3 text-left">{t('timeEntry.task')}</th>
                    <th className="p-3 text-left">{t('approvals.dialog.duration')}</th>
                    <th className="p-3 text-left">{t('timeEntry.notes')}</th>
                    <th className="p-3 text-left">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {timeEntries.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="p-8 text-center text-muted-foreground">
                        {t('approvals.messages.noEntries')}
                      </td>
                    </tr>
                  ) : (
                    timeEntries.map((entry) => {
                      const project = projects.find(p => p.id === entry.project_id);
                      const task = allTasks.find(t => t.id === entry.task_id);

                      return (
                        <tr key={entry.id} className="border-t hover:bg-muted/20">
                          <td className="p-3">{parseEntryDate(entry).toLocaleDateString([], { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</td>
                          <td className="p-3">
                            {formatTimeBerlin(entry.start_time)}
                          </td>
                          <td className="p-3">{project?.name || 'No Project'}</td>
                          <td className="p-3">{task?.name || 'No Task'}</td>
                          <td className="p-3 font-medium">{formatDuration(entry.duration)}</td>
                          <td className="p-3 text-muted-foreground">{entry.notes || '-'}</td>
                          <td className="p-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditEntry(entry)}
                              disabled={loadingEditEntry === entry.id}
                              data-testid={`edit-entry-${entry.id}`}
                            >
                              {loadingEditEntry === entry.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Edit className="h-4 w-4" />
                              )}
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Entry Modal - Using TimeLogModal */}
      <TimeLogModal
        isOpen={showEditEntryDialog}
        onClose={handleCloseEditModal}
        timeEntry={editingEntry}
        onSave={handleSaveTimeEntry}
        onDelete={handleDeleteTimeEntry}
        projects={projects}
        allTasks={allTasks}
        isSaving={isSavingEntry}
        isDeleting={isDeletingEntry}
      />
    </div>
  );
};
