import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';

const TimerContext = createContext();

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const TimerProvider = ({ children }) => {
  const { user, token } = useAuth();
  const [activeTimer, setActiveTimer] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [onStopCallbacks, setOnStopCallbacks] = useState([]);

  // Use ref to store the start time to avoid dependency issues
  const startTimeRef = useRef(null);

  // Load active timer on mount, and reset everything when the session ends
  useEffect(() => {
    if (user && token) {
      checkActiveTimer();
    } else {
      setActiveTimer(null);
      setIsRunning(false);
      setElapsed(0);
      startTimeRef.current = null;
    }
  }, [user, token]);

  // Timer tick - FIXED: Use startTimeRef to avoid activeTimer dependency issues
  useEffect(() => {
    let interval;
    if (isRunning && startTimeRef.current) {
      interval = setInterval(() => {
        const start = new Date(startTimeRef.current).getTime();
        const now = Date.now();
        setElapsed(Math.floor((now - start) / 1000));
      }, 1000);
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isRunning]); // Only depend on isRunning, not activeTimer

  // Heartbeat every 30 seconds
  useEffect(() => {
    let heartbeat;
    if (isRunning && token) {
      heartbeat = setInterval(async () => {
        try {
          await axios.post(`${API}/timer/heartbeat`, {}, {
            headers: { Authorization: `Bearer ${token}` }
          });
        } catch (error) {
          console.error('Heartbeat failed:', error);
        }
      }, 30000);
    }
    return () => {
      if (heartbeat) {
        clearInterval(heartbeat);
      }
    };
  }, [isRunning, token]);

  const checkActiveTimer = async () => {
    try {
      const response = await axios.get(`${API}/timer/active`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data && response.data.id) {
        setActiveTimer(response.data);
        setIsRunning(true);
        // Store start time in ref
        startTimeRef.current = response.data.start_time;
        const start = new Date(response.data.start_time).getTime();
        const now = Date.now();
        setElapsed(Math.floor((now - start) / 1000));
      } else {
        // Server says there is no running timer -> clear any stale local state
        setActiveTimer(null);
        setIsRunning(false);
        setElapsed(0);
        startTimeRef.current = null;
      }
    } catch (error) {
      console.error('Failed to check active timer:', error);
    }
  };

  const startTimer = async (projectId, taskId) => {
    try {
      const response = await axios.post(
        `${API}/timer/start`,
        { project_id: projectId, task_id: taskId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setActiveTimer(response.data);
      setIsRunning(true);
      // Store start time in ref
      startTimeRef.current = response.data.start_time;
      setElapsed(0);
      toast.success('Timer started');
      return { success: true };
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to start timer');
      return { success: false };
    }
  };

  const stopTimer = async (notes = '') => {
    try {
      await axios.post(
        `${API}/timer/stop`,
        { notes },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setActiveTimer(null);
      setIsRunning(false);
      setElapsed(0);
      // Clear start time ref
      startTimeRef.current = null;
      toast.success('Timer stopped');

      // Trigger all registered callbacks
      onStopCallbacks.forEach(callback => {
        try {
          callback();
        } catch (error) {
          console.error('Error in timer stop callback:', error);
        }
      });

      return { success: true };
    } catch (error) {
      // The timer no longer exists on the server -> stop the zombie local timer
      if (error.response?.status === 404) {
        setActiveTimer(null);
        setIsRunning(false);
        setElapsed(0);
        startTimeRef.current = null;
        toast.error('No active timer found on the server');
        return { success: false };
      }
      toast.error(error.response?.data?.detail || 'Failed to stop timer');
      return { success: false };
    }
  };

  const registerOnStopCallback = useCallback((callback) => {
    setOnStopCallbacks(prev => [...prev, callback]);
    // Return cleanup function
    return () => {
      setOnStopCallbacks(prev => prev.filter(cb => cb !== callback));
    };
  }, []);

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <TimerContext.Provider
      value={{
        activeTimer,
        elapsed,
        isRunning,
        startTimer,
        stopTimer,
        formatTime,
        refreshTimer: checkActiveTimer,
        registerOnStopCallback
      }}
    >
      {children}
    </TimerContext.Provider>
  );
};

export const useTimer = () => {
  const context = useContext(TimerContext);
  if (!context) {
    throw new Error('useTimer must be used within TimerProvider');
  }
  return context;
};