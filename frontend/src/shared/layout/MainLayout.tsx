import { Outlet } from 'react-router-dom';
import TopBar from './topbar/TopBar';
import Sidebar from './sidebar/Sidebar';
import './MainLayout.css';

export default function MainLayout() {
  return (
    <div className="layout">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <TopBar />
      <div className="layout__body">
        <Sidebar />
        <main className="content" id="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
