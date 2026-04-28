import { createBrowserRouter, Navigate } from 'react-router-dom';
import MainLayout from '../../shared/layout/MainLayout';
import LoginPage from '../../pages/Login/login';
import ResetPasswordPage from '../../pages/Login/ResetPassword';
import DashboardPage from '../../pages/Dashboard/Dashboard';
import HomePage from '../../pages/Home/Home';
import AdminPage from '../../pages/Admin/Admin';
import ScreenPage from '../../pages/Screen/Screen';
import { AuthGuard } from './AuthGuard';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/reset-password',
    element: <ResetPasswordPage />,
  },
  {
    path: '/home',
    element: (
      <AuthGuard>
        <HomePage />
      </AuthGuard>
    ),
  },
  {
    path: '/',
    element: (
      <AuthGuard>
        <MainLayout />
      </AuthGuard>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
    ],
  },
  {
    path: '/admin',
    element: (
      <AuthGuard>
        <MainLayout />
      </AuthGuard>
    ),
    children: [
      { index: true, element: <AdminPage /> },
    ],
  },
  {
    path: '/screen/:campaignId',
    element: (
      <AuthGuard>
        <ScreenPage />
      </AuthGuard>
    ),
  },
  {
    path: '*',
    element: <Navigate to="/home" replace />,
  },
]);
