import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const ReportsPage = () => {
  const { token, user } = useAuth();
  const { t } = useTranslation();
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    group_by: 'date',
    user_id: '',
    project_id: ''
  });
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchUsers();
    }
    fetchProjects();
  }, [user]);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/admin/employees`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(response.data.filter(u => u.role === 'employee'));
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
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
  };

  const generateReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        start_date: filters.start_date,
        end_date: filters.end_date,
        group_by: filters.group_by,
        ...(filters.user_id && { user_id: filters.user_id }),
        ...(filters.project_id && { project_id: filters.project_id })
      });

      const response = await axios.get(`${API}/reports/time?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReportData(response.data);
    } catch (error) {
      toast.error(t('reports.messages.failedToGenerate'));
    } finally {
      setLoading(false);
    }
  };

  const exportPDF = async () => {
    try {
      const params = new URLSearchParams({
        start_date: filters.start_date,
        end_date: filters.end_date,
        ...(filters.user_id && { user_id: filters.user_id })
      });

      const response = await axios.get(`${API}/reports/export/pdf?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `time_report_${filters.start_date}_${filters.end_date}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(t('reports.messages.pdfExported'));
    } catch (error) {
      toast.error(t('reports.messages.failedToExportPDF'));
    }
  };

  const exportCSV = async () => {
    try {
      const params = new URLSearchParams({
        start_date: filters.start_date,
        end_date: filters.end_date,
        ...(filters.user_id && { user_id: filters.user_id })
      });

      const response = await axios.get(`${API}/reports/export/csv?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `time_report_${filters.start_date}_${filters.end_date}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(t('reports.messages.csvExported'));
    } catch (error) {
      toast.error(t('reports.messages.failedToExportCSV'));
    }
  };

  return (
    <div className="space-y-6" data-testid="reports-page">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold tracking-tight" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          {t('reports.title')}
        </h1>
        <p className="text-base text-muted-foreground leading-relaxed mt-2">
          {t('reports.subtitle')}
        </p>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-4">{t('reports.filters')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">{t('reports.startDate')}</label>
            <Input
              type="date"
              value={filters.start_date}
              onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
              data-testid="filter-start-date"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">{t('reports.endDate')}</label>
            <Input
              type="date"
              value={filters.end_date}
              onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
              data-testid="filter-end-date"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">{t('reports.groupBy')}</label>
            <Select value={filters.group_by} onValueChange={(value) => setFilters({ ...filters, group_by: value })}>
              <SelectTrigger data-testid="filter-group-by">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">{t('reports.employee')}</SelectItem>
                <SelectItem value="project">{t('reports.project')}</SelectItem>
                <SelectItem value="task">{t('reports.task')}</SelectItem>
                <SelectItem value="date">{t('reports.date')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {user?.role === 'admin' && (
            <div>
              <label className="text-sm font-medium mb-2 block">{t('reports.employee')}</label>
              <Select value={filters.user_id || 'all'} onValueChange={(value) => setFilters({ ...filters, user_id: value === 'all' ? '' : value })}>
                <SelectTrigger data-testid="filter-user">
                  <SelectValue placeholder={t('reports.allEmployees')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('reports.allEmployees')}</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-4">
          <Button onClick={generateReport} disabled={loading} data-testid="generate-report-btn">
            {loading ? t('reports.generating') : t('reports.generateReport')}
          </Button>
          {reportData && (
            <>
              <Button variant="outline" onClick={exportPDF} data-testid="export-pdf-btn">
                <Download className="h-4 w-4 mr-2" />
                {t('reports.exportPDF')}
              </Button>
              <Button variant="outline" onClick={exportCSV} data-testid="export-csv-btn">
                <Download className="h-4 w-4 mr-2" />
                {t('reports.exportCSV')}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Report Results */}
      {reportData && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-6 border-b border-border">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                {t('reports.reportResults')}
              </h2>
              <div className="text-right">
                <div className="text-2xl font-bold">{reportData.summary.total_hours}h</div>
                <div className="text-sm text-muted-foreground">{t('reports.totalHours')}</div>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left" data-testid="report-results-table">
              <thead className="bg-muted/50 text-muted-foreground font-medium">
                <tr>
                  {(reportData?.filters?.group_by || filters.group_by) === 'user' && <th className="p-4 align-middle">{t('reports.employee')}</th>}
                  {(reportData?.filters?.group_by || filters.group_by) === 'project' && <th className="p-4 align-middle">{t('reports.project')}</th>}
                  {(reportData?.filters?.group_by || filters.group_by) === 'task' && <th className="p-4 align-middle">{t('reports.task')}</th>}
                  {(reportData?.filters?.group_by || filters.group_by) === 'date' && <th className="p-4 align-middle">{t('reports.date')}</th>}
                  <th className="p-4 align-middle">{t('reports.totalHours')}</th>
                  <th className="p-4 align-middle">{t('reports.entryCount')}</th>
                </tr>
              </thead>
              <tbody>
                {reportData.data.map((item, index) => (
                  <tr key={item.id || index} className="border-b border-border hover:bg-muted/20 transition-colors">
                    <td className="p-4 align-middle font-medium">
                      {(reportData?.filters?.group_by || filters.group_by) === 'date'
                        ? new Date(item.label).toLocaleDateString([], { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
                        : (item.label ?? '—')}
                    </td>
                    <td className="p-4 align-middle">{item.total_hours}h</td>
                    <td className="p-4 align-middle text-muted-foreground">{item.entry_count}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/30 font-semibold">
                <tr>
                  <td className="p-4 align-middle">{t('reports.total')}</td>
                  <td className="p-4 align-middle">{reportData.summary.total_hours}h</td>
                  <td className="p-4 align-middle">{reportData.summary.total_entries}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
