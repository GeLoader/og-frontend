import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  Download,
  Users as UsersIcon,
  Briefcase,
  Check,
  Info,
  Calendar,
  Loader2
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useAuth } from '../contexts/AuthContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Helper function to get week start (Monday)
const getWeekStart = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1; // Days to subtract to get to Monday
  const monday = new Date(d);
  monday.setDate(d.getDate() - diff); // Subtract to get Monday
  monday.setHours(0, 0, 0, 0); // Reset time to start of day
  return monday;
};

// Helper to get local date string YYYY-MM-DD
const toLocalISODate = (date) => {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
};

export const ReportTimeSheetPage = () => {
  const { token, user } = useAuth();

  // Check admin role using same pattern as DetailedViewPage
  const isAdmin = user?.role === 'admin';

  // State for date navigation - Start week on Monday
  const [viewStartDate, setViewStartDate] = useState(() => {
    const today = new Date();
    return getWeekStart(today);
  });

  const [viewEndDate, setViewEndDate] = useState(() => {
    const today = new Date();
    const start = getWeekStart(today);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return end;
  });

  // State for date filter
  const [dateFilter, setDateFilter] = useState('this-week');
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // State for filters
  const [selectedUserId, setSelectedUserId] = useState('all');
  const [selectedProjectId, setSelectedProjectId] = useState('all');
  const [selectedTaskId, setSelectedTaskId] = useState('all');

  // State for data
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);

  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // State for expanded rows
  const [expandedRows, setExpandedRows] = useState({});

  // Calculate dates in view
  const datesInView = useMemo(() => {
    const dates = [];
    const current = new Date(viewStartDate);
    const end = new Date(viewEndDate);

    // Safety break to prevent infinite loops if dates are messed up
    let count = 0;
    while (current <= end && count < 60) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
      count++;
    }
    return dates;
  }, [viewStartDate, viewEndDate]);

  // Format date helper
  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatDayName = (date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  };

  // Date filter handler
  const handleDateFilterChange = (value) => {
    setDateFilter(value);
    setShowCustomDatePicker(value === 'custom');

    const today = new Date();
    let newStart, newEnd;

    switch (value) {
      case 'today':
        newStart = new Date(today);
        newStart.setHours(0, 0, 0, 0);
        newEnd = new Date(newStart);
        setViewStartDate(newStart);
        setViewEndDate(newEnd);
        break;

      case 'this-week':
        newStart = getWeekStart(today);
        newEnd = new Date(newStart);
        newEnd.setDate(newEnd.getDate() + 6); // Monday + 6 = Sunday
        setViewStartDate(newStart);
        setViewEndDate(newEnd);
        break;

      case 'last-week':
        newStart = getWeekStart(today);
        newStart.setDate(newStart.getDate() - 7);
        newEnd = new Date(newStart);
        newEnd.setDate(newEnd.getDate() + 6);
        setViewStartDate(newStart);
        setViewEndDate(newEnd);
        break;

      case 'this-month':
        newStart = new Date(today.getFullYear(), today.getMonth(), 1);
        newEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0); // Last day of month
        setViewStartDate(newStart);
        setViewEndDate(newEnd);
        break;

      case 'last-month':
        newStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        newEnd = new Date(today.getFullYear(), today.getMonth(), 0); // Last day of previous month
        setViewStartDate(newStart);
        setViewEndDate(newEnd);
        break;

      case 'custom':
        // Show custom date picker
        break;

      default:
        break;
    }
  };

  // Apply custom date range
  const handleApplyCustomDate = () => {
    if (customStartDate && customEndDate) {
      const start = new Date(customStartDate);
      const end = new Date(customEndDate);
      setViewStartDate(start);
      setViewEndDate(end);
      setShowCustomDatePicker(false);
      // setDateFilter('custom'); // Already set
    }
  };

  // Navigation handlers
  const handlePrevious = () => {
    const diffTime = Math.abs(viewEndDate - viewStartDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include start day

    const newStart = new Date(viewStartDate);
    newStart.setDate(newStart.getDate() - diffDays);

    const newEnd = new Date(viewEndDate);
    newEnd.setDate(newEnd.getDate() - diffDays);

    setViewStartDate(newStart);
    setViewEndDate(newEnd);
    setDateFilter('custom');
  };

  const handleNext = () => {
    const diffTime = Math.abs(viewEndDate - viewStartDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const newStart = new Date(viewStartDate);
    newStart.setDate(newStart.getDate() + diffDays);

    const newEnd = new Date(viewEndDate);
    newEnd.setDate(newEnd.getDate() + diffDays);

    setViewStartDate(newStart);
    setViewEndDate(newEnd);
    setDateFilter('custom');
  };

  // Fetch master data
  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        // Only fetch all users if admin
        if (isAdmin) {
          const usersRes = await axios.get(`${API}/users`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setUsers(usersRes.data || []);
        } else {
          // For non-admin, only set current user
          if (user) {
            setUsers([{ id: user.id, name: user.name }]);
          }
        }

        // Fetch projects
        const projectsRes = await axios.get(`${API}/projects`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setProjects(projectsRes.data || []);

        // Fetch tasks
        const tasksRes = await axios.get(`${API}/tasks`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setTasks(tasksRes.data || []);
      } catch (error) {
        console.error('Error fetching master data:', error);
        // If API fails, at least set current user for non-admin
        if (!isAdmin && user) {
          setUsers([{ id: user.id, name: user.name }]);
        }
      }
    };

    if (token && user) {
      fetchMasterData();
    }
  }, [token, user, isAdmin]);

  // Update selected user when auth state changes
  useEffect(() => {
    if (!isAdmin && user) {
      setSelectedUserId(user.id);
    }
  }, [isAdmin, user]);

  // Fetch time entries
  useEffect(() => {
    const fetchTimeEntries = async () => {
      if (!token || !user) return;

      setLoading(true);
      try {
        const params = {
          start_date: toLocalISODate(viewStartDate),
          end_date: toLocalISODate(viewEndDate),
        };

        // For non-admin users, always filter by their user ID
        if (!isAdmin) {
          params.user_id = user.id;
        } else if (selectedUserId !== 'all') {
          params.user_id = selectedUserId;
        }

        if (selectedProjectId !== 'all') params.project_id = selectedProjectId;
        if (selectedTaskId !== 'all') params.task_id = selectedTaskId;

        const response = await axios.get(`${API}/time-entries`, {
          params,
          headers: { Authorization: `Bearer ${token}` }
        });
        setTimeEntries(response.data || []);
      } catch (error) {
        console.error('Error fetching time entries:', error);
        setTimeEntries([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTimeEntries();
  }, [viewStartDate, viewEndDate, selectedUserId, selectedProjectId, selectedTaskId, token, user, isAdmin]);

  // Group and aggregate time entries
  const groupedData = useMemo(() => {
    if (!timeEntries.length || !user) return [];

    const grouped = {};
    const totalDays = datesInView.length;

    timeEntries.forEach(entry => {
      const userId = entry.user_id || user.id; // Fallback to current user
      const projectId = entry.project_id || 'no-project';
      const taskId = entry.task_id || 'no-task';
      const entryDate = new Date(entry.date || entry.start_time);

      // Normalize dates to midnight for comparison
      const entryTime = new Date(entryDate);
      entryTime.setHours(0, 0, 0, 0);
      const startTime = new Date(viewStartDate);
      startTime.setHours(0, 0, 0, 0);

      const dayIndex = Math.floor((entryTime - startTime) / (1000 * 60 * 60 * 24));

      // Skip entries outside current view
      if (dayIndex < 0 || dayIndex >= totalDays) return;

      const duration = entry.duration || 0;

      // Initialize user
      if (!grouped[userId]) {
        // Find user name from users array or use current user
        let userName;
        if (userId === user.id) {
          userName = user.name;
        } else {
          const foundUser = users.find(u => u.id === userId);
          userName = foundUser ? foundUser.name : 'Unknown User';
        }

        grouped[userId] = {
          id: userId,
          name: userName,
          projects: {},
          totalHours: Array(totalDays).fill(0),
        };
      }

      // Initialize project
      if (!grouped[userId].projects[projectId]) {
        const project = projects.find(p => p.id === projectId);
        grouped[userId].projects[projectId] = {
          id: projectId,
          name: projectId === 'no-project' ? 'No Project' : (project?.name || `Project ${projectId}`),
          tasks: {},
          totalHours: Array(totalDays).fill(0),
        };
      }

      // Initialize task
      if (!grouped[userId].projects[projectId].tasks[taskId]) {
        const task = tasks.find(t => t.id === taskId);
        grouped[userId].projects[projectId].tasks[taskId] = {
          id: taskId,
          name: taskId === 'no-task' ? 'No Task' : (task?.name || `Task ${taskId}`),
          totalHours: Array(totalDays).fill(0),
        };
      }

      // Add hours
      const hours = duration / 3600;
      grouped[userId].totalHours[dayIndex] += hours;
      grouped[userId].projects[projectId].totalHours[dayIndex] += hours;
      grouped[userId].projects[projectId].tasks[taskId].totalHours[dayIndex] += hours;
    });

    return grouped;
  }, [timeEntries, users, projects, tasks, user, datesInView, viewStartDate]);

  // Calculate grand totals
  const grandTotals = useMemo(() => {
    const totalDays = datesInView.length;
    const totals = Array(totalDays).fill(0);
    Object.values(groupedData).forEach(user => {
      user.totalHours.forEach((hours, index) => {
        totals[index] += hours;
      });
    });
    return totals;
  }, [groupedData, datesInView]);

  // Format hours display
  const formatHours = (hours) => {
    if (!hours) return '0';
    const totalMinutes = Math.round(hours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}:${String(m).padStart(2, '0')}`;
  };

  // Toggle row expansion
  const toggleRow = (rowId) => {
    setExpandedRows(prev => ({
      ...prev,
      [rowId]: !prev[rowId]
    }));
  };

  // Export handlers
  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const params = {
        start_date: toLocalISODate(viewStartDate),
        end_date: toLocalISODate(viewEndDate),
      };

      // For non-admin, always use their user ID
      if (!isAdmin) {
        params.user_id = user.id;
      } else if (selectedUserId !== 'all') {
        params.user_id = selectedUserId;
      }

      if (selectedProjectId !== 'all') {
        params.project_id = selectedProjectId;
      }

      const response = await axios.get(`${API}/reports/export/pdf`, {
        params,
        responseType: 'blob',
        headers: { Authorization: `Bearer ${token}` }
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `timesheet_${params.start_date}_to_${params.end_date}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error exporting PDF:', error);
    } finally {
      setExporting(false);
    }
  };

  // useTranslation hook
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <h1 className="text-4xl font-bold tracking-tight" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              {t('reportTimeSheet.title')}
            </h1>
            <Info className="w-5 h-5 text-muted-foreground" />
          </div>
          <Button
            onClick={handleExportPDF}
            disabled={exporting}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-6"
            data-testid="download-pdf-btn"
          >
            {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            {t('reportTimeSheet.downloadPdf')}
          </Button>
        </div>

        {/* Date Navigation */}
        <div className="bg-card rounded-lg border border-border p-4 mb-6 shadow-sm">
          <div className="flex items-center gap-4 flex-wrap">
            <Select value={dateFilter} onValueChange={handleDateFilterChange}>
              <SelectTrigger className="w-[150px] bg-background border-input">
                <SelectValue placeholder={t('reportTimeSheet.dateRanges.thisWeek')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">{t('reportTimeSheet.dateRanges.today')}</SelectItem>
                <SelectItem value="this-week">{t('reportTimeSheet.dateRanges.thisWeek')}</SelectItem>
                <SelectItem value="last-week">{t('reportTimeSheet.dateRanges.lastWeek')}</SelectItem>
                <SelectItem value="this-month">{t('reportTimeSheet.dateRanges.thisMonth')}</SelectItem>
                <SelectItem value="last-month">{t('reportTimeSheet.dateRanges.lastMonth')}</SelectItem>
                <SelectItem value="custom">{t('reportTimeSheet.dateRanges.custom')}</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrevious}
                data-testid="previous-week-btn"
                className="hover:bg-muted text-foreground"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>

              <div className="text-lg font-medium px-4 text-foreground">
                {formatDate(viewStartDate)} → {formatDate(viewEndDate)}
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={handleNext}
                data-testid="next-week-btn"
                className="hover:bg-muted text-foreground"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Custom Date Picker */}
          {showCustomDatePicker && (
            <div className="mt-4 p-4 bg-muted/50 rounded-lg border border-border">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-[180px] bg-background border-input"
                    placeholder={t('reportTimeSheet.customDate.startDate')}
                  />
                  <span className="text-muted-foreground">→</span>
                  <Input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-[180px] bg-background border-input"
                    placeholder={t('reportTimeSheet.customDate.endDate')}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleApplyCustomDate}
                    disabled={!customStartDate || !customEndDate}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    {t('reportTimeSheet.customDate.apply')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowCustomDatePicker(false);
                      setDateFilter('this-week');
                      handleDateFilterChange('this-week');
                    }}
                    className="border-input hover:bg-muted hover:text-foreground"
                  >
                    {t('reportTimeSheet.customDate.cancel')}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="bg-card rounded-lg border border-border p-4 mb-6 shadow-sm">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm font-semibold text-muted-foreground">{t('reportTimeSheet.filters.label')}</span>

            {/* Users Filter - Only show for Admin */}
            {isAdmin && (
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="w-[150px] bg-background border-input" data-testid="users-filter">
                  <UsersIcon className="w-4 h-4 mr-2" />
                  <SelectValue placeholder={t('reportTimeSheet.filters.users')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('reportTimeSheet.filters.allUsers')}</SelectItem>
                  {users.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Projects Filter */}
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="w-[150px] bg-background border-input" data-testid="projects-filter">
                <Briefcase className="w-4 h-4 mr-2" />
                <SelectValue placeholder={t('reportTimeSheet.filters.projects')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('reportTimeSheet.filters.allProjects')}</SelectItem>
                {projects.map(project => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Tasks Filter */}
            <Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
              <SelectTrigger className="w-[150px] bg-background border-input" data-testid="tasks-filter">
                <Check className="w-4 h-4 mr-2" />
                <SelectValue placeholder={t('reportTimeSheet.filters.tasks')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('reportTimeSheet.filters.allTasks')}</SelectItem>
                {tasks.map(task => (
                  <SelectItem key={task.id} value={task.id}>
                    {task.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-card rounded-lg border border-border overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground flex justify-center items-center" data-testid="loading-state">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-foreground" data-testid="timesheet-table">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-6 py-3 text-left text-lg font-medium text-muted-foreground uppercase tracking-wider w-64 min-w-[200px] sticky left-0 bg-muted/50 z-10">
                      {/* {t('reportTimeSheet.table.grandTotal')} */}Users
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider min-w-[100px]">
                      {t('reportTimeSheet.table.grandTotal')}
                    </th>
                    {datesInView.map((date, index) => (
                      <th key={index} className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider min-w-[100px]">
                        <div>{formatDayName(date)}, {formatDate(date).replace(' ', ' ')}</div>
                      </th>
                    ))}
                  </tr>
                  <tr className="bg-muted/30 border-b border-border">
                    <th className="px-6 py-2 text-left text-xs font-medium text-muted-foreground sticky left-0 bg-muted/30 z-10 shadow-sm">
                      {/* {t('reportTimeSheet.table.totalHours')} */}
                    </th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-muted-foreground min-w-[100px]">
                      {t('reportTimeSheet.table.totalHours')}
                    </th>
                    {datesInView.map((_, index) => (
                      <th key={index} className="px-4 py-2 text-center text-xs font-medium text-muted-foreground min-w-[100px]">
                        {t('reportTimeSheet.table.totalHours')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border">
                  {Object.values(groupedData).map((userRow) => (
                    <React.Fragment key={userRow.id}>
                      {/* User Row */}
                      <tr className="bg-muted hover:bg-muted/80 transition-colors" data-testid={`user-row-${userRow.id}`}>
                        <td className="px-6 py-3 whitespace-nowrap sticky left-0 bg-muted z-10 shadow-sm border-r border-border">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleRow(`user-${userRow.id}`)}
                              className="text-muted-foreground hover:text-foreground"
                              data-testid={`expand-user-${userRow.id}`}
                            >
                              {expandedRows[`user-${userRow.id}`] ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRightIcon className="w-4 h-4" />
                              )}
                            </button>
                            <span className="font-medium text-foreground">{t('reportTimeSheet.table.userTotal', { name: userRow.name })}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-foreground border-r border-border border-dashed">
                          {formatHours(userRow.totalHours.reduce((a, b) => a + b, 0))}
                        </td>
                        {userRow.totalHours.map((hours, index) => (
                          <td key={index} className="px-4 py-3 text-center text-foreground border-r border-border border-dashed last:border-r-0">
                            {formatHours(hours)}
                          </td>
                        ))}
                      </tr>

                      {/* Project Rows */}
                      {expandedRows[`user-${userRow.id}`] && Object.values(userRow.projects).map((project) => (
                        <React.Fragment key={`${userRow.id}-${project.id}`}>
                          <tr className="bg-card hover:bg-muted/30 transition-colors">
                            <td className="px-6 py-3 whitespace-nowrap pl-12 sticky left-0 bg-card z-10 shadow-sm border-r border-border">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => toggleRow(`project-${userRow.id}-${project.id}`)}
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  {expandedRows[`project-${userRow.id}-${project.id}`] ? (
                                    <ChevronDown className="w-4 h-4" />
                                  ) : (
                                    <ChevronRightIcon className="w-4 h-4" />
                                  )}
                                </button>
                                <span className="text-sm font-medium text-foreground">{t('reportTimeSheet.table.projectTotal', { name: project.name })}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center font-semibold text-foreground border-r border-border border-dashed">
                              {formatHours(project.totalHours.reduce((a, b) => a + b, 0))}
                            </td>
                            {project.totalHours.map((hours, index) => (
                              <td key={index} className="px-4 py-3 text-center text-sm text-foreground border-r border-border border-dashed last:border-r-0">
                                {formatHours(hours)}
                              </td>
                            ))}
                          </tr>

                          {/* Task Rows */}
                          {expandedRows[`project-${userRow.id}-${project.id}`] && Object.values(project.tasks).map((task) => (
                            <tr key={`${userRow.id}-${project.id}-${task.id}`} className="bg-card hover:bg-muted/20 transition-colors">
                              <td className="px-6 py-3 whitespace-nowrap pl-20 sticky left-0 bg-card z-10 shadow-sm border-r border-border">
                                <span className="text-sm text-muted-foreground">{task.name}</span>
                              </td>
                              <td className="px-4 py-3 text-center font-medium text-foreground border-r border-border border-dashed">
                                {formatHours(task.totalHours.reduce((a, b) => a + b, 0))}
                              </td>
                              {task.totalHours.map((hours, index) => (
                                <td key={index} className="px-4 py-3 text-center text-sm text-muted-foreground border-r border-border border-dashed last:border-r-0">
                                  {formatHours(hours)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                    </React.Fragment>
                  ))}

                  {/* Grand Total Row */}
                  <tr className="bg-muted/70 font-bold border-t-2 border-border" data-testid="grand-total-row">
                    <td className="px-6 py-4 whitespace-nowrap sticky left-0 bg-muted/70 z-10 shadow-sm border-r border-border">
                      {t('reportTimeSheet.table.mainGrandTotal')}
                    </td>
                    <td className="px-4 py-4 text-center border-r border-border border-dashed">
                      {formatHours(grandTotals.reduce((a, b) => a + b, 0))}
                    </td>
                    {grandTotals.map((hours, index) => (
                      <td key={index} className="px-4 py-4 text-center border-r border-border border-dashed last:border-r-0">
                        {formatHours(hours)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
