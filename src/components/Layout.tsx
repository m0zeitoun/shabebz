import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import TickerTape from './TickerTape';
import AnnouncementBanner from './AnnouncementBanner';

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <TickerTape />
      <AnnouncementBanner />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>
    </div>
  );
}
