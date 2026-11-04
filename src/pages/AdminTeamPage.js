import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Edit, FolderKanban, Search, Filter, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const AdminTeamPage = () => {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [showProjectsViewDialog, setShowProjectsViewDialog] = useState(false);
  const [employeeProjects, setEmployeeProjects] = useState([]);
  const [viewingEmployee, setViewingEmployee] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isViewingProjects, setIsViewingProjects] = useState(false);
  const [isOpeningAssignDialog, setIsOpeningAssignDialog] = useState(null); // id of employee
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    email: '',
    password: '',
    status: 'active',
    daily_hours: 8.0,
    default_project: 'none',
    default_task: 'none'
  });

  useEffect(() => {
    fetchEmployees();
    fetchProjects();
    fetchTasks();
  }, [statusFilter]);

  useEffect(() => {
    const filtered = employees.filter(emp => {
      const matchesSearch = emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.email.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
    setFilteredEmployees(filtered);
  }, [searchQuery, employees]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const statusParam = statusFilter === 'all' ? '' : `?status=${statusFilter}`;
      const response = await axios.get(`${API}/admin/employees${statusParam}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEmployees(response.data);
    } catch (error) {
      console.error('Failed to fetch employees:', error);
      if (error.response) {
        console.error('Error response data:', error.response.data);
      }
      toast.error(t('adminTeam.messages.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await axios.get(`${API}/projects`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProjects(response.data);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
  };

  const fetchTasks = async () => {
    try {
      const response = await axios.get(`${API}/tasks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTasks(response.data);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const submitData = {
        name: formData.name,
        email: formData.email,
        status: formData.status,
        daily_hours: parseFloat(formData.daily_hours) || 8.0,
        default_project: formData.default_project === 'none' ? null : formData.default_project,
        default_task: formData.default_task === 'none' ? null : formData.default_task
      };

      if (formData.password) {
        submitData.password = formData.password;
      }

      if (isEditing) {
        await axios.put(`${API}/admin/employees/${formData.id}`, submitData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success(t('adminTeam.messages.employeeUpdated'));
      } else {
        if (!formData.password) {
          toast.error(t('settings.passwordTooShort'));
          return;
        }
        submitData.password = formData.password;
        await axios.post(`${API}/admin/employees`, submitData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success(t('adminTeam.messages.employeeCreated'));
      }
      setShowDialog(false);
      resetForm();
      fetchEmployees();
    } catch (error) {
      console.error('Error:', error);
      const errorMsg = error.response?.data?.detail || t('adminTeam.messages.operationFailed');
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (employee) => {
    setFormData({
      id: employee.id,
      name: employee.name,
      email: employee.email,
      password: '',
      status: employee.status,
      daily_hours: employee.daily_hours || 8.0,
      default_project: employee.default_project || 'none',
      default_task: employee.default_task || 'none'
    });
    setIsEditing(true);
    setShowDialog(true);
  };

  const handleOpenAssignDialog = async (employee) => {
    setIsOpeningAssignDialog(employee.id);
    setSelectedEmployee(employee);
    // Fetch currently assigned projects
    try {
      const response = await axios.get(`${API}/admin/employees/${employee.id}/projects`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedProjects(response.data.map(p => p.id));
      setShowAssignDialog(true);
    } catch (error) {
      console.error('Failed to fetch assigned projects:', error);
      toast.error(t('adminTeam.messages.loadError'));
      setSelectedProjects([]);
    } finally {
      setIsOpeningAssignDialog(null);
    }
  };

  const handleAssignProjects = async () => {
    if (!selectedEmployee) return;
    setIsAssigning(true);

    try {
      await axios.post(
        `${API}/admin/employees/${selectedEmployee.id}/projects/assign`,
        { project_ids: selectedProjects },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(t('adminTeam.messages.projectsAssigned'));
      setShowAssignDialog(false);
      fetchEmployees();
    } catch (error) {
      console.error('Error assigning projects:', error);
      toast.error(t('adminTeam.messages.assignError'));
    } finally {
      setIsAssigning(false);
    }
  };

  const handleViewProjects = async (employee) => {
    setViewingEmployee(employee);
    setEmployeeProjects([]);
    setShowProjectsViewDialog(true);
    setIsViewingProjects(employee.id);

    try {
      const response = await axios.get(`${API}/admin/employees/${employee.id}/projects`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEmployeeProjects(response.data);
    } catch (error) {
      console.error('Failed to fetch assigned projects:', error);
      toast.error(t('adminTeam.messages.loadError'));
    } finally {
      setIsViewingProjects(null);
    }
  };

  const toggleProjectSelection = (projectId) => {
    setSelectedProjects(prev => {
      if (prev.includes(projectId)) {
        return prev.filter(id => id !== projectId);
      } else {
        return [...prev, projectId];
      }
    });
  };

  const resetForm = () => {
    setFormData({
      id: '',
      name: '',
      email: '',
      password: '',
      status: 'active',
      daily_hours: 8.0,
      default_project: 'none',
      default_task: 'none'
    });
    setIsEditing(false);
  };

  const openCreateDialog = () => {
    resetForm();
    setShowDialog(true);
  };

  return (
    <div className="space-y-6" data-testid="admin-team-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            {t('adminTeam.users')}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {/* <Button variant="outline" data-testid="import-btn">
            {t('adminTeam.import')}
          </Button> */}
          {/* <Button variant="outline" data-testid="export-btn">
            {t('adminTeam.export')}
          </Button> */}
          <Button onClick={openCreateDialog} data-testid="create-employee-btn">
            <Plus className="h-4 w-4 mr-2" />
            {t('adminTeam.addEmployee')}
          </Button>
        </div>
      </div>

      {/* Search and Filter Section */}
      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative w-full md:flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('adminTeam.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 w-full"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder={t('adminTeam.filter.showAll')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('adminTeam.filter.showAll')}</SelectItem>
              <SelectItem value="active">{t('adminTeam.filter.showActive')}</SelectItem>
              <SelectItem value="inactive">{t('adminTeam.filter.showInactive')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Employees Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left" data-testid="employees-table">
            <thead className="bg-muted/50 text-muted-foreground font-medium uppercase text-xs">
              <tr>
                <th className="p-4 align-middle">{t('adminTeam.table.name')}</th>
                <th className="p-4 align-middle">{t('adminTeam.table.role')}</th>
                <th className="p-4 align-middle">{t('adminTeam.table.status')}</th>
                <th className="p-4 align-middle">{t('adminTeam.table.projects')}</th>
                {/* <th className="p-4 align-middle">{t('adminTeam.table.dailyHours')}</th> */}
                <th className="p-4 align-middle">{t('adminTeam.table.actions')}</th>
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
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-muted-foreground">
                    {t('adminTeam.messages.noEmployees')}
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((employee) => (
                  <tr key={employee.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                    <td className="p-4 align-middle">
                      <div className="flex flex-col">
                        <span className="font-medium text-base">{employee.name}</span>
                        <span className="text-sm text-muted-foreground uppercase">{employee.email}</span>
                      </div>
                    </td>
                    <td className="p-4 align-middle">
                      <span className={`inline-flex items-center rounded-md px-3 py-1 text-xs font-semibold ${employee.role === 'admin'
                        ? 'bg-slate-700 text-white'
                        : 'bg-slate-100 text-slate-800'
                        }`}>
                        {employee.role === 'admin' ? t('adminTeam.roles.owner') : t('adminTeam.roles.normal')}
                      </span>
                    </td>
                    <td className="p-4 align-middle">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${employee.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                        {employee.status === 'active' ? t('adminTeam.status.activeLabel') : t('adminTeam.status.inactiveLabel')}
                      </span>
                    </td>
                    <td className="p-4 align-middle">
                      <button
                        onClick={() => handleViewProjects(employee)}
                        disabled={isViewingProjects === employee.id}
                        className="text-blue-600 font-medium hover:underline focus:outline-none flex items-center"
                      >
                        {isViewingProjects === employee.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          employee.project_count || 0
                        )}
                      </button>
                    </td>
                    {/* <td className="p-4 align-middle">
                      <span className="font-medium">
                        {employee.daily_hours ? Number(employee.daily_hours).toFixed(2) : '8.00'}
                      </span>
                    </td> */}
                    <td className="p-4 align-middle">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(employee)}
                          data-testid={`edit-employee-${employee.id}`}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          {t('adminTeam.buttons.edit')}
                        </Button>
                        {employee.role !== 'admin' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenAssignDialog(employee)}
                            disabled={isOpeningAssignDialog === employee.id}
                            data-testid={`assign-project-${employee.id}`}
                          >
                            {isOpeningAssignDialog === employee.id ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-1" />
                            ) : (
                              <FolderKanban className="h-4 w-4 mr-1" />
                            )}
                            {t('adminTeam.buttons.assignProject')}
                          </Button>
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

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Select defaultValue="10">
            <SelectTrigger className="w-16">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="text-sm text-muted-foreground">
          {t('adminTeam.pagination.pageInfo', { page: 1, totalPages: 1, count: filteredEmployees.length })}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled>1</Button>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent data-testid="employee-dialog">
          <DialogHeader>
            <DialogTitle>{isEditing ? t('adminTeam.dialog.editTitle') : t('adminTeam.dialog.createTitle')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div>
              <label className="text-sm font-medium mb-2 block">{t('adminTeam.dialog.name')}</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                data-testid="employee-name-input"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">{t('adminTeam.dialog.email')}</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                data-testid="employee-email-input"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                {t('adminTeam.dialog.password')} {isEditing && t('adminTeam.dialog.passwordHint')}
              </label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required={!isEditing}
                data-testid="employee-password-input"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">{t('adminTeam.dialog.status')}</label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger data-testid="employee-status-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t('adminTeam.status.activeLabel')}</SelectItem>
                  <SelectItem value="inactive">{t('adminTeam.status.inactiveLabel')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* <div>
              <label className="text-sm font-medium mb-2 block">{t('adminTeam.dialog.dailyHours')}</label>
              <Input
                type="number"
                step="0.5"
                min="0"
                max="24"
                value={formData.daily_hours}
                onChange={(e) => setFormData({ ...formData, daily_hours: e.target.value })}
                data-testid="employee-daily-hours-input"
              />
            </div> */}

            <div>
              <label className="text-sm font-medium mb-2 block">{t('adminTeam.dialog.defaultProject')}</label>
              <Select
                value={formData.default_project}
                onValueChange={(value) => setFormData({ ...formData, default_project: value })}
              >
                <SelectTrigger data-testid="employee-project-select">
                  <SelectValue placeholder={t('adminTeam.dialog.selectProject')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">{t('adminTeam.dialog.defaultTask')}</label>
              <Select
                value={formData.default_task}
                onValueChange={(value) => setFormData({ ...formData, default_task: value })}
              >
                <SelectTrigger data-testid="employee-task-select">
                  <SelectValue placeholder={t('adminTeam.dialog.selectTask')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {tasks.map((task) => (
                    <SelectItem key={task.id} value={task.id}>
                      {task.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" className="w-full" data-testid="employee-submit-btn" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? t('adminTeam.dialog.updateButton') : t('adminTeam.dialog.createButton')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assign Projects Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent data-testid="assign-projects-dialog">
          <DialogHeader>
            <DialogTitle>{t('adminTeam.dialog.assignProjectsTitle', { name: selectedEmployee?.name })}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="text-sm text-muted-foreground mb-4">
              {t('adminTeam.dialog.assignProjectsSubtitle')}
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {projects.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  {t('adminTeam.dialog.noProjectsAvailable')}
                </div>
              ) : (
                projects.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/20 cursor-pointer"
                    onClick={() => toggleProjectSelection(project.id)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedProjects.includes(project.id)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggleProjectSelection(project.id)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <div className="flex-1">
                      <div className="font-medium">{project.name}</div>
                      {project.description && (
                        <div className="text-sm text-muted-foreground">{project.description}</div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowAssignDialog(false)}
                className="flex-1"
              >
                {t('adminTeam.dialog.cancel')}
              </Button>
              <Button
                onClick={handleAssignProjects}
                className="flex-1"
                data-testid="assign-projects-submit-btn"
                disabled={isAssigning}
              >
                {isAssigning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {selectedProjects.length !== 1
                  ? t('adminTeam.dialog.assignButtonPlural', { count: selectedProjects.length })
                  : t('adminTeam.dialog.assignButton', { count: selectedProjects.length })}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Projects Dialog */}
      <Dialog open={showProjectsViewDialog} onOpenChange={setShowProjectsViewDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t('adminTeam.dialog.assignedProjectsFor', { name: viewingEmployee?.name })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {isViewingProjects ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              </div>
            ) : employeeProjects.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                {t('adminTeam.dialog.noProjectsAssigned')}
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {employeeProjects.map((project) => (
                  <div key={project.id} className="p-3 border rounded-lg bg-muted/20">
                    <div className="font-semibold">{project.name}</div>
                    {project.description && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {project.description}
                      </div>
                    )}
                    <div className="text-[10px] text-muted-foreground mt-2 italic">
                      {t('adminTeam.dialog.assignedOn')}: {new Date(project.assigned_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="pt-4">
              <Button
                className="w-full"
                variant="outline"
                onClick={() => setShowProjectsViewDialog(false)}
              >
                {t('common.close') || 'Close'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTeamPage;
