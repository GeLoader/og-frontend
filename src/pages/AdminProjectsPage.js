import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Edit, FolderKanban, ListChecks, Trash2, Loader2 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const AdminProjectsPage = () => {
  const { token } = useAuth();
  const { t } = useTranslation();
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [isEditingTask, setIsEditingTask] = useState(false);

  const [projectForm, setProjectForm] = useState({ id: '', name: '', description: '' });
  const [taskForm, setTaskForm] = useState({ id: '', name: '', description: '', project_id: '' });

  // Loading states
  const [isSubmittingProject, setIsSubmittingProject] = useState(false);
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);
  const [deletingProjectIds, setDeletingProjectIds] = useState([]);
  const [deletingTaskIds, setDeletingTaskIds] = useState([]);

  useEffect(() => {
    fetchProjects();
    fetchTasks();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await axios.get(`${API}/projects`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProjects(response.data);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setLoading(false);
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

  const handleProjectSubmit = async (e) => {
    e.preventDefault();
    setIsSubmittingProject(true);
    try {
      if (isEditingProject) {
        await axios.put(`${API}/projects/${projectForm.id}`, projectForm, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success(t('Project updated successfully'));
      } else {
        await axios.post(`${API}/projects`, projectForm, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success(t('Project created successfully'));
      }
      setShowProjectDialog(false);
      resetProjectForm();
      fetchProjects();
    } catch (error) {
      toast.error(t('Operation failed'));
    } finally {
      setIsSubmittingProject(false);
    }
  };

  const handleTaskSubmit = async (e) => {
    e.preventDefault();
    setIsSubmittingTask(true);
    try {
      if (isEditingTask) {
        await axios.put(`${API}/tasks/${taskForm.id}`, taskForm, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success(t('Task updated successfully'));
      } else {
        await axios.post(`${API}/tasks`, taskForm, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success(t('Task created successfully'));
      }
      setShowTaskDialog(false);
      resetTaskForm();
      fetchTasks();
    } catch (error) {
      toast.error(t('Operation failed'));
    } finally {
      setIsSubmittingTask(false);
    }
  };

  const handleDeleteProject = async (id) => {
    if (!window.confirm(t('Are you sure you want to delete this project?'))) return;

    setDeletingProjectIds(prev => [...prev, id]);
    try {
      await axios.delete(`${API}/projects/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(t('Project deleted successfully'));
      fetchProjects();
      fetchTasks(); // Refresh tasks as some might be affected
    } catch (error) {
      toast.error(t('Failed to delete project'));
    } finally {
      setDeletingProjectIds(prev => prev.filter(pid => pid !== id));
    }
  };

  const handleDeleteTask = async (id) => {
    if (!window.confirm(t('Are you sure you want to delete this task?'))) return;

    setDeletingTaskIds(prev => [...prev, id]);
    try {
      await axios.delete(`${API}/tasks/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(t('Task deleted successfully'));
      fetchTasks();
    } catch (error) {
      toast.error(t('Failed to delete task'));
    } finally {
      setDeletingTaskIds(prev => prev.filter(tid => tid !== id));
    }
  };

  const resetProjectForm = () => {
    setProjectForm({ id: '', name: '', description: '', status: 'active' });
    setIsEditingProject(false);
  };

  const resetTaskForm = () => {
    setTaskForm({ id: '', name: '', description: '', project_id: '', status: 'active' });
    setIsEditingTask(false);
  };

  const openCreateProject = () => {
    resetProjectForm();
    setShowProjectDialog(true);
  };

  const openEditProject = (project) => {
    setProjectForm({
      id: project.id,
      name: project.name,
      description: project.description || '',
      status: project.status || 'active' // keep the current status on update
    });
    setIsEditingProject(true);
    setShowProjectDialog(true);
  };

  const openCreateTask = () => {
    resetTaskForm();
    setShowTaskDialog(true);
  };

  const openEditTask = (task) => {
    setTaskForm({
      id: task.id,
      name: task.name,
      description: task.description || '',
      project_id: task.project_id,
      status: task.status || 'active' // keep the current status on update
    });
    setIsEditingTask(true);
    setShowTaskDialog(true);
  };

  return (
    <div className="space-y-6" data-testid="admin-projects-page">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold tracking-tight" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          {t('adminProjects.title')}
        </h1>
        <p className="text-base text-muted-foreground leading-relaxed mt-2">
          {t('adminProjects.subtitle')}
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="projects" className="w-full">
        <TabsList>
          <TabsTrigger value="projects" data-testid="projects-tab">
            <FolderKanban className="h-4 w-4 mr-2" />
            {t('adminProjects.tabs.projects')}
          </TabsTrigger>
          <TabsTrigger value="tasks" data-testid="tasks-tab">
            <ListChecks className="h-4 w-4 mr-2" />
            {t('adminProjects.tabs.tasks')}
          </TabsTrigger>
        </TabsList>

        {/* Projects Tab */}
        <TabsContent value="projects" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openCreateProject} data-testid="create-project-btn">
              <Plus className="h-4 w-4 mr-2" />
              {t('adminProjects.addProject')}
            </Button>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left" data-testid="projects-table">
                <thead className="bg-muted/50 text-muted-foreground font-medium">
                  <tr>
                    <th className="p-4 align-middle">{t('adminProjects.projectsTable.name')}</th>
                    <th className="p-4 align-middle">{t('adminProjects.projectsTable.description')}</th>
                    <th className="p-4 align-middle">{t('adminProjects.projectsTable.status')}</th>
                    <th className="p-4 align-middle text-right">{t('adminProjects.projectsTable.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="4" className="p-8 text-center text-muted-foreground">
                        <div className="flex justify-center items-center">
                          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                        </div>
                      </td>
                    </tr>
                  ) : projects.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="p-8 text-center text-muted-foreground">
                        {t('adminProjects.messages.noProjects')}
                      </td>
                    </tr>
                  ) : (
                    projects.map((project) => (
                      <tr key={project.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                        <td className="p-4 align-middle font-medium">{project.name}</td>
                        <td className="p-4 align-middle text-muted-foreground">{project.description || '-'}</td>
                        <td className="p-4 align-middle">
                          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-green-100 text-green-800">
                            {project.status}
                          </span>
                        </td>
                        <td className="p-4 align-middle text-right space-x-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditProject(project)}
                            data-testid={`edit-project-${project.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteProject(project.id)}
                            disabled={deletingProjectIds.includes(project.id)}
                            data-testid={`delete-project-${project.id}`}
                          >
                            {deletingProjectIds.includes(project.id) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openCreateTask} data-testid="create-task-btn">
              <Plus className="h-4 w-4 mr-2" />
              {t('adminProjects.addTask')}
            </Button>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left" data-testid="tasks-table">
                <thead className="bg-muted/50 text-muted-foreground font-medium">
                  <tr>
                    <th className="p-4 align-middle">{t('adminProjects.tasksTable.name')}</th>
                    <th className="p-4 align-middle">{t('adminProjects.tasksTable.project')}</th>
                    <th className="p-4 align-middle">{t('adminProjects.tasksTable.description')}</th>
                    <th className="p-4 align-middle">{t('adminProjects.tasksTable.status')}</th>
                    <th className="p-4 align-middle text-right">{t('adminProjects.tasksTable.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="5" className="p-8 text-center text-muted-foreground">
                        <div className="flex justify-center items-center">
                          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                        </div>
                      </td>
                    </tr>
                  ) : tasks.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="p-8 text-center text-muted-foreground">
                        {t('adminProjects.messages.noTasks')}
                      </td>
                    </tr>
                  ) : (
                    tasks.map((task) => {
                      const project = projects.find(p => p.id === task.project_id);
                      return (
                        <tr key={task.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                          <td className="p-4 align-middle font-medium">{task.name}</td>
                          <td className="p-4 align-middle">{project?.name || t('adminProjects.messages.unknownProject')}</td>
                          <td className="p-4 align-middle text-muted-foreground">{task.description || '-'}</td>
                          <td className="p-4 align-middle">
                            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-green-100 text-green-800">
                              {task.status}
                            </span>
                          </td>
                          <td className="p-4 align-middle text-right space-x-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEditTask(task)}
                              data-testid={`edit-task-${task.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeleteTask(task.id)}
                              disabled={deletingTaskIds.includes(task.id)}
                              data-testid={`delete-task-${task.id}`}
                            >
                              {deletingTaskIds.includes(task.id) ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
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
        </TabsContent>
      </Tabs>

      {/* Project Dialog */}
      <Dialog open={showProjectDialog} onOpenChange={setShowProjectDialog}>
        <DialogContent data-testid="project-dialog">
          <DialogHeader>
            <DialogTitle>{isEditingProject ? t('adminProjects.projectDialog.editTitle') : t('adminProjects.projectDialog.createTitle')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleProjectSubmit} className="space-y-4 pt-4">
            <div>
              <label className="text-sm font-medium mb-2 block">{t('adminProjects.projectDialog.name')}</label>
              <Input
                value={projectForm.name}
                onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                required
                data-testid="project-name-input"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">{t('adminProjects.projectDialog.description')}</label>
              <Textarea
                value={projectForm.description}
                onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                rows={3}
                data-testid="project-description-input"
              />
            </div>
            <Button type="submit" className="w-full" data-testid="project-submit-btn" disabled={isSubmittingProject}>
              {isSubmittingProject && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditingProject ? t('adminProjects.projectDialog.updateButton') : t('adminProjects.projectDialog.createButton')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Task Dialog */}
      <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
        <DialogContent data-testid="task-dialog">
          <DialogHeader>
            <DialogTitle>{isEditingTask ? t('adminProjects.taskDialog.editTitle') : t('adminProjects.taskDialog.createTitle')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleTaskSubmit} className="space-y-4 pt-4">
            <div>
              <label className="text-sm font-medium mb-2 block">{t('adminProjects.taskDialog.name')}</label>
              <Input
                value={taskForm.name}
                onChange={(e) => setTaskForm({ ...taskForm, name: e.target.value })}
                required
                data-testid="task-name-input"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">{t('adminProjects.taskDialog.project')}</label>
              <select
                value={taskForm.project_id}
                onChange={(e) => setTaskForm({ ...taskForm, project_id: e.target.value })}
                required
                className="w-full px-3 py-2 border border-input rounded-md"
                data-testid="task-project-select"
              >
                <option value="">{t('adminProjects.taskDialog.selectProject')}</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">{t('adminProjects.taskDialog.description')}</label>
              <Textarea
                value={taskForm.description}
                onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                rows={3}
                data-testid="task-description-input"
              />
            </div>
            <Button type="submit" className="w-full" data-testid="task-submit-btn" disabled={isSubmittingTask}>
              {isSubmittingTask && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditingTask ? t('adminProjects.taskDialog.updateButton') : t('adminProjects.taskDialog.createButton')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
